import type { Analysis } from '../analysis/analyze.js'
import { collectSymbols } from '../analysis/symbols.js'
import type { ConvertedBot } from '../emit/convert.js'
import { normalizeBot } from '../ir/normalize.js'
import type { MigrationState } from '../ir/types.js'

// Relatorios de apoio a decisao por jornada (F3-01/02/03). Nao decidem nada:
// organizam a evidencia para o responsavel aceitar ou corrigir.

const md = (s: string): string => s.replaceAll('|', '\\|').replaceAll('\n', ' ')

function titleOf(bot: { states: MigrationState[] }, id: string): string {
  return bot.states.find((s) => s.stateId === id)?.title ?? id
}

/** F3-01: efeito original -> blocos emitidos, para os estados informados. */
export function journeyReport(a: Analysis, converted: ConvertedBot, stateTitles: string[]): string {
  const src = a.pkg.bots.find((b) => b.name === converted.name)
  if (!src) return ''
  const { bot } = normalizeBot(src)
  const blockType = new Map<string, string>()
  for (const g of converted.document.groups) for (const b of g.blocks) blockType.set(b.id, b.type)
  const byPointer = new Map<string, (typeof converted.sourceMap)[number][]>()
  for (const e of converted.sourceMap) {
    const l = byPointer.get(e.source.jsonPointer) ?? []
    l.push(e)
    byPointer.set(e.source.jsonPointer, l)
  }
  const mapped = (ptr: string): { blocks: string; adaptations: string } => {
    const es = byPointer.get(ptr) ?? []
    const types = es.flatMap((e) => e.target.blockKeys.map((id) => blockType.get(id) ?? '?'))
    const counts: Record<string, number> = {}
    for (const t of types) counts[t] = (counts[t] ?? 0) + 1
    return {
      blocks: Object.entries(counts).map(([t, n]) => (n > 1 ? `${t} x${n}` : t)).join(', ') || '— (nao emitido)',
      adaptations: [...new Set(es.flatMap((e) => e.adaptationIds))].map((x) => x.split(':').slice(1).join(':')).join(', '),
    }
  }

  const out: string[] = []
  out.push(`# Jornada ${converted.name} — efeito original → bloco emitido`, '')
  out.push('Gerado por `report`. Cada linha liga um elemento da Blip (arquivo + caminho JSON) ao que o conversor emitiu. “— (nao emitido)” indica adaptação (veja `adaptations.json`).', '')
  for (const title of stateTitles) {
    const st = bot.states.find((s) => s.title === title)
    if (!st) {
      out.push(`## ${title}`, '', '_Estado nao encontrado._', '')
      continue
    }
    out.push(`## ${st.title}`, '', `Origem: \`${bot.file}#${st.source.jsonPointer}\` · estado \`${st.stateId}\`${st.root ? ' · inicial' : ''}`, '')
    out.push('| Fase | Elemento original | Blocos emitidos | Adaptações |', '| --- | --- | --- | --- |')
    for (const act of st.enter) {
      const m = mapped(act.source.jsonPointer)
      out.push(`| entrada | ${md(act.type)}${act.title ? ` — ${md(act.title)}` : ''}${act.conditions.length ? ' (condicional)' : ''} | ${m.blocks} | ${m.adaptations} |`)
    }
    for (const msg of st.messages) {
      const m = mapped(msg.source.jsonPointer)
      out.push(`| conteudo | ${md(msg.kind)} ${md(msg.mime)} | ${m.blocks} | ${m.adaptations} |`)
    }
    const inp = st.input
    out.push(`| input | ${inp.bypass ? 'sem espera' : `aguarda resposta${inp.timeoutRaw ? ` (expiracao ${inp.timeoutRaw} = ${inp.timeoutMinutes} min)` : ''}${inp.validation ? ` · validacao ${inp.validation.rule}` : ''}`} | ${inp.bypass ? '—' : 'whatsapp-cloud awaitReply'} | ${inp.timeoutRaw ? 'input-timeout-followup' : ''} |`)
    for (const act of st.leave) {
      const m = mapped(act.source.jsonPointer)
      out.push(`| saida | ${md(act.type)}${act.title ? ` — ${md(act.title)}` : ''}${act.conditions.length ? ' (condicional)' : ''} | ${m.blocks} | ${m.adaptations} |`)
    }
    const exits = [...st.exits, ...(st.defaultExit ? [st.defaultExit] : [])]
    for (const e of exits) {
      const when = e.predicates.map((p) => `${p.source}${p.variable ? ':' + p.variable : ''} ${p.op}${p.values.length ? ' ' + JSON.stringify(p.values) : ''}`).join(' E ') || 'padrao'
      const to = e.target.kind === 'state' ? titleOf(bot, e.target.stateId) : e.target.expression
      out.push(`| decisao | ${md(when)} → ${md(to)} | Condition / aresta | ${e.target.kind === 'dynamic' ? 'dynamic-destination-router' : ''} |`)
    }
    out.push('')
  }
  return out.join('\n') + '\n'
}

