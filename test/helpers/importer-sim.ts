import { randomUUID } from 'node:crypto'

// Replica FIEL do que o importador do Kayros OS faz (kayros-os/src/features/builder/api/
// regenerate-bot-structure.ts, mode "import"), lida do codigo em 02/11/2026:
//  - regenera TODOS os ids (grupos, blocos, eventos, itens de Condition, botoes/linhas, variaveis);
//  - reescreve variableId em Set variable, Condition, whatsapp-cloud (reply/response), Webhook (mapeamentos);
//  - grava as arestas SO com to.groupId (DESCARTA to.blockId);
//  - reescreve os ponteiros *EdgeId; edges orfas sao descartadas;
//  - NAO remapeia Jump (options.groupId/blockId) nem Typebot link;
//  - acrescenta as variaveis de sessao que faltarem.
// Serve para testar que o que o conversor emite sobrevive a importacao.

type Obj = Record<string, any>

const SESSION = ['wa_id', 'user_name', 'channel', 'channel_phone', 'user_id', 'initial_message', 'initial_channel', 'template_name', 'session_origin']

export function importLikeKayrosOs(src: Obj): Obj {
  const ids = new Map<string, string>()
  const rekey = (old: string): string => {
    let n = ids.get(old)
    if (!n) ids.set(old, (n = randomUUID()))
    return n
  }
  const varRef = (v: unknown): string => (typeof v === 'string' && v && ids.has(v) ? (ids.get(v) as string) : '')

  const imported = (src.variables as Obj[]).filter((v) => typeof v?.name === 'string')
  const names = new Set(imported.map((v) => v.name as string))
  const variables = [
    ...SESSION.filter((n) => !names.has(n)).map((n) => ({ id: randomUUID(), name: n, isSessionVariable: true })),
    ...imported.map((v) => ({ ...v, id: rekey(v.id) })),
  ]

  const events = (src.events as Obj[]).map((e) => ({ ...e, id: rekey(e.id) }))

  const groups = (src.groups as Obj[]).map((g) => {
    const gid = rekey(g.id)
    const blocks = (g.blocks as Obj[]).map((b) => {
      const nb: Obj = { ...b, id: rekey(b.id) }
      if (b.type === 'Set variable' && b.options) nb.options = { ...b.options, variableId: varRef(b.options.variableId) }
      if (b.type === 'Webhook' && b.options && Array.isArray(b.options.responseVariableMapping)) {
        nb.options = { ...b.options, responseVariableMapping: b.options.responseVariableMapping.map((m: Obj) => ({ ...m, variableId: varRef(m.variableId) })) }
      }
      if (b.type === 'Condition' && Array.isArray(b.items)) {
        nb.items = b.items.map((it: Obj) => ({
          ...it,
          id: rekey(it.id),
          content: { ...it.content, comparisons: (it.content?.comparisons ?? []).map((c: Obj) => ({ ...c, id: randomUUID(), variableId: varRef(c.variableId) })) },
        }))
      }
      if (b.type === 'whatsapp-cloud' && b.options) {
        const o: Obj = { ...b.options }
        if ('replyVariableId' in o) o.replyVariableId = varRef(o.replyVariableId)
        if ('responseVariableId' in o) o.responseVariableId = varRef(o.responseVariableId)
        if (Array.isArray(o.buttons)) o.buttons = o.buttons.map((x: Obj) => ({ ...x, id: rekey(x.id) }))
        if (Array.isArray(o.sections)) o.sections = o.sections.map((s: Obj) => ({ ...s, rows: (s.rows ?? []).map((r: Obj) => ({ ...r, id: rekey(r.id) })) }))
        nb.options = o
      }
      return nb
    })
    return { ...g, id: gid, blocks }
  })

  const edgeIds = new Map<string, string>()
  const edges: Obj[] = []
  for (const e of src.edges as Obj[]) {
    const from: Obj = e.from
    let nf: Obj
    if (typeof from.eventId === 'string') {
      const m = ids.get(from.eventId)
      if (!m) continue
      nf = { eventId: m }
    } else if (typeof from.blockId === 'string') {
      const m = ids.get(from.blockId)
      if (!m) continue
      nf = { blockId: m }
      if (typeof from.itemId === 'string' && ids.has(from.itemId)) nf.itemId = ids.get(from.itemId)
    } else continue
    const mg = ids.get(e.to.groupId)
    if (!mg) continue
    const nid = randomUUID()
    edgeIds.set(e.id, nid)
    edges.push({ id: nid, from: nf, to: { groupId: mg } }) // <- to.blockId DESCARTADO
  }

  const rewrite = (v: any): any => {
    if (Array.isArray(v)) return v.map(rewrite)
    if (v === null || typeof v !== 'object') return v
    const out: Obj = {}
    for (const [k, x] of Object.entries(v)) {
      if (k.endsWith('EdgeId') && typeof x === 'string') {
        const m = edgeIds.get(x)
        if (m) out[k] = m
        continue
      }
      out[k] = rewrite(x)
    }
    return out
  }
  return { name: `${src.name} (importado)`, events: rewrite(events), groups: rewrite(groups), edges, variables }
}
