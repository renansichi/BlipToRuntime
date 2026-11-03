import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { analyzePackage } from '../src/analysis/analyze.js'
import { validateConfig } from '../src/config/load.js'
import { convertAnalysis } from '../src/emit/convert.js'
import { mergeSetVariables } from '../src/optimize/merge-set.js'
import { validateKayrosDocument } from '../src/profile/validate-document.js'
import { validateImportSafety, validateReferences } from '../src/validate/refs.js'
import { type Scenario, type Step, simulate } from './helpers/sim.js'

const LOTE = 'C:/Users/renan/Documents/Convert To Runtime/Analise Blip Kayros/2026-11-02T04-26-43-071Z-e44c3a22'
const root = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const BS = String.fromCharCode(92)

const V = (name: string) => ({ id: `v-${name}`, name })
const set = (id: string, name: string, expr: string) => ({ id, type: 'Set variable', options: { type: 'Custom', variableId: `v-${name}`, expressionToEvaluate: expr, isCode: false } })
const msg = (id: string) => ({ id, type: 'whatsapp-cloud', options: { action: 'Enviar texto', body: 'oi' } })
const mk = (blocks: unknown[], edges: unknown[] = []) =>
  ({
    groups: [{ id: 'g', title: 'G', graphCoordinates: { x: 0, y: 0 }, blocks }],
    edges,
    variables: ['a', 'b', 'c', 'x'].map(V),
  }) as never
type D = { groups: { blocks: { id: string; type: string; outgoingEdgeId?: string; options?: { isCode?: boolean; variableId?: string; expressionToEvaluate?: string } }[] }[]; edges: { from: unknown }[]; variables: { id: string; name: string }[] }
// `*` marca o Set variable em modo codigo.
const types = (d: D) => d.groups[0]!.blocks.map((b) => b.type + (b.options?.isCode === true ? '*' : ''))
const code = (d: D, i = 0) => String(d.groups[0]!.blocks[i]!.options?.expressionToEvaluate)

describe('fusao de Set variable (sintetico)', () => {
  it('Set variable consecutivos viram um Set variable em modo codigo com um setVariable por linha, na ordem, com alvo interno', () => {
    const d = mk([set('s1', 'a', 'um'), set('s2', 'b', 'dois "q"'), msg('m')])
    const st = mergeSetVariables(d)
    expect(types(d as D)).toEqual(['Set variable*', 'whatsapp-cloud'])
    const sink = (d as D).variables.find((v) => v.name === '__set_sink')!
    expect((d as D).groups[0]!.blocks[0]!.options).toMatchObject({ type: 'Custom', isCode: true, variableId: sink.id })
    expect(code(d as D)).toBe('setVariable("a", "um");\nsetVariable("b", "dois ' + BS + '"q' + BS + '"");')
    expect((d as D).groups[0]!.blocks[0]!.id).toBe('s1')
    expect(st).toEqual({ setBlocksMerged: 2, blocksRemoved: 1 })
  })

  it('{{x}} vira __s({{x}}) concatenado aos literais, com o helper; Empty vira ""', () => {
    const d = mk([set('s1', 'a', 'pre-{{x}}-pos'), { id: 's2', type: 'Set variable', options: { type: 'Empty', variableId: 'v-b' } }])
    mergeSetVariables(d)
    const c = code(d as D)
    expect(c).toContain('const __s = function')
    expect(c).toContain('setVariable("a", "pre-" + __s({{x}}) + "-pos");')
    expect(c).toContain('setVariable("b", "");')
  })

  it('um Set que le uma variavel escrita antes na sequencia abre outra sequencia (retrato na entrada)', () => {
    const d = mk([set('s1', 'a', '1'), set('s2', 'b', '{{a}}'), set('s3', 'c', '3'), msg('m')])
    mergeSetVariables(d)
    expect(types(d as D)).toEqual(['Set variable', 'Set variable*', 'whatsapp-cloud'])
    expect(code(d as D, 1)).toContain('setVariable("b", __s({{a}}));\nsetVariable("c", "3");')
  })

  it('nao funde: Recurso, expressao, modo codigo e bloco de outro tipo no meio', () => {
    const d = mk([
      set('s1', 'a', '{{resource.blip.x}}'),
      set('s2', 'b', '{{=1+1}}'),
      { id: 's3', type: 'Set variable', options: { type: 'Custom', variableId: 'v-c', expressionToEvaluate: 'x', isCode: true } },
      set('s4', 'x', '1'),
      msg('m'),
      set('s5', 'a', '2'),
    ])
    const st = mergeSetVariables(d)
    expect(types(d as D)).toEqual(['Set variable', 'Set variable', 'Set variable*', 'Set variable', 'whatsapp-cloud', 'Set variable'])
    expect(st.blocksRemoved).toBe(0)
  })

  it('o ultimo bloco da sequencia pode carregar a aresta: ela passa para o bloco fundido', () => {
    const last = { ...set('s2', 'b', '2'), outgoingEdgeId: 'e' }
    const d = mk([set('s1', 'a', '1'), last], [{ id: 'e', from: { blockId: 's2' }, to: { groupId: 'h' } }])
    mergeSetVariables(d)
    expect(types(d as D)).toEqual(['Set variable*'])
    expect((d as D).groups[0]!.blocks[0]!.outgoingEdgeId).toBe('e')
    expect((d as D).edges[0]!.from).toEqual({ blockId: 's1' })
  })

  it('destino de aresta so pode abrir uma sequencia; o mapa de origem aponta para o bloco fundido', () => {
    const d = mk([set('s1', 'a', '1'), set('s2', 'b', '2'), set('s3', 'c', '3')], [{ id: 'e', from: { blockId: 'z' }, to: { groupId: 'g', blockId: 's2' } }])
    const map = [{ source: { bot: 'b', file: 'f', jsonPointer: '/', phase: 'p' }, target: { groupKeys: [], blockKeys: ['s1', 's2', 's3'] }, transformation: 't', adaptationIds: [] }]
    mergeSetVariables(d, map as never)
    expect(types(d as D)).toEqual(['Set variable', 'Set variable*'])
    expect(map[0]!.target.blockKeys).toEqual(['s1', 's2'])
  })
})