/** F3-02: esperas sem envio, com a evidencia para decidir remover ou perguntar. */
export function waitsReport(a: Analysis, botName: string): string {
  const src = a.pkg.bots.find((b) => b.name === botName)
  if (!src) return ''
  const { bot } = normalizeBot(src)
  const dyn = a.graph.dynamicTargets.filter((d) => d.bot === botName)
  const rows: string[] = []
  for (const w of bot.states) {
    if (w.root || w.input.bypass || w.messages.some((m) => m.kind !== 'chatstate')) continue
    const lit = bot.states.filter((s) => [...s.exits, ...(s.defaultExit ? [s.defaultExit] : [])].some((e) => e.target.kind === 'state' && e.target.stateId === w.stateId))
    const viaDyn = [...new Set(dyn.filter((d) => d.candidateStateIds.includes(w.stateId)).map((d) => `{{${d.variable}}}`))]
    const readsInput =
      [...w.exits, ...(w.defaultExit ? [w.defaultExit] : [])].some((e) => e.predicates.some((p) => p.source === 'input' && p.op !== 'exists' && p.op !== 'notExists')) ||
      [...w.enter, ...w.leave].some((x) => JSON.stringify(x.settings).includes('input.content'))
    const hasRedirect = [...w.enter, ...w.leave].some((x) => x.kind === 'redirect' || x.kind === 'forwardToDesk')
    const advice = hasRedirect
      ? 'provavel dispensavel: o estado redireciona/transfere; a espera so adia o redirecionamento'
      : readsInput
        ? 'necessaria: decide ou processa o texto digitado pelo cliente'
        : 'a avaliar: nao le o conteudo da resposta'
    rows.push(
      `| ${md(w.title)} | \`${w.stateId.slice(0, 8)}\` | ${lit.map((s) => md(s.title)).join('; ') || '—'} | ${viaDyn.join(', ') || '—'} | ${readsInput ? 'sim' : 'nao'} | ${hasRedirect ? 'sim' : 'nao'} | ${w.input.timeoutRaw ?? '—'} | ${advice} |`,
    )
  }
  return [
    `# Esperas sem envio — ${botName}`,
    '',
    'Estados que aguardam entrada do usuario sem enviar mensagem (spec 3.3). Cada um gera a adaptacao `<bot>:wait-without-message:<id8>`.',
    'Para **remover** a espera, aceite a adaptacao com `fallback.kind = "remove"`; para **trocar a pergunta padrao**, informe `fallback.promptText`. Sem decisao, o pacote usa a pergunta padrao e a adaptacao fica `proposed`.',
    '',
    '| Estado | Id | Antecessores literais | Via destino calculado | Le o conteudo digitado | Redireciona/transfere | Expiracao | Indicacao (heuristica) |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n')
}

/** F3-03: dados temporarios x duraveis (evidencia de leitura/escrita no bot). */
export function dataReport(a: Analysis, botName: string): string {
  const src = a.pkg.bots.find((b) => b.name === botName)
  if (!src) return ''
  const uses = collectSymbols(src).uses
  const keys = new Map<string, { ns: string; name: string; w: number; r: number; ttl: boolean }>()
  for (const u of uses) {
    if (u.namespace !== 'contact.extras' && u.namespace !== 'contact' && u.namespace !== 'context') continue
    const k = `${u.namespace}:${u.name}`
    const e = keys.get(k) ?? { ns: u.namespace, name: u.name, w: 0, r: 0, ttl: false }
    if (u.kind === 'write') e.w++
    else e.r++
    keys.set(k, e)
  }
  for (const act of a.inventory.actions) {
    if (act.ref.bot === botName && act.type === 'SetVariable' && act.expiration !== undefined && act.variable) {
      const e = keys.get(`context:${act.variable}`)
      if (e) e.ttl = true
    }
  }
  const cls = (e: { w: number; r: number; ns: string }) =>
    e.w > 0 && e.r > 0 ? 'escrito e lido no bot' : e.w > 0 ? 'so escrito (BI/consumo externo?)' : 'so lido (vem de fora: entrada/campanha/router)'
  const rec = (e: { w: number; r: number; ns: string; ttl: boolean }) =>
    e.ns === 'context'
      ? e.ttl ? 'sessao (TTL vira adaptacao `ttl-session`)' : 'sessao'
      : e.w > 0 && e.r === 0
        ? 'decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato'
        : e.w === 0
          ? 'parametro: definir quem preenche (entrada/campanha)'
          : 'sessao (duravel so se a informacao precisar existir em uma nova conversa)'
  const rows = [...keys.values()]
    .sort((x, y) => `${x.ns}${x.name}`.localeCompare(`${y.ns}${y.name}`))
    .map((e) => `| ${e.ns} | ${md(e.name)} | ${e.w} | ${e.r} | ${cls(e)} | ${rec(e)} |`)
  return [
    `# Dados temporarios x duraveis — ${botName}`,
    '',
    'Evidencia de uso dentro do proprio bot. **Nao ha como saber, so pelos arquivos, se outro sistema le o contato da Blip**; essa decisao e do responsavel (Q08: duravel somente com API/base existente confirmada).',
    'Padrao do pacote: tudo na sessao (adaptacao `merge-contact-session`).',
    '',
    '| Namespace | Nome | Escritas | Leituras | Situacao no bot | Recomendacao |',
    '| --- | --- | ---: | ---: | --- | --- |',
    ...rows,
    '',
  ].join('\n')
}
