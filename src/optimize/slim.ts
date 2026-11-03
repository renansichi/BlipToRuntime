import type { KBlock, KEdge, KEvent, KGroup, KVariable } from '../emit/builder.js'
import { type PruneOptions, type PruneStats, pruneUnreadVariables } from './prune.js'

// Versao ENXUTA de um documento (so para testes de homologacao, onde o tamanho do JSON importado
// importa). Nao muda o comportamento a partir da entrada:
//
//  1. descarta grupos inalcancaveis: a busca parte das arestas dos eventos (start/followUp) e
//     segue toda aresta (`outgoingEdgeId` de bloco, item, botao ou linha de lista); como todo salto
//     de grupo e uma aresta, o que nao e alcancado nunca executa;
//  2. repete o descarte de variaveis sem leitor (os leitores podem ter ido embora com os grupos);
//  3. troca cada id estrutural (id, *EdgeId, variableId, blockId...) por um id curto. O importador
//     do Kayros OS regenera todos os ids, entao os originais so ligam referencias dentro do arquivo.
//     Textos e valores nao sao tocados, mesmo quando sao UUID (id de estado, midia, queueId).

export interface SlimDoc {
  name: string
  groups: KGroup[]
  events: KEvent[]
  variables: KVariable[]
  edges: KEdge[]
}

export interface SlimStats extends PruneStats {
  groupsRemoved: number
  edgesRemoved: number
  idsShortened: number
  /** id original -> id curto. */
  idMap: ReadonlyMap<string, string>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
/**
 * Campos estruturais que carregam um id do arquivo (o proprio id e as referencias a ele). So eles
 * sao encurtados: qualquer texto ou valor (mesmo um UUID, como id de estado ou de midia) fica como
 * esta. `queueId` e `typebotId` sao valores reais da plataforma e tambem ficam.
 */
const ID_KEYS = new Set(['id', 'variableId', 'replyVariableId', 'responseVariableId', 'blockId', 'itemId', 'eventId', 'groupId'])

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function edgeIdsIn(v: unknown, into: string[]): void {
  if (Array.isArray(v)) for (const x of v) edgeIdsIn(x, into)
  else if (isObj(v)) {
    if (typeof v.outgoingEdgeId === 'string') into.push(v.outgoingEdgeId)
    // Saida "Fora do horario" do transferToQueue: a aresta parte do bloco e o id fica em options.
    if (typeof v.outOfHoursEdgeId === 'string') into.push(v.outOfHoursEdgeId)
    for (const x of Object.values(v)) edgeIdsIn(x, into)
  }
}

function dropUnreachable(doc: SlimDoc): { groups: number; edges: number } {
  const edge = new Map(doc.edges.map((e) => [e.id, e]))
  const next = new Map<string, Set<string>>()
  for (const g of doc.groups) {
    const ids: string[] = []
    for (const b of g.blocks) edgeIdsIn(b, ids)
    next.set(g.id, new Set(ids.flatMap((id) => (edge.get(id) ? [(edge.get(id) as KEdge).to.groupId] : []))))
  }
  const roots = doc.events.flatMap((e) => (e.outgoingEdgeId && edge.get(e.outgoingEdgeId) ? [(edge.get(e.outgoingEdgeId) as KEdge).to.groupId] : []))
  const seen = new Set(roots)
  const stack = [...roots]
  while (stack.length > 0) {
    for (const t of next.get(stack.pop() as string) ?? []) if (!seen.has(t)) (seen.add(t), stack.push(t))
  }
  const gone = doc.groups.filter((g) => !seen.has(g.id))
  const goneBlocks = new Set(gone.flatMap((g) => g.blocks.map((b: KBlock) => b.id)))
  const goneItems = new Set(gone.flatMap((g) => g.blocks.flatMap((b: KBlock) => (b.items ?? []).map((i) => i.id))))
  const edgesBefore = doc.edges.length
  doc.groups = doc.groups.filter((g) => seen.has(g.id))
  doc.edges = doc.edges.filter((e) => !(e.from.blockId && goneBlocks.has(e.from.blockId)) && !(e.from.itemId && goneItems.has(e.from.itemId)))
  return { groups: gone.length, edges: edgesBefore - doc.edges.length }
}

/** Troca cada id estrutural por um id curto e estavel (ordem de aparicao). Devolve o mapa. */
function shortenIds(doc: SlimDoc): Map<string, string> {
  const map = new Map<string, string>()
  const token = (u: string): string => {
    let t = map.get(u)
    if (!t) map.set(u, (t = `x${map.size.toString(36)}`))
    return t
  }
  const isIdKey = (k: string): boolean => ID_KEYS.has(k) || k.endsWith('EdgeId')
  const walk = (v: unknown, key = ''): unknown => {
    if (typeof v === 'string') return isIdKey(key) && UUID.test(v) ? token(v) : v
    if (Array.isArray(v)) return v.map((x) => walk(x, key))
    if (isObj(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, k)]))
    return v
  }
  const out = walk(doc) as SlimDoc
  doc.groups = out.groups
  doc.events = out.events
  doc.variables = out.variables
  doc.edges = out.edges
  return map
}

export function slimDocument(doc: SlimDoc, opts: PruneOptions = {}): SlimStats {
  const dropped = dropUnreachable(doc)
  const pruned = pruneUnreadVariables(doc, opts)
  const idMap = shortenIds(doc)
  return { ...pruned, groupsRemoved: dropped.groups, edgesRemoved: dropped.edges, idsShortened: idMap.size, idMap }
}
