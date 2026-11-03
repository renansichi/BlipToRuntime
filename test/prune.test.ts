import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { analyzePackage } from '../src/analysis/analyze.js'
import { validateConfig } from '../src/config/load.js'
import { convertAnalysis } from '../src/emit/convert.js'
import { pruneUnreadVariables } from '../src/optimize/prune.js'
import { type SlimDoc, slimDocument } from '../src/optimize/slim.js'
import { validateKayrosDocument } from '../src/profile/validate-document.js'
import { validateImportSafety, validateReferences } from '../src/validate/refs.js'
import { importLikeKayrosOs } from './helpers/importer-sim.js'
import { type ScenarioFile, check, runScenario } from './helpers/scenario-runner.js'
import { type Scenario, type Step, type Trace, simulate } from './helpers/sim.js'

const LOTE = 'C:/Users/renan/Documents/Convert To Runtime/Analise Blip Kayros/2026-11-02T04-26-43-071Z-e44c3a22'
const root = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// ---- documento sintetico ----
const V = (name: string) => ({ id: `v-${name}`, name, isSessionVariable: true as const })
const set = (id: string, name: string, expr: string) => ({ id, type: 'Set variable', options: { type: 'Custom', variableId: `v-${name}`, expressionToEvaluate: expr, isCode: false } })
const msg = (id: string, text: string, extra: Record<string, unknown> = {}) => ({ id, type: 'whatsapp-cloud', options: { action: 'Enviar texto', body: text, ...extra } })
const mkDoc = (blocks: ReturnType<typeof set>[] | unknown[], names: string[], extraGroups: unknown[] = []): SlimDoc =>
  ({
    name: 't',
    groups: [{ id: 'g1', title: 'A', graphCoordinates: { x: 0, y: 0 }, blocks }, ...extraGroups],
    events: [{ id: 'ev', type: 'start', graphCoordinates: { x: 0, y: 0 }, outgoingEdgeId: 'e0' }],
    variables: names.map(V),
    edges: [{ id: 'e0', from: { eventId: 'ev' }, to: { groupId: 'g1' } }],
  }) as unknown as SlimDoc

describe('descarte de variaveis sem leitor (sintetico)', () => {
  it('remove a gravacao sem leitor e mantem a lida por placeholder, por Condition e por Code', () => {
    const doc = mkDoc(
      [
        set('b1', 'lixo', 'x'),
        set('b2', 'lida', 'y'),
        set('b3', 'naCondicao', 'z'),
        set('b4', 'noCode', 'w'),
        msg('b5', 'oi {{lida}}'),
        { id: 'b6', type: 'Condition', items: [{ id: 'i1', content: { logicalOperator: 'OR', comparisons: [{ id: 'c', variableId: 'v-naCondicao', comparisonOperator: 'Equal to', value: '1' }] } }] },
        { id: 'b7', type: 'Code', options: { name: 'x', content: 'x({{noCode}})' } },
      ],
      ['lixo', 'lida', 'naCondicao', 'noCode'],
    )
    const st = pruneUnreadVariables(doc)
    expect(doc.groups[0]!.blocks.map((b) => b.id)).toEqual(['b2', 'b3', 'b4', 'b5', 'b6', 'b7'])
    expect(doc.variables.map((v) => v.name)).toEqual(['lida', 'naCondicao', 'noCode'])
    expect(st.discarded).toEqual(['lixo'])
  })

  it('ponto fixo: a cadeia so lida por gravacoes mortas inteira sai; auto-leitura nao mantem viva', () => {
    const doc = mkDoc([set('b1', 'a', 'x'), set('b2', 'b', '{{a}}'), set('b3', 'c', '{{b}}'), set('b4', 's', '{{s}}'), msg('b5', 'fim')], ['a', 'b', 'c', 's'])
    pruneUnreadVariables(doc)
    expect(doc.groups[0]!.blocks.map((b) => b.id)).toEqual(['b5'])
    expect(doc.variables.map((v) => v.name)).toEqual([])
  })

  it('protegida, destino/origem de aresta e unico bloco do grupo nao saem', () => {
    const doc = mkDoc([set('b1', 'protegida', 'x'), { ...set('b2', 'comAresta', 'y'), outgoingEdgeId: 'e1' }], ['protegida', 'comAresta'], [
      { id: 'g2', title: 'B', graphCoordinates: { x: 0, y: 0 }, blocks: [set('b3', 'sozinha', 'z')] },
    ])
    doc.variables.push(V('sozinha') as never)
    doc.edges.push({ id: 'e1', from: { blockId: 'b2' }, to: { groupId: 'g2' } })
    pruneUnreadVariables(doc, { protectedNames: new Set(['protegida']) })
    expect(doc.groups[0]!.blocks.map((b) => b.id)).toEqual(['b1', 'b2'])
    expect(doc.groups[1]!.blocks.map((b) => b.id)).toEqual(['b3'])
  })

  it('variablesToPass leva so nao internas, declaradas e lidas por outro bot', () => {
    const doc = mkDoc(
      [set('b1', 'cpf', '1'), set('b2', 'privada', '2'), set('b3', '__eq_cpf', '3'), msg('b4', '{{privada}} {{cpf}} {{__eq_cpf}}'), { id: 'b5', type: 'Typebot link', options: { typebotId: '{{resource.blip.link.x}}', variablesToPass: ['cpf', 'privada', '__eq_cpf', 'fantasma'] } }],
      ['cpf', 'privada', '__eq_cpf'],
    )
    pruneUnreadVariables(doc, { passNames: new Set(['cpf']) })
    const link = doc.groups[0]!.blocks.find((b) => b.type === 'Typebot link')!
    expect((link.options as { variablesToPass: string[] }).variablesToPass).toEqual(['cpf'])
  })
})

