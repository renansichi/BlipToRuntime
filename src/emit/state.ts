import type { AdaptationRegistry } from '../adapt/registry.js'
import type { DynamicTarget } from '../analysis/graph.js'
import type { ConverterConfig } from '../config/schema.js'
import type { MigrationBot, MigrationState, OrderedExit, TargetRef } from '../ir/types.js'
import type { SourceRef } from '../analysis/types.js'
import { type BlockRefs, emitAction, emitActions } from './actions.js'
import { DocBuilder, type KBlock, type KGroup, type LinkFrom } from './builder.js'
import { EmitCtx } from './context.js'
import { emitMessage } from './messages.js'
import { buildDecision, emitDecisionPre } from './predicates.js'
import { Seq } from './seq.js'
import { varNameOf } from './translate.js'

// Emissao de um bot (F2-03/04/05): um grupo por estado Blip, com a ordem
// entrar -> enviar -> (aguardar+validar) -> sair -> escolher saida. A
// otimizacao (fundir/agrupar) fica para a F4; aqui a prioridade e preservar
// efeitos e rastrear a origem.

export interface EmitBotOptions {
  mb: MigrationBot
  dynamicTargets: DynamicTarget[]
  adapt: AdaptationRegistry
  config: ConverterConfig | undefined
  /** O bot le state.id/state.name/state.previous.*: cada grupo de estado atualiza essas variaveis. */
  usesStateNamespace?: boolean
  /** Campos de contato so escritos (nenhum bot do pacote os le). */
  writeOnlyKeys?: ReadonlySet<string>
  /** Descarta as escritas acima: so com adaptacao aceita na configuracao. */
  discardWriteOnly?: boolean
  /** Otimizacoes de estrutura da F4 (padrao: ligadas). */
  optimize?: boolean
  /** Arestas para blocos dentro do grupo (nao sobrevivem ao importador do Kayros OS). */
  blockEdges?: boolean
  /**
   * Entrada de TESTE (homologacao): a conversa comeca neste estado, depois de gravar as variaveis de
   * `presets` (chave = expressao Blip, ex.: tunnel.owner). Nao existe na origem; so para validar um trecho.
   */
  testEntry?: { stateId: string; presets: Record<string, string> }
}

export interface EmittedBot {
  ctx: EmitCtx
  b: DocBuilder
  stats: { states: number; groups: number; blocks: number; edges: number }
}

const isTimeoutExit = (e: OrderedExit): boolean =>
  e.predicates.length === 1 && e.predicates[0]?.source === 'input' && e.predicates[0]?.op === 'notExists'

