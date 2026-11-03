import { type Diagnostic, diagnostic } from '../diagnostics.js'
import { EVENT_TYPES, SUPPORTED_BLOCK_TYPES } from './kayros-current-adapted.js'

// Validador estrutural minimo do nucleo executavel (spec 5.2): quatro colecoes,
// ids unicos e ponteiros outgoingEdgeId coerentes com edges. Validacoes de
// variaveis usadas, itens de menu e links entre arquivos entram na F2-09.

interface Obj {
  [k: string]: unknown
}
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

export function validateKayrosDocument(doc: unknown): Diagnostic[] {
  const out: Diagnostic[] = []
  const bad = (msg: string, ptr?: string) => {
    out.push(diagnostic('KAYROS_STRUCTURE_INVALID', msg, ptr))
  }

  if (!isObj(doc)) return [diagnostic('KAYROS_STRUCTURE_INVALID', 'Documento nao e um objeto.', '')]
  for (const k of ['groups', 'edges', 'variables', 'events'] as const) {
    if (!Array.isArray(doc[k])) bad(`Colecao obrigatoria ausente ou invalida: ${k}.`, `/${k}`)
  }
  if (out.length) return out
  const groups = doc.groups as unknown[]
  const edges = doc.edges as unknown[]
  const events = doc.events as unknown[]
  const variables = doc.variables as unknown[]

  const ids = new Map<string, string>()
  const claim = (id: unknown, ptr: string) => {
    if (typeof id !== 'string' || id === '') return bad('Id ausente ou nao textual.', ptr)
    const prev = ids.get(id)
    if (prev) bad(`Id duplicado ${id} (ja usado em ${prev}).`, ptr)
    else ids.set(id, ptr)
  }

  const groupIds = new Set<string>()
  const blockToGroup = new Map<string, string>()
  const blockPointer = new Map<string, string | undefined>()
  groups.forEach((g, gi) => {
    if (!isObj(g)) return bad('Grupo invalido.', `/groups/${gi}`)
    claim(g.id, `/groups/${gi}/id`)
    if (typeof g.id === 'string') groupIds.add(g.id)
    if (!Array.isArray(g.blocks)) return bad('Grupo sem lista de blocos.', `/groups/${gi}/blocks`)
    g.blocks.forEach((b: unknown, bi: number) => {
      const ptr = `/groups/${gi}/blocks/${bi}`
      if (!isObj(b)) return bad('Bloco invalido.', ptr)
      claim(b.id, `${ptr}/id`)
      if (typeof b.id === 'string') {
        blockToGroup.set(b.id, String(g.id))
        blockPointer.set(b.id, typeof b.outgoingEdgeId === 'string' ? b.outgoingEdgeId : undefined)
      }
      if (!(SUPPORTED_BLOCK_TYPES as readonly string[]).includes(String(b.type))) {
        out.push(
          diagnostic('KAYROS_BLOCK_TYPE_UNSUPPORTED', `Tipo de bloco fora do perfil: ${String(b.type)}.`, `${ptr}/type`),
        )
      }
    })
  })

  const eventPointer = new Map<string, string | undefined>()
  let hasStart = false
  events.forEach((e, ei) => {
    const ptr = `/events/${ei}`
    if (!isObj(e)) return bad('Evento invalido.', ptr)
    claim(e.id, `${ptr}/id`)
    if (!(EVENT_TYPES as readonly string[]).includes(String(e.type))) {
      bad(`Tipo de evento desconhecido: ${String(e.type)}.`, `${ptr}/type`)
    }
    if (e.type === 'start') hasStart = true
    if (typeof e.id === 'string') {
      eventPointer.set(e.id, typeof e.outgoingEdgeId === 'string' ? e.outgoingEdgeId : undefined)
    }
  })
  if (!hasStart) bad('Evento start ausente.', '/events')

  variables.forEach((v, vi) => {
    if (!isObj(v)) return bad('Variavel invalida.', `/variables/${vi}`)
    claim(v.id, `/variables/${vi}/id`)
    if (typeof v.name !== 'string' || v.name === '') bad('Variavel sem nome.', `/variables/${vi}/name`)
  })

  const edgeById = new Map<string, Obj>()
  edges.forEach((e, ei) => {
    const ptr = `/edges/${ei}`
    if (!isObj(e)) return bad('Aresta invalida.', ptr)
    claim(e.id, `${ptr}/id`)
    if (typeof e.id === 'string') edgeById.set(e.id, e)
    const { from, to } = e
    if (!isObj(from)) bad('Aresta sem origem.', `${ptr}/from`)
    else {
      const src = from.eventId ?? from.blockId
      if (typeof src !== 'string') bad('Origem sem eventId/blockId.', `${ptr}/from`)
      else if (from.eventId !== undefined ? !eventPointer.has(src) : !blockToGroup.has(src)) {
        bad(`Origem inexistente: ${src}.`, `${ptr}/from`)
      }
    }
    if (!isObj(to) || typeof to.groupId !== 'string' || !groupIds.has(to.groupId)) {
      out.push(diagnostic('TARGET_EDGE_INVALID', 'Destino da aresta aponta para grupo inexistente.', `${ptr}/to`))
    } else if (typeof to.blockId === 'string' && blockToGroup.get(to.blockId) !== to.groupId) {
      out.push(diagnostic('TARGET_EDGE_INVALID', 'blockId de destino nao pertence ao grupo de destino.', `${ptr}/to`))
    }
  })

  // Ponteiros outgoingEdgeId precisam existir e partir do proprio bloco/evento.
  const checkPointer = (owner: string, key: 'blockId' | 'eventId', edgeId: string | undefined) => {
    if (edgeId === undefined) return
    const edge = edgeById.get(edgeId)
    const from = edge && isObj(edge.from) ? edge.from : undefined
    if (!edge || from?.[key] !== owner) {
      out.push(
        diagnostic('TARGET_EDGE_INVALID', `outgoingEdgeId ${edgeId} ausente ou nao parte de ${owner}.`, `${key}:${owner}`),
      )
    }
  }
  // transferToQueue: a saida "Fora do horario" e uma aresta `from:{blockId}` apontada por options.outOfHoursEdgeId.
  groups.forEach((g) => {
    if (!isObj(g) || !Array.isArray(g.blocks)) return
    for (const b of g.blocks) {
      if (isObj(b) && isObj(b.options) && typeof b.options.outOfHoursEdgeId === 'string' && typeof b.id === 'string') checkPointer(b.id, 'blockId', b.options.outOfHoursEdgeId)
    }
  })
  for (const [id, p] of blockPointer) checkPointer(id, 'blockId', p)
  for (const [id, p] of eventPointer) checkPointer(id, 'eventId', p)
  return out
}
