import type { KBlock, KEdge, KGroup } from '../emit/builder.js'
import type { SourceMapEntry } from '../emit/context.js'

// Pos-passada de otimizacao (F4). Cada transformacao tem precondicao explicita e
// nunca altera mensagens, chamadas, eventos, suspensoes ou destinos:
//
//  1. Dedupe de derivadas: uma linha `setVariable("__eq_x" ...)` (ou __ci_/__dec_/mat_ nao
//     aleatoria) identica a uma ja calculada no mesmo trecho linear, sem que a variavel de
//     origem tenha sido escrita no meio, e redundante. "Trecho linear" = ate um bloco que seja
//     destino de aresta (entrada alternativa) ou o fim do grupo.
//  2. Fusao de Codes gerados adjacentes, quando o segundo nao le variaveis que o primeiro
//     escreve (o Code le um retrato das variaveis na entrada do bloco).
//
// Scripts de origem (Code com nome diferente de "gerado") nunca sao tocados.

interface Doc {
  groups: KGroup[]
  edges: KEdge[]
  variables: { id: string; name: string }[]
}

export interface OptimizeStats {
  derivedLinesRemoved: number
  codeBlocksRemoved: number
  codeBlocksMerged: number
}

const GENERATED = 'gerado'
const DERIVED = /^(__eq_|__ci_|__dec_|mat_(?!rnd_))/
const SET_VAR = /setVariable\("([^"]+)"/g
const PLACEHOLDER = /\{\{([^{}]*)\}\}/g