describe.skipIf(!existsSync(LOTE))('piloto vivofixadados: a fusao preserva o comportamento', () => {
  const BOT = 'vivofixadados'
  const a = analyzePackage(LOTE)
  const cfg = validateConfig(JSON.parse(readFileSync(root('../config/piloto.config.json'), 'utf8'))).config!
  const ref = convertAnalysis(a, { onlyBots: [BOT], config: cfg, prune: true }).bots[0]!
  const merged = convertAnalysis(a, { onlyBots: [BOT], config: cfg, prune: true, mergeSetVariables: true }).bots[0]!

  it('reduz blocos e continua valido e seguro para o importador', () => {
    expect(merged.merging!.blocksRemoved).toBeGreaterThan(200)
    expect(merged.stats.blocks).toBeLessThan(ref.stats.blocks)
    expect(merged.status).toBe('structurally_valid')
    expect([...validateKayrosDocument(merged.document), ...validateReferences(merged.document), ...validateImportSafety(merged.document)]).toEqual([])
  })

  const INPUTS = ['sim', 'não', '1', 'continuar', 'atendente', '52998224725', '12345678901', 'ola', 'a@b.com']
  const HTTP = [{ status: 200, body: { isValid: true, data: { a: 1 }, nome: 'x' } }, { status: 500, body: 'erro' }, { status: 200, body: {} }]
  const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7)
  const prng = (seed: number) => {
    let x = seed >>> 0
    return () => {
      x = (x + 0x6d2b79f5) >>> 0
      let t = x
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  it('execucoes pseudo-aleatorias em todos os grupos: mesmas mensagens, HTTP, eventos, fim e TODAS as variaveis finais', () => {
    const vars = ref.document.variables.map((v) => v.name)
    let compared = 0
    const diffs: string[] = []
    for (const g of ref.document.groups) {
      const mg = merged.document.groups.find((x) => x.id === g.id)
      if (!mg) continue
      for (let trial = 0; trial < 3; trial++) {
        const r = prng(hash(`${g.title}|${trial}`))
        const pick = <T>(l: T[]): T => l[Math.floor(r() * l.length)] as T
        const preset: Record<string, string> = {}
        for (let i = 0, n = Math.floor(r() * 9); i < n; i++) preset[pick(vars)] = pick(['true', 'false', 'x', '1', 'sim', 'EMPRESA'])
        const input: Step[] = Array.from({ length: 4 }, () => (r() < 0.12 ? { timeout: true as const } : pick(INPUTS)))
        const sc: Scenario = { id: g.title, title: 'd', startGroupId: g.id, vars: preset, input, http: [], httpAuto: (m, u) => HTTP[hash(m + u) % HTTP.length] as never, maxSteps: 50000, maxTrail: 25 }
        const x = simulate(ref.document as never, sc)
        const y = simulate(merged.document as never, sc)
        if (x.end.detail === 'LIMITE_DE_PASSOS' || y.end.detail === 'LIMITE_DE_PASSOS') continue
        compared++
        const obs = (t: typeof x) => JSON.stringify({ groups: t.groups, messages: t.messages, http: t.http, events: t.events, links: t.links, end: t.end, vars: Object.fromEntries(Object.entries(t.vars).filter(([k]) => !k.startsWith('__'))) })
        if (obs(x) !== obs(y)) diffs.push(`${g.title} #${trial}`)
      }
    }
    expect(compared).toBeGreaterThan(1000)
    expect(diffs.slice(0, 5).join('\n')).toBe('')
  }, 600_000)
})
