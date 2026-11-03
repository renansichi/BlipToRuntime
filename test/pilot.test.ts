import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { analyzePackage } from '../src/analysis/analyze.js'
import { validateConfig } from '../src/config/load.js'
import { convertAnalysis } from '../src/emit/convert.js'
import { type ScenarioFile, check, runScenario } from './helpers/scenario-runner.js'

const LOTE = 'C:/Users/renan/Documents/Convert To Runtime/Analise Blip Kayros/2026-11-02T04-26-43-071Z-e44c3a22'
const root = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const file = { bot: 'vivofixadados', ...JSON.parse(readFileSync(root('../scenarios/vivofixadados.piloto.json'), 'utf8')) } as ScenarioFile

describe.skipIf(!existsSync(LOTE))('piloto vivofixadados (recorte CPF) — cenarios derivados', () => {
  const a = analyzePackage(LOTE)
  const pilotCfg = validateConfig(JSON.parse(readFileSync(root('../config/piloto.config.json'), 'utf8'))).config!
  // Sem configuracao: isola a semantica da conversao. Com a configuracao do piloto: o pacote entregue.
  const bare = convertAnalysis(a, { onlyBots: ['vivofixadados'] }).bots[0]!
  const converted = convertAnalysis(a, { onlyBots: ['vivofixadados'], config: pilotCfg }).bots[0]!
  const traces = new Map<string, ReturnType<typeof runScenario>>()

  for (const s of file.scenarios) {
    it(`${s.id} — ${s.title}`, () => {
      const t = runScenario(a, s.config === 'none' ? bare : converted, file, s)
      traces.set(s.id, t)
      check(s, t)
    })
  }

  it('chamada sem fixture e erro explicito, nunca sucesso generico; Recurso sem valor e detectado', () => {
    const p01 = file.scenarios.find((x) => x.id === 'P-01')!
    const noFixture = runScenario(a, converted, file, { ...p01, http: [] })
    expect(noFixture.end.kind).toBe('error')
    expect(noFixture.end.detail).toBe('FIXTURE_MISSING GET https://hub.exemplo.test/CPF/52998224725')
    const noResource = runScenario(a, converted, { ...file, resources: {} }, p01)
    expect(noResource.missingResources.has('blip.vivofixadados.apiHub')).toBe(true)
  })

  it('os cenarios cobrem todos os estados do recorte CPF', () => {
    const visited = new Set([...traces.values()].flatMap((t) => t.groups))
    for (const g of ['CPF', 'Valida CPF', 'DI CPF', 'API Busca CPF', 'API Dados Pessoais', 'Erro API Dados Pessoais', 'Abandono CPF', 'Exceções']) {
      expect(visited.has(g), `estado sem cenario: ${g}`).toBe(true)
    }
  })

  it('cada bloco emitido do recorte tem origem rastreavel (mapa de origem)', () => {
    const mapped = new Set(converted.sourceMap.flatMap((e) => e.target.blockKeys))
    const generated = converted.document.groups.filter((g) => ['CPF', 'Valida CPF', 'DI CPF', 'API Busca CPF', 'API Dados Pessoais'].includes(g.title.split(' · ')[0] as string))
    const orphan = generated.flatMap((g) => g.blocks).filter((b) => !mapped.has(b.id) && !['Code', 'Condition', 'Set variable'].includes(b.type))
    expect(orphan.map((b) => b.type)).toEqual([])
  })

  it('decisoes de dados: descarta so os marcadores que nenhum bot le; mantem os lidos por outros bots e as chaves dinamicas', () => {
    const exprs = (b: typeof converted) =>
      new Set(b.document.variables.map((v) => v.name))
    const withCfg = exprs(converted)
    const without = exprs(bare)
    // Marcadores so escritos: presentes sem a decisao, ausentes com ela.
    for (const name of ['contact_extras_Etapa_Cpf', 'contact_extras_8__Cpf']) {
      expect(without.has(name), `sem decisao: ${name}`).toBe(true)
      expect(withCfg.has(name), `com decisao: ${name}`).toBe(false)
    }
    // Lidos por outro bot (ex.: primeiraMensagem, lido por 6 bots) continuam sendo escritos.
    expect(withCfg.has('contact_extras_primeiraMensagem')).toBe(true)
    // Chave dinamica nunca e descartada; campos lidos no proprio bot tambem nao.
    expect([...withCfg].some((n) => n.startsWith('contact_extras_dataAgendamento'))).toBe(true)
    expect(withCfg.has('contact_extras_cpf')).toBe(true)
    // Mantidos por decisao (nome operacional), mesmo sem leitor no pacote; os demais marcadores seguem descartados.
    for (const name of ['contact_extras_filaAH', 'contact_extras_prioridade', 'contact_extras_encerramentoAbandonoFormulario']) {
      expect(withCfg.has(name), `mantido: ${name}`).toBe(true)
    }
    expect(withCfg.has('contact_extras_Etapa_Email')).toBe(false)
    const adaptations = convertAnalysis(a, { onlyBots: ['vivofixadados'], config: pilotCfg }).adaptations
    for (const slug of ['ttl-session', 'merge-contact-session', 'merge-contact-write-only-discard']) {
      expect(adaptations.find((x) => x.id === `vivofixadados:${slug}`)?.acceptance, slug).toMatchObject({ status: 'accepted', responsible: 'Renan' })
    }
    // Sem a aceitacao, o descarte nao acontece (so e proposto).
    const proposedOnly = convertAnalysis(a, { onlyBots: ['vivofixadados'] }).adaptations.find((x) => x.id === 'vivofixadados:merge-contact-write-only-discard')
    expect(proposedOnly?.acceptance.status).toBe('proposed')
  })

  it('parametros de entrada: externos x herdados da cadeia, saidos do pacote', () => {
    const res = convertAnalysis(a, { onlyBots: ['vivofixadados'], config: pilotCfg })
    const ep = res.entryParameters.find((x) => x.bot === 'vivofixadados')!
    expect(ep.external.map((p) => p.name)).toEqual(expect.arrayContaining(['utmSource', 'gclid', 'phoneNumber']))
    const cep = ep.fromChain.find((p) => p.name === 'cep')
    expect(cep?.writtenBy.length).toBeGreaterThan(0)
    expect(ep.external.some((p) => p.name === 'cep')).toBe(false)
  })

  it('decisoes aceitas sobre as esperas do piloto (config/piloto.config.json)', () => {
    const cfg = validateConfig(JSON.parse(readFileSync(root('../config/piloto.config.json'), 'utf8'))).config!
    const base = convertAnalysis(a, { onlyBots: ['vivofixadados'] })
    const dec = convertAnalysis(a, { onlyBots: ['vivofixadados'], config: cfg })
    const waits = (r: typeof base) => r.bots[0]!.document.groups.flatMap((g) => g.blocks).filter((b) => b.options && (b.options as Record<string, unknown>).awaitReply === true && (b.options as Record<string, unknown>).body === 'Pode me confirmar para continuarmos?')
    // Antes: 4 esperas com pergunta padrao; "Bloco vazio final" foi removida.
    expect(waits(base)).toHaveLength(4)
    expect(waits(dec)).toHaveLength(3)
    const removed = dec.bots[0]!.sourceMap.filter((e) => e.transformation === 'wait-removed')
    expect(removed).toHaveLength(1)
    expect(removed[0]!.adaptationIds).toEqual(['vivofixadados:wait-without-message:51550a60'])
    for (const id8 of ['cd52b86a', '5e7c8d2b', '13af0f48', '51550a60']) {
      expect(dec.adaptations.find((x) => x.id === `vivofixadados:wait-without-message:${id8}`)?.acceptance.status, id8).toBe('accepted')
    }
    // As esperas de outros bots continuam so propostas.
    const all = convertAnalysis(a, { config: cfg })
    const other = all.adaptations.filter((x) => x.id.includes(':wait-without-message:') && !x.id.startsWith('vivofixadados:'))
    expect(other.length).toBeGreaterThan(0)
    expect(other.every((x) => x.acceptance.status === 'proposed')).toBe(true)
  })

  it('a espera sem envio muda de pergunta/some conforme decisao aceita na configuracao', () => {
    const cfg = validateConfig(JSON.parse(readFileSync(root('../examples/configuracao.exemplo.json'), 'utf8'))).config!
    const waitId = (b: ReturnType<typeof convertAnalysis>) => b.adaptations.find((x) => x.id.startsWith('vivofixadados:wait-without-message:'))!.id
    const base = convertAnalysis(a, { onlyBots: ['vivofixadados'] })
    const id = waitId(base)
    const tpl = {
      id, sourceLocations: [], journeyId: 'vivofixadados', originalBehavior: 'x', proposedBehavior: 'y', reason: 'z', kind: 'wait' as const,
      changesBusinessBehavior: true, targetStrategy: 'contextual-question', validationScenarioIds: [],
      acceptance: { status: 'accepted' as const, responsible: 'Renan', date: '2026-11-03', evidenceFile: 'ev.md' },
    }
    cfg.adaptations = [{ ...tpl, fallback: { kind: 'contextual-question', queueBindingKey: null, logicalFlow: null, promptText: 'Confirma, por favor?', retryPolicy: null, endReason: null } }]
    const withPrompt = convertAnalysis(a, { onlyBots: ['vivofixadados'], config: cfg })
    expect(JSON.stringify(withPrompt.bots[0]!.document)).toContain('Confirma, por favor?')
    expect(withPrompt.adaptations.find((x) => x.id === id)?.acceptance.status).toBe('accepted')

    cfg.adaptations = [{ ...tpl, fallback: { kind: 'remove', queueBindingKey: null, logicalFlow: null, promptText: null, retryPolicy: null, endReason: null } }]
    const removed = convertAnalysis(a, { onlyBots: ['vivofixadados'], config: cfg })
    expect(removed.bots[0]!.sourceMap.some((e) => e.transformation === 'wait-removed')).toBe(true)
    const count = (r: typeof base) => r.bots[0]!.document.groups.flatMap((g) => g.blocks).filter((b) => b.options && (b.options as Record<string, unknown>).awaitReply === true).length
    expect(count(removed)).toBe(count(base) - 1)
  })
})
