import { resourceSlug, toResourceKey } from './ids.js'
import type { Json, JsonObject } from '../ingest/package.js'
import type { MigrationAction } from '../ir/types.js'
import type { KBlock } from './builder.js'
import type { Seq } from './seq.js'
import { buildScript } from './script.js'
import { translate, varNameOf } from './translate.js'

// Emissao de acoes (F2-05/06/07). Cada acao vira blocos nativos; o que o
// Kayros atual nao tem vira adaptacao proposta, nunca um resultado fabricado.

const isObj = (v: Json | undefined): v is JsonObject => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: Json | undefined): string => (typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v))

/** Segredos literais em corpo JSON/cabecalho: viram Recurso, o valor nunca entra no pacote. */
const SECRET_KEY = /(chave\w*|token\w*|senha|secret\w*|password|api[-_]?key|authorization|auth)/i

export interface BlockRefs {
  /** Blocos Typebot link cujo variablesToPass sera preenchido ao final. */
  links: KBlock[]
}

/** MergeContact cujos campos foram todos descartados por decisao aceita: nao emite nada (nem a Condition). */
function fullyDiscarded(seq: Seq, a: MigrationAction): boolean {
  const { ctx } = seq
  if (a.kind !== 'mergeContact' || !ctx.discardWriteOnly) return false
  const keys = Object.entries(a.settings)
  if (keys.length === 0) return false
  return keys.every(([k, v]) => k === 'extras' && isObj(v) && Object.keys(v).length > 0 && Object.keys(v).every((x) => ctx.writeOnlyKeys.has(x)))
}

export function emitAction(seq: Seq, a: MigrationAction, refs: BlockRefs): void {
  if (fullyDiscarded(seq, a)) {
    const { ctx } = seq
    const id = ctx.adapt.propose(
      {
        slug: 'merge-contact-write-only-discard',
        kind: 'data',
        originalBehavior: 'MergeContact grava marcadores/etapas no contato que nenhum bot do pacote le (no maximo, relatorios ou campanhas fora do bot).',
        proposedBehavior: 'Escrita descartada: o marcador nao e gravado nem na sessao.',
        reason: 'Decisao do responsavel: marcadores so escritos nao sao mais necessarios.',
        changesBusinessBehavior: true,
        targetStrategy: 'discard-write-only',
      },
      a.source,
    )
    ctx.map(a.source, 'merge-contact-discarded', { groupKeys: [seq.cur.id], blockKeys: [] }, [id])
    return
  }
  seq.conditional(a.conditions, a.source, (s) => emitBody(s, a, refs))
}

// --- Fusao de acoes consecutivas com a mesma condicao (F4-02/03) ---------------------------
// Precondicao: a condicao e avaliada uma unica vez, no inicio da corrida; por isso nenhuma acao da
// corrida (antes da ultima) pode escrever uma variavel lida pela condicao. Acoes terminais nunca
// entram numa corrida, e a ordem original das acoes e preservada.

const predKey = (a: MigrationAction): string => JSON.stringify(a.conditions.map((p) => [p.source, p.variable ?? null, p.op, p.values]))

const predReads = (a: MigrationAction): string[] =>
  a.conditions.map((p) => (p.source === 'input' ? 'input.content' : (p.variable ?? '').split('@')[0] ?? ''))

function writtenNames(a: MigrationAction): string[] {
  const s = a.settings
  const str = (v: Json | undefined) => (typeof v === 'string' && v !== '' ? [v] : [])
  switch (a.kind) {
    case 'setVariable': return str(s.variable)
    case 'script': return str(s.outputVariable)
    case 'http': return [...str(s.responseStatusVariable), ...str(s.responseBodyVariable), 'api_status', 'api_response', 'api_ok']
    case 'command': return str(s.variable)
    case 'mergeContact': return [
      ...(isObj(s.extras) ? Object.keys(s.extras).map((k) => `contact.extras.${k}`) : []),
      ...Object.entries(s).filter(([k, v]) => k !== 'extras' && (typeof v === 'string' || typeof v === 'number')).map(([k]) => `contact.${k}`),
    ]
    default: return []
  }
}

const TERMINAL = new Set(['redirect', 'forwardToDesk'])

