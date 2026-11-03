import type { KBlock, KEdge, KGroup } from '../emit/builder.js'
import type { SourceMapEntry } from '../emit/context.js'

// Descarte de variaveis sem leitor (F4-b). A Blip mantem muitas gravacoes que so alimentam relatorios
// (estado anterior, respostas e status de chamadas, campos de contato); no Kayros elas viram blocos
// `Set variable` que ninguem consome e engordam o JSON a ser importado. Regras:
//
//  - Um `Set variable` so sai se a variavel nao e lida por nenhum bloco VIVO do proprio fluxo
//    (`{{x}}` em qualquer texto, comparacao de Condition, Code) e nao e lida por outro bot do
//    pacote (`protectedNames`). A busca e por ponto fixo: `state_previous_id = {{state_id}}` morre
//    primeiro e so entao `state_id` deixa de ter leitor.
//  - Nunca sai bloco que carrega aresta, que e origem ou destino de aresta, nem o ultimo bloco de um grupo.
//  - Codes (de origem ou gerados) nao sao tocados: um `setVariable(...)` dentro deles continua
//    valendo mesmo sem leitor.
//  - `variablesToPass` dos Typebot link passa a listar so o que o bot de destino pode herdar:
//    variaveis declaradas, nao internas (`__eq_`, `__ci_`, `__dec_`, `mat_`: o destino as recalcula
//    antes de ler) e lidas por algum outro bot do pacote (`passNames`).

interface Doc {
  groups: KGroup[]
  edges: KEdge[]
  variables: { id: string; name: string }[]
}

export interface PruneStats {
  setBlocksRemoved: number
  variablesRemoved: number
  passedNamesRemoved: number
  /** Nomes das variaveis cujas gravacoes foram descartadas. */
  discarded: string[]
}

export interface PruneOptions {
  /** Variaveis que nunca podem ser descartadas (lidas por outro bot, contexto de redirect, config). */
  protectedNames?: ReadonlySet<string>
  /** Nomes que algum outro bot do pacote le: so estes vale levar no `variablesToPass`. Omitido: todas as nao internas. */
  passNames?: ReadonlySet<string>
}

const PLACEHOLDER = /\{\{([^{}]*)\}\}/g
const SET_VAR = /setVariable\("([^"]+)"/g
const INTERNAL = /^(__eq_|__ci_|__dec_|mat_(?!rnd_))/
/** Escritas implicitas do runtime/emissor: continuam declaradas mesmo sem referencia no JSON. */
const IMPLICIT = new Set(['api_status', 'api_response', 'api_ok', 'last_message', 'input_content', 'timeout_state'])

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function placeholders(v: unknown, into: Set<string>): void {
  if (typeof v === 'string') {
    for (const m of v.matchAll(PLACEHOLDER)) {
      const n = (m[1] ?? '').trim()
      if (n !== '' && !n.startsWith('resource.') && !n.startsWith('=')) into.add(n)
    }
  } else if (Array.isArray(v)) for (const x of v) placeholders(x, into)
  else if (isObj(v)) for (const x of Object.values(v)) placeholders(x, into)
}

