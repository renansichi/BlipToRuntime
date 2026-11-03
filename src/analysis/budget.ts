import type { KBlock, KEdge, KGroup } from '../emit/builder.js'
import { TARGET_LIMITS } from '../profile/kayros-current-adapted.js'

// Orcamento por passada (F5-06). Uma passada vai de um ponto de entrada (start, followUp ou a
// retomada depois de um awaitReply) ate a proxima suspensao ou fim. O motor corta a passada
// que passar de MAX_OUTBOUND_PER_PASS mensagens ou MAX_EXTERNAL_CALLS_PER_PASS chamadas
// externas (e de PASS_DEADLINE_MS), encerrando a sessao. Aqui medimos o pior caminho de cada
// passada no fluxo EMITIDO. Ramos exclusivos nao se somam: e o maximo sobre caminhos.

interface Doc {
  groups: KGroup[]
  edges: KEdge[]
  events: { id: string; type: string; outgoingEdgeId?: string }[]
}

export interface PassMetrics {
  /** Descricao do ponto de partida (evento ou grupo do awaitReply). */
  start: string
  outbound: number
  externalCalls: number
  /** Houve ciclo sem suspensao (o motor encerraria a sessao pelo teto). */
  cycle: boolean
}

export interface BudgetReport {
  passes: number
  maxOutbound: number
  maxExternalCalls: number
  cycles: number
  /** Passadas acima dos tetos do motor. */
  exceeding: PassMetrics[]
  /** As cinco passadas com mais chamadas externas (para revisao de latencia). */
  heaviest: PassMetrics[]
}

export function analyzePassBudget(doc: Doc): BudgetReport {
  const blockInfo = new Map<string, { block: KBlock; group: KGroup; index: number }>()
  for (const g of doc.groups) g.blocks.forEach((block, index) => blockInfo.set(block.id, { block, group: g, index }))
  const edges = new Map(doc.edges.map((e) => [e.id, e]))
  const groups = new Map(doc.groups.map((g) => [g.id, g]))

  const targetOf = (edgeId: string | undefined): string | undefined => {
    const e = edgeId ? edges.get(edgeId) : undefined
    if (!e) return undefined
    if (e.to.blockId) return e.to.blockId
    return groups.get(e.to.groupId)?.blocks[0]?.id
  }
  const nextInGroup = (id: string): string | undefined => {
    const i = blockInfo.get(id)
    return i ? i.group.blocks[i.index + 1]?.id : undefined
  }
  const TERMINAL = new Set(['Typebot link', 'endSession', 'transferToQueue', 'Return'])
  const awaits = (b: KBlock) => b.type === 'whatsapp-cloud' && (b.options as { awaitReply?: boolean } | undefined)?.awaitReply === true
  const isMessage = (b: KBlock) => b.type === 'whatsapp-cloud'
  const isExternal = (b: KBlock) => b.type === 'Webhook' || b.type === 'database' || b.type === 'kayros-tools' || b.type === 'askAgent'

  /** Sucessores na MESMA passada (um awaitReply encerra a passada; a retomada e outra passada). */
  const successors = (id: string): string[] => {
    const info = blockInfo.get(id)
    if (!info) return []
    const b = info.block
    if (awaits(b) || TERMINAL.has(b.type)) return []
    const out: string[] = []
    if (b.type === 'Condition') {
      for (const it of b.items ?? []) {
        const t = targetOf(it.outgoingEdgeId)
        if (t) out.push(t)
      }
      const t = targetOf(b.outgoingEdgeId) ?? (b.outgoingEdgeId ? undefined : nextInGroup(id))
      if (t) out.push(t)
      return out
    }
    if (b.type === 'Jump') {
      const o = (b.options ?? {}) as { groupId?: string; blockId?: string }
      const t = o.blockId ?? (o.groupId ? groups.get(o.groupId)?.blocks[0]?.id : undefined)
      return t ? [t] : []
    }
    const t = b.outgoingEdgeId ? targetOf(b.outgoingEdgeId) : nextInGroup(id)
    return t ? [t] : []
  }

  type Memo = { outbound: number; external: number; cycle: boolean }
  const memo = new Map<string, Memo>()
  const stack = new Set<string>()
  const longest = (id: string): Memo => {
    const cached = memo.get(id)
    if (cached) return cached
    if (stack.has(id)) return { outbound: 0, external: 0, cycle: true }
    stack.add(id)
    const b = (blockInfo.get(id) as { block: KBlock }).block
    let best: Memo = { outbound: 0, external: 0, cycle: false }
    for (const s of successors(id)) {
      const r = longest(s)
      best = { outbound: Math.max(best.outbound, r.outbound), external: Math.max(best.external, r.external), cycle: best.cycle || r.cycle }
    }
    stack.delete(id)
    const res: Memo = {
      outbound: best.outbound + (isMessage(b) ? 1 : 0),
      external: best.external + (isExternal(b) ? 1 : 0),
      cycle: best.cycle,
    }
    memo.set(id, res)
    return res
  }

  const starts: { label: string; block: string }[] = []
  for (const e of doc.events) {
    if (e.type !== 'start' && e.type !== 'followUp') continue
    const t = targetOf(e.outgoingEdgeId)
    if (t) starts.push({ label: `evento ${e.type}`, block: t })
  }
  for (const [id, info] of blockInfo) {
    if (!awaits(info.block)) continue
    // Retomada: segue a aresta do bloco ou o proximo bloco do grupo.
    const t = info.block.outgoingEdgeId ? targetOf(info.block.outgoingEdgeId) : nextInGroup(id)
    if (t) starts.push({ label: `apos aguardar resposta em "${info.group.title}"`, block: t })
  }

  const passes: PassMetrics[] = starts.map((s) => {
    const r = longest(s.block)
    return { start: s.label, outbound: r.outbound, externalCalls: r.external, cycle: r.cycle }
  })
  return {
    passes: passes.length,
    maxOutbound: Math.max(0, ...passes.map((p) => p.outbound)),
    maxExternalCalls: Math.max(0, ...passes.map((p) => p.externalCalls)),
    cycles: passes.filter((p) => p.cycle).length,
    exceeding: passes.filter((p) => p.outbound > TARGET_LIMITS.passMaxOutbound || p.externalCalls > TARGET_LIMITS.passMaxExternalCalls),
    heaviest: [...passes].sort((x, y) => y.externalCalls - x.externalCalls || y.outbound - x.outbound).slice(0, 5),
  }
}
