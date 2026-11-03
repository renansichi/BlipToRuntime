import { type Diagnostic, diagnostic } from '../diagnostics.js'
import { toNumber } from '../ingest/lossless.js'
import type { BotSource, Json, JsonObject, SourcePackage } from '../ingest/package.js'
import type {
  ActionRecord,
  BotInventory,
  ContentRecord,
  ExitRecord,
  InputRecord,
  Inventory,
  Phase,
  SourceRef,
  StateRecord,
} from './types.js'

// Inventario (F1-04): estados, conteudo, input, acoes locais/globais/pos-mudanca,
// condicoes e saidas, cada um com arquivo e caminho JSON. Nao executa scripts.

const isObj = (v: Json | undefined): v is JsonObject => typeof v === 'object' && v !== null && !Array.isArray(v)
const arr = (v: Json | undefined): Json[] => (Array.isArray(v) ? v : [])
const str = (v: Json | undefined): string | undefined => (typeof v === 'string' ? v : undefined)

/** Escapa um segmento de JSON Pointer (RFC 6901). */
export const esc = (s: string): string => s.replaceAll('~', '~0').replaceAll('/', '~1')

const FLOW_BASE = '/configuracoes_gerais/fluxo/flow'
const GLOBAL_BASE = '/configuracoes_gerais/fluxo/globalActions'
const CHATSTATE = 'application/vnd.lime.chatstate+json'

export const stripQuery = (uri: string): string => {
  const i = uri.indexOf('?')
  return i < 0 ? uri : uri.slice(0, i)
}

export interface BotScan {
  bot: BotSource
  states: StateRecord[]
  actions: ActionRecord[]
  content: ContentRecord[]
  diagnostics: Diagnostic[]
}