/** Emite a lista de acoes; devolve as que ficaram sem emitir por causa de uma acao terminal. */
export function emitActions(seq: Seq, list: MigrationAction[], refs: BlockRefs): MigrationAction[] {
  const { ctx } = seq
  let run: MigrationAction[] = []
  let writes = new Set<string>()
  const flush = () => {
    if (run.length === 1) emitAction(seq, run[0] as MigrationAction, refs)
    else if (run.length > 1) {
      const first = run[0] as MigrationAction
      const members = run
      seq.conditional(first.conditions, first.source, (s) => members.forEach((m) => emitBody(s, m, refs)))
    }
    run = []
    writes = new Set()
  }
  for (let i = 0; i < list.length; i++) {
    const a = list[i] as MigrationAction
    if (seq.terminated) {
      flush()
      return list.slice(i)
    }
    if (!ctx.optimize || a.conditions.length === 0 || TERMINAL.has(a.kind) || fullyDiscarded(seq, a)) {
      flush()
      emitAction(seq, a, refs)
      continue
    }
    const mergeable = run.length > 0 && predKey(a) === predKey(run[0] as MigrationAction) && !predReads(a).some((r) => writes.has(r))
    if (!mergeable) flush()
    run.push(a)
    for (const w of writtenNames(a)) writes.add(w)
  }
  flush()
  return []
}

