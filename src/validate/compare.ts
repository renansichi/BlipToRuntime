import { createHash } from 'node:crypto'

// Conferencia do rascunho IMPORTADO (F3-08): compara o JSON exportado do Kayros OS depois da importacao
// com o JSON gerado. O importador regenera todos os ids, entao a comparacao ignora ids e compara a
// FORMA: por grupo (titulo), a sequencia de tipos de bloco, o conteudo das opcoes sem ids e os grupos de
// destino das arestas. Variaveis extras de sessao injetadas pelo importador sao esperadas.

interface Obj {
  [k: string]: unknown
}
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

const ID_KEY = /(^id$|Id$|Ids$|EdgeId$)/

/** Remove, em qualquer profundidade, campos de identidade (ids regenerados pelo importador). */
function stripIds(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stripIds)
  if (!isObj(v)) return v
  const out: Obj = {}
  for (const k of Object.keys(v).sort()) if (!ID_KEY.test(k)) out[k] = stripIds(v[k])
  return out
}

const short = (v: unknown): string => createHash('sha1').update(JSON.stringify(v) ?? 'null').digest('hex').slice(0, 8)

function groupSignatures(doc: Obj): string[] {
  const groups = arr(doc.groups).filter(isObj)
  const title = new Map(groups.map((g) => [String(g.id), String(g.title)]))
  const edges = new Map(arr(doc.edges).filter(isObj).map((e) => [String(e.id), e]))
  const dest = (edgeId: unknown): string => {
    const e = typeof edgeId === 'string' ? edges.get(edgeId) : undefined
    return e && isObj(e.to) ? (title.get(String(e.to.groupId)) ?? '?') : '-'
  }
  return groups.map((g) => {
    const blocks = arr(g.blocks).filter(isObj).map((b) => {
      const items = arr(b.items).filter(isObj).map((it) => `${short(stripIds(it.content))}>${dest(it.outgoingEdgeId)}`)
      return `${String(b.type)}:${short(stripIds(b.options))}>${dest(b.outgoingEdgeId)}[${items.join(',')}]`
    })
    return `${String(g.title)} :: ${blocks.join(' ; ')}`
  })
}

export interface Comparison {
  ok: boolean
  differences: string[]
  groups: { generated: number; exported: number }
}

export function compareDocuments(generated: unknown, exported: unknown): Comparison {
  const diffs: string[] = []
  const g = isObj(generated) ? generated : {}
  const e = isObj(exported) ? exported : {}

  const gs = groupSignatures(g)
  const es = groupSignatures(e)
  const count = (l: string[]) => {
    const m = new Map<string, number>()
    for (const s of l) m.set(s, (m.get(s) ?? 0) + 1)
    return m
  }
  const cg = count(gs)
  const ce = count(es)
  for (const [s, n] of cg) {
    const m = ce.get(s) ?? 0
    if (m < n) diffs.push(`Grupo ausente ou alterado no exportado (${n - m}x): ${s.slice(0, 160)}`)
  }
  for (const [s, n] of ce) {
    const m = cg.get(s) ?? 0
    if (m < n) diffs.push(`Grupo a mais ou alterado no exportado (${n - m}x): ${s.slice(0, 160)}`)
  }

  const names = (d: Obj) => new Set(arr(d.variables).filter(isObj).map((v) => String(v.name)))
  const en = names(e)
  for (const n of names(g)) if (!en.has(n)) diffs.push(`Variavel ausente no exportado: ${n}`)

  const evTypes = (d: Obj) => arr(d.events).filter(isObj).map((x) => String(x.type)).sort().join(',')
  if (evTypes(g) !== evTypes(e)) diffs.push(`Eventos diferentes: gerado [${evTypes(g)}] x exportado [${evTypes(e)}]`)

  if (arr(g.edges).length !== arr(e.edges).length) diffs.push(`Quantidade de arestas diferente: gerado ${arr(g.edges).length} x exportado ${arr(e.edges).length}`)

  return { ok: diffs.length === 0, differences: diffs, groups: { generated: gs.length, exported: es.length } }
}
