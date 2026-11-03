import { type Diagnostic, diagnostic } from '../diagnostics.js'
import { TARGET_LIMITS } from '../profile/kayros-current-adapted.js'

// Validacao de referencias do documento emitido (F2-09), alem da estrutura em
// profile/validate-document.ts: variaveis declaradas, ids de variavel/grupo/
// bloco existentes, itens de Condition com saida, limites de menus.

interface Obj {
  [k: string]: unknown
}
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const PLACEHOLDER = /\{\{([^{}]*)\}\}/g
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function validateReferences(doc: unknown): Diagnostic[] {
  const out: Diagnostic[] = []
  if (!isObj(doc)) return out
  const bad = (msg: string, ptr: string) => out.push(diagnostic('KAYROS_REFERENCE_INVALID', msg, ptr))

  const variables = Array.isArray(doc.variables) ? doc.variables.filter(isObj) : []
  const varIds = new Set(variables.map((v) => String(v.id)))
  const varNames = new Set(variables.map((v) => String(v.name)))
  const groups = Array.isArray(doc.groups) ? doc.groups.filter(isObj) : []
  const groupIds = new Set(groups.map((g) => String(g.id)))
  const blockGroup = new Map<string, string>()
  for (const g of groups) for (const b of Array.isArray(g.blocks) ? g.blocks : []) if (isObj(b)) blockGroup.set(String(b.id), String(g.id))

  const checkVar = (id: unknown, ptr: string) => {
    if (typeof id === 'string' && !varIds.has(id)) bad(`variableId inexistente: ${id}.`, ptr)
  }

  // Placeholders {{x}} em qualquer string devem apontar para variavel declarada ou Recurso.
  const scan = (v: unknown, ptr: string) => {
    if (typeof v === 'string') {
      for (const m of v.matchAll(PLACEHOLDER)) {
        const name = (m[1] ?? '').trim()
        if (name.startsWith('resource.')) {
          const key = name.slice('resource.'.length)
          if (!/^[A-Za-z0-9_.]+$/.test(key) || key.length > 100) {
            out.push(diagnostic('KAYROS_REFERENCE_INVALID', `Chave de Recurso invalida para o Kayros OS ([A-Za-z0-9_.], ate 100): ${key}`, ptr))
          }
          continue
        }
        if (name === '' || name.startsWith('=')) continue
        if (!varNames.has(name)) {
          out.push(diagnostic('KAYROS_VARIABLE_UNDECLARED', `Variavel {{${name}}} usada e nao declarada.`, ptr))
        }
      }
    } else if (Array.isArray(v)) v.forEach((x, i) => scan(x, `${ptr}/${i}`))
    else if (isObj(v)) for (const [k, x] of Object.entries(v)) scan(x, `${ptr}/${k}`)
  }

  groups.forEach((g, gi) => {
    ;(Array.isArray(g.blocks) ? g.blocks : []).forEach((b: unknown, bi: number) => {
      if (!isObj(b)) return
      const ptr = `/groups/${gi}/blocks/${bi}`
      const opt = isObj(b.options) ? b.options : {}
      scan(b.options, `${ptr}/options`)

      switch (b.type) {
        case 'Set variable':
          checkVar(opt.variableId, `${ptr}/options/variableId`)
          break
        case 'Condition': {
          if (typeof b.outgoingEdgeId !== 'string') bad('Condition sem aresta padrao (senao).', `${ptr}`)
          const items = Array.isArray(b.items) ? b.items : []
          items.forEach((it: unknown, ii: number) => {
            if (!isObj(it)) return
            if (typeof it.outgoingEdgeId !== 'string') bad('Ramo de Condition sem aresta de saida.', `${ptr}/items/${ii}`)
            const comps = isObj(it.content) && Array.isArray(it.content.comparisons) ? it.content.comparisons : []
            comps.forEach((c: unknown, ci: number) => {
              if (isObj(c)) checkVar(c.variableId, `${ptr}/items/${ii}/content/comparisons/${ci}/variableId`)
            })
          })
          break
        }
        case 'Jump':
          if (typeof opt.groupId === 'string' && !groupIds.has(opt.groupId)) bad(`Jump para grupo inexistente: ${opt.groupId}.`, `${ptr}/options/groupId`)
          if (typeof opt.blockId === 'string' && !blockGroup.has(opt.blockId)) bad(`Jump para bloco inexistente: ${opt.blockId}.`, `${ptr}/options/blockId`)
          break
        case 'Typebot link':
          if (typeof opt.typebotId !== 'string' || opt.typebotId === '') bad('Typebot link sem typebotId.', `${ptr}/options/typebotId`)
          break
        case 'transferToQueue':
          if (typeof opt.queueId !== 'string' || !UUID.test(opt.queueId)) bad('transferToQueue exige queueId UUID real (sem valor ficticio).', `${ptr}/options/queueId`)
          break
        case 'whatsapp-cloud': {
          if (opt.awaitReply === true) checkVar(opt.replyVariableId, `${ptr}/options/replyVariableId`)
          const buttons = Array.isArray(opt.buttons) ? opt.buttons : []
          if (buttons.length > TARGET_LIMITS.buttonsMax) bad(`Mais de ${TARGET_LIMITS.buttonsMax} botoes.`, `${ptr}/options/buttons`)
          for (const s of Array.isArray(opt.sections) ? opt.sections : []) {
            const rows = isObj(s) && Array.isArray(s.rows) ? s.rows : []
            if (rows.length > TARGET_LIMITS.listItemsMax) bad(`Mais de ${TARGET_LIMITS.listItemsMax} itens na lista.`, `${ptr}/options/sections`)
          }
          break
        }
        default:
      }
    })
  })

  const events = Array.isArray(doc.events) ? doc.events : []
  events.forEach((e: unknown, i: number) => {
    if (isObj(e) && e.type !== 'start' && typeof e.outgoingEdgeId !== 'string') bad('Evento sem aresta de saida.', `/events/${i}`)
  })
  return out
}

/**
 * Seguranca para o importador do Kayros OS (importFlow, regenerate-bot-structure): ele grava as arestas
 * so com `to.groupId` (descarta `to.blockId`) e nao remapeia os ids de um bloco Jump. Um fluxo que
 * dependa disso muda de comportamento depois de importado.
 */
export function validateImportSafety(doc: unknown): Diagnostic[] {
  const out: Diagnostic[] = []
  if (!isObj(doc)) return out
  const edges = Array.isArray(doc.edges) ? doc.edges : []
  edges.forEach((e: unknown, i: number) => {
    if (isObj(e) && isObj(e.to) && e.to.blockId !== undefined) {
      out.push(diagnostic('KAYROS_IMPORT_UNSAFE', 'Aresta com to.blockId: o importador do Kayros OS descarta o blockId e o fluxo muda de comportamento.', `/edges/${i}/to`))
    }
  })
  const groups = Array.isArray(doc.groups) ? doc.groups : []
  groups.forEach((g: unknown, gi: number) => {
    if (!isObj(g)) return
    ;(Array.isArray(g.blocks) ? g.blocks : []).forEach((b: unknown, bi: number) => {
      if (isObj(b) && b.type === 'Jump') {
        out.push(diagnostic('KAYROS_IMPORT_UNSAFE', 'Bloco Jump: o importador do Kayros OS nao remapeia groupId/blockId.', `/groups/${gi}/blocks/${bi}`))
      }
    })
  })
  return out
}
