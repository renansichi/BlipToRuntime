import { TARGET_LIMITS } from '../profile/kayros-current-adapted.js'
import type { MigrationMessage } from '../ir/types.js'
import type { KBlock } from './builder.js'
import type { Seq } from './seq.js'
import { translate } from './translate.js'

// Mensagens (F2-04): texto, midia, menus e payloads raw -> acoes tipadas do
// bloco whatsapp-cloud. O destinatario e o canal vem da sessao; enderecamento
// da origem nao e carregado (spec 7.5).

/** Marcacao HTML da Blip -> marcacao WhatsApp. So converte o que reconhece. */
export function markup(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(b|strong)>/gi, '*')
    .replace(/<\/?(i|em)>/gi, '_')
    .replace(/<\/?(s|strike|del)>/gi, '~')
}

const hasMarkup = (s: string): boolean => /<\/?(b|strong|i|em|s|strike|del|br)\b/i.test(s)

const base = (action: string, credentialsId: string): Record<string, unknown> => ({
  action,
  to: '{{wa_id}}',
  channel: '{{channel}}',
  credentialsId,
  cards: [],
  buttons: [],
  sections: [],
})

function mediaType(mime: string): string {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return 'document'
}

export interface SendOptions {
  /** Aguardar resposta do usuario neste envio e gravar em input_content. */
  awaitReply: boolean
  /** Atraso (min) do follow-up por inatividade, se houver timeout. */
  followUpMinutes?: number
}

