import { describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { analyzePackage, writeAnalysis } from '../src/analysis/analyze.js'
import { countByCode } from '../src/analysis/patterns.js'
import { stronglyConnected } from '../src/analysis/graph.js'
import { classify } from '../src/analysis/symbols.js'
import { makePackage, state } from './helpers/make-package.js'

const LOTE = 'C:/Users/renan/Documents/Convert To Runtime/Analise Blip Kayros/2026-11-02T04-26-43-071Z-e44c3a22'

// Totais de referencia da especificacao (secoes 3.1 a 3.3) e de Tarefas.md (F1).
describe.skipIf(!existsSync(LOTE))('lote de referencia (13 bots)', () => {
  const a = analyzePackage(LOTE)
  const t = a.inventory.totals

  it('pacote integro: 39 arquivos conferidos, sem erro tecnico', () => {
    expect(a.pkg.filesVerified).toBe(39)
    expect(a.technical).toEqual([])
    expect(a.pkg.runId).toBe('2026-11-02T04-26-43-071Z-e44c3a22')
    expect(a.pkg.router).toBe('vivofixacarrinho4router')
  })

  it('reproduz as contagens de referencia', () => {
    expect(t.bots).toBe(13)
    expect(t.states).toBe(1629)
    expect(t.localActions).toBe(6370)
    expect(t.globalActions).toBe(4)
    expect(t.afterStateChangeActions).toBe(3)
    expect(t.actionOccurrences).toBe(6377)
    expect(t.configs).toBe(140)
    expect(t.inputsNoBypass).toBe(887)
    expect(t.timeouts).toBe(441)
    expect(t.dynamicExits).toBe(401)
    expect(t.setVariableWithExpiration).toBe(682)
    expect(t.mergeContact).toBe(1395)
    expect(t.redirectOccurrences).toBe(94)
    expect(t.redirectDistinctAddresses).toBe(35)
    expect(t.redirectWithContext).toBe(70)
    expect(t.scripts).toBe(1621)
    expect(t.httpLocal).toBe(570)
    expect(t.httpGlobal).toBe(4)
    expect(t.contentSends).toBe(2066)
    expect(t.contentMessages).toBe(1215)
    expect(t.inputValidations).toBe(9)
    expect(t.conditionalInputs).toBe(3)
  })

  it('distribuicao por tipo de acao e de conteudo', () => {
    expect(a.inventory.actionTypes).toEqual({
      ExecuteScript: 1579, ExecuteScriptV2: 42, ForwardToDesk: 3, LeavingFromDesk: 3, MergeContact: 1395,
      ProcessCommand: 42, ProcessHttp: 574, Redirect: 94, SetVariable: 1632, TrackEvent: 1013,
    })
    expect(a.inventory.contentTypes).toEqual({
      'SendMessage application/vnd.lime.chatstate+json': 851,
      'SendMessage application/vnd.lime.media-link+json': 85,
      'SendMessage application/vnd.lime.select+json': 291,
      'SendMessage text/plain': 639,
      'SendRawMessage application/json': 187,
      'SendRawMessage application/vnd.lime.select+json': 7,
      'SendRawMessage text/plain': 6,
    })
  })

  it('tabela por bot (spec 3.1)', () => {
    const row = (b: string) => {
      const r = a.inventory.perBot.find((x) => x.bot === b)
      return [r?.states, r?.localActions, r?.configs, r?.inputsNoBypass, r?.timeouts, r?.httpLocal, r?.scripts, r?.redirect]
    }
    expect(row('bkovivofixamsgativaah')).toEqual([89, 143, 13, 69, 8, 5, 21, 6])
    expect(row('fibrasubida17')).toEqual([201, 1060, 10, 127, 67, 82, 280, 7])
    expect(row('vivofixaabandonomsgatah')).toEqual([25, 39, 10, 17, 3, 5, 6, 4])
    expect(row('vivofixadados')).toEqual([129, 687, 22, 59, 41, 85, 148, 11])
    expect(row('vivofixawhatsapp')).toEqual([200, 1057, 13, 126, 66, 82, 280, 7])
    expect(row('vivoiptveitvplanos')).toEqual([59, 143, 6, 27, 8, 12, 38, 7])
    expect(row('vivoiptvwpp')).toEqual([333, 1042, 10, 165, 100, 71, 280, 6])
    expect(row('vivoitvah')).toEqual([23, 30, 6, 16, 5, 1, 7, 2])
    expect(row('vivoitvplanos')).toEqual([105, 288, 6, 54, 17, 15, 50, 16])
    expect(row('vivosegurocelular')).toEqual([114, 332, 11, 41, 20, 51, 103, 5])
    expect(row('vivoseguros')).toEqual([100, 272, 9, 40, 19, 49, 89, 6])
    expect(row('vivototaldados')).toEqual([111, 509, 13, 52, 36, 49, 127, 8 + 2])
    expect(row('vivototalplanoswppnovo')).toEqual([140, 768, 11, 94, 51, 63, 192, 7])
  })

  it('padroes de atencao (spec 3.3 e inventario de lacunas)', () => {
    const c = countByCode(a.findings)
    expect(c['WAIT_WITHOUT_MESSAGE:wait-no-terminal']).toBe(138)
    expect((c['WAIT_WITHOUT_MESSAGE:wait-no-terminal'] ?? 0) + (c['WAIT_WITHOUT_MESSAGE:wait-with-terminal'] ?? 0)).toBe(196)
    expect(c['BLIP_COMMAND_UNMAPPED:command']).toBe(42)
    expect(c['BLIP_COMMAND_UNMAPPED:http-msging']).toBe(19)
    expect(c['AGENT_CONTRACT_UNVERIFIED:http-whitewall']).toBe(19)
    expect(c['AGENT_CONTRACT_UNVERIFIED:state-whitewall']).toBe(19)
    expect(c.GLOBAL_ACTION_PLACEMENT).toBe(4)
    expect(c['DESK_CONTINUATION_DIFFERENCE:leaving']).toBe(3)
    expect(c['INPUT_VALIDATION_DECLARED:regex']).toBe(6)
    expect(c['INPUT_VALIDATION_DECLARED:text']).toBe(3)
    expect(c.INTENT_CONDITION_CUSTOM).toBe(1)
    expect(c.REDIRECT_ALIAS_UNRESOLVED).toBe(35)
    expect(c['SOURCE_CONFIG_UNRESOLVED:placeholder']).toBe(2)
  })

  it('configuracoes ausentes e recursos externos (grafia preservada)', () => {
    const miss = a.configs.flatMap((c) => c.missing.map((m) => `${c.bot}:${m.key}`)).sort()
    expect(miss).toEqual(['vivofixaabandonomsgatah:autoriza', 'vivoiptveitvplanos:apiurl'])
    expect(a.externalResources.map((e) => e.expression).sort()).toEqual(
      ['resource. flowIdDev', 'resource.flowId', 'resource.flowIdDev', 'resource.routerKey'].sort(),
    )
  })

  it('ids de WhatsApp Flow em raw: 11 distintos (2 literais, 9 expressoes)', () => {
    const f = a.findings.filter((x) => x.code === 'FLOW_ASSET_MISSING')
    const distinct = new Map(f.map((x) => [x.message, x.tag]))
    expect(distinct.size).toBe(11)
    expect([...distinct.values()].filter((v) => v === 'flow-literal')).toHaveLength(2)
  })

  it('grafo: nenhuma saida literal para estado ausente; destinos dinamicos preservados', () => {
    expect(a.graph.bots.every((g) => g.danglingLiteral.length === 0)).toBe(true)
    expect(a.graph.dynamicTargets).toHaveLength(401)
    expect(a.graph.aliases).toHaveLength(35)
    const pilot = a.graph.dynamicTargets.filter((d) => d.bot === 'vivofixadados' && d.variable === 'idAbandono')
    expect(pilot.length).toBeGreaterThan(0)
    expect(pilot.every((d) => d.complete && d.candidateStateIds.length > 0)).toBe(true)
  })

  it('cada ocorrencia tem arquivo e caminho JSON; segredos de configuracao nao vazam para as saidas', () => {
    expect(a.inventory.actions.every((x) => x.ref.file && x.ref.jsonPointer.startsWith('/configuracoes_gerais/'))).toBe(true)
    const out = mkdtempSync(join(tmpdir(), 'blip-out-'))
    const files = writeAnalysis(a, out)
    expect(files).toEqual(['inventory.json', 'dependencies.json', 'diagnostics.json'])
    // Chaves com cara de segredo: o valor nao pode aparecer nos artefatos. (Nomes de alias e URLs
    // que o proprio fluxo escreve literalmente em enderecos de Redirect/HTTP sao dados do fluxo.)
    const secretKey = /token|secret|senha|password|autoriza|chave|apikey|api_key/i
    const values = a.pkg.bots.flatMap((b) => b.configs.filter((c) => secretKey.test(c.key)).map((c) => c.value)).filter((v): v is string => typeof v === 'string' && v.length >= 6)
    expect(values.length).toBeGreaterThan(0)
    const blob = files.map((f) => readFileSync(join(out, f), 'utf8')).join('\n')
    for (const v of values) expect(blob.includes(v), `valor de configuracao vazou: ${v.slice(0, 4)}…`).toBe(false)
  })
})

describe('analise de pacote sintetico', () => {
  const flow = {
    ini: state({
      root: true,
      $title: 'Inicio',
      $contentActions: [
        { action: { type: 'SendMessage', settings: { type: 'text/plain', content: 'Oi {{config.apiHub}}' } } },
        { input: { bypass: false, expiration: '0:25' } },
      ],
      $conditionOutputs: [
        { stateId: '{{dest}}', typeOfStateId: 'variable', conditions: [{ source: 'input', comparison: 'notExists', values: [] }] },
        { stateId: 'esp', conditions: [{ source: 'input', comparison: 'exists', values: [] }] },
      ],
      $enteringCustomActions: [
        { type: 'SetVariable', settings: { variable: 'dest', value: 'esp', expiration: 84600 }, conditions: [] },
        { type: 'MergeContact', settings: { extras: { campo: '' } }, conditions: [] },
        { type: 'Redirect', settings: { address: 'Bot Qualquer', context: { type: 'text/plain', value: 'x' } }, conditions: [] },
      ],
    }),
    esp: state({
      $title: 'Espera',
      $contentActions: [{ input: { bypass: false } }],
      $defaultOutput: { stateId: 'ini' },
    }),
    fallback: state({ $title: 'Excecoes' }),
  }

  it('inventaria, resolve destino dinamico e detecta padroes', () => {
    const { root } = makePackage([{ name: 'botA', flow, configs: [{ key: 'apiHub', value: '' }, { key: 'nulo', value: null }] }])
    const a = analyzePackage(root)
    expect(a.technical).toEqual([])
    expect(a.inventory.totals).toMatchObject({ states: 3, timeouts: 1, dynamicExits: 1, setVariableWithExpiration: 1, mergeContact: 1, redirectOccurrences: 1 })
    const dyn = a.graph.dynamicTargets[0]
    expect(dyn).toMatchObject({ variable: 'dest', constants: ['esp'], candidateStateIds: ['esp'], complete: true })
    const c = countByCode(a.findings)
    expect(c['WAIT_WITHOUT_MESSAGE:wait-no-terminal']).toBe(1)
    expect(c.REDIRECT_ALIAS_UNRESOLVED).toBe(1)
    // inicio <-> espera forma um ciclo; nada e removido.
    expect(a.graph.bots[0]?.cycles).toContainEqual(expect.arrayContaining(['ini', 'esp']))
    expect(a.graph.bots[0]?.unreachableByStaticEdges).toEqual([])
  })

  it('destino dinamico cujo valor vem de script nao fecha o conjunto', () => {
    const f = {
      ini: state({
        root: true,
        $conditionOutputs: [{ stateId: '{{dest}}', typeOfStateId: 'variable', conditions: [] }],
        $enteringCustomActions: [{ type: 'ExecuteScript', settings: { outputVariable: 'dest', function: 'run', source: 'x', inputVariables: [] }, conditions: [] }],
      }),
      fallback: state(),
    }
    const a = analyzePackage(makePackage([{ name: 'botA', flow: f }]).root)
    expect(a.graph.dynamicTargets[0]?.complete).toBe(false)
    expect(countByCode(a.findings).DYNAMIC_TARGET_UNRESOLVED).toBe(1)
  })

  it('saida literal para estado ausente e erro tecnico; estrutura desconhecida e reportada', () => {
    const f = {
      ini: state({ root: true, $defaultOutput: { stateId: 'nao-existe' }, $enteringCustomActions: [{ settings: {} }] }),
    }
    const a = analyzePackage(makePackage([{ name: 'botA', flow: f }]).root)
    const c = a.technical.map((d) => d.code)
    expect(c).toContain('SOURCE_LITERAL_TARGET_MISSING')
    expect(c).toContain('SOURCE_STRUCTURE_UNKNOWN')
  })

  it('config referenciada e ausente do export gera pendencia, sem valor presumido', () => {
    const f = {
      ini: state({
        root: true,
        $contentActions: [{ action: { type: 'SendMessage', settings: { type: 'text/plain', content: '{{config.autoriza}} {{resource. flowIdDev}}' } } }, { input: { bypass: true } }],
      }),
      fallback: state(),
    }
    const a = analyzePackage(makePackage([{ name: 'botA', flow: f }]).root)
    expect(a.configs[0]?.missing.map((m) => m.key)).toEqual(['autoriza'])
    expect(a.externalResources.map((e) => e.expression)).toEqual(['resource. flowIdDev'])
  })

  it('o mesmo id de estado em dois bots permanece separado por bot', () => {
    const f = { ini: state({ root: true }), fallback: state() }
    const a = analyzePackage(makePackage([{ name: 'botA', flow: f }, { name: 'botB', flow: f }]).root)
    expect(a.inventory.states.filter((s) => s.stateId === 'ini').map((s) => s.bot).sort()).toEqual(['botA', 'botB'])
  })
})

describe('simbolos e grafo (unidades)', () => {
  it('classifica namespaces sem corrigir grafia', () => {
    expect(classify('config.apiHub')).toEqual({ namespace: 'config', name: 'apiHub' })
    expect(classify('contact.extras.utmTerm')).toEqual({ namespace: 'contact.extras', name: 'utmTerm' })
    expect(classify('resource. flowIdDev')).toEqual({ namespace: 'resource', name: ' flowIdDev' })
    expect(classify('obj@a.b')).toEqual({ namespace: 'context', name: 'obj@a.b' })
    expect(classify('tunnel.owner').namespace).toBe('tunnel')
  })

  it('componentes fortemente conexos', () => {
    const adj = new Map([['a', new Set(['b'])], ['b', new Set(['c'])], ['c', new Set(['a', 'd'])], ['d', new Set<string>()]])
    const comps = stronglyConnected(['a', 'b', 'c', 'd'], adj).map((c) => c.sort())
    expect(comps).toContainEqual(['a', 'b', 'c'])
    expect(comps).toContainEqual(['d'])
  })
})
