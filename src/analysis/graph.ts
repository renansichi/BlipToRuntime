import type { BotSource, Json, JsonObject } from '../ingest/package.js'
import type { Inventory, StateRecord } from './types.js'

// Grafo interno e entre bots (F1-06). Destinos calculados nao sao descartados:
// cada saida dinamica recebe o conjunto conservador de valores constantes
// escritos no mesmo bot (spec 9.3) e a indicacao de se o conjunto fechou.

const isObj = (v: Json | undefined): v is JsonObject => typeof v === 'object' && v !== null && !Array.isArray(v)

export interface LiteralEdge {
  bot: string
  from: string
  to: string
  pointer: string
}

export interface DynamicTarget {
  bot: string
  from: string
  pointer: string
  /** Nome da variavel dentro de `{{ }}`. */
  variable: string
  /** Valores constantes atribuidos a variavel por SetVariable no mesmo bot. */
  constants: string[]
  /** Constantes que sao ids de estado do bot (destinos candidatos). */
  candidateStateIds: string[]
  /** Escritas nao constantes (script, HTTP, interpolacao, comando) ou ausentes. */
  nonConstantWriters: number
  /** true somente se todas as escritas sao constantes e todas resolvem a um estado. */
  complete: boolean
}

export interface RedirectEdge {
  bot: string
  from: string
  address: string
  hasContext: boolean
  pointer: string
}

export interface BotGraph {
  bot: string
  roots: string[]
  literalEdges: number
  danglingLiteral: LiteralEdge[]
  /** Estados nao alcancaveis por arestas literais + candidatos dinamicos a partir da raiz (informativo; nao implica remocao). */
  unreachableByStaticEdges: string[]
  /** Componentes fortemente conexos com ciclo (tamanho > 1 ou auto-laco). */
  cycles: string[][]
}

export interface GraphResult {
  bots: BotGraph[]
  dynamicTargets: DynamicTarget[]
  redirects: RedirectEdge[]
  /** alias -> bots de origem e ocorrencias (nenhum alias e ligado a um bot por semelhanca de nome). */
  aliases: { address: string; occurrences: number; fromBots: string[]; withContext: number }[]
  channelSignals: { bot: string; stateId: string; pointer: string; signal: string }[]
}

const CHANNEL_WORDS = /whatsapp|webchat|facebook|messenger|instagram|\brcs\b|telegram/i