export function scanBot(bot: BotSource): BotScan {
  const file = bot.files.principal.path
  const states: StateRecord[] = []
  const actions: ActionRecord[] = []
  const content: ContentRecord[] = []
  const diagnostics: Diagnostic[] = []

  const ref = (phase: Phase, jsonPointer: string, ordinal: number, stateId?: string): SourceRef =>
    stateId === undefined
      ? { bot: bot.name, file, phase, jsonPointer, ordinal }
      : { bot: bot.name, file, stateId, phase, jsonPointer, ordinal }

  const addActions = (list: Json[], key: string, base: string, phase: Phase, stateId?: string) => {
    list.forEach((a, i) => {
      if (!isObj(a) || typeof a.type !== 'string') {
        diagnostics.push(diagnostic('SOURCE_STRUCTURE_UNKNOWN', `Acao sem tipo em ${base}/${key}/${i}.`, `${base}/${key}/${i}`))
        return
      }
      const settings = isObj(a.settings) ? a.settings : {}
      const rec: ActionRecord = {
        ref: ref(phase, `${base}/${key}/${i}`, i, stateId),
        type: a.type,
        conditions: arr(a.conditions).length,
      }
      const id = str(a.$id)
      if (id) rec.id = id
      const title = str(a.$title)
      if (title) rec.title = title
      if (a.type === 'ProcessHttp' || a.type === 'ProcessCommand') {
        const uri = str(settings.uri)
        if (uri) rec.uri = stripQuery(uri)
        const method = str(settings.method)
        if (method) rec.method = method
      }
      if (a.type === 'Redirect') {
        const address = str(settings.address)
        if (address) rec.address = address
        rec.hasContext = isObj(settings.context)
      }
      if (a.type === 'SetVariable') {
        const v = str(settings.variable)
        if (v) rec.variable = v
        if (settings.expiration !== undefined && settings.expiration !== null && settings.expiration !== '') {
          rec.expiration = toNumber(settings.expiration) ?? String(settings.expiration)
        }
      }
      actions.push(rec)
    })
  }

  // Acoes globais (spec 4.3): pseudo-estado `global-actions`.
  if (bot.globalActions) {
    addActions(arr(bot.globalActions.$enteringCustomActions), '$enteringCustomActions', GLOBAL_BASE, 'globalEnter')
    addActions(arr(bot.globalActions.$leavingCustomActions), '$leavingCustomActions', GLOBAL_BASE, 'globalLeave')
  }

  for (const [stateId, raw] of Object.entries(bot.flow)) {
    if (!isObj(raw)) {
      diagnostics.push(diagnostic('SOURCE_STRUCTURE_UNKNOWN', `Estado ${stateId} nao e objeto.`, `${FLOW_BASE}/${esc(stateId)}`))
      continue
    }
    const base = `${FLOW_BASE}/${esc(stateId)}`
    addActions(arr(raw.$enteringCustomActions), '$enteringCustomActions', base, 'enter', stateId)
    addActions(arr(raw.$leavingCustomActions), '$leavingCustomActions', base, 'leave', stateId)
    addActions(arr(raw.$afterStateChangedActions), '$afterStateChangedActions', base, 'afterStateChange', stateId)

    let input: InputRecord = { pointer: `${base}/$contentActions`, bypass: true, conditions: 0 }
    let contentSends = 0
    let contentMessages = 0
    arr(raw.$contentActions).forEach((c, i) => {
      if (!isObj(c)) return
      const pointer = `${base}/$contentActions/${i}`
      if (isObj(c.input)) {
        const inp = c.input
        input = { pointer: pointer, bypass: inp.bypass === true, conditions: arr(inp.conditions).length }
        if (inp.expiration !== undefined && inp.expiration !== null) input.expiration = String(inp.expiration)
        if (isObj(inp.validation)) input.validation = { rule: str(inp.validation.rule) ?? 'unknown' }
        const v = str(inp.variable)
        if (v) input.variable = v
      } else if (isObj(c.action)) {
        const type = str(c.action.type)
        const settings = isObj(c.action.settings) ? c.action.settings : {}
        if (type !== 'SendMessage' && type !== 'SendRawMessage') {
          diagnostics.push(diagnostic('SOURCE_STRUCTURE_UNKNOWN', `Acao de conteudo desconhecida: ${String(type)}.`, pointer))
          return
        }
        const mime = str(settings.type) ?? ''
        const typing = type === 'SendMessage' && mime === CHATSTATE
        content.push({ ref: ref('content', pointer, i, stateId), type, mime, isTypingIndicator: typing })
        contentSends++
        if (!typing) contentMessages++
      } else {
        diagnostics.push(diagnostic('SOURCE_STRUCTURE_UNKNOWN', 'Item de $contentActions sem action nem input.', pointer))
      }
    })

    const exits: ExitRecord[] = []
    const addExit = (o: Json, index: number, pointer: string) => {
      if (!isObj(o)) return
      const target = str(o.stateId)
      if (target === undefined) return
      const dynamic = o.typeOfStateId === 'variable'
      exits.push({ index, kind: dynamic ? 'dynamic' : 'literal', target, conditions: arr(o.conditions).length, pointer })
    }
    arr(raw.$conditionOutputs).forEach((o, i) => addExit(o, i, `${base}/$conditionOutputs/${i}`))
    if (raw.$defaultOutput !== undefined) addExit(raw.$defaultOutput, -1, `${base}/$defaultOutput`)

    states.push({
      bot: bot.name,
      stateId,
      title: str(raw.$title) ?? '',
      root: raw.root === true,
      pointer: base,
      input,
      enterActions: arr(raw.$enteringCustomActions).length,
      leaveActions: arr(raw.$leavingCustomActions).length,
      afterActions: arr(raw.$afterStateChangedActions).length,
      contentSends,
      contentMessages,
      exits,
      whiteWall: raw.$whiteWallIntegration !== undefined,
      desk: raw.deskStateVersion !== undefined || raw.$afterStateChangedActions !== undefined,
    })
  }
  return { bot, states, actions, content, diagnostics }
}

