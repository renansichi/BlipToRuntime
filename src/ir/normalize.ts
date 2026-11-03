import { type Diagnostic, diagnostic } from '../diagnostics.js'
import { esc } from '../analysis/inventory.js'
import type { Phase, SourceRef } from '../analysis/types.js'
import { toNumber } from '../ingest/lossless.js'
import type { BotSource, Json, JsonObject } from '../ingest/package.js'
import type {
  ActionKind,
  Effect,
  MigrationAction,
  MigrationBot,
  MigrationInput,
  MigrationMessage,
  MigrationState,
  OrderedExit,
  Predicate,
} from './types.js'

// Normalizacao (F2-01): contrato Blip -> IR. Nao executa scripts.

const isObj = (v: Json | undefined): v is JsonObject => typeof v === 'object' && v !== null && !Array.isArray(v)
const arr = (v: Json | undefined): Json[] => (Array.isArray(v) ? v : [])
const str = (v: Json | undefined): string | undefined => (typeof v === 'string' ? v : undefined)

const FLOW = '/configuracoes_gerais/fluxo/flow'
const GLOBAL = '/configuracoes_gerais/fluxo/globalActions'

const KIND: Record<string, [ActionKind, Effect]> = {
  SetVariable: ['setVariable', 'sessionWrite'],
  TrackEvent: ['trackEvent', 'analytics'],
  MergeContact: ['mergeContact', 'persistentWrite'],
  ExecuteScript: ['script', 'pure'],
  ExecuteScriptV2: ['script', 'pure'],
  ProcessHttp: ['http', 'http'],
  ProcessCommand: ['command', 'http'],
  Redirect: ['redirect', 'terminate'],
  ForwardToDesk: ['forwardToDesk', 'handoff'],
  LeavingFromDesk: ['leavingFromDesk', 'handoff'],
}

/** `h:mm` -> minutos (decisao do responsavel, 02/11/2026). */
export function parseExpiration(raw: string): number | undefined {
  const m = /^(\d+):(\d{1,2})$/.exec(raw.trim())
  if (!m) return undefined
  return Number(m[1]) * 60 + Number(m[2])
}

function predicates(list: Json | undefined, base: string): Predicate[] {
  return arr(list).flatMap((c, i): Predicate[] => {
    if (!isObj(c)) return []
    const source = c.source === 'input' || c.source === 'context' || c.source === 'intent' ? c.source : 'unknown'
    const p: Predicate = {
      source,
      op: str(c.comparison) ?? '',
      values: arr(c.values).map((v) => (typeof v === 'string' ? v : String(toNumber(v) ?? v))),
      pointer: `${base}/${i}`,
    }
    const variable = str(c.variable)
    if (variable !== undefined && source === 'context') p.variable = variable
    return [p]
  })
}