function emitBody(seq: Seq, a: MigrationAction, refs: BlockRefs): void {
  const { ctx } = seq
  const at = a.source
  const set = a.settings
  const start = seq.cur.blocks.length
  const done = (transformation: string, adaptationIds: string[] = []) => {
    const blocks = seq.cur.blocks.slice(start).map((b) => b.id)
    ctx.map(at, transformation, { groupKeys: [seq.cur.id], blockKeys: blocks }, adaptationIds)
  }

  switch (a.kind) {
    case 'setVariable': {
      const name = text(set.variable)
      const value = text(set.value)
      const t = translate(ctx, value, at)
      seq.code(t.prelude)
      const v = ctx.b.variable(varNameOf(ctx, name, at))
      const ids: string[] = []
      if (set.expiration !== undefined && set.expiration !== null && set.expiration !== '') {
        ctx.warn('CONTEXT_TTL_DIFFERENCE', `SetVariable "${name}" tem expiracao; o Kayros mantem o valor na sessao.`, at)
        ids.push(
          ctx.adapt.propose(
            {
              slug: 'ttl-session',
              kind: 'data',
              originalBehavior: 'Variavel de contexto expira apos o prazo configurado na Blip.',
              proposedBehavior: 'Valor mantido na sessao do Kayros, sem expiracao propria.',
              reason: 'Set variable do Kayros nao tem TTL; recursos nao sao armazenamento por cliente.',
              changesBusinessBehavior: true,
              targetStrategy: 'session-variable',
            },
            at,
          ),
        )
      }
      seq.add('Set variable', value === '' ? { type: 'Empty', variableId: v.id } : { type: 'Custom', variableId: v.id, expressionToEvaluate: t.text, isCode: false }, 'set')
      done('set-variable', ids)
      return
    }

    case 'trackEvent': {
      const category = translate(ctx, text(set.category), at)
      const action = translate(ctx, text(set.action), at)
      const payload: { key: string; value: string }[] = [{ key: 'action', value: action.text }]
      const pre = [...category.prelude, ...action.prelude]
      if (isObj(set.extras)) {
        for (const [k, v] of Object.entries(set.extras)) {
          const tv = translate(ctx, text(v), at)
          pre.push(...tv.prelude)
          payload.push({ key: k, value: tv.text })
        }
      }
      seq.code(pre)
      seq.add('journeyEvent', { eventName: category.text, payload }, 'evt')
      done('track-event')
      return
    }

    case 'mergeContact': {
      const ids = [
        ctx.adapt.propose(
          {
            slug: 'merge-contact-session',
            kind: 'data',
            originalBehavior: 'MergeContact grava extras do contato de forma duravel na Blip.',
            proposedBehavior: 'Campos gravados como variaveis de sessao contact_extras_*; nao persistem entre conversas.',
            reason: 'Decisao Q08: dados temporarios na sessao; persistencia duravel so com API/base existente confirmada.',
            changesBusinessBehavior: true,
            targetStrategy: 'session-variable',
          },
          at,
        ),
      ]
      ctx.warn('MERGE_CONTACT_PERSISTENCE', 'MergeContact emitido como variaveis de sessao (persistencia duravel nao confirmada).', at)
      const pre: string[] = []
      const sets: [string, string][] = []
      let discarded = 0
      let writeOnlyId: string | undefined
      const collect = (prefix: string, o: JsonObject) => {
        for (const [k, v] of Object.entries(o)) {
          if (prefix === 'contact_extras_' && ctx.writeOnlyKeys.has(k)) {
            // Campo so escrito: nenhum bot do pacote o le. Fica visivel como adaptacao; so e descartado se aceita.
            writeOnlyId = ctx.adapt.propose(
              {
                slug: 'merge-contact-write-only-discard',
                kind: 'data',
                originalBehavior: 'MergeContact grava marcadores/etapas no contato que nenhum bot do pacote le (no maximo, relatorios ou campanhas fora do bot).',
                proposedBehavior: 'Escrita descartada: o marcador nao e gravado nem na sessao.',
                reason: 'Decisao do responsavel: marcadores so escritos nao sao mais necessarios.',
                changesBusinessBehavior: true,
                targetStrategy: 'discard-write-only',
              },
              at,
            )
            if (ctx.discardWriteOnly) {
              discarded++
              continue
            }
          }
          const t = translate(ctx, text(v), at)
          pre.push(...t.prelude)
          sets.push([`${prefix}${k.replace(/[^A-Za-z0-9_]/g, '_')}`, t.text])
        }
      }
      for (const [k, v] of Object.entries(set)) {
        if (k === 'extras' && isObj(v)) collect('contact_extras_', v)
        else if (typeof v === 'string' || typeof v === 'number') collect('contact_', { [k]: v })
      }
      seq.code([...new Set(pre)])
      for (const [name, value] of sets) {
        const v = ctx.b.variable(name)
        seq.add('Set variable', value === '' ? { type: 'Empty', variableId: v.id } : { type: 'Custom', variableId: v.id, expressionToEvaluate: value, isCode: false }, 'mrg')
      }
      if (writeOnlyId) ids.push(writeOnlyId)
      done(discarded > 0 ? 'merge-contact-session-partial-discard' : 'merge-contact-session', ids)
      return
    }

    case 'script': {
      const built = buildScript(
        ctx,
        {
          source: text(set.source),
          fn: text(set.function) || 'run',
          inputVariables: Array.isArray(set.inputVariables) ? set.inputVariables.map((x) => text(x as Json)) : [],
          ...(typeof set.outputVariable === 'string' ? { outputVariable: set.outputVariable } : {}),
        },
        at,
      )
      if (built.outputVariable) ctx.b.variable(built.outputVariable)
      seq.add('Code', { name: a.title ?? 'script', content: [...built.prelude, built.code].join('\n') }, 'scr')
      done('script', built.analysis.parses ? [] : [`${ctx.bot}:script-syntax-incompatible`])
      return
    }

    case 'http':
      emitHttp(seq, a)
      return

    case 'command': {
      const id = ctx.adapt.propose(
        {
          slug: 'blip-command',
          kind: 'integration',
          originalBehavior: 'ProcessCommand na API de comandos da Blip (contatos, tickets, buckets, historico).',
          proposedBehavior: 'Nenhuma chamada e emitida; a variavel de saida fica sem valor ate haver integracao suportada confirmada.',
          reason: 'Capacidade especifica da plataforma Blip, sem equivalente nativo no Kayros.',
          changesBusinessBehavior: true,
          targetStrategy: 'parameter-required',
        },
        at,
      )
      ctx.warn('BLIP_COMMAND_UNMAPPED', `ProcessCommand ${text(set.method)} ${text(set.uri)} sem equivalente; nao emitido.`, at)
      ctx.map(at, 'command-unmapped', { groupKeys: [seq.cur.id], blockKeys: [] }, [id])
      return
    }

    case 'redirect': {
      const address = text(set.address)
      const alias = ctx.config?.bindings.botAliases.find((x) => x.sourceAddress === address)
      const target = alias?.targetImportedBotId ?? `{{resource.${toResourceKey(`blip.link.${resourceSlug(address)}`)}}}`
      if (!alias?.targetImportedBotId) {
        ctx.warn('REDIRECT_ALIAS_UNRESOLVED', `Redirect para ${JSON.stringify(address)} sem id de bot confirmado; usando referencia configuravel.`, at)
      }
      const ids: string[] = []
      if (isObj(set.context)) {
        const t = translate(ctx, text(set.context.value), at)
        seq.code(t.prelude)
        const v = ctx.b.variable('redirect_context')
        seq.add('Set variable', { type: 'Custom', variableId: v.id, expressionToEvaluate: t.text, isCode: false }, 'ctx')
        ids.push(
          ctx.adapt.propose(
            {
              slug: 'redirect-context',
              kind: 'integration',
              originalBehavior: 'Redirect entrega ao bot de destino um contexto inicial (tipo e valor).',
              proposedBehavior: 'Contexto gravado na variavel redirect_context e repassado via variablesToPass.',
              reason: 'Typebot link nao tem campo de contexto inicial.',
              changesBusinessBehavior: false,
              targetStrategy: 'variables-to-pass',
            },
            at,
          ),
        )
      }
      const link = seq.add('Typebot link', { typebotId: target, variablesToPass: [] }, 'lnk')
      refs.links.push(link)
      seq.terminated = true
      done('redirect-typebot-link', ids)
      return
    }

    case 'forwardToDesk': {
      const stateId = at.stateId ?? ''
      const q = ctx.config?.bindings.queues.find((x) => x.sourceBot === ctx.bot && x.sourceStateId.includes(stateId))
      if (q?.targetQueueId) {
        seq.add('transferToQueue', { queueId: q.targetQueueId }, 'tq')
        done('forward-to-queue')
      } else {
        const id = ctx.adapt.propose(
          {
            slug: 'desk-queue-pending',
            kind: 'handoff',
            originalBehavior: 'ForwardToDesk transfere para a fila de atendimento humano.',
            proposedBehavior: 'Fila ainda nao configurada: aviso ao cliente e encerramento explicito, sem UUID de fila ficticio.',
            reason: 'Decisao: fila unica com aviso; a fila precisa ser informada para ativar a transferencia.',
            changesBusinessBehavior: true,
            targetStrategy: 'parameter-required',
            fallbackKind: 'notice-and-end',
          },
          at,
        )
        ctx.warn('DESK_CONTINUATION_DIFFERENCE', 'ForwardToDesk sem fila configurada; emitido aviso e encerramento.', at)
        seq.add(
          'whatsapp-cloud',
          { action: 'Enviar texto', to: '{{wa_id}}', channel: '{{channel}}', credentialsId: ctx.credentialsId, cards: [], buttons: [], sections: [], body: 'No momento não consigo transferir seu atendimento. Por favor, tente novamente em instantes.' },
          'deskmsg',
        )
        seq.add('endSession', { reason: 'fila_nao_configurada' }, 'end')
        done('forward-to-queue-pending', [id])
      }
      ctx.b.variable('wa_id')
      ctx.b.variable('channel')
      seq.terminated = true
      return
    }

    case 'leavingFromDesk': {
      const id = ctx.adapt.propose(
        {
          slug: 'post-attendance-separate-flow',
          kind: 'handoff',
          originalBehavior: 'LeavingFromDesk retoma o bot apos o atendimento humano.',
          proposedBehavior: 'Pos-atendimento em fluxo separado, acionado por integracao viavel ou procedimento manual documentado.',
          reason: 'Decisao Q10; uma sessao encerrada nao pode ser retomada.',
          changesBusinessBehavior: true,
          targetStrategy: 'separate-flow',
        },
        at,
      )
      ctx.warn('DESK_CONTINUATION_DIFFERENCE', 'LeavingFromDesk nao emitido no fluxo principal.', at)
      ctx.map(at, 'post-attendance-separate', { groupKeys: [seq.cur.id], blockKeys: [] }, [id])
      return
    }

    default:
      ctx.warn('SOURCE_STRUCTURE_UNKNOWN', `Acao ${a.type} sem emissor.`, at)
  }
}

