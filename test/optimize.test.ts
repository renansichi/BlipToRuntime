import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { analyzePackage } from '../src/analysis/analyze.js'
import { convertAnalysis } from '../src/emit/convert.js'
import { stableId } from '../src/emit/ids.js'
import { optimizeDocument } from '../src/optimize/index.js'
import { validateKayrosDocument } from '../src/profile/validate-document.js'
import { validateImportSafety, validateReferences } from '../src/validate/refs.js'
import { type Scenario, type Step, type Trace, simulate } from './helpers/sim.js'

const LOTE = 'C:/Users/renan/Documents/Convert To Runtime/Analise Blip Kayros/2026-11-02T04-26-43-071Z-e44c3a22'

// ---- Teste diferencial (F4-06): o fluxo de referencia (sem otimizacao) e o otimizado precisam
// produzir o MESMO resultado observavel: mensagens, chamadas HTTP, eventos, links, variaveis
// finais, trilha de estados e fim. Entradas pseudo-aleatorias, deterministicas (semente fixa).

function prng(seed: number) {
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

const INPUTS = ['sim', 'não', 'Não', '1', '2', 'continuar', 'atendente', '52998224725', '12345678901', 'ola', 'a@b.com', '10/10/1990']
const VALUES = ['true', 'false', 'null', 'Empresa', 'EMPRESA', 'x', '1', '0', '{"a":1}', 'sim']
const HTTP = [
  { status: 200, body: { isValid: true, data: { a: 1 }, nome: 'x', mae: 'y' } },
  { status: 500, body: 'erro' },
  { status: 200, body: {} },
  { status: 404, body: { message: 'nao' } },
]

function scenarioFor(bot: string, groupId: string, vars: string[], trial: number): Scenario {
  const r = prng(hash(`${bot}|${groupId}|${trial}`))
  const pick = <T>(l: T[]): T => l[Math.floor(r() * l.length)] as T
  const preset: Record<string, string> = {}
  const n = Math.floor(r() * 9)
  for (let i = 0; i < n && vars.length; i++) preset[pick(vars)] = pick(VALUES)
  const input: Step[] = Array.from({ length: 4 }, () => (r() < 0.12 ? { timeout: true as const } : pick(INPUTS)))
  return {
    id: `${bot}/${groupId}/${trial}`,
    title: 'diferencial',
    startGroupId: groupId,
    vars: preset,
    input,
    http: [],
    httpAuto: (method, url) => HTTP[hash(method + url) % HTTP.length] as { status: number; body?: unknown },
    maxSteps: 50000,
    maxTrail: 25,
  }
}

const observable = (t: Trace) => ({
  groups: t.groups,
  messages: t.messages,
  http: t.http,
  events: t.events,
  links: t.links,
  end: t.end,
  // Variaveis internas (`__dec_*`, `__eq_*`...) nao sao comportamento observavel.
  vars: Object.fromEntries(Object.entries(t.vars).filter(([k]) => !k.startsWith('__'))),
})

describe.skipIf(!existsSync(LOTE))('otimizacao (F4): equivalencia observavel com o formato de referencia', () => {
  const a = analyzePackage(LOTE)
  const ref = convertAnalysis(a, { optimize: false })
  const opt = convertAnalysis(a) // padrao: seguro para o importador (sem to.blockId)
  const inl = convertAnalysis(a, { blockEdges: true }) // opt-in: arestas para blocos

  it('os dois formatos otimizados sao estruturalmente validos nos 13 bots e menores que a referencia', () => {
    expect(opt.bots.every((b) => b.status === 'structurally_valid')).toBe(true)
    expect(inl.bots.every((b) => b.status === 'structurally_valid')).toBe(true)
    for (let i = 0; i < opt.bots.length; i++) {
      const r = ref.bots[i]!
      expect(opt.bots[i]!.stats.groups, opt.bots[i]!.name).toBeLessThanOrEqual(r.stats.groups)
      expect(opt.bots[i]!.stats.blocks, opt.bots[i]!.name).toBeLessThanOrEqual(r.stats.blocks)
      expect(inl.bots[i]!.stats.groups, inl.bots[i]!.name).toBeLessThan(r.stats.groups)
    }
    const total = (res: typeof ref, k: 'groups' | 'blocks') => res.bots.reduce((n, b) => n + b.stats[k], 0)
    expect(total(opt, 'groups')).toBeLessThan(total(ref, 'groups'))
    expect(total(inl, 'groups')).toBeLessThan(total(ref, 'groups') * 0.4)
  })

  it('so os formatos sem to.blockId sao seguros para o importador do Kayros OS', () => {
    for (const b of opt.bots) expect(validateImportSafety(b.document), b.name).toEqual([])
    for (const b of ref.bots) expect(validateImportSafety(b.document), b.name).toEqual([])
    expect(inl.bots.some((b) => validateImportSafety(b.document).length > 0)).toBe(true)
  })

  it('todo estado mantem seu grupo de entrada e as mesmas adaptacoes propostas', () => {
    expect(opt.adaptations.map((x) => x.id)).toEqual(ref.adaptations.map((x) => x.id))
    for (let i = 0; i < opt.bots.length; i++) {
      const ids = new Set(opt.bots[i]!.document.groups.map((g) => g.id))
      for (const s of a.inventory.states.filter((x) => x.bot === opt.bots[i]!.name)) {
        expect(ids.has(stableId(s.bot, `group:s:${s.stateId}`)), `${s.bot}/${s.title}`).toBe(true)
      }
    }
  })

  it('execucoes pseudo-aleatorias em TODOS os estados dos 13 bots: referencia e formatos otimizados se comportam igual', () => {
    let compared = 0
    let skipped = 0
    const diffs: string[] = []
    for (const [label, fmt, trials] of [['seguro', opt, 2], ['blockEdges', inl, 1]] as const) {
      for (let i = 0; i < ref.bots.length; i++) {
        const rb = ref.bots[i]!
        const ob = fmt.bots[i]!
        const vars = rb.document.variables.map((v) => v.name)
        for (const s of a.inventory.states.filter((x) => x.bot === rb.name)) {
          const gid = stableId(s.bot, `group:s:${s.stateId}`)
          for (let trial = 0; trial < trials; trial++) {
            const sc = scenarioFor(rb.name, gid, vars, trial)
            const x = simulate(rb.document as never, sc)
            const y = simulate(ob.document as never, sc)
            if (x.end.detail === 'LIMITE_DE_PASSOS' || y.end.detail === 'LIMITE_DE_PASSOS') {
              skipped++
              continue
            }
            compared++
            if (JSON.stringify(observable(x)) !== JSON.stringify(observable(y))) {
              diffs.push(`[${label}] ${rb.name}/${s.title} #${trial}\n  ref: ${x.groups.join('>')} ${JSON.stringify(x.end)} msgs=${x.messages.length} http=${x.http.length}\n  opt: ${y.groups.join('>')} ${JSON.stringify(y.end)} msgs=${y.messages.length} http=${y.http.length}`)
            }
          }
        }
      }
    }
    expect(compared).toBeGreaterThan(4500)
    expect(skipped, 'muitas execucoes inconclusivas').toBeLessThan(compared * 0.02)
    expect(diffs.slice(0, 5).join('\n')).toBe('')
    expect(diffs).toHaveLength(0)
  }, 900_000)
})

describe.skipIf(!existsSync(LOTE))('o teste diferencial enxerga defeitos (sensibilidade)', () => {
  it('remover blocos do fluxo otimizado produz divergencias detectadas', () => {
    const a = analyzePackage(LOTE)
    const ref = convertAnalysis(a, { optimize: false, onlyBots: ['vivofixadados'] }).bots[0]!
    const opt = convertAnalysis(a, { onlyBots: ['vivofixadados'] }).bots[0]!
    // Mutacao: elimina cada 7o "Set variable" sem aresta e sem destino de aresta.
    const incoming = new Set(opt.document.edges.flatMap((e) => (e.to.blockId ? [e.to.blockId] : [])))
    let n = 0
    for (const g of opt.document.groups) {
      g.blocks = g.blocks.filter((b) => !(b.type === 'Set variable' && !b.outgoingEdgeId && !incoming.has(b.id) && n++ % 7 === 0))
    }
    expect(n).toBeGreaterThan(20)
    const vars = ref.document.variables.map((v) => v.name)
    let diffs = 0
    for (const s of a.inventory.states.filter((x) => x.bot === 'vivofixadados')) {
      const sc = scenarioFor('vivofixadados', stableId('vivofixadados', `group:s:${s.stateId}`), vars, 0)
      if (JSON.stringify(observable(simulate(ref.document as never, sc))) !== JSON.stringify(observable(simulate(opt.document as never, sc)))) diffs++
    }
    expect(diffs).toBeGreaterThan(5)
  }, 120_000)
})

describe('optimizeDocument: precondicoes', () => {
  const mkDoc = (blocks: { id: string; type: string; options?: Record<string, unknown>; outgoingEdgeId?: string }[], edges: { id: string; from: Record<string, string>; to: { groupId: string; blockId?: string } }[] = []) =>
    ({
      groups: [{ id: 'g', title: 'G', graphCoordinates: { x: 0, y: 0 }, blocks }],
      edges,
      variables: [{ id: 'v1', name: 'x' }],
    }) as never
  const gen = (id: string, content: string, extra: Record<string, unknown> = {}) => ({ id, type: 'Code', options: { name: 'gerado', content }, ...extra })
  const eq = 'setVariable("__eq_x", __n({{x}}));'
  const helper = 'const __n = function (v) { return String(v); };'

  it('remove derivada repetida no mesmo trecho linear', () => {
    const doc = mkDoc([gen('a', `${helper}\n${eq}`), { id: 'm', type: 'whatsapp-cloud', options: { action: 'Enviar texto' } }, gen('b', `${helper}\n${eq}`)])
    const s = optimizeDocument(doc)
    expect(s.codeBlocksRemoved).toBe(1)
    expect((doc as { groups: { blocks: unknown[] }[] }).groups[0]!.blocks).toHaveLength(2)
  })

  it('mantem a derivada se a variavel de origem foi escrita no meio', () => {
    const doc = mkDoc([gen('a', `${helper}\n${eq}`), { id: 's', type: 'Set variable', options: { variableId: 'v1', expressionToEvaluate: 'z' } }, gen('b', `${helper}\n${eq}`)])
    expect(optimizeDocument(doc).codeBlocksRemoved).toBe(0)
  })

  it('mantem a derivada se o bloco e destino de aresta vinda de fora do trecho', () => {
    const doc = mkDoc([gen('a', `${helper}\n${eq}`), gen('b', `${helper}\n${eq}`)], [{ id: 'e', from: { blockId: 'outro' }, to: { groupId: 'g', blockId: 'b' } }])
    expect(optimizeDocument(doc).derivedLinesRemoved).toBe(0)
  })

  it('nao toca scripts de origem nem sorteio (mat_rnd_)', () => {
    const doc = mkDoc([
      { id: 'a', type: 'Code', options: { name: 'script', content: eq } },
      { id: 'b', type: 'Code', options: { name: 'script', content: eq } },
      gen('c', 'setVariable("mat_rnd_1", [1][0]);'),
      gen('d', 'setVariable("mat_rnd_1", [1][0]);'),
    ])
    const s = optimizeDocument(doc)
    expect(s.derivedLinesRemoved).toBe(0)
  })

  it('funde Codes gerados adjacentes independentes e nao funde se o segundo le o que o primeiro escreve', () => {
    const indep = mkDoc([gen('a', 'setVariable("p", "1");'), gen('b', 'setVariable("q", "2");')])
    expect(optimizeDocument(indep).codeBlocksMerged).toBe(1)
    const dep = mkDoc([gen('a', 'setVariable("p", "1");'), gen('b', 'setVariable("q", {{p}});')])
    expect(optimizeDocument(dep).codeBlocksMerged).toBe(0)
  })

  it('o resultado continua valido pelos validadores', () => {
    // Documento minimo valido com dois Codes independentes.
    const doc = {
      groups: [{ id: 'g', title: 'G', graphCoordinates: { x: 0, y: 0 }, blocks: [gen('a', 'setVariable("p", "1");'), gen('b', 'setVariable("q", "2");')] }],
      edges: [{ id: 'e', from: { eventId: 'ev' }, to: { groupId: 'g' } }],
      events: [{ id: 'ev', type: 'start', outgoingEdgeId: 'e', graphCoordinates: { x: 0, y: 0 } }],
      variables: [],
    }
    optimizeDocument(doc as never)
    expect([...validateKayrosDocument(doc), ...validateReferences(doc)].filter((d) => d.code !== 'KAYROS_VARIABLE_UNDECLARED')).toEqual([])
  })
})