/** Retorna o bloco que carrega o aguardo de resposta (ou o unico bloco emitido). */
export function emitMessage(seq: Seq, m: MigrationMessage, opt: SendOptions): KBlock | undefined {
  const { ctx } = seq
  const at = m.source
  ctx.b.variable('wa_id')
  ctx.b.variable('channel')

  if (m.kind === 'chatstate') {
    ctx.adapt.propose(
      {
        slug: 'typing-indicator-dropped',
        kind: 'presentation',
        originalBehavior: 'Indicador de digitacao (chatstate composing) antes de mensagens.',
        proposedBehavior: 'Omitido; o envio sai sem indicador.',
        reason: 'Mudanca de apresentacao que preserva o resultado.',
        changesBusinessBehavior: false,
        targetStrategy: 'omit',
      },
      at,
    )
    ctx.map(at, 'typing-indicator-omitted', { groupKeys: [], blockKeys: [] }, [`${ctx.bot}:typing-indicator-dropped`])
    return undefined
  }

  let block: KBlock
  const prelude: string[] = []
  const tr = (s: string): string => {
    const t = translate(ctx, s, at)
    prelude.push(...t.prelude)
    return t.text
  }
  const flushPrelude = () => {
    seq.code([...new Set(prelude)])
  }
  const note = (s: string): string => {
    if (hasMarkup(s)) {
      ctx.adapt.propose(
        {
          slug: 'html-markup-to-whatsapp',
          kind: 'presentation',
          originalBehavior: 'Texto com marcacao HTML (<b>, <i>, <br>) da Blip.',
          proposedBehavior: 'Marcacao convertida para a sintaxe do WhatsApp (*negrito*, _italico_).',
          reason: 'Mudanca de apresentacao que preserva o resultado.',
          changesBusinessBehavior: false,
          targetStrategy: 'markup-conversion',
        },
        at,
      )
    }
    return markup(s)
  }

  if (m.kind === 'text') {
    const body = tr(note(String(m.content ?? '')))
    flushPrelude()
    block = seq.add('whatsapp-cloud', { ...base('Enviar texto', ctx.credentialsId), body }, 'msg')
  } else if (m.kind === 'media' && typeof m.content === 'object' && m.content !== null) {
    const c = m.content as Record<string, unknown>
    const link = tr(String(c.uri ?? ''))
    const caption = tr(note(String(c.text ?? c.title ?? '')))
    flushPrelude()
    block = seq.add('whatsapp-cloud', { ...base('Enviar mídia', ctx.credentialsId), link, mediaType: mediaType(String(c.type ?? '')), caption }, 'media')
  } else if (m.kind === 'select' && typeof m.content === 'object' && m.content !== null) {
    const c = m.content as { text?: unknown; options?: { text?: unknown; value?: unknown }[] }
    const bodyText = tr(note(String(c.text ?? '')))
    // O texto capturado em awaitReply e o TITULO (o motor passa reply = title); o id so roteia e
    // e trocado pelo importador, entao e um id estavel sem significado.
    const opts = (c.options ?? []).map((o, i) => ({
      title: tr(String(o.text ?? '')),
      id: ctx.b.id(`opt:${at.jsonPointer}:${i}`),
    }))
    flushPrelude()
    if (opts.length <= TARGET_LIMITS.buttonsMax) {
      for (const o of opts) {
        if (o.title.length > TARGET_LIMITS.buttonTitleMax) {
          ctx.warn('MENU_OPTIONS_EXCEED_LIMIT', `Titulo de botao com ${o.title.length} caracteres (limite ${TARGET_LIMITS.buttonTitleMax}); nao truncado.`, at)
        }
      }
      block = seq.add('whatsapp-cloud', { ...base('Enviar botões', ctx.credentialsId), bodyText, buttons: opts.map((o, i) => ({ id: o.id, title: o.title, key: i })).map(({ key: _k, ...r }) => r) }, 'menu')
    } else if (opts.length <= TARGET_LIMITS.listItemsMax) {
      for (const o of opts) {
        if (o.title.length > TARGET_LIMITS.listTitleMax) {
          ctx.warn('MENU_OPTIONS_EXCEED_LIMIT', `Titulo de item com ${o.title.length} caracteres (limite ${TARGET_LIMITS.listTitleMax}); nao truncado.`, at)
        }
      }
      block = seq.add(
        'whatsapp-cloud',
        { ...base('Enviar lista', ctx.credentialsId), bodyText, buttonText: 'Ver opções', sections: [{ title: 'Opções', rows: opts.map((o) => ({ id: o.id, title: o.title })) }] },
        'menu',
      )
    } else {
      const id = ctx.adapt.propose(
        {
          slug: 'menu-exceeds-list-limit',
          kind: 'presentation',
          originalBehavior: 'Menu com mais opcoes do que uma lista do WhatsApp comporta.',
          proposedBehavior: 'Opcoes enviadas em texto numerado, com resposta por texto; paginacao com retorno a definir.',
          reason: 'Sem truncar opcoes de negocio (limite de 10 itens).',
          changesBusinessBehavior: true,
          targetStrategy: 'text-menu',
        },
        at,
      )
      ctx.warn('MENU_OPTIONS_EXCEED_LIMIT', `Menu com ${opts.length} opcoes (limite ${TARGET_LIMITS.listItemsMax}); enviado como texto.`, at)
      const body = [bodyText, ...opts.map((o) => `- ${o.title}`)].join('\n')
      block = seq.add('whatsapp-cloud', { ...base('Enviar texto', ctx.credentialsId), body }, 'menu')
      ctx.map(at, 'menu-as-text', { groupKeys: [seq.cur.id], blockKeys: [block.id] }, [id])
    }
  } else if (m.kind === 'raw') {
    const raw = tr(String(m.content ?? ''))
    flushPrelude()
    if (/^\s*\{\{[^{}]*\}\}\s*$/.test(String(m.content ?? ''))) {
      ctx.adapt.propose(
        {
          slug: 'dynamic-raw-payload',
          kind: 'presentation',
          originalBehavior: 'Payload de mensagem montado por script em tempo de execucao.',
          proposedBehavior: 'Enviar raw com o payload da variavel; o script que o monta e convertido em Code.',
          reason: 'O formato final do payload so existe em tempo de execucao.',
          changesBusinessBehavior: false,
          targetStrategy: 'raw-from-variable',
        },
        at,
      )
    }
    block = seq.add('whatsapp-cloud', { ...base('Enviar raw', ctx.credentialsId), payload: raw }, 'raw')
  } else {
    ctx.warn('SOURCE_STRUCTURE_UNKNOWN', `Conteudo ${m.mime} sem emissor.`, at)
    return undefined
  }

  const opts = block.options as Record<string, unknown>
  if (opt.awaitReply) {
    opts.awaitReply = true
    opts.replyVariableId = ctx.b.variable('input_content').id
    if (opt.followUpMinutes !== undefined) {
      opts.followUp = {
        isEnabled: true,
        attempts: [{ send: { action: 'Desviar para follow-up' }, delayInMinutes: opt.followUpMinutes }],
      }
    }
  }
  ctx.map(at, `message-${m.kind}`, { groupKeys: [seq.cur.id], blockKeys: [block.id] })
  return block
}
