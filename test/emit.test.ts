import { tokTypes, tokenizer } from 'acorn'
import { describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { analyzePackage } from '../src/analysis/analyze.js'
import { convertAnalysis, writeConversion } from '../src/emit/convert.js'
import { validateConfig } from '../src/config/load.js'
import { validateKayrosDocument } from '../src/profile/validate-document.js'
import { validateImportSafety, validateReferences } from '../src/validate/refs.js'
import { analyzeScript, transformSource } from '../src/emit/script.js'
import { AdaptationRegistry } from '../src/adapt/registry.js'
import { DocBuilder } from '../src/emit/builder.js'
import { EmitCtx } from '../src/emit/context.js'
import { stableId } from '../src/emit/ids.js'
import { makePackage, state } from './helpers/make-package.js'

type Doc = ReturnType<typeof convertAnalysis>['bots'][number]['document']
type AnyBlock = { type: string; options?: Record<string, any>; items?: any[]; outgoingEdgeId?: string; id: string }

const text = (content: string) => ({ action: { type: 'SendMessage', settings: { type: 'text/plain', content } } })
const input = (over: Record<string, unknown> = {}) => ({ input: { bypass: false, ...over } })
const act = (type: string, settings: Record<string, unknown>, conditions: unknown[] = []) => ({ type, settings, conditions })
const exit = (stateId: string, conditions: unknown[] = [], extra: Record<string, unknown> = {}) => ({ stateId, conditions, ...extra })

function convert(flow: Record<string, unknown>, opts: { name?: string; config?: Parameters<typeof convertAnalysis>[1] extends infer O ? O : never; globalActions?: Record<string, unknown>; optimize?: boolean; blockEdges?: boolean } = {}) {
  const name = opts.name ?? 'botA'
  const a = analyzePackage(makePackage([{ name, flow, ...(opts.globalActions ? { globalActions: opts.globalActions } : {}) }]).root)
  expect(a.technical).toEqual([])
  const r = convertAnalysis(a, { ...((opts.config ?? {}) as object), ...(opts.optimize === undefined ? {} : { optimize: opts.optimize }), ...(opts.blockEdges === undefined ? {} : { blockEdges: opts.blockEdges }) } as never)
  const bot = r.bots[0]!
  const blocks = (doc: Doc = bot.document): AnyBlock[] => doc.groups.flatMap((g) => g.blocks as AnyBlock[])
  const group = (title: string) => bot.document.groups.find((g) => g.title === title)!
  return { r, bot, blocks, group, a }
}

// Exemplo didatico minimo: perguntar o nome, capturar e cumprimentar.
const nome = () => ({
  ini: state({
    root: true,
    $title: 'Pergunta nome',
    $contentActions: [text('Qual o seu nome?'), input()],
    $defaultOutput: { stateId: 'sauda' },
  }),
  sauda: state({
    $title: 'Saudacao',
    $contentActions: [text('Ola, {{input.content}}!'), { input: { bypass: true } }],
    $defaultOutput: { stateId: 'fallback' },
  }),
  fallback: state({ $title: 'Excecoes' }),
})

describe('exemplo minimo (nome)', () => {
  it('gera documento valido com start, captura e interpolacao', () => {
    const { bot, blocks } = convert(nome())
    expect(validateKayrosDocument(bot.document)).toEqual([])
    expect(validateReferences(bot.document)).toEqual([])
    expect(bot.status).toBe('structurally_valid')
    const start = bot.document.events.find((e) => e.type === 'start')!
    const first = bot.document.edges.find((e) => e.id === start.outgoingEdgeId)!
    expect(bot.document.groups.find((g) => g.id === first.to.groupId)?.title).toBe('Pergunta nome')
    expect(blocks().some((b) => b.options?.body === 'Ola, {{input_content}}!')).toBe(true)
  })

  it('estado inicial consome a primeira mensagem e nao aguarda', () => {
    const { group, blocks } = convert(nome())
    const g = group('Pergunta nome').blocks as AnyBlock[]
    expect(g[0]).toMatchObject({ type: 'Set variable', options: { expressionToEvaluate: '{{last_message}}' } })
    const ask = blocks().find((b) => b.options?.body === 'Qual o seu nome?')!
    expect(ask.options?.awaitReply).toBeUndefined()
  })

  it('estado nao inicial com input aguarda resposta e grava em input_content', () => {
    const f = nome()
    ;(f.sauda as any).$contentActions = [text('Qual a cidade?'), input()]
    const { bot, blocks } = convert(f)
    const ask = blocks().find((b) => b.options?.body === 'Qual a cidade?')!
    const v = bot.document.variables.find((x) => x.name === 'input_content')!
    expect(ask.options).toMatchObject({ awaitReply: true, replyVariableId: v.id })
  })

  it('e reproduzivel: duas execucoes geram o mesmo JSON e ids estaveis', () => {
    const a = convert(nome()).bot.document
    const b = convert(nome()).bot.document
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(stableId('x', 'k')).toBe(stableId('x', 'k'))
    expect(stableId('x', 'k')).not.toBe(stableId('y', 'k'))
  })
})

describe('menus e mensagens', () => {
  const sel = (n: number, title = 'Opcao') => ({
    action: { type: 'SendMessage', settings: { type: 'application/vnd.lime.select+json', content: { text: 'Escolha', options: Array.from({ length: n }, (_, i) => ({ text: `${title} ${i}`, value: i === 0 ? null : `v${i}` })) } } },
  })
  const flowWith = (n: number) => ({ ini: state({ root: true, $contentActions: [sel(n), { input: { bypass: true } }], $defaultOutput: { stateId: 'fallback' } }), fallback: state() })

  it('ate 3 opcoes viram botoes: o titulo e o texto capturado; o id e estavel e sem significado (o importador o troca)', () => {
    const { blocks } = convert(flowWith(3))
    const b = blocks().find((x) => x.options?.action === 'Enviar botões')!
    expect(b.options?.buttons.map((x: any) => x.title)).toEqual(['Opcao 0', 'Opcao 1', 'Opcao 2'])
    const ids = b.options?.buttons.map((x: any) => x.id)
    expect(new Set(ids).size).toBe(3)
    expect(ids.every((i: string) => /^[0-9a-f-]{36}$/.test(i))).toBe(true)
  })
  it('4 a 10 viram lista; acima de 10 vira texto com adaptacao (sem truncar)', () => {
    expect(convert(flowWith(7)).blocks().some((x) => x.options?.action === 'Enviar lista')).toBe(true)
    const big = convert(flowWith(12))
    expect(big.r.adaptations.map((a) => a.id)).toContain('botA:menu-exceeds-list-limit')
    expect(big.blocks().find((x) => x.options?.action === 'Enviar texto')?.options?.body).toContain('Opcao 11')
  })
  it('chatstate e omitido e HTML vira marcacao WhatsApp', () => {
    const f = {
      ini: state({
        root: true,
        $contentActions: [
          { action: { type: 'SendMessage', settings: { type: 'application/vnd.lime.chatstate+json', content: { state: 'composing' } } } },
          text('Informe o <b>CPF</b><br>agora'),
          { input: { bypass: true } },
        ],
        $defaultOutput: { stateId: 'fallback' },
      }),
      fallback: state(),
    }
    const { blocks, r } = convert(f)
    expect(blocks().filter((b) => b.type === 'whatsapp-cloud')).toHaveLength(1)
    expect(blocks().find((b) => b.type === 'whatsapp-cloud')?.options?.body).toBe('Informe o *CPF*\nagora')
    expect(r.adaptations.map((a) => a.id)).toEqual(expect.arrayContaining(['botA:typing-indicator-dropped', 'botA:html-markup-to-whatsapp']))
  })
  it('espera sem envio vira pergunta contextual e adaptacao que muda regra', () => {
    const f = { ini: state({ root: true, $defaultOutput: { stateId: 'w' } }), w: state({ $title: 'Espera', $contentActions: [input()], $defaultOutput: { stateId: 'fallback' } }), fallback: state() }
    const { blocks, r } = convert(f)
    expect(blocks().some((b) => b.options?.awaitReply === true)).toBe(true)
    expect(r.adaptations.find((a) => a.id.startsWith('botA:wait-without-message:'))?.changesBusinessBehavior).toBe(true)
  })
})

describe('condicoes (caixa, acento, espacos, regex)', () => {
  const exitsFlow = (conditions: unknown[]) => ({
    ini: state({
      root: true,
      $contentActions: [text('?'), { input: { bypass: true } }],
      $conditionOutputs: [exit('a', conditions)],
      $defaultOutput: { stateId: 'fallback' },
    }),
    a: state({ $title: 'A' }),
    fallback: state({ $title: 'Excecoes' }),
  })
  const cond = (blocks: AnyBlock[]) => blocks.find((b) => b.type === 'Condition')!

  it('equals ignora caixa e acento: compara variavel normalizada com valor normalizado', () => {
    const { blocks } = convert(exitsFlow([{ source: 'context', variable: 'resp', comparison: 'equals', values: ['Não', 'SIM'] }]))
    // OR = uma branch por valor (o builder exige todas as comparacoes da branch verdadeiras).
    const items = cond(blocks()).items!
    expect(items.map((i: any) => i.content.logicalOperator)).toEqual([undefined, undefined])
    expect(items.flatMap((i: any) => i.content.comparisons.map((x: any) => [x.comparisonOperator, x.value]))).toEqual([['Equal to', 'nao'], ['Equal to', 'sim']])
    expect(new Set(items.map((i: any) => i.outgoingEdgeId)).size).toBe(2)
    expect(blocks().find((b) => b.type === 'Code')?.options?.content).toContain('setVariable("__eq_resp"')
  })
  it('notEquals com varios valores significa nenhum deles (AND), nunca OR', () => {
    const { blocks } = convert(exitsFlow([{ source: 'context', variable: 'resp', comparison: 'notEquals', values: ['a', 'b'] }]))
    const c = cond(blocks()).items![0].content
    expect(c.logicalOperator).toBe('AND')
    expect(c.comparisons.map((x: any) => x.comparisonOperator)).toEqual(['Not equal', 'Not equal'])
  })
  it('contains ignora caixa sem trim; variavel esquerda fica em minusculas', () => {
    const { blocks } = convert(exitsFlow([{ source: 'input', comparison: 'contains', values: ['Certo ', 'SIM'] }]))
    const items = cond(blocks()).items!
    expect(items.flatMap((i: any) => i.content.comparisons.map((x: any) => x.value))).toEqual(['certo ', 'sim'])
    expect(blocks().find((b) => b.type === 'Code')?.options?.content).toContain('.toLowerCase()')
  })
  it('AND entre predicados com varios valores usa booleano calculado', () => {
    const { blocks, r } = convert(
      exitsFlow([
        { source: 'context', variable: 'x', comparison: 'equals', values: ['a', 'b'] },
        { source: 'context', variable: 'y', comparison: 'exists', values: [] },
      ]),
    )
    expect(cond(blocks()).items![0].content.comparisons[0]).toMatchObject({ comparisonOperator: 'Equal to', value: 'true' })
    expect(r.adaptations.map((a) => a.id)).toContain('botA:compound-condition-code')
  })
  it('exists/notExists e regex usam operadores nativos', () => {
    const { blocks } = convert(exitsFlow([{ source: 'context', variable: 'x', comparison: 'matches', values: ['^\\d+$'] }]))
    expect(cond(blocks()).items![0].content.comparisons[0]).toMatchObject({ comparisonOperator: 'Matches regex', value: '^\\d+$' })
  })
  it('a primeira saida satisfeita vence: a ordem dos itens e preservada e o padrao e o ELSE', () => {
    const f = exitsFlow([{ source: 'context', variable: 'x', comparison: 'exists', values: [] }])
    ;(f.ini as any).$conditionOutputs.push(exit('fallback', [{ source: 'context', variable: 'y', comparison: 'exists', values: [] }]))
    const { blocks, bot } = convert(f)
    const c = cond(blocks())
    const target = (id: string) => bot.document.groups.find((g) => g.id === bot.document.edges.find((e) => e.id === id)!.to.groupId)!.title
    expect(c.items!.map((i) => target(i.outgoingEdgeId))).toEqual(['A', 'Excecoes'])
    expect(target(c.outgoingEdgeId!)).toBe('Excecoes')
  })
  const condAction = () => ({
    ini: state({
      root: true,
      $contentActions: [{ input: { bypass: true } }],
      $enteringCustomActions: [
        act('SetVariable', { variable: 'k', value: 'v' }, [{ source: 'context', variable: 'z', comparison: 'exists', values: [] }]),
        act('SetVariable', { variable: 'depois', value: 'x' }),
      ],
      $defaultOutput: { stateId: 'fallback' },
    }),
    fallback: state(),
  })
  it('acao com condicao de execucao so executa no ramo verdadeiro (formato de referencia: grupos separados)', () => {
    const { bot } = convert(condAction(), { optimize: false })
    const g = bot.document.groups[0]!.blocks as AnyBlock[]
    const cnd = g.find((b) => b.type === 'Condition')!
    const edges = new Map(bot.document.edges.map((e) => [e.id, e]))
    const thenG = bot.document.groups.find((x) => x.id === edges.get(cnd.items![0].outgoingEdgeId)!.to.groupId)!
    expect((thenG.blocks as AnyBlock[]).map((b) => b.type)).toEqual(['Set variable'])
    expect(edges.get(cnd.outgoingEdgeId!)!.to.groupId).not.toBe(thenG.id)
  })
  it('padrao (seguro para o importador): sem to.blockId e sem Jump', () => {
    const { bot } = convert(condAction())
    expect(validateImportSafety(bot.document)).toEqual([])
    expect(bot.document.edges.every((e) => e.to.blockId === undefined)).toBe(true)
  })
  it('blockEdges: a condicao pula blocos dentro do mesmo grupo (sem grupos extras)', () => {
    const ref = convert(condAction(), { optimize: false })
    const opt = convert(condAction(), { blockEdges: true })
    expect(opt.bot.document.groups.length).toBeLessThan(ref.bot.document.groups.length)
    const g = opt.bot.document.groups[0]!
    const blocks = g.blocks as AnyBlock[]
    const cnd = blocks.find((b) => b.type === 'Condition' && b.items?.length === 1)!
    const edges = new Map(opt.bot.document.edges.map((e) => [e.id, e]))
    const yes = edges.get(cnd.items![0].outgoingEdgeId!)!.to
    const no = edges.get(cnd.outgoingEdgeId!)!.to
    expect(yes.groupId).toBe(g.id)
    expect(no.groupId).toBe(g.id)
    expect(blocks.find((b) => b.id === yes.blockId)?.options?.expressionToEvaluate).toBe('v')
    // O ramo "senao" salta o corpo e cai no bloco seguinte (a segunda atribuicao), nao em outro lugar.
    expect(blocks.find((b) => b.id === no.blockId)?.options?.expressionToEvaluate).toBe('x')
    expect(blocks.indexOf(blocks.find((b) => b.id === no.blockId)!)).toBeGreaterThan(blocks.indexOf(blocks.find((b) => b.id === yes.blockId)!))
  })
})

describe('validacao de input, timeout e captura', () => {
  it('regex invalido envia o erro e volta ao bloco da pergunta', () => {
    const f = {
      ini: state({ root: true, $defaultOutput: { stateId: 'q' } }),
      q: state({ $title: 'Data', $contentActions: [text('Data?'), input({ validation: { rule: 'regex', regex: '^\\d{2}/\\d{2}$', error: 'Data invalida' } })], $defaultOutput: { stateId: 'fallback' } }),
      fallback: state(),
    }
    const { bot, blocks } = convert(f)
    const ask = blocks().find((b) => b.options?.body === 'Data?')!
    const err = blocks().find((b) => b.options?.body === 'Data invalida')!
    const back = bot.document.edges.find((e) => e.id === err.outgoingEdgeId)!
    // O importador descarta to.blockId: a pergunta tem grupo proprio e a repeticao volta ao INICIO dele.
    expect(back.to.blockId).toBeUndefined()
    expect(bot.document.groups.find((g) => g.id === back.to.groupId)!.blocks[0]!.id).toBe(ask.id)
    expect(blocks().some((b) => b.type === 'Condition' && b.items?.[0]?.content.comparisons[0].comparisonOperator === 'Matches regex')).toBe(true)
  })
  it('expiration h:mm vira follow-up em minutos e roteador por timeout_state', () => {
    const f = {
      ini: state({ root: true, $defaultOutput: { stateId: 'q' } }),
      q: state({
        $title: 'CPF',
        $contentActions: [text('CPF?'), input({ expiration: '0:25' })],
        $conditionOutputs: [exit('ab', [{ source: 'input', comparison: 'notExists', values: [] }])],
        $defaultOutput: { stateId: 'fallback' },
      }),
      ab: state({ $title: 'Abandono' }),
      fallback: state(),
    }
    const { bot, blocks } = convert(f)
    const ask = blocks().find((b) => b.options?.body === 'CPF?')!
    expect(ask.options?.followUp).toEqual({ isEnabled: true, attempts: [{ send: { action: 'Desviar para follow-up' }, delayInMinutes: 25 }] })
    const fu = bot.document.events.find((e) => e.type === 'followUp')!
    expect(fu.outgoingEdgeId).toBeTruthy()
    const router = bot.document.groups.find((g) => g.title === 'Roteador de timeout')!
    const item = (router.blocks[0] as AnyBlock).items![0]
    expect(item.content.comparisons[0]).toMatchObject({ value: 'q' })
    const to = bot.document.edges.find((e) => e.id === item.outgoingEdgeId)!.to.groupId
    expect(bot.document.groups.find((g) => g.id === to)?.title).toBe('Abandono')
  })
  it('1:30 equivale a 90 minutos', () => {
    const f = { ini: state({ root: true, $defaultOutput: { stateId: 'q' } }), q: state({ $contentActions: [text('?'), input({ expiration: '1:30' })], $defaultOutput: { stateId: 'fallback' } }), fallback: state() }
    expect(convert(f).blocks().find((b) => b.options?.body === '?')?.options?.followUp.attempts[0].delayInMinutes).toBe(90)
  })
})

describe('scripts', () => {
  const scriptFlow = (source: string, extra: Record<string, unknown> = {}) => ({
    ini: state({
      root: true,
      $contentActions: [{ input: { bypass: true } }],
      $enteringCustomActions: [act('ExecuteScript', { function: 'run', source, inputVariables: ['input.content', 'config.k'], outputVariable: 'saida', ...extra })],
      $defaultOutput: { stateId: 'fallback' },
    }),
    fallback: state(),
  })
  const ctxFor = () => new EmitCtx('botA', 'f.json', new DocBuilder('botA'), new AdaptationRegistry(), undefined)
  const at = { bot: 'botA', file: 'f.json', phase: 'enter' as const, jsonPointer: '/x', ordinal: 0 }

  it('envolve a funcao com argumentos em texto e grava a saida', () => {
    const { blocks } = convert(scriptFlow('function run(a, b) { return a + b }'))
    const code = blocks().find((b) => b.type === 'Code' && String(b.options?.content).includes('function run'))!.options!.content as string
    expect(code).toContain('run(__s({{input_content}}), __s({{resource.blip.botA.k}}))')
    expect(code).toContain('setVariable("saida", __s(__result))')
  })
  it('placeholder dentro de string vira concatenacao, nao identificador quebrando o literal', () => {
    const t = transformSource(ctxFor(), 'function run(){ return "{\\"id\\":\\"{{contact.extras.pedido}}\\"}"; }', at)
    expect(t.code).toContain('__s({{contact_extras_pedido}})')
    // Nenhum literal de string pode conter `{{`: o Code do Kayros trocaria o placeholder por identificador.
    const strings = [...tokenizer(t.code, { ecmaVersion: 'latest' })].filter((k) => k.type === tokTypes.string).map((k) => t.code.slice(k.start, k.end))
    expect(strings.some((v) => v.includes('{{'))).toBe(false)
  })
  it('acesso estruturado e sorteio sao materializados antes do uso', () => {
    const t = transformSource(ctxFor(), 'function run(){ return "a {{obj@x.y}} b {{Oi|Ola}}"; }', at)
    expect(t.prelude.join('\n')).toContain('JSON.parse')
    expect(t.prelude.join('\n')).toContain('Math.random')
  })
  it('sintaxe aceita pela Blip e rejeitada pelo V8 e sinalizada, sem esconder o script', () => {
    const src = 'function run(x) { let a = 1; let a = 2; return a }'
    expect(analyzeScript(src, 'run').parses).toBe(false)
    const { r, blocks } = convert(scriptFlow(src))
    expect(r.adaptations.map((a) => a.id)).toContain('botA:script-syntax-incompatible')
    expect(blocks().some((b) => String(b.options?.content).includes('let a = 2'))).toBe(true)
  })
  it('conta parametros: aridade divergente e diagnostico informativo', () => {
    expect(analyzeScript('function run(a,b,c){}', 'run').paramCount).toBe(3)
    expect(convert(scriptFlow('function run(a){ return a }', { inputVariables: ['input.content', 'x'] })).bot.diagnostics.map((d) => d.code)).toContain('SCRIPT_ARITY_MISMATCH')
  })
})

describe('HTTP, segredos, eventos e contato', () => {
  const http = (over: Record<string, unknown> = {}) => act('ProcessHttp', { method: 'POST', uri: '{{config.apiHub}}/x', headers: { 'Content-Type': 'application/json' }, body: '{"id":"{{cpf}}"}', responseStatusVariable: 's1', responseBodyVariable: 'b1', ...over })
  const flowOf = (actions: unknown[]) => ({ ini: state({ root: true, $contentActions: [{ input: { bypass: true } }], $enteringCustomActions: actions, $defaultOutput: { stateId: 'fallback' } }), fallback: state() })

  it('Webhook copia status e corpo antes da proxima chamada (dois consecutivos)', () => {
    const { bot } = convert(flowOf([http(), http({ responseStatusVariable: 's2', responseBodyVariable: 'b2' })]))
    const types = (bot.document.groups[0]!.blocks as AnyBlock[]).map((b) => b.type)
    expect(types.slice(types.indexOf('Webhook'))).toEqual(['Webhook', 'Set variable', 'Set variable', 'Webhook', 'Set variable', 'Set variable'])
    const w = (bot.document.groups[0]!.blocks as AnyBlock[]).find((b) => b.type === 'Webhook')!
    expect(w.options?.webhook).toMatchObject({ method: 'POST', url: '{{resource.blip.botA.apiHub}}/x' })
  })
  it('segredo literal em corpo e cabecalho vira Recurso e o valor nao vaza', () => {
    const { r, bot } = convert(flowOf([http({ body: '{"chaveAcesso":"SEGREDO-123","x":1}', headers: { 'access-token': 'TOKEN-ABC' } })]))
    const out = JSON.stringify(bot.document) + JSON.stringify(r)
    expect(out).not.toContain('SEGREDO-123')
    expect(out).not.toContain('TOKEN-ABC')
    expect(bot.secrets.map((s) => s.resourceKey).sort()).toEqual(['blip.botA.access_token', 'blip.botA.chaveacesso'])
    expect(out).toContain('{{resource.blip.botA.chaveacesso}}')
  })
  it('HTTP para a plataforma Blip nao e emitido e vira adaptacao que muda regra', () => {
    const { r, blocks } = convert(flowOf([act('ProcessHttp', { method: 'GET', uri: 'https://http.msging.net/commands', responseBodyVariable: 'r' })]))
    expect(blocks().some((b) => b.type === 'Webhook')).toBe(false)
    expect(r.adaptations.find((a) => a.id === 'botA:blip-platform-http')?.changesBusinessBehavior).toBe(true)
  })
  it('TrackEvent vira journeyEvent com categoria, acao e extras; MergeContact fica na sessao', () => {
    const { bot, r } = convert(flowOf([act('TrackEvent', { category: 'Cpf', action: 'exibicao', extras: { canal: '{{contact.extras.canal}}' } }), act('MergeContact', { extras: { Etapa: '1' } })]))
    const bl = bot.document.groups[0]!.blocks as AnyBlock[]
    expect(bl.find((b) => b.type === 'journeyEvent')?.options).toEqual({ eventName: 'Cpf', payload: [{ key: 'action', value: 'exibicao' }, { key: 'canal', value: '{{contact_extras_canal}}' }] })
    expect(bl.some((b) => b.type === 'Set variable' && b.options?.expressionToEvaluate === '1')).toBe(true)
    expect(r.adaptations.map((a) => a.id)).toContain('botA:merge-contact-session')
    expect(bot.document.variables.map((v) => v.name)).toContain('contact_extras_Etapa')
  })
  it('SetVariable com expiracao preserva o valor e registra a diferenca de TTL', () => {
    const { r, bot } = convert(flowOf([act('SetVariable', { variable: 'abandono', value: 'cpf', expiration: 84600 })]))
    expect(r.adaptations.find((a) => a.id === 'botA:ttl-session')?.changesBusinessBehavior).toBe(true)
    expect(bot.diagnostics.map((d) => d.code)).toContain('CONTEXT_TTL_DIFFERENCE')
  })
  it('acoes globais entram apos a captura de cada interacao', () => {
    const f = { ini: state({ root: true, $defaultOutput: { stateId: 'q' } }), q: state({ $contentActions: [text('?'), input()], $defaultOutput: { stateId: 'fallback' } }), fallback: state() }
    const { blocks } = convert(f, { globalActions: { $enteringCustomActions: [act('ProcessHttp', { method: 'GET', uri: 'https://x.test/g' })], $leavingCustomActions: [] } })
    expect(blocks().filter((b) => b.type === 'Webhook')).toHaveLength(2)
  })
})

describe('links entre bots, destinos dinamicos e atendimento', () => {
  const redirectFlow = () => ({
    ini: state({
      root: true,
      $contentActions: [{ input: { bypass: true } }],
      $enteringCustomActions: [act('Redirect', { address: 'BKO [AH]', context: { type: 'text/plain', value: 'Consultar' } })],
      $leavingCustomActions: [act('SetVariable', { variable: 'depois', value: 'x' })],
      $defaultOutput: { stateId: 'fallback' },
    }),
    fallback: state(),
  })
  it('Redirect vira Typebot link terminal com referencia configuravel e sem ligar por semelhanca de nome', () => {
    const { bot, blocks } = convert(redirectFlow())
    const link = blocks().find((b) => b.type === 'Typebot link')!
    expect(link.options?.typebotId).toBe('{{resource.blip.link.bko_ah}}')
    expect(link.outgoingEdgeId).toBeUndefined()
    expect(link.options?.variablesToPass).toContain('redirect_context')
    expect(bot.diagnostics.map((d) => d.code)).toEqual(expect.arrayContaining(['REDIRECT_ALIAS_UNRESOLVED', 'UNREACHABLE_AFTER_TERMINAL']))
  })
  it('alias confirmado na configuracao usa o id importado', () => {
    const cfg = validateConfig(JSON.parse(readFileSync(join(import.meta.dirname, '../examples/configuracao.exemplo.json'), 'utf8'))).config!
    cfg.bindings.botAliases = [{ sourceAddress: 'BKO [AH]', count: 1, targetLogicalBot: 'vivofixadados', targetImportedBotId: 'abc-123', status: 'confirmed' }]
    expect(convert(redirectFlow(), { config: { config: cfg } as never }).blocks().find((b) => b.type === 'Typebot link')?.options?.typebotId).toBe('abc-123')
  })
  const dyn = (extra: unknown[]) => ({
    ini: state({
      root: true,
      $contentActions: [{ input: { bypass: true } }],
      $enteringCustomActions: [act('SetVariable', { variable: 'destino', value: 'x1' }), ...extra],
      $defaultOutput: { stateId: '{{destino}}', typeOfStateId: 'variable' },
    }),
    x1: state({ $title: 'X1' }),
    fallback: state({ $title: 'Excecoes' }),
  })
  it('destino calculado vira Condition com os candidatos e cai no estado de excecao', () => {
    const { bot, group } = convert(dyn([]))
    const router = bot.document.groups.find((g) => g.title === 'Destino {{destino}}')!
    const cond = router.blocks[0] as AnyBlock
    expect(cond.items).toHaveLength(1)
    expect(cond.items![0].content.comparisons[0]).toMatchObject({ comparisonOperator: 'Equal to', value: 'x1' })
    const els = bot.document.edges.find((e) => e.id === cond.outgoingEdgeId)!
    expect(bot.document.groups.find((g) => g.id === els.to.groupId)?.title).toBe('Excecoes')
    expect(group('X1')).toBeTruthy()
  })
  it('destino que tambem vem de script nao fecha: diagnostico, nunca o primeiro estado', () => {
    const { bot } = convert(dyn([act('ExecuteScript', { function: 'run', source: 'function run(){return "z"}', inputVariables: [], outputVariable: 'destino' })]))
    expect(bot.diagnostics.map((d) => d.code)).toContain('DYNAMIC_TARGET_UNRESOLVED')
  })
  const desk = () => ({ ini: state({ root: true, $contentActions: [{ input: { bypass: true } }], $enteringCustomActions: [act('ForwardToDesk', {})], $defaultOutput: { stateId: 'fallback' } }), fallback: state() })
  it('ForwardToDesk sem fila nao inventa UUID: aviso e encerramento explicito', () => {
    const { blocks, bot, r } = convert(desk())
    expect(blocks().some((b) => b.type === 'transferToQueue')).toBe(false)
    expect(blocks().some((b) => b.type === 'endSession')).toBe(true)
    expect(bot.status).toBe('structurally_valid')
    expect(r.adaptations.find((a) => a.id === 'botA:desk-queue-pending')?.acceptance.status).toBe('proposed')
  })
  it('com fila configurada emite transferToQueue', () => {
    const cfg = validateConfig(JSON.parse(readFileSync(join(import.meta.dirname, '../examples/configuracao.exemplo.json'), 'utf8'))).config!
    cfg.bindings.queues = [{ sourceBot: 'botA' as never, sourceStateId: 'desk:ini', targetQueueId: 'a7144fc1-908a-418c-bc25-775d2a75163e', businessHoursSource: null, outOfHoursAlternative: null, status: 'confirmed' }]
    const { blocks } = convert(desk(), { config: { config: cfg } as never })
    expect(blocks().find((b) => b.type === 'transferToQueue')?.options?.queueId).toBe('a7144fc1-908a-418c-bc25-775d2a75163e')
  })
})

describe('validadores do documento emitido', () => {
  const ok = () => structuredClone(convert(nome()).bot.document) as any
  it('detectam variavel nao declarada, variableId inexistente, ramo sem aresta e fila invalida', () => {
    const d = ok()
    d.groups[0].blocks.push({ id: 'zz1', type: 'Set variable', options: { type: 'Custom', variableId: 'nao-existe', expressionToEvaluate: '{{fantasma}}' } })
    d.groups[0].blocks.push({ id: 'zz2', type: 'Condition', items: [{ id: 'zi', content: { comparisons: [] } }] })
    d.groups[0].blocks.push({ id: 'zz3', type: 'transferToQueue', options: { queueId: 'fila-ficticia' } })
    const codes = validateReferences(d).map((x) => x.code)
    expect(codes).toContain('KAYROS_VARIABLE_UNDECLARED')
    expect(codes.filter((c) => c === 'KAYROS_REFERENCE_INVALID').length).toBeGreaterThanOrEqual(3)
  })
  it('detectam aresta quebrada e tipo de bloco inexistente', () => {
    const d = ok()
    d.edges[0].to.groupId = 'x'
    d.groups[0].blocks.push({ id: 'zz4', type: 'Espera independente' })
    const codes = validateKayrosDocument(d).map((x) => x.code)
    expect(codes).toEqual(expect.arrayContaining(['TARGET_EDGE_INVALID', 'KAYROS_BLOCK_TYPE_UNSUPPORTED']))
  })
})

const LOTE = 'C:/Users/renan/Documents/Convert To Runtime/Analise Blip Kayros/2026-11-02T04-26-43-071Z-e44c3a22'
describe.skipIf(!existsSync(LOTE))('lote real', () => {
  const a = analyzePackage(LOTE)
  const r = convertAnalysis(a)

  it('converte os 13 bots com estrutura valida, sem aresta ou variavel quebrada', () => {
    expect(r.bots).toHaveLength(13)
    for (const b of r.bots) expect(b.validation, b.name).toEqual([])
    expect(r.bots.every((b) => b.status === 'structurally_valid')).toBe(true)
  })
  it('todo estado tem grupo e todo caminho de saida tem destino (nada e apagado)', () => {
    for (const b of r.bots) {
      expect(b.document.groups.length, b.name).toBeGreaterThanOrEqual(b.stats.states)
      expect(b.document.events.find((e) => e.type === 'start')?.outgoingEdgeId, b.name).toBeTruthy()
    }
  })
  it('adaptacoes que mudam regra de negocio nascem como propostas, nunca aceitas', () => {
    expect(r.adaptations.every((x) => x.acceptance.status === 'proposed')).toBe(true)
    expect(r.pendingAcceptance.length).toBeGreaterThan(0)
  })
  it('e reproduzivel e nao vaza segredos literais da origem', () => {
    const out1 = mkdtempSync(join(tmpdir(), 'conv1-'))
    const out2 = mkdtempSync(join(tmpdir(), 'conv2-'))
    const f1 = writeConversion(r, out1)
    const f2 = writeConversion(convertAnalysis(analyzePackage(LOTE)), out2)
    expect(f1).toEqual(f2)
    for (const f of f1) expect(readFileSync(join(out1, f), 'utf8'), f).toBe(readFileSync(join(out2, f), 'utf8'))
    const all = f1.map((f) => readFileSync(join(out1, f), 'utf8')).join('\n')
    const literals: string[] = []
    for (const bot of a.pkg.bots) {
      for (const s of JSON.stringify(bot.flow).matchAll(/chaveAcesso[^:]*:[^"]*\\"([^\\"{][^\\"]{5,})\\"/g)) literals.push(s[1] as string)
    }
    expect(literals.length).toBeGreaterThan(0)
    for (const v of new Set(literals)) expect(all.includes(v), 'segredo literal vazou no pacote').toBe(false)
    expect(readdirSync(out1).sort()).toEqual(['adaptations.json', 'coverage.json', 'diagnostics.json', 'entry-parameters.json', 'flows', 'manifest.json', 'mapping.json', 'passes.json', 'reports', 'secrets-to-fill.json', 'validation'])
  }, 60_000)
  it('chaves de Recurso respeitam o padrao do Kayros OS ([A-Za-z0-9_.], ate 100) e batem com secrets-to-fill', () => {
    for (const b of r.bots) {
      const text = JSON.stringify(b.document)
      const keys = [...text.matchAll(/{{resource.([^{}]+)}}/g)].map((m) => m[1] as string)
      expect(keys.length, b.name).toBeGreaterThan(0)
      for (const k of keys) expect(/^[A-Za-z0-9_.]+$/.test(k) && k.length <= 100, `${b.name}: ${k}`).toBe(true)
      // Todo segredo extraido aparece no fluxo com a MESMA chave listada em secrets-to-fill.
      for (const s of b.secrets) expect(text.includes(`{{resource.${s.resourceKey}}}`), `${b.name}: ${s.resourceKey}`).toBe(true)
    }
  })

  it('piloto vivofixadados: fluxo CPF presente com validacao, consulta e abandono', () => {
    const b = r.bots.find((x) => x.name === 'vivofixadados')!
    const titles = new Set(b.document.groups.map((g) => g.title.split(' · ')[0]))
    for (const t of ['CPF', 'Valida CPF', 'DI CPF', 'API Busca CPF', 'API Dados Pessoais', 'Abandono CPF']) expect(titles.has(t), t).toBe(true)
    const busca = b.document.groups.find((g) => g.title === 'API Busca CPF')!
    const w = (busca.blocks as AnyBlock[]).find((x) => x.type === 'Webhook')!
    expect(w.options?.webhook).toMatchObject({ method: 'GET', url: '{{resource.blip.vivofixadados.apiHub}}/CPF/{{cpf}}' })
  })
})