export function emitBot(o: EmitBotOptions): EmittedBot {
  const { mb } = o
  const b = new DocBuilder(mb.name)
  const ctx = new EmitCtx(mb.name, mb.file, b, o.adapt, o.config, o.writeOnlyKeys, o.discardWriteOnly, o.optimize ?? true, o.blockEdges ?? false)
  const refs: BlockRefs = { links: [] }

  const groups = new Map<string, KGroup>()
  for (const st of mb.states) groups.set(st.stateId, b.group(`s:${st.stateId}`, st.title || st.stateId))

  const dynByKey = new Map<string, DynamicTarget>()
  for (const d of o.dynamicTargets) if (d.bot === mb.name) dynByKey.set(d.pointer, d)

  let unresolvedGroup: KGroup | undefined
  const fallbackGroup = (): KGroup => {
    const fb = groups.get('fallback')
    if (fb) return fb
    if (!unresolvedGroup) {
      unresolvedGroup = b.group('unresolved-destination', 'Destino nao resolvido')
      b.block(unresolvedGroup, 'unresolved:end', 'endSession', { reason: 'destino_nao_resolvido' })
    }
    return unresolvedGroup
  }

  const dynRouters = new Map<string, KGroup>()
  const dynamicRouter = (st: MigrationState, e: OrderedExit & { target: Extract<TargetRef, { kind: 'dynamic' }> }): KGroup => {
    const key = `${st.stateId}:${e.index}`
    const cached = dynRouters.get(key)
    if (cached) return cached
    const g = b.group(`dyn:${key}`, `Destino {{${e.target.variable}}}`)
    dynRouters.set(key, g)
    const info = dynByKey.get(e.pointer)
    const v = b.variable(varNameOf(ctx, e.target.variable, st.source))
    const cond = b.block(g, `dyn:${key}:cond`, 'Condition')
    for (const sid of info?.candidateStateIds ?? []) {
      const target = groups.get(sid)
      if (!target) continue
      const item = b.item(cond, `dyn:${key}:${sid}`, {
        logicalOperator: 'OR',
        comparisons: [{ id: b.id(`cmp:dyn:${key}:${sid}`), variableId: v.id, comparisonOperator: 'Equal to', value: sid }],
      })
      b.link({ kind: 'item', block: cond, item }, target)
    }
    b.link({ kind: 'block', block: cond }, fallbackGroup())
    if (!info || !info.complete) {
      ctx.warn(
        'DYNAMIC_TARGET_UNRESOLVED',
        `Destino {{${e.target.variable}}}: ${info?.candidateStateIds.length ?? 0} candidato(s) conhecido(s); valores fora deles seguem para o estado de excecao.`,
        st.source,
      )
    }
    o.adapt.propose(
      {
        slug: 'dynamic-destination-router',
        kind: 'presentation',
        originalBehavior: 'Saida cujo destino e o valor de uma variavel em tempo de execucao.',
        proposedBehavior: 'Condition comparando a variavel com os ids de estado candidatos; valor desconhecido segue para o estado de excecao.',
        reason: 'Edges do Kayros tem destino fixo.',
        changesBusinessBehavior: false,
        targetStrategy: 'condition-router',
      },
      st.source,
    )
    return g
  }

  const targetGroup = (st: MigrationState, e: OrderedExit): KGroup => {
    if (e.target.kind === 'state') {
      const g = groups.get(e.target.stateId)
      if (g) return g
      ctx.warn('TARGET_EDGE_INVALID', `Saida aponta para estado ausente ${e.target.stateId}.`, st.source)
      return fallbackGroup()
    }
    return dynamicRouter(st, e as OrderedExit & { target: Extract<TargetRef, { kind: 'dynamic' }> })
  }

  const timeouts: { stateId: string; target: KGroup }[] = []

  for (const st of mb.states) emitState(st)

  function emitState(st: MigrationState): void {
    const g = groups.get(st.stateId) as KGroup
    const seq = new Seq(ctx, `s:${st.stateId}`, g)
    ctx.map(st.source, 'state-group', { groupKeys: [g.id], blockKeys: [] })
    const noMessage = !st.input.bypass && !st.root && !st.messages.some((m) => m.kind !== 'chatstate')
    const waitScope = st.stateId.slice(0, 8)
    const waitId = `${mb.name}:wait-without-message:${waitScope}`
    const waitDecision = noMessage ? o.config?.adaptations.find((x) => x.id === waitId) : undefined
    // Espera sem envio removida por decisao aceita (a espera era dispensavel).
    const waitRemoved = waitDecision?.acceptance.status === 'accepted' && waitDecision.fallback.kind === 'remove'
    const waits = !st.input.bypass && !st.root && !waitRemoved
    const minutes = waits ? st.input.timeoutMinutes : undefined
    const skipped: SourceRef[] = []
    // Nada some em silencio: o que fica sem emitir depois de uma acao terminal consta do mapa de origem.
    const skip = (ref: SourceRef) => {
      skipped.push(ref)
      ctx.map(ref, 'skipped-after-terminal', { groupKeys: [g.id], blockKeys: [] })
    }
    const inputRef: SourceRef = { ...st.source, jsonPointer: st.input.pointer, phase: 'input' }
    let awaitMapped = false
    const mapInput = () => {
      const kind = st.input.bypass ? 'input-bypass' : waitRemoved ? 'input-wait-removed' : st.root ? 'input-first-message' : awaitMapped ? 'input-await' : 'input-skipped-after-terminal'
      ctx.map(inputRef, kind, { groupKeys: [g.id], blockKeys: [] })
    }

    if (o.usesStateNamespace) {
      // state.* da Blip: o estado anterior e o corrente, mantidos por grupo de estado.
      for (const [name, value] of [['state_previous_id', '{{state_id}}'], ['state_previous_name', '{{state_name}}'], ['state_id', st.stateId], ['state_name', st.title.replaceAll('{{', '{ {')]] as const) {
        const sv = b.variable(name)
        seq.add('Set variable', { type: 'Custom', variableId: sv.id, expressionToEvaluate: value, isCode: false }, 'st')
      }
    }

    if (st.root) {
      // O estado inicial consome a mensagem que abriu a conversa.
      b.variable('last_message')
      const v = b.variable('input_content')
      seq.add('Set variable', { type: 'Custom', variableId: v.id, expressionToEvaluate: '{{last_message}}', isCode: false }, 'first')
    }

    let step = 0
    for (const x of emitActions(seq, st.enter, refs)) skip(x.source)

    // Mensagens
    const sends = st.messages.filter((m) => m.kind !== 'chatstate')
    let awaitBlock: KBlock | undefined
    let awaitGroup: KGroup | undefined
    st.messages.forEach((m) => {
      if (seq.terminated) {
        skip(m.source)
        return
      }
      const isLast = sends.length > 0 && m === sends[sends.length - 1]
      if (waits && isLast && st.input.validation?.rule === 'regex' && st.input.validation.regex) {
        // A repeticao da pergunta (resposta invalida) volta a ESTE grupo: a pergunta ganha grupo proprio.
        const base = seq.cur.title.split(' · ')[0] ?? seq.cur.title
        const ask = seq.newGroup('ask', `${base} · pergunta`)
        seq.closeTo(ask)
        seq.cur = ask
      }
      if (waits && isLast && minutes !== undefined) {
        const tv = b.variable('timeout_state')
        seq.add('Set variable', { type: 'Custom', variableId: tv.id, expressionToEvaluate: st.stateId, isCode: false }, 'tstate')
      }
      const blk = emitMessage(seq, m, { awaitReply: waits && isLast, ...(waits && isLast && minutes !== undefined ? { followUpMinutes: minutes } : {}) })
      if (waits && isLast && blk) {
        awaitBlock = blk
        awaitGroup = seq.cur
        awaitMapped = true
      }
    })

    if (waitRemoved) {
      o.adapt.propose({ slug: 'wait-without-message', scope: waitScope, kind: 'wait', originalBehavior: 'Estado aguarda entrada do usuario sem enviar mensagem.', proposedBehavior: 'Espera dispensavel removida: o fluxo segue sem aguardar.', reason: 'Decisao aceita de remover a espera.', changesBusinessBehavior: true, targetStrategy: 'remove-wait', fallbackKind: 'remove' }, st.source)
      ctx.map(st.source, 'wait-removed', { groupKeys: [g.id], blockKeys: [] }, [waitId])
    }

    if (waits && !awaitBlock && !seq.terminated) {
      // Espera sem envio (spec 3.3): pergunta curta e contextualizada (Q09).
      const id = o.adapt.propose(
        {
          slug: 'wait-without-message',
          scope: waitScope,
          kind: 'wait',
          originalBehavior: 'Estado aguarda entrada do usuario sem enviar mensagem.',
          proposedBehavior: 'Pergunta curta e contextualizada com aguardo de resposta; eliminavel se a espera for dispensavel (revisar por estado).',
          reason: 'O Kayros so aguarda resposta apos um envio (awaitReply no bloco WhatsApp).',
          changesBusinessBehavior: true,
          targetStrategy: 'contextual-question',
          fallbackKind: 'contextual-question',
        },
        st.source,
      )
      ctx.warn('WAIT_WITHOUT_MESSAGE', `Estado "${st.title}" aguarda sem enviar mensagem; emitida pergunta contextual (a revisar).`, st.source)
      b.variable('wa_id')
      b.variable('channel')
      if (minutes !== undefined) {
        const tv = b.variable('timeout_state')
        seq.add('Set variable', { type: 'Custom', variableId: tv.id, expressionToEvaluate: st.stateId, isCode: false }, 'tstate')
      }
      const blk = seq.add(
        'whatsapp-cloud',
        {
          action: 'Enviar texto', to: '{{wa_id}}', channel: '{{channel}}', credentialsId: ctx.credentialsId, cards: [], buttons: [], sections: [],
          body: waitDecision?.fallback.promptText ?? 'Pode me confirmar para continuarmos?',
          awaitReply: true,
          replyVariableId: b.variable('input_content').id,
          ...(minutes !== undefined ? { followUp: { isEnabled: true, attempts: [{ send: { action: 'Desviar para follow-up' }, delayInMinutes: minutes }] } } : {}),
        },
        'ask',
      )
      awaitBlock = blk
      awaitGroup = seq.cur
      awaitMapped = true
      ctx.map(st.source, 'wait-without-message', { groupKeys: [seq.cur.id], blockKeys: [blk.id] }, [id])
    }

    // Continuacao apos a captura: acoes globais por interacao e validacao.
    if ((waits || st.root) && !seq.terminated) {
      for (const a of mb.globalEnter) emitAction(seq, a, refs)
      if (mb.globalEnter.length > 0) {
        o.adapt.propose(
          {
            slug: 'global-actions-per-interaction',
            kind: 'integration',
            originalBehavior: 'Acoes globais de entrada executam a cada interacao do usuario.',
            proposedBehavior: 'Acoes replicadas logo apos cada captura de resposta e no estado inicial.',
            reason: 'O Kayros nao tem gancho global por interacao (o evento reply nao executa blocos arbitrarios).',
            changesBusinessBehavior: false,
            targetStrategy: 'inline-after-capture',
          },
          mb.globalEnter[0]?.source ?? st.source,
        )
      }
    }

    if (waits && awaitBlock && awaitGroup && !seq.terminated) {
      const v = st.input.validation
      if (v?.rule === 'regex' && v.regex) {
        const preds = [{ source: 'input' as const, op: 'matches', values: [v.regex], pointer: st.source.jsonPointer }]
        const dec = buildDecision(ctx, preds, st.source, seq.key('valid'))
        if (dec) {
          const bad = seq.newGroup('bad', 'Resposta invalida')
          const ok = seq.newGroup('ok', 'Resposta valida')
          emitDecisionPre(seq, [dec])
          const cond = seq.add('Condition', undefined, 'vld')
          const item = b.item(cond, seq.key('vitem'), dec.content)
          b.link({ kind: 'item', block: cond, item }, ok)
          b.link({ kind: 'block', block: cond }, bad)
          const msg = b.block(bad, seq.key('verr'), 'whatsapp-cloud', {
            action: 'Enviar texto', to: '{{wa_id}}', channel: '{{channel}}', credentialsId: ctx.credentialsId, cards: [], buttons: [], sections: [],
            body: v.error ?? 'Resposta invalida. Tente novamente.',
          })
          b.link({ kind: 'block', block: msg }, awaitGroup)
          seq.cur = ok
          o.adapt.propose(
            {
              slug: 'input-regex-validation',
              kind: 'validation',
              originalBehavior: 'Validacao de input por regex da Blip, com mensagem de erro e nova tentativa.',
              proposedBehavior: 'Condition "Matches regex" apos a captura; invalido envia o erro e repete a pergunta.',
              reason: 'Validacao fica no fluxo; dialeto de regex e limites (500 caracteres, 50 ms) a validar.',
              changesBusinessBehavior: false,
              targetStrategy: 'condition-regex',
            },
            st.source,
          )
        }
      } else if (v) {
        ctx.warn('INPUT_VALIDATION_DECLARED', `Validacao "${v.rule}" do input nao emitida; confirmar semantica.`, st.source)
        o.adapt.propose(
          {
            slug: 'input-validation-text',
            kind: 'validation',
            originalBehavior: `Validacao de input do tipo ${v.rule}.`,
            proposedBehavior: 'Sem validacao no fluxo ate a regra ser confirmada.',
            reason: 'Semantica da regra nao disponivel nos arquivos.',
            changesBusinessBehavior: true,
            targetStrategy: 'parameter-required',
          },
          st.source,
        )
      }
      if (st.input.conditions.length > 0) {
        ctx.warn('INPUT_VALIDATION_DECLARED', 'Input condicional (Desk) nao emitido; confirmar aguardo condicionado.', st.source)
      }
    }

    if (seq.terminated) for (const x of st.leave) skip(x.source)
    else for (const x of emitActions(seq, st.leave, refs)) skip(x.source)
    for (const a of st.afterStateChange) emitAction(seq, a, refs)

    if (seq.terminated) {
      for (const e of [...st.exits, ...(st.defaultExit ? [st.defaultExit] : [])]) skip(exitRef(st, e))
      mapInput()
      const n = skipped.length
      if (n > 0) {
        ctx.warn(
          'UNREACHABLE_AFTER_TERMINAL',
          `Estado "${st.title}": ${n} elemento(s) apos uma acao terminal nao emitido(s) (${skipped.length} passo(s)/saida(s)).`,
          st.source,
        )
      }
      return
    }
    emitExits(seq, st, minutes !== undefined)
    mapInput()
    if (seq.hasPending()) ctx.warn('TARGET_EDGE_INVALID', `Estado "${st.title}": ramo "senao" de acao condicional sem destino.`, st.source)
    void step
  }

  function exitRef(st: MigrationState, e: OrderedExit): SourceRef {
    return { ...st.source, jsonPointer: e.pointer, phase: 'leave', ordinal: e.index }
  }

  function emitExits(seq: Seq, st: MigrationState, hasTimeout: boolean): void {
    const normal: OrderedExit[] = []
    let timeoutExit: OrderedExit | undefined
    for (const e of st.exits) {
      if (hasTimeout && isTimeoutExit(e)) timeoutExit ??= e
      else normal.push(e)
    }
    for (const e of st.exits) {
      if (hasTimeout && isTimeoutExit(e)) ctx.map(exitRef(st, e), e === timeoutExit ? 'exit-timeout-router' : 'exit-unreachable', { groupKeys: [], blockKeys: [] })
    }
    if (timeoutExit) {
      timeouts.push({ stateId: st.stateId, target: targetGroup(st, timeoutExit) })
      o.adapt.propose(
        {
          slug: 'input-timeout-followup',
          kind: 'wait',
          originalBehavior: 'Input com expiracao: sem resposta no prazo, segue a saida "input nao existe".',
          proposedBehavior: 'Follow-up por inatividade do bloco WhatsApp desvia para um roteador que usa timeout_state para escolher o destino.',
          reason: 'O Kayros tem um unico evento followUp por bot; destino por estado exige roteador. Semantica de prazo a validar na homologacao.',
          changesBusinessBehavior: true,
          targetStrategy: 'followup-router',
        },
        st.source,
      )
    }

    // Saidas em ordem; uma saida sem condicao funciona como padrao (as seguintes sao inalcancaveis).
    const items: { e: OrderedExit; dec: NonNullable<ReturnType<typeof buildDecision>> }[] = []
    let fallthrough: OrderedExit | undefined
    for (let i = 0; i < normal.length; i++) {
      const e = normal[i] as OrderedExit
      if (e.predicates.length === 0) {
        fallthrough = e
        ctx.map(exitRef(st, e), 'exit-default', { groupKeys: [], blockKeys: [] })
        for (const rest of normal.slice(i + 1)) ctx.map(exitRef(st, rest), 'exit-unreachable', { groupKeys: [], blockKeys: [] })
        break
      }
      const dec = buildDecision(ctx, e.predicates, st.source, seq.key(`exit${e.index}`))
      if (dec) {
        items.push({ e, dec })
        ctx.map(exitRef(st, e), 'exit-condition', { groupKeys: [], blockKeys: [] })
      } else ctx.map(exitRef(st, e), 'exit-unsupported', { groupKeys: [], blockKeys: [] })
    }
    const def = fallthrough ?? st.defaultExit
    if (st.defaultExit) ctx.map(exitRef(st, st.defaultExit), fallthrough ? 'exit-unreachable' : 'exit-default', { groupKeys: [], blockKeys: [] })
    const defGroup = def ? targetGroup(st, def) : fallbackGroup()
    if (!def) ctx.warn('TARGET_EDGE_INVALID', `Estado "${st.title}" sem saida padrao; usando estado de excecao.`, st.source)

    if (items.length === 0) {
      seq.closeTo(defGroup)
      return
    }
    emitDecisionPre(seq, items.map((i) => i.dec))
    const cond = seq.add('Condition', undefined, 'exits')
    for (const { e, dec } of items) {
      const item = b.item(cond, seq.key(`xi${e.index}`), dec.content)
      b.link({ kind: 'item', block: cond, item } as LinkFrom, targetGroup(st, e))
    }
    b.link({ kind: 'block', block: cond }, defGroup)
    ctx.map(st.source, 'exits-condition', { groupKeys: [seq.cur.id], blockKeys: [cond.id] })
  }

  // Evento start -> estado inicial.
  const root = mb.states.find((s) => s.root)
  const start = b.event('start', 'start')
  if (root) b.link({ kind: 'event', event: start }, groups.get(root.stateId) as KGroup)
  else ctx.warn('TARGET_EDGE_INVALID', 'Bot sem estado inicial (root).', { jsonPointer: '/configuracoes_gerais/fluxo/flow' })

  // Roteador do follow-up: timeout_state -> destino de abandono do estado.
  if (timeouts.length > 0) {
    const router = b.group('timeout-router', 'Roteador de timeout')
    const cond = b.block(router, 'timeout:cond', 'Condition')
    const v = b.variable('timeout_state')
    for (const t of timeouts) {
      const item = b.item(cond, `timeout:${t.stateId}`, {
        logicalOperator: 'OR',
        comparisons: [{ id: b.id(`cmp:timeout:${t.stateId}`), variableId: v.id, comparisonOperator: 'Equal to', value: t.stateId }],
      })
      b.link({ kind: 'item', block: cond, item }, t.target)
    }
    b.link({ kind: 'block', block: cond }, fallbackGroup())
    const fu = b.event('followUp', 'followUp')
    b.link({ kind: 'event', event: fu }, router)
  }

  if (o.testEntry) {
    const target = groups.get(o.testEntry.stateId)
    const startEdge = b.edges.find((e) => e.id === start.outgoingEdgeId)
    if (target && startEdge) {
      const g = b.group('test:entry', 'Entrada de teste')
      const at = mb.states.find((s) => s.stateId === o.testEntry?.stateId)?.source as SourceRef
      for (const [key, value] of Object.entries(o.testEntry.presets)) {
        const v = b.variable(varNameOf(ctx, key, at))
        b.block(g, `test:set:${key}`, 'Set variable', value === '' ? { type: 'Empty', variableId: v.id } : { type: 'Custom', variableId: v.id, expressionToEvaluate: value, isCode: false })
      }
      if (g.blocks.length === 0) b.block(g, 'test:pass', 'Code', { name: 'gerado', content: '// entrada de teste' })
      b.link({ kind: 'block', block: g.blocks[g.blocks.length - 1] as KBlock }, target)
      startEdge.to = { groupId: g.id }
    }
  }

  // variablesToPass: todas as variaveis do bot (heranca explicita no bot de destino).
  const names = b.variableList().map((v) => v.name)
  for (const l of refs.links) (l.options as { variablesToPass: string[] }).variablesToPass = names

  return {
    ctx,
    b,
    stats: {
      states: mb.states.length,
      groups: b.groups.length,
      blocks: b.groups.reduce((n, g) => n + g.blocks.length, 0),
      edges: b.edges.length,
    },
  }
}