export function normalizeBot(bot: BotSource): { bot: MigrationBot; diagnostics: Diagnostic[] } {
  const file = bot.files.principal.path
  const diagnostics: Diagnostic[] = []

  const ref = (phase: Phase, jsonPointer: string, ordinal: number, stateId?: string): SourceRef =>
    stateId === undefined
      ? { bot: bot.name, file, phase, jsonPointer, ordinal }
      : { bot: bot.name, file, stateId, phase, jsonPointer, ordinal }

  const actions = (list: Json | undefined, key: string, base: string, phase: Phase, stateId?: string): MigrationAction[] =>
    arr(list).flatMap((a, i): MigrationAction[] => {
      if (!isObj(a) || typeof a.type !== 'string') return []
      const [kind, effect] = KIND[a.type] ?? (['unknown', 'pure'] as [ActionKind, Effect])
      if (kind === 'unknown') {
        diagnostics.push(diagnostic('SOURCE_STRUCTURE_UNKNOWN', `Acao desconhecida ${a.type}.`, `${base}/${key}/${i}`))
      }
      const act: MigrationAction = {
        kind,
        type: a.type,
        source: ref(phase, `${base}/${key}/${i}`, i, stateId),
        conditions: predicates(a.conditions, `${base}/${key}/${i}/conditions`),
        continueOnError: a.continueOnError === true,
        settings: isObj(a.settings) ? a.settings : {},
        effect,
      }
      const title = str(a.$title)
      if (title) act.title = title
      return [act]
    })

  const states: MigrationState[] = []
  for (const [stateId, raw] of Object.entries(bot.flow)) {
    if (!isObj(raw)) continue
    const base = `${FLOW}/${esc(stateId)}`
    const messages: MigrationMessage[] = []
    let input: MigrationInput = { pointer: `${base}/$contentActions`, bypass: true, conditions: [] }
    arr(raw.$contentActions).forEach((c, i) => {
      if (!isObj(c)) return
      const ptr = `${base}/$contentActions/${i}`
      if (isObj(c.input)) {
        const inp = c.input
        input = { pointer: ptr, bypass: inp.bypass === true, conditions: predicates(inp.conditions, `${ptr}/input/conditions`) }
        if (inp.expiration !== undefined && inp.expiration !== null) {
          input.timeoutRaw = String(inp.expiration)
          const mins = parseExpiration(input.timeoutRaw)
          if (mins !== undefined) input.timeoutMinutes = mins
        }
        if (isObj(inp.validation)) {
          input.validation = { rule: str(inp.validation.rule) ?? 'unknown' }
          const rx = str(inp.validation.regex)
          if (rx !== undefined) input.validation.regex = rx
          const er = str(inp.validation.error)
          if (er !== undefined) input.validation.error = er
        }
        const v = str(inp.variable)
        if (v) input.variable = v
      } else if (isObj(c.action) && isObj(c.action.settings)) {
        const type = str(c.action.type)
        const s = c.action.settings
        const mime = str(s.type) ?? ''
        const viaRaw = type === 'SendRawMessage'
        const kind: MigrationMessage['kind'] = viaRaw
          ? 'raw'
          : mime === 'text/plain'
            ? 'text'
            : mime === 'application/vnd.lime.select+json'
              ? 'select'
              : mime === 'application/vnd.lime.media-link+json'
                ? 'media'
                : mime === 'application/vnd.lime.chatstate+json'
                  ? 'chatstate'
                  : 'unknown'
        if (kind === 'unknown') diagnostics.push(diagnostic('SOURCE_STRUCTURE_UNKNOWN', `Conteudo ${mime} desconhecido.`, ptr))
        messages.push({
          kind,
          source: ref('content', ptr, i, stateId),
          mime,
          content: viaRaw ? s.rawContent : s.content,
          viaRaw,
        })
      }
    })

    const exits: OrderedExit[] = []
    const mkExit = (o: Json | undefined, index: number, pointer: string): OrderedExit | undefined => {
      if (!isObj(o)) return undefined
      const target = str(o.stateId)
      if (target === undefined) return undefined
      const dynamic = o.typeOfStateId === 'variable'
      return {
        index,
        predicates: predicates(o.conditions, `${pointer}/conditions`),
        target: dynamic
          ? { kind: 'dynamic', variable: target.replace(/^\{\{\s*|\s*\}\}$/g, '').trim(), expression: target }
          : { kind: 'state', stateId: target },
        pointer,
      }
    }
    arr(raw.$conditionOutputs).forEach((o, i) => {
      const e = mkExit(o, i, `${base}/$conditionOutputs/${i}`)
      if (e) exits.push(e)
    })
    const defaultExit = mkExit(raw.$defaultOutput, -1, `${base}/$defaultOutput`)

    states.push({
      source: ref('enter', base, 0, stateId),
      stateId,
      title: str(raw.$title) ?? '',
      root: raw.root === true,
      enter: actions(raw.$enteringCustomActions, '$enteringCustomActions', base, 'enter', stateId),
      messages,
      input,
      leave: actions(raw.$leavingCustomActions, '$leavingCustomActions', base, 'leave', stateId),
      afterStateChange: actions(raw.$afterStateChangedActions, '$afterStateChangedActions', base, 'afterStateChange', stateId),
      exits,
      defaultExit,
      whiteWall: raw.$whiteWallIntegration !== undefined,
    })
  }

  const g = bot.globalActions
  return {
    bot: {
      name: bot.name,
      file,
      states,
      globalEnter: g ? actions(g.$enteringCustomActions, '$enteringCustomActions', GLOBAL, 'globalEnter') : [],
      globalLeave: g ? actions(g.$leavingCustomActions, '$leavingCustomActions', GLOBAL, 'globalLeave') : [],
      configKeys: bot.configs.map((c) => c.key),
    },
    diagnostics,
  }
}
