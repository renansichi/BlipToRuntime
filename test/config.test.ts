import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadConfigFile, validateConfig } from '../src/config/index.js'

const examplePath = fileURLToPath(new URL('../examples/configuracao.exemplo.json', import.meta.url))
const example = (): any => JSON.parse(readFileSync(examplePath, 'utf8'))

describe('configuracao revisao 2.0', () => {
  it('aceita o modelo de exemplo, com pendencias explicitas e sem erro tecnico', () => {
    const r = loadConfigFile(examplePath)
    expect(r.errors).toEqual([])
    expect(r.ok).toBe(true)
    expect(r.config?.bindings.resources).toHaveLength(140)
    expect(r.config?.bindings.botAliases).toHaveLength(35)
    expect(r.config?.bindings.whatsappFlows).toHaveLength(11)
    expect(r.config?.manualImportMappings).toHaveLength(13)
    expect(r.pending.length).toBeGreaterThan(0)
    expect(r.pending.every((d) => d.class === 'parameter_required' || d.class === 'parameter_or_adaptation_required' || d.class === 'adaptation_required')).toBe(true)
  })

  it('pendencias nao viram valores: aliases nulos geram REDIRECT_ALIAS_UNRESOLVED', () => {
    const r = validateConfig(example())
    expect(r.pending.filter((d) => d.code === 'REDIRECT_ALIAS_UNRESOLVED')).toHaveLength(35)
    expect(r.pending.filter((d) => d.code === 'FLOW_ASSET_MISSING')).toHaveLength(11)
  })

  it.each([
    ['delivery.automaticInstall', (c: any) => (c.delivery.automaticInstall = true)],
    ['policies.allowFakeIntegrationSuccess', (c: any) => (c.policies.allowFakeIntegrationSuccess = true)],
    ['policies.allowKayrosCodeChanges', (c: any) => (c.policies.allowKayrosCodeChanges = true)],
    ['target.channel', (c: any) => (c.target.channel = 'webchat')],
    ['target.profile', (c: any) => (c.target.profile = 'kayros-strict')],
    ['schemaVersion', (c: any) => (c.schemaVersion = '1.0')],
  ])('rejeita violacao de escopo/politica: %s', (_n, mutate) => {
    const c = example()
    mutate(c)
    const r = validateConfig(c)
    expect(r.ok).toBe(false)
    expect(r.errors[0]?.class).toBe('technical_error')
  })

  it('campo desconhecido em politicas nao e aceito silenciosamente', () => {
    const c = example()
    c.policies.novaPolitica = true
    expect(validateConfig(c).ok).toBe(false)
  })

  it('bot fora dos 13 conhecidos e rejeitado', () => {
    const c = example()
    c.bindings.resources[0].bot = 'outrobot'
    expect(validateConfig(c).ok).toBe(false)
  })

  it('segredo nao pode carregar valor', () => {
    const c = example()
    const i = c.bindings.resources.findIndex((r: any) => r.isSecret)
    expect(i).toBeGreaterThanOrEqual(0)
    c.bindings.resources[i].overrideValue = 'SEGREDO'
    const r = validateConfig(c)
    expect(r.errors.map((e) => e.code)).toContain('CONFIG_SECRET_VALUE_PRESENT')
    expect(JSON.stringify(r.errors)).not.toContain('SEGREDO')
  })

  it('chave de Recurso duplicada e erro', () => {
    const c = example()
    c.bindings.resources[1].targetResourceKey = c.bindings.resources[0].targetResourceKey
    expect(validateConfig(c).errors.map((e) => e.code)).toContain('CONFIG_DUPLICATE_KEY')
  })

  describe('aceite de adaptacoes', () => {
    const adaptation = (over: any = {}) => ({
      id: 'ttl-cpf',
      sourceLocations: [],
      journeyId: 'vivofixadados/cpf',
      originalBehavior: 'Contexto expira em 10 min',
      proposedBehavior: 'Sessao do Kayros',
      reason: 'Kayros nao expira variavel',
      kind: 'data',
      changesBusinessBehavior: true,
      targetStrategy: 'session',
      fallback: { kind: null, queueBindingKey: null, logicalFlow: null, promptText: null, retryPolicy: null, endReason: null },
      acceptance: { status: 'proposed', responsible: null, date: null, evidenceFile: null },
      validationScenarioIds: [],
      ...over,
    })

    it('proposta funcional nao aceita fica listada, sem bloquear', () => {
      const c = example()
      c.adaptations = [adaptation()]
      const r = validateConfig(c)
      expect(r.ok).toBe(true)
      expect(r.unacceptedAdaptations).toEqual(['ttl-cpf'])
    })

    it('aceite sem responsavel/data/evidencia e erro', () => {
      const c = example()
      c.adaptations = [adaptation({ acceptance: { status: 'accepted', responsible: 'Ana', date: null, evidenceFile: null } })]
      expect(validateConfig(c).errors.map((e) => e.code)).toContain('CONFIG_ACCEPTANCE_INCOMPLETE')
    })

    it('aceite completo remove da lista de nao aceitas', () => {
      const c = example()
      c.adaptations = [adaptation({ acceptance: { status: 'accepted', responsible: 'Ana', date: '2026-11-03', evidenceFile: 'ev.md' } })]
      const r = validateConfig(c)
      expect(r.ok).toBe(true)
      expect(r.unacceptedAdaptations).toEqual([])
    })
  })
})