export function pruneUnreadVariables(doc: Doc, opts: PruneOptions = {}, sourceMap: SourceMapEntry[] = []): PruneStats {
  const protectedNames = opts.protectedNames ?? new Set<string>()
  const nameOf = new Map(doc.variables.map((v) => [v.id, v.name]))
  const edgeSources = new Set(doc.edges.flatMap((e) => (e.from.blockId ? [e.from.blockId] : [])))
  const edgeTargets = new Set(doc.edges.flatMap((e) => (e.to.blockId ? [e.to.blockId] : [])))
  const removedIds = new Set<string>()
  const discarded = new Set<string>()

  const target = (b: KBlock): string => nameOf.get(String((b.options as { variableId?: unknown }).variableId)) ?? ''
  // Set variable em modo codigo grava varias variaveis por `setVariable`: nunca e gravacao descartavel pelo alvo.
  const isCodeSet = (b: KBlock): boolean => b.type === 'Set variable' && (b.options as { isCode?: unknown } | undefined)?.isCode === true
  const isSet = (b: KBlock): boolean => b.type === 'Set variable' && !isCodeSet(b)

  /** Nomes lidos por um bloco (escritas nao contam). */
  const readsOf = (b: KBlock): Set<string> => {
    const out = new Set<string>()
    const o = b.options ?? {}
    if (isSet(b)) placeholders((o as { expressionToEvaluate?: unknown }).expressionToEvaluate, out)
    else if (b.type === 'Typebot link') placeholders((o as { typebotId?: unknown }).typebotId, out)
    else if (b.type === 'Webhook') {
      const { responseVariableMapping: _w, ...rest } = o as Record<string, unknown>
      placeholders(rest, out)
    } else placeholders(o, out)
    for (const it of b.items ?? []) {
      const comps = isObj(it.content) && Array.isArray(it.content.comparisons) ? it.content.comparisons : []
      for (const c of comps) {
        if (!isObj(c)) continue
        const n = nameOf.get(String(c.variableId))
        if (n) out.add(n)
        placeholders(c.value, out)
      }
    }
    return out
  }

  const blocks = doc.groups.flatMap((g) => g.blocks)
  const cache = new Map(blocks.map((b) => [b.id, readsOf(b)]))

  for (;;) {
    // Quem le o que, entre os blocos que continuam no fluxo. Um Set que le a propria variavel nao a mantem viva.
    const live = new Set<string>(protectedNames)
    for (const g of doc.groups) {
      for (const b of g.blocks) {
        if (removedIds.has(b.id)) continue
        const self = isSet(b) ? target(b) : undefined
        for (const n of cache.get(b.id) ?? []) if (n !== self) live.add(n)
      }
    }
    let changed = false
    for (const g of doc.groups) {
      const dead = g.blocks.filter((b) => !removedIds.has(b.id) && isSet(b) && !b.outgoingEdgeId && !edgeSources.has(b.id) && !edgeTargets.has(b.id) && target(b) !== '' && !live.has(target(b)))
      const remaining = g.blocks.filter((b) => !removedIds.has(b.id)).length
      // Um grupo nunca fica vazio: sobra o ultimo bloco morto.
      const drop = dead.length >= remaining ? dead.slice(0, -1) : dead
      for (const b of drop) {
        removedIds.add(b.id)
        discarded.add(target(b))
        changed = true
      }
    }
    if (!changed) break
  }

  for (const g of doc.groups) g.blocks = g.blocks.filter((b) => !removedIds.has(b.id))

  // Declaracoes: fica o que ainda e referenciado (leitura, escrita, Code) ou e implicito/protegido.
  const referenced = new Set<string>([...protectedNames, ...IMPLICIT])
  for (const g of doc.groups) {
    for (const b of g.blocks) {
      for (const n of readsOf(b)) referenced.add(n)
      const o = b.options ?? {}
      const w = nameOf.get(String((o as { variableId?: unknown }).variableId))
      if (w) referenced.add(w)
      const rv = nameOf.get(String((o as { replyVariableId?: unknown }).replyVariableId))
      if (rv) referenced.add(rv)
      const map = (o as { responseVariableMapping?: unknown }).responseVariableMapping
      if (Array.isArray(map)) for (const m of map) if (isObj(m) && nameOf.get(String(m.variableId))) referenced.add(nameOf.get(String(m.variableId)) as string)
      if (b.type === 'Code') for (const m of String((o as { content?: unknown }).content ?? '').matchAll(SET_VAR)) referenced.add(m[1] as string)
      if (isCodeSet(b)) for (const m of String((o as { expressionToEvaluate?: unknown }).expressionToEvaluate ?? '').matchAll(SET_VAR)) referenced.add(m[1] as string)
    }
  }
  const before = doc.variables.length
  doc.variables = doc.variables.filter((v) => referenced.has(v.name))
  const declared = new Set(doc.variables.map((v) => v.name))

  let passedNamesRemoved = 0
  const passable = doc.variables.map((v) => v.name).filter((n) => !INTERNAL.test(n) && (!opts.passNames || opts.passNames.has(n) || protectedNames.has(n)))
  for (const b of doc.groups.flatMap((g) => g.blocks)) {
    if (b.type !== 'Typebot link') continue
    const o = b.options as { variablesToPass?: string[] }
    if (!Array.isArray(o.variablesToPass)) continue
    const next = passable.filter((n) => declared.has(n))
    passedNamesRemoved += o.variablesToPass.length - next.length
    o.variablesToPass = next
  }

  if (removedIds.size > 0) for (const e of sourceMap) e.target.blockKeys = e.target.blockKeys.filter((id) => !removedIds.has(id))

  return { setBlocksRemoved: removedIds.size, variablesRemoved: before - doc.variables.length, passedNamesRemoved, discarded: [...discarded].sort() }
}