describe('Set variable em modo codigo (fusao)', () => {
  it('nunca e removido como gravacao sem leitor; as variaveis do setVariable continuam declaradas', () => {
    const merged = { id: 'm', type: 'Set variable', options: { type: 'Custom', isCode: true, variableId: 'v-sink', expressionToEvaluate: 'setVariable("lida", "1"); setVariable("outra", "2");' } }
    const doc = mkDoc([merged, msg('b2', 'oi {{lida}}')], ['sink', 'lida', 'outra'])
    pruneUnreadVariables(doc)
    expect(doc.groups[0]!.blocks.map((b) => b.id)).toEqual(['m', 'b2'])
    expect(doc.variables.map((v) => v.name)).toEqual(['sink', 'lida', 'outra'])
  })
})

describe('versao enxuta (sintetico)', () => {
  it('descarta grupo inalcancavel e suas arestas, e troca UUIDs por ids curtos sem tocar queueId', () => {
    const U = (n: number) => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`
    const q = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
    const doc = {
      name: 't',
      groups: [
        { id: U(1), title: 'A', graphCoordinates: { x: 0, y: 0 }, blocks: [{ id: U(2), type: 'transferToQueue', options: { queueId: q }, outgoingEdgeId: U(3) }, set(U(4), 'chave', U(7))] },
        { id: U(5), title: 'B', graphCoordinates: { x: 0, y: 0 }, blocks: [msg(U(6), 'x', {})] },
        { id: U(8), title: 'Orfao', graphCoordinates: { x: 0, y: 0 }, blocks: [{ ...msg(U(9), 'y'), outgoingEdgeId: U(10) }] },
      ],
      events: [{ id: U(11), type: 'start', graphCoordinates: { x: 0, y: 0 }, outgoingEdgeId: U(12) }],
      variables: [{ id: `v-chave`, name: 'chave', isSessionVariable: true }],
      edges: [
        { id: U(3), from: { blockId: U(2) }, to: { groupId: U(5) } },
        { id: U(10), from: { blockId: U(9) }, to: { groupId: U(1) } },
        { id: U(12), from: { eventId: U(11) }, to: { groupId: U(1) } },
      ],
    } as unknown as SlimDoc
    const st = slimDocument(doc, { protectedNames: new Set(['chave']) })
    expect(st).toMatchObject({ groupsRemoved: 1, edgesRemoved: 1 })
    expect(doc.groups.map((g) => g.title)).toEqual(['A', 'B'])
    const text = JSON.stringify(doc)
    expect(text).toContain(q)
    expect(text).not.toContain(U(1))
    // UUID usado como dado (id de estado, midia) nao e id do arquivo: fica como esta
    const data = (doc.groups[0]!.blocks[1]!.options as { expressionToEvaluate: string }).expressionToEvaluate
    expect(data).toBe(U(7))
    expect(validateReferences(doc)).toEqual([])
  })
})

// ---- dados reais: vivofixadados ----
const INPUTS = ['sim', 'não', '1', '2', 'continuar', 'atendente', '52998224725', '12345678901', 'ola', 'a@b.com', '10/10/1990']
const VALUES = ['true', 'false', 'null', 'Empresa', 'EMPRESA', 'x', '1', '0', 'sim']
const HTTP = [
  { status: 200, body: { isValid: true, data: { a: 1 }, nome: 'x', mae: 'y' } },
  { status: 500, body: 'erro' },
  { status: 200, body: {} },
]
const prng = (seed: number) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7)
const observable = (t: Trace, keep: Set<string>) => ({
  groups: t.groups,
  messages: t.messages,
  http: t.http,
  events: t.events,
  links: t.links,
  end: t.end,
  vars: Object.fromEntries(Object.entries(t.vars).filter(([k]) => keep.has(k) && !k.startsWith('__'))),
})

describe.skipIf(!existsSync(LOTE))('piloto vivofixadados: poda e versao enxuta preservam o comportamento', () => {
  const BOT = 'vivofixadados'
  const a = analyzePackage(LOTE)
  const cfg = validateConfig(JSON.parse(readFileSync(root('../config/piloto.config.json'), 'utf8'))).config!
  const file = { bot: BOT, ...JSON.parse(readFileSync(root('../scenarios/vivofixadados.piloto.json'), 'utf8')) } as ScenarioFile
  const entries = [{ bot: BOT, stateTitle: 'CPF', presets: { tipoPessoa: 'Pessoa Fisica', idAbandono: '@state:Direciona_Abandono' } }]
  const ref = convertAnalysis(a, { onlyBots: [BOT], config: cfg, testEntries: entries })
  const lean = convertAnalysis(a, { onlyBots: [BOT], config: cfg, testEntries: entries, prune: true })

  it('a poda reduz o documento e o resultado continua estruturalmente valido e seguro para o importador', () => {
    for (let i = 0; i < ref.bots.length; i++) {
      const r = ref.bots[i]!
      const p = lean.bots[i]!
      expect(p.status).toBe('structurally_valid')
      expect(validateImportSafety(p.document)).toEqual([])
      expect(p.pruning!.setBlocksRemoved).toBeGreaterThan(0)
      expect(p.stats.blocks).toBeLessThan(r.stats.blocks)
      expect(p.document.variables.length).toBeLessThan(r.document.variables.length)
    }
  })

  it('nunca descarta o que outro bot le, o contexto do redirect e as decisoes de dados', () => {
    const names = new Set(lean.bots[0]!.document.variables.map((v) => v.name))
    for (const n of ['redirect_context', 'contact_extras_primeiraMensagem', 'contact_extras_filaAH', 'contact_extras_prioridade', 'contact_extras_encerramentoAbandonoFormulario', 'produtoEscolhido']) {
      expect(names.has(n), n).toBe(true)
    }
  })

  const slim = (i: number) => {
    const doc = structuredClone(lean.bots[i]!.document) as unknown as SlimDoc
    const st = slimDocument(doc, lean.bots[i]!.pruneOptions)
    return Object.assign(doc, { idMap: st.idMap }) as SlimDoc & { idMap: ReadonlyMap<string, string> }
  }


  it('a versao enxuta e valida e menor, e sobrevive ao importador do Kayros OS', () => {
    const variant = lean.bots.findIndex((b) => b.variant === 'cpf')
    const doc = slim(variant)
    expect([...validateKayrosDocument(doc), ...validateReferences(doc), ...validateImportSafety(doc)]).toEqual([])
    expect(doc.groups.length).toBeLessThan(lean.bots[variant]!.document.groups.length)
    expect(JSON.stringify(doc).length).toBeLessThan(JSON.stringify(lean.bots[variant]!.document).length * 0.75)
    const imported = importLikeKayrosOs(doc as never)
    expect(imported.groups).toHaveLength(doc.groups.length)
    expect([...validateReferences(imported)]).toEqual([])
  })

  for (const s of file.scenarios.filter((x) => x.config !== 'none')) {
    it(`${s.id} — ${s.title}: mesmo resultado no original, no podado e no enxuto importado`, () => {
      const variant = lean.bots.findIndex((b) => b.variant === 'cpf')
      const sl = slim(variant)
      const doc = importLikeKayrosOs(sl as never)
      const base = ref.bots.find((b) => !b.variant)!
      const x = runScenario(a, base, file, s)
      const y = runScenario(a, lean.bots.find((b) => !b.variant)!, file, s)
      check(s, y)
      const z = runScenario(a, { ...lean.bots[variant]!, document: doc as never }, file, s)
      const keep = new Set(lean.bots.find((b) => !b.variant)!.document.variables.map((v) => v.name))
      expect(observable(y, keep)).toEqual(observable(x, keep))
      // No enxuto, uma variavel cujo unico leitor ficou em grupo inalcancavel deixa de ser gravada.
      const keepZ = new Set([...keep].filter((n) => doc.variables.some((v: { name: string }) => v.name === n)))
      expect(observable(z, keepZ)).toEqual(observable(x, keepZ))
    })
  }

  it('execucoes pseudo-aleatorias em todos os estados: original, podado e enxuto importado se comportam igual', () => {
    const variant = lean.bots.findIndex((b) => b.variant === 'cpf')
    const full = ref.bots.find((b) => !b.variant)!
    const pruned = lean.bots.find((b) => !b.variant)!
    const enx = importLikeKayrosOs(slim(variant) as never)
    const enxByTitle = new Map<string, string[]>()
    for (const g of enx.groups as { id: string; title: string }[]) enxByTitle.set(g.title, [...(enxByTitle.get(g.title) ?? []), g.id])
    const keep = new Set(enx.variables.map((v: { name: string }) => v.name) as string[])
    for (const n of pruned.document.variables.map((v) => v.name)) if (!keep.has(n)) keep.delete(n)
    const vars = full.document.variables.map((v) => v.name)
    let compared = 0
    const diffs: string[] = []
    for (const g of full.document.groups) {
      const mine = enxByTitle.get(g.title)
      if (!mine || mine.length !== 1) continue
      const pg = pruned.document.groups.find((x) => x.title === g.title)
      if (!pg) continue
      for (let trial = 0; trial < 3; trial++) {
        const r = prng(hash(`${g.title}|${trial}`))
        const pick = <T>(l: T[]): T => l[Math.floor(r() * l.length)] as T
        const preset: Record<string, string> = {}
        for (let i = 0, n = Math.floor(r() * 9); i < n; i++) preset[pick(vars)] = pick(VALUES)
        const input: Step[] = Array.from({ length: 4 }, () => (r() < 0.12 ? { timeout: true as const } : pick(INPUTS)))
        const sc = (startGroupId: string): Scenario => ({ id: g.title, title: 'diferencial', startGroupId, vars: preset, input, http: [], httpAuto: (m, u) => HTTP[hash(m + u) % HTTP.length] as never, maxSteps: 50000, maxTrail: 25 })
        const x = simulate(full.document as never, sc(g.id))
        const y = simulate(pruned.document as never, sc(pg.id))
        const z = simulate(enx as never, sc(mine[0]!))
        if ([x, y, z].some((t) => t.end.detail === 'LIMITE_DE_PASSOS')) continue
        compared++
        const ox = JSON.stringify(observable(x, keep))
        if (ox !== JSON.stringify(observable(y, keep)) || ox !== JSON.stringify(observable(z, keep))) {
          const ob = [observable(x, keep), observable(y, keep), observable(z, keep)] as Record<string, unknown>[]
          const keys = Object.keys(ob[0]!).filter((k) => JSON.stringify(ob[0]![k]) !== JSON.stringify(ob[1]![k]) || JSON.stringify(ob[0]![k]) !== JSON.stringify(ob[2]![k]))
          const one = (k: string) => (k === 'vars' ? Object.keys(ob[0]!.vars as object).filter((n) => JSON.stringify((ob[0]!.vars as Record<string, unknown>)[n]) !== JSON.stringify((ob[2]!.vars as Record<string, unknown>)[n]) || JSON.stringify((ob[0]!.vars as Record<string, unknown>)[n]) !== JSON.stringify((ob[1]!.vars as Record<string, unknown>)[n])).join(',') : '')
          diffs.push(`${g.title} #${trial}: ${keys.map((k) => k + (one(k) ? `[${one(k)}]` : '')).join(' ')}`)
        }
      }
    }
    expect(compared).toBeGreaterThan(400)
    expect(diffs.slice(0, 5).join('\n')).toBe('')
  }, 600_000)
})