const inc = (m: Record<string, number>, k: string) => {
  m[k] = (m[k] ?? 0) + 1
}

export function buildInventory(pkg: SourcePackage): { inventory: Inventory; diagnostics: Diagnostic[] } {
  const scans = pkg.bots.map(scanBot)
  const states = scans.flatMap((s) => s.states)
  const actions = scans.flatMap((s) => s.actions)
  const content = scans.flatMap((s) => s.content)
  const diagnostics = scans.flatMap((s) => s.diagnostics)

  const actionTypes: Record<string, number> = {}
  const contentTypes: Record<string, number> = {}
  for (const a of actions) inc(actionTypes, a.type)
  for (const c of content) inc(contentTypes, `${c.type} ${c.mime}`)

  const local = (a: ActionRecord) => a.ref.phase === 'enter' || a.ref.phase === 'leave'
  const isScript = (a: ActionRecord) => a.type === 'ExecuteScript' || a.type === 'ExecuteScriptV2'
  const redirects = actions.filter((a) => a.type === 'Redirect')

  const perBot: BotInventory[] = scans.map((s) => {
    const own = s.actions
    return {
      bot: s.bot.name,
      identifier: s.bot.identifier,
      files: {
        original: s.bot.files.original.path,
        principal: s.bot.files.principal.path,
        variaveis: s.bot.files.variaveis.path,
      },
      states: s.states.length,
      localActions: own.filter(local).length,
      configs: s.bot.configs.length,
      inputsNoBypass: s.states.filter((x) => !x.input.bypass).length,
      timeouts: s.states.filter((x) => !x.input.bypass && x.input.expiration !== undefined).length,
      httpLocal: own.filter((a) => local(a) && a.type === 'ProcessHttp').length,
      scripts: own.filter((a) => local(a) && isScript(a)).length,
      redirect: own.filter((a) => a.type === 'Redirect').length,
    }
  })

  const inventory: Inventory = {
    totals: {
      bots: pkg.bots.length,
      states: states.length,
      localActions: actions.filter(local).length,
      globalActions: actions.filter((a) => a.ref.phase === 'globalEnter' || a.ref.phase === 'globalLeave').length,
      afterStateChangeActions: actions.filter((a) => a.ref.phase === 'afterStateChange').length,
      actionOccurrences: actions.length,
      configs: scans.reduce((n, s) => n + s.bot.configs.length, 0),
      contentSends: content.length,
      contentMessages: content.filter((c) => !c.isTypingIndicator).length,
      inputs: states.length,
      inputsNoBypass: states.filter((s) => !s.input.bypass).length,
      timeouts: states.filter((s) => !s.input.bypass && s.input.expiration !== undefined).length,
      dynamicExits: states.reduce((n, s) => n + s.exits.filter((e) => e.kind === 'dynamic').length, 0),
      setVariableWithExpiration: actions.filter((a) => a.type === 'SetVariable' && a.expiration !== undefined).length,
      mergeContact: actions.filter((a) => a.type === 'MergeContact').length,
      redirectOccurrences: redirects.length,
      redirectDistinctAddresses: new Set(redirects.map((a) => a.address)).size,
      redirectWithContext: redirects.filter((a) => a.hasContext).length,
      scripts: actions.filter(isScript).length,
      httpLocal: actions.filter((a) => local(a) && a.type === 'ProcessHttp').length,
      httpGlobal: actions.filter((a) => a.ref.phase.startsWith('global') && a.type === 'ProcessHttp').length,
      inputValidations: states.filter((s) => s.input.validation).length,
      conditionalInputs: states.filter((s) => s.input.conditions > 0).length,
    },
    actionTypes: sortKeys(actionTypes),
    contentTypes: sortKeys(contentTypes),
    perBot,
    states,
    actions,
    content,
  }
  return { inventory, diagnostics }
}

function sortKeys(m: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(m).sort(([a], [b]) => a.localeCompare(b)))
}
