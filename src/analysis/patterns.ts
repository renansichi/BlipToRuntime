import { type Diagnostic, type DiagnosticCode, diagnostic } from '../diagnostics.js'
import type { BotSource, Json, JsonObject } from '../ingest/package.js'
import type { GraphResult } from './graph.js'
import { esc } from './inventory.js'
import type { ActionRecord, Inventory, StateRecord } from './types.js'

// Padroes que exigem atencao (F1-07). Cada ocorrencia vira um diagnostico com
// bot e localizacao. Nada aqui decide o destino de uma funcionalidade: o
// caminho continua no inventario e a decisao fica para a adaptacao (F2/F3).

const isObj = (v: Json | undefined): v is JsonObject => typeof v === 'object' && v !== null && !Array.isArray(v)

export interface Finding extends Diagnostic {
  bot: string
  file: string
  jsonPointer: string
  /** Subcategoria dentro do codigo (ex.: `http-msging`, `wait-no-terminal`). */
  tag?: string
}

const FLOW_ID = /"flow_id"\s*:\s*"([^"]*)"/g

export function detectPatterns(
  bots: BotSource[],
  inv: Inventory,
  graph: GraphResult,
  missingConfigs: { bot: string; key: string; uses: string[]; via: string }[],
  externalByBot: { bot: string; expression: string; uses: string[] }[],
): Finding[] {
  const out: Finding[] = []
  const file = new Map(bots.map((b) => [b.name, b.files.principal.path]))
  const add = (
    code: DiagnosticCode,
    bot: string,
    jsonPointer: string,
    message: string,
    tag?: string,
  ) => {
    const f: Finding = { ...diagnostic(code, message, `${file.get(bot)}#${jsonPointer}`), bot, file: file.get(bot) ?? '', jsonPointer }
    if (tag) f.tag = tag
    out.push(f)
  }

  const sk = (s: StateRecord) => `${s.title || s.stateId}`

  for (const a of inv.actions) {
    const at = a.ref
    switch (a.type) {
      case 'SetVariable':
        if (a.expiration !== undefined) {
          add('CONTEXT_TTL_DIFFERENCE', at.bot, at.jsonPointer, `SetVariable "${a.variable ?? ''}" com expiracao ${String(a.expiration)}.`)
        }
        break
      case 'MergeContact':
        add('MERGE_CONTACT_PERSISTENCE', at.bot, at.jsonPointer, 'MergeContact: classificar dado duravel x temporario.')
        break
      case 'ProcessCommand':
        add('BLIP_COMMAND_UNMAPPED', at.bot, at.jsonPointer, `ProcessCommand ${a.uri ?? ''}.`, 'command')
        break
      case 'ProcessHttp':
        if (isBlipHttp(a)) add('BLIP_COMMAND_UNMAPPED', at.bot, at.jsonPointer, `HTTP para a plataforma Blip (${a.uri ?? ''}).`, 'http-msging')
        if (isWhiteWall(a)) add('AGENT_CONTRACT_UNVERIFIED', at.bot, at.jsonPointer, `HTTP White Wall (${a.uri ?? ''}).`, 'http-whitewall')
        break
      case 'ForwardToDesk':
        add('DESK_CONTINUATION_DIFFERENCE', at.bot, at.jsonPointer, 'ForwardToDesk: fila/horario a confirmar.', 'forward')
        break
      case 'LeavingFromDesk':
        add('DESK_CONTINUATION_DIFFERENCE', at.bot, at.jsonPointer, 'LeavingFromDesk (pos-atendimento) em $afterStateChangedActions.', 'leaving')
        break
      default:
    }
    if (at.phase === 'globalEnter' || at.phase === 'globalLeave') {
      add('GLOBAL_ACTION_PLACEMENT', at.bot, at.jsonPointer, `Acao global ${a.type} (${at.phase}): executar por interacao, nao por grupo.`)
    }
  }

  // Inputs: validacao declarada e inputs condicionais.
  const localsByState = new Map<string, ActionRecord[]>()
  for (const a of inv.actions) {
    if (a.ref.stateId && (a.ref.phase === 'enter' || a.ref.phase === 'leave')) {
      const k = `${a.ref.bot}\0${a.ref.stateId}`
      const l = localsByState.get(k) ?? []
      l.push(a)
      localsByState.set(k, l)
    }
  }
  for (const s of inv.states) {
    if (s.input.validation) add('INPUT_VALIDATION_DECLARED', s.bot, `${s.pointer}/$contentActions`, `Input "${sk(s)}" com validacao ${s.input.validation.rule}.`, s.input.validation.rule)
    if (s.input.conditions > 0) add('INPUT_VALIDATION_DECLARED', s.bot, `${s.pointer}/$contentActions`, `Input "${sk(s)}" condicional.`, 'conditional-input')
    if (s.whiteWall) add('AGENT_CONTRACT_UNVERIFIED', s.bot, `${s.pointer}/$whiteWallIntegration`, `Estado "${sk(s)}" com integracao White Wall.`, 'state-whitewall')

    // Espera sem envio (spec 3.3): input sem bypass, sem mensagem e fora da raiz.
    if (!s.root && !s.input.bypass && s.contentMessages === 0) {
      const locals = localsByState.get(`${s.bot}\0${s.stateId}`) ?? []
      const terminal = locals.some((a) => a.type === 'Redirect' || a.type === 'ForwardToDesk')
      add('WAIT_WITHOUT_MESSAGE', s.bot, s.pointer, `Estado "${sk(s)}" aguarda entrada sem enviar mensagem.`, terminal ? 'wait-with-terminal' : 'wait-no-terminal')
    }
  }

  // Redirect: um diagnostico por endereco distinto (35), com ocorrencias.
  for (const al of graph.aliases) {
    const first = graph.redirects.find((r) => r.address === al.address)
    if (first) {
      add('REDIRECT_ALIAS_UNRESOLVED', first.bot, first.pointer, `Alias ${JSON.stringify(al.address)}: ${al.occurrences} ocorrencia(s) em ${al.fromBots.join(', ')}; ${al.withContext} com contexto.`)
    }
  }

  // Saidas dinamicas cujo conjunto de destinos nao fechou.
  for (const d of graph.dynamicTargets) {
    if (!d.complete) {
      add('DYNAMIC_TARGET_UNRESOLVED', d.bot, d.pointer, `Destino {{${d.variable}}}: ${d.constants.length} constante(s), ${d.nonConstantWriters} escrita(s) nao constante(s).`)
    }
  }

  // Configuracoes e recursos nao exportados.
  for (const m of missingConfigs) {
    const p = m.uses[0] ?? ''
    add('SOURCE_CONFIG_UNRESOLVED', m.bot, p, `config.${m.key} referenciado (${m.via}, ${m.uses.length}x) sem chave no export do bot.`, m.via)
  }
  for (const e of externalByBot) {
    add('EXTERNAL_RESOURCE_UNRESOLVED', e.bot, e.uses[0] ?? '', `${JSON.stringify(e.expression)} referenciado (${e.uses.length}x) e nao exportado.`)
  }

  // Condicao por intencao personalizada e ids de WhatsApp Flow em raw.
  for (const bot of bots) {
    for (const [id, raw] of Object.entries(bot.flow)) {
      if (!isObj(raw)) continue
      const base = `/configuracoes_gerais/fluxo/flow/${esc(id)}`
      if (Array.isArray(raw.$conditionOutputs)) {
        raw.$conditionOutputs.forEach((o, i) => {
          if (!isObj(o) || !Array.isArray(o.conditions)) return
          o.conditions.forEach((c, j) => {
            if (isObj(c) && c.source === 'intent') {
              add('INTENT_CONDITION_CUSTOM', bot.name, `${base}/$conditionOutputs/${i}/conditions/${j}`, `Condicao por intencao: ${JSON.stringify(c.values)}.`)
            }
          })
        })
      }
      if (Array.isArray(raw.$contentActions)) {
        raw.$contentActions.forEach((c, i) => {
          if (!isObj(c) || !isObj(c.action) || c.action.type !== 'SendRawMessage' || !isObj(c.action.settings)) return
          const rc = c.action.settings.rawContent
          if (typeof rc !== 'string') return
          for (const m of rc.matchAll(FLOW_ID)) {
            const expr = m[1] ?? ''
            add('FLOW_ASSET_MISSING', bot.name, `${base}/$contentActions/${i}/action/settings/rawContent`, `WhatsApp Flow id ${JSON.stringify(expr)}.`, expr.includes('{{') ? 'flow-expression' : 'flow-literal')
          }
        })
      }
    }
  }
  return out
}

export const isBlipHttp = (a: ActionRecord): boolean => /msging\.net/i.test(a.uri ?? '')
export const isWhiteWall = (a: ActionRecord): boolean => /white-?wall|\bww\b/i.test(a.uri ?? '')

export function countByCode(findings: Finding[]): Record<string, number> {
  const m: Record<string, number> = {}
  for (const f of findings) {
    const k = f.tag ? `${f.code}:${f.tag}` : f.code
    m[k] = (m[k] ?? 0) + 1
  }
  return Object.fromEntries(Object.entries(m).sort(([a], [b]) => a.localeCompare(b)))
}