export function buildGraph(bots: BotSource[], inv: Inventory): GraphResult {
  const byBot = new Map<string, StateRecord[]>()
  for (const s of inv.states) {
    const l = byBot.get(s.bot) ?? []
    l.push(s)
    byBot.set(s.bot, l)
  }

  const result: GraphResult = { bots: [], dynamicTargets: [], redirects: [], aliases: [], channelSignals: [] }

  for (const bot of bots) {
    const states = byBot.get(bot.name) ?? []
    const ids = new Set(states.map((s) => s.stateId))

    // Escritas por variavel de contexto neste bot.
    const consts = new Map<string, string[]>()
    const nonConst = new Map<string, number>()
    const note = (variable: string, value: string | undefined) => {
      if (value !== undefined && !value.includes('{{')) {
        const l = consts.get(variable) ?? []
        l.push(value)
        consts.set(variable, l)
      } else nonConst.set(variable, (nonConst.get(variable) ?? 0) + 1)
    }
    const collect = (list: Json | undefined) => {
      if (!Array.isArray(list)) return
      for (const a of list) {
        if (!isObj(a) || !isObj(a.settings)) continue
        const s = a.settings
        const v = (k: string) => (typeof s[k] === 'string' ? (s[k] as string) : undefined)
        if (a.type === 'SetVariable' && v('variable')) note(v('variable') as string, v('value'))
        else if ((a.type === 'ExecuteScript' || a.type === 'ExecuteScriptV2') && v('outputVariable')) note(v('outputVariable') as string, undefined)
        else if (a.type === 'ProcessHttp') {
          if (v('responseStatusVariable')) note(v('responseStatusVariable') as string, undefined)
          if (v('responseBodyVariable')) note(v('responseBodyVariable') as string, undefined)
        } else if (a.type === 'ProcessCommand' && v('variable')) note(v('variable') as string, undefined)
      }
    }
    for (const raw of Object.values(bot.flow)) {
      if (!isObj(raw)) continue
      collect(raw.$enteringCustomActions)
      collect(raw.$leavingCustomActions)
      collect(raw.$afterStateChangedActions)
    }
    if (bot.globalActions) {
      collect(bot.globalActions.$enteringCustomActions)
      collect(bot.globalActions.$leavingCustomActions)
    }

    const literal: LiteralEdge[] = []
    const adj = new Map<string, Set<string>>()
    const addAdj = (a: string, b: string) => {
      const s = adj.get(a) ?? new Set<string>()
      s.add(b)
      adj.set(a, s)
    }
    for (const st of states) {
      for (const e of st.exits) {
        if (e.kind === 'literal') {
          literal.push({ bot: bot.name, from: st.stateId, to: e.target, pointer: e.pointer })
          if (ids.has(e.target)) addAdj(st.stateId, e.target)
        } else {
          const variable = e.target.replace(/^\{\{\s*|\s*\}\}$/g, '').trim()
          const constants = [...new Set(consts.get(variable) ?? [])]
          const candidateStateIds = constants.filter((c) => ids.has(c))
          const nc = nonConst.get(variable) ?? 0
          result.dynamicTargets.push({
            bot: bot.name,
            from: st.stateId,
            pointer: e.pointer,
            variable,
            constants,
            candidateStateIds,
            nonConstantWriters: nc,
            complete: constants.length > 0 && nc === 0 && candidateStateIds.length === constants.length,
          })
          for (const c of candidateStateIds) addAdj(st.stateId, c)
        }
      }
    }

    const roots = states.filter((s) => s.root).map((s) => s.stateId)
    const seen = new Set<string>(roots)
    const stack = [...roots]
    while (stack.length) {
      const n = stack.pop() as string
      for (const m of adj.get(n) ?? []) if (!seen.has(m)) { seen.add(m); stack.push(m) }
    }

    result.bots.push({
      bot: bot.name,
      roots,
      literalEdges: literal.length,
      danglingLiteral: literal.filter((l) => !ids.has(l.to)),
      unreachableByStaticEdges: states.filter((s) => !seen.has(s.stateId)).map((s) => s.stateId),
      cycles: stronglyConnected(states.map((s) => s.stateId), adj).filter(
        (c) => c.length > 1 || (c[0] !== undefined && adj.get(c[0])?.has(c[0])),
      ),
    })
  }

  // Redirects entre bots: enderecos continuam sem destino confirmado.
  const agg = new Map<string, { occurrences: number; from: Set<string>; ctx: number }>()
  for (const a of inv.actions) {
    if (a.type !== 'Redirect' || !a.address) continue
    result.redirects.push({
      bot: a.ref.bot,
      from: a.ref.stateId ?? '',
      address: a.address,
      hasContext: a.hasContext === true,
      pointer: a.ref.jsonPointer,
    })
    const r = agg.get(a.address) ?? { occurrences: 0, from: new Set<string>(), ctx: 0 }
    r.occurrences++
    r.from.add(a.ref.bot)
    if (a.hasContext) r.ctx++
    agg.set(a.address, r)
  }
  result.aliases = [...agg]
    .map(([address, r]) => ({ address, occurrences: r.occurrences, fromBots: [...r.from].sort(), withContext: r.ctx }))
    .sort((a, b) => a.address.localeCompare(b.address))

  // Sinais de canal em condicoes (informativo; nenhum caminho e retirado).
  for (const bot of bots) {
    for (const [id, raw] of Object.entries(bot.flow)) {
      if (!isObj(raw) || !Array.isArray(raw.$conditionOutputs)) continue
      raw.$conditionOutputs.forEach((o, i) => {
        if (!isObj(o) || !Array.isArray(o.conditions)) return
        o.conditions.forEach((c, j) => {
          if (!isObj(c)) return
          const text = [c.variable, ...(Array.isArray(c.values) ? c.values : [])].filter((x) => typeof x === 'string').join(' ')
          const m = CHANNEL_WORDS.exec(text)
          if (m) {
            result.channelSignals.push({
              bot: bot.name,
              stateId: id,
              pointer: `/configuracoes_gerais/fluxo/flow/${id}/$conditionOutputs/${i}/conditions/${j}`,
              signal: m[0].toLowerCase(),
            })
          }
        })
      })
    }
  }
  return result
}

/** Tarjan iterativo (sem recursao, grafos de ate centenas de nos). */
export function stronglyConnected(nodes: string[], adj: Map<string, Set<string>>): string[][] {
  let index = 0
  const idx = new Map<string, number>()
  const low = new Map<string, number>()
  const onStack = new Set<string>()
  const stack: string[] = []
  const out: string[][] = []

  for (const start of nodes) {
    if (idx.has(start)) continue
    const work: { n: string; it: Iterator<string> }[] = []
    const enter = (n: string) => {
      idx.set(n, index)
      low.set(n, index)
      index++
      stack.push(n)
      onStack.add(n)
      work.push({ n, it: (adj.get(n) ?? new Set<string>()).values() })
    }
    enter(start)
    while (work.length) {
      const top = work[work.length - 1] as { n: string; it: Iterator<string> }
      const next = top.it.next()
      if (!next.done) {
        const m = next.value
        if (!idx.has(m)) enter(m)
        else if (onStack.has(m)) low.set(top.n, Math.min(low.get(top.n) as number, idx.get(m) as number))
      } else {
        work.pop()
        const parent = work[work.length - 1]
        if (parent) low.set(parent.n, Math.min(low.get(parent.n) as number, low.get(top.n) as number))
        if (low.get(top.n) === idx.get(top.n)) {
          const comp: string[] = []
          let m: string
          do {
            m = stack.pop() as string
            onStack.delete(m)
            comp.push(m)
          } while (m !== top.n)
          out.push(comp)
        }
      }
    }
  }
  return out
}