const isGenerated = (b: KBlock): boolean => b.type === 'Code' && (b.options as { name?: string } | undefined)?.name === GENERATED
const content = (b: KBlock): string => String((b.options as { content?: unknown }).content ?? '')
const setNames = (src: string): string[] => [...src.matchAll(SET_VAR)].map((m) => m[1] as string)
const reads = (src: string): Set<string> => new Set([...src.matchAll(PLACEHOLDER)].map((m) => (m[1] ?? '').trim()))
const isHelper = (line: string): boolean => line.startsWith('const __')
const derivedTarget = (line: string): string | undefined => {
  const m = /^setVariable\("([^"]+)"|^\(function[\s\S]*?setVariable\("([^"]+)"/.exec(line)
  return m ? (m[1] ?? m[2]) : undefined
}

export function optimizeDocument(doc: Doc, sourceMap: SourceMapEntry[] = []): OptimizeStats {
  const stats: OptimizeStats = { derivedLinesRemoved: 0, codeBlocksRemoved: 0, codeBlocksMerged: 0 }
  const incoming = new Set(doc.edges.flatMap((e) => (e.to.blockId ? [e.to.blockId] : [])))
  const varName = new Map(doc.variables.map((v) => [v.id, v.name]))
  const removed = new Map<string, string | undefined>() // id removido -> bloco que o substitui

  const writesOf = (b: KBlock): string[] => {
    const o = (b.options ?? {}) as Record<string, unknown>
    switch (b.type) {
      case 'Set variable': return [varName.get(String(o.variableId)) ?? '', ...(o.isCode === true ? setNames(String(o.expressionToEvaluate ?? '')) : [])]
      case 'Code': return setNames(content(b))
      case 'Webhook': return ['api_status', 'api_response', 'api_ok']
      case 'whatsapp-cloud': return o.awaitReply === true ? [varName.get(String(o.replyVariableId)) ?? '', 'last_message'] : []
      default: return []
    }
  }

  // 1. Dedupe de derivadas, com fluxo de dados dentro de cada grupo: o estado "fresco" na entrada
  // de um bloco e a intersecao do estado de saida dos antecessores (bloco anterior, se houver
  // queda sequencial, e origens de arestas que partem de blocos anteriores do mesmo grupo).
  // Qualquer entrada vinda de fora do grupo, ou do inicio do grupo, comeca vazia.
  const edgesTo = new Map<string, KEdge[]>()
  for (const e of doc.edges) if (e.to.blockId) edgesTo.set(e.to.blockId, [...(edgesTo.get(e.to.blockId) ?? []), e])
  const NO_FALLTHROUGH = new Set(['Typebot link', 'endSession', 'transferToQueue', 'Jump', 'Return'])
  type Fresh = Map<string, { line: string; deps: Set<string> }>
  const meet = (states: Fresh[]): Fresh => {
    const [first, ...rest] = states
    const out: Fresh = new Map()
    if (!first) return out
    for (const [k, v] of first) if (rest.every((s) => s.get(k)?.line === v.line)) out.set(k, v)
    return out
  }

  for (const g of doc.groups) {
    const blocks = g.blocks
    const position = new Map(blocks.map((b, i) => [b.id, i]))
    const outStates: Fresh[] = []
    const dropped = new Set<KBlock>()
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i] as KBlock
      // Antecessores dentro do grupo.
      const preds: number[] = []
      let unknown = i === 0
      const prev = blocks[i - 1]
      if (i > 0 && prev && !prev.outgoingEdgeId && !NO_FALLTHROUGH.has(prev.type)) preds.push(i - 1)
      for (const e of edgesTo.get(b.id) ?? []) {
        const j = e.from.blockId === undefined ? undefined : position.get(e.from.blockId)
        if (j !== undefined && j < i) preds.push(j)
        else unknown = true
      }
      let fresh: Fresh = unknown || preds.length === 0 ? new Map() : meet([...new Set(preds)].map((p) => outStates[p] as Fresh))
      fresh = new Map(fresh)

      if (isGenerated(b) && !b.outgoingEdgeId) {
        const lines = content(b).split('\n')
        const kept: string[] = []
        for (const line of lines) {
          const target = derivedTarget(line)
          if (target && DERIVED.test(target) && fresh.get(target)?.line === line) {
            stats.derivedLinesRemoved++
            continue
          }
          kept.push(line)
        }
        if (kept.filter((l) => !isHelper(l)).length === 0) {
          dropped.add(b)
          removed.set(b.id, undefined)
          stats.codeBlocksRemoved++
          outStates[i] = fresh
          continue
        }
        if (kept.length !== lines.length) (b.options as { content: string }).content = kept.join('\n')
      }
      // Escritas deste bloco invalidam derivadas que dependem delas; derivadas novas ficam frescas.
      const w = new Set(writesOf(b))
      for (const [k, v] of [...fresh]) if ([...v.deps].some((d) => w.has(d)) || w.has(k)) fresh.delete(k)
      if (isGenerated(b)) {
        for (const line of content(b).split('\n')) {
          const target = derivedTarget(line)
          if (target && DERIVED.test(target)) fresh.set(target, { line, deps: reads(line) })
        }
      }
      outStates[i] = fresh
    }
    // Bloco redundante que e destino de aresta: religa a aresta ao proximo bloco que sobrar;
    // sem ele, o bloco fica (redundante, mas inofensivo).
    for (const d of [...dropped]) {
      const targets = edgesTo.get(d.id) ?? []
      if (targets.length === 0) continue
      const next = blocks.slice(blocks.indexOf(d) + 1).find((x) => !dropped.has(x))
      if (!next) {
        dropped.delete(d)
        removed.delete(d.id)
        stats.codeBlocksRemoved--
        continue
      }
      for (const e of targets) e.to = { ...e.to, blockId: next.id }
      edgesTo.set(next.id, [...(edgesTo.get(next.id) ?? []), ...targets])
    }
    if (dropped.size > 0) g.blocks = blocks.filter((b) => !dropped.has(b))
  }
  const incomingNow = new Set(doc.edges.flatMap((e) => (e.to.blockId ? [e.to.blockId] : [])))
  incoming.clear()
  for (const id of incomingNow) incoming.add(id)

  // 2. Fusao de Codes gerados adjacentes
  for (const g of doc.groups) {
    for (let i = 0; i < g.blocks.length - 1; ) {
      const a = g.blocks[i] as KBlock
      const b = g.blocks[i + 1] as KBlock
      if (isGenerated(a) && isGenerated(b) && !a.outgoingEdgeId && !incoming.has(b.id)) {
        const written = new Set(setNames(content(a)))
        const needs = reads(content(b))
        if (![...needs].some((n) => written.has(n))) {
          const helpers = new Set<string>()
          const body: string[] = []
          for (const line of [...content(a).split('\n'), ...content(b).split('\n')]) (isHelper(line) ? helpers.add(line) : body.push(line))
          ;(a.options as { content: string }).content = [...helpers, ...body].join('\n')
          if (b.outgoingEdgeId) {
            a.outgoingEdgeId = b.outgoingEdgeId
            const e = doc.edges.find((x) => x.id === b.outgoingEdgeId)
            if (e) e.from = { ...e.from, blockId: a.id }
          }
          g.blocks.splice(i + 1, 1)
          removed.set(b.id, a.id)
          stats.codeBlocksMerged++
          continue
        }
      }
      i++
    }
  }

  // Mapa de origem: blocos removidos saem; fundidos apontam para o bloco que os absorveu.
  if (removed.size > 0) {
    for (const e of sourceMap) {
      e.target.blockKeys = e.target.blockKeys.flatMap((id) => (removed.has(id) ? (removed.get(id) ? [removed.get(id) as string] : []) : [id]))
    }
  }
  return stats
}