function emitHttp(seq: Seq, a: MigrationAction): void {
  const { ctx } = seq
  const at = a.source
  const set = a.settings
  const method = text(set.method).toUpperCase() || 'GET'
  const urlT = translate(ctx, text(set.uri), at)
  const pre = [...urlT.prelude]

  const headers: { id: string; key: string; value: string }[] = []
  if (isObj(set.headers)) {
    for (const [k, v] of Object.entries(set.headers)) {
      let value = text(v)
      if (SECRET_KEY.test(k) && value !== '' && !value.includes('{{')) {
        const key = toResourceKey(`blip.${ctx.bot}.${resourceSlug(k)}`)
        ctx.secrets.push({ bot: ctx.bot, resourceKey: key, source: { file: ctx.file, jsonPointer: `${at.jsonPointer}/settings/headers/${k}` } })
        ctx.warn('SECRET_EXTRACTED_FROM_SOURCE', `Cabecalho "${k}" tinha valor literal; substituido por {{resource.${key}}}. Preencher o Recurso secreto.`, at)
        // Sentinela: o traducer trataria `{{resource.*}}` como recurso externo da Blip e trocaria a chave.
        value = `@@SECRET(${key})@@`
      }
      const t = translate(ctx, value, at)
      t.text = t.text.replace(/@@SECRET\(([^)]+)\)@@/g, '{{resource.$1}}')
      const kt = translate(ctx, k, at)
      pre.push(...t.prelude, ...kt.prelude)
      headers.push({ id: ctx.b.id(`hdr:${at.jsonPointer}:${k}`), key: kt.text, value: t.text })
    }
  }

  let body = typeof set.body === 'string' ? set.body : undefined
  if (body !== undefined) {
    let n = 0
    body = body.replace(/("([^"\\]*(?:chave\w*|token\w*|senha|secret\w*|password|api[-_]?key)[^"\\]*)"\s*:\s*")((?:[^"\\]|\\.)*)(")/gi, (whole, pre1: string, name: string, val: string, post: string) => {
      if (val === '' || val.includes('{{')) return whole
      const key = toResourceKey(`blip.${ctx.bot}.${resourceSlug(name)}${n++ ? `_${n}` : ''}`)
      ctx.secrets.push({ bot: ctx.bot, resourceKey: key, source: { file: ctx.file, jsonPointer: `${at.jsonPointer}/settings/body` } })
      ctx.warn('SECRET_EXTRACTED_FROM_SOURCE', `Corpo HTTP tinha valor literal em "${name}"; substituido por {{resource.${key}}}. Preencher o Recurso secreto.`, at)
      return `${pre1}@@SECRET(${key})@@${post}`
    })
  }
  const bodyT = body === undefined ? undefined : translate(ctx, body, at)
  if (bodyT) bodyT.text = bodyT.text.replace(/@@SECRET\(([^)]+)\)@@/g, '{{resource.$1}}')
  if (bodyT) pre.push(...bodyT.prelude)

  const missing = !ctx.config || ctx.config.bindings.integrations.every((i) => i.contractFile === null)
  if (missing) {
    ctx.warn('INTEGRATION_CONTRACT_PENDING', `HTTP ${method} ${text(set.uri)}: contrato nao confirmado; Webhook gerado a partir da origem, sem homologacao.`, at)
  }
  const blipHttp = /msging\.net/i.test(text(set.uri))
  if (blipHttp) {
    const id = ctx.adapt.propose(
      {
        slug: 'blip-platform-http',
        kind: 'integration',
        originalBehavior: 'HTTP para a API da plataforma Blip (commands/messages).',
        proposedBehavior: 'Nenhuma chamada e emitida; integracao Blip precisa de alternativa confirmada.',
        reason: 'A dependencia continua sendo da Blip mesmo se passasse a Webhook.',
        changesBusinessBehavior: true,
        targetStrategy: 'parameter-required',
      },
      at,
    )
    ctx.warn('BLIP_COMMAND_UNMAPPED', `HTTP para ${text(set.uri)} depende da plataforma Blip; nao emitido.`, at)
    ctx.map(at, 'blip-http-unmapped', { groupKeys: [seq.cur.id], blockKeys: [] }, [id])
    return
  }

  seq.code([...new Set(pre)])
  const start = seq.cur.blocks.length
  seq.add(
    'Webhook',
    {
      webhook: {
        url: urlT.text,
        method,
        headers,
        queryParams: [],
        ...(bodyT ? { body: bodyT.text } : {}),
      },
      isCustomBody: bodyT !== undefined,
      timeout: 30,
      responseVariableMapping: [],
    },
    'http',
  )
  // Copia imediata antes do proximo Webhook (spec 7.4): api_status/api_response
  // sao sobrescritos a cada chamada.
  for (const [src, key] of [
    ['api_status', 'responseStatusVariable'],
    ['api_response', 'responseBodyVariable'],
  ] as const) {
    const target = text(set[key])
    if (!target) continue
    ctx.b.variable(src)
    const v = ctx.b.variable(varNameOf(ctx, target, at))
    seq.add('Set variable', { type: 'Custom', variableId: v.id, expressionToEvaluate: `{{${src}}}`, isCode: false }, 'cp')
  }
  const blocks = seq.cur.blocks.slice(start).map((b) => b.id)
  ctx.map(at, 'http-webhook', { groupKeys: [seq.cur.id], blockKeys: blocks })
}
