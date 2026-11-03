import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { analyzePackage } from '../src/analysis/analyze.js'
import { analyzePassBudget } from '../src/analysis/budget.js'
import { convertAnalysis } from '../src/emit/convert.js'
import { computeCoverage, coverageTotals } from '../src/report/coverage.js'
import { makePackage, state } from './helpers/make-package.js'

const LOTE = 'C:/Users/renan/Documents/Convert To Runtime/Analise Blip Kayros/2026-11-02T04-26-43-071Z-e44c3a22'
const text = (content: string) => ({ action: { type: 'SendMessage', settings: { type: 'text/plain', content } } })

describe.skipIf(!existsSync(LOTE))('F5-09: cobertura da origem nos 13 bots', () => {
  const a = analyzePackage(LOTE)

  for (const optimize of [true, false]) {
    it(`todo estado, acao, conteudo, input e saida tem traducao ou registro rastreavel (optimize=${optimize})`, () => {
      const r = convertAnalysis(a, { optimize })
      const cov = computeCoverage(a, r.bots)
      expect(cov.flatMap((c) => c.uncovered).slice(0, 5)).toEqual([])
      const t = coverageTotals(cov)
      // 1.629 estados + 1.629 inputs + 6.377 acoes + 2.066 conteudos + 5.201 saidas
      expect(t.expected).toBe(1629 + 1629 + 6377 + 2066 + 5201)
      expect(t.mapped).toBe(t.expected)
      expect(r.bots.every((b) => b.status === 'structurally_valid')).toBe(true)
    })
  }

  it('o que fica sem emitir depois de uma acao terminal consta como omissao explicita', () => {
    const r = convertAnalysis(a)
    const skipped = r.bots.flatMap((b) => b.sourceMap).filter((e) => e.transformation === 'skipped-after-terminal')
    expect(skipped.length).toBeGreaterThan(0)
    // Cada estado cortado tambem tem o diagnostico correspondente.
    const diag = r.bots.flatMap((b) => b.diagnostics).filter((d) => d.code === 'UNREACHABLE_AFTER_TERMINAL')
    expect(diag.length).toBeGreaterThan(0)
  })

  it('o verificador enxerga lacunas (sensibilidade): sem uma entrada do mapa, a cobertura falha', () => {
    const r = convertAnalysis(a, { onlyBots: ['vivofixadados'] })
    const bot = r.bots[0]!
    bot.sourceMap.splice(0, 40)
    const cov = computeCoverage(a, [bot])
    expect(cov[0]!.uncovered.length).toBeGreaterThan(0)
  })

  it('F5-06: nenhuma passada excede os tetos do motor, e a otimizacao nao altera o orcamento', () => {
    const ref = convertAnalysis(a, { optimize: false })
    const opt = convertAnalysis(a)
    for (let i = 0; i < opt.bots.length; i++) {
      const o = opt.bots[i]!
      const r = ref.bots[i]!
      expect(o.budget.exceeding, o.name).toEqual([])
      expect([o.budget.maxOutbound, o.budget.maxExternalCalls, o.budget.passes], o.name).toEqual([r.budget.maxOutbound, r.budget.maxExternalCalls, r.budget.passes])
    }
  }, 60_000)
})

describe('F5-06: orcamento por passada (unidade)', () => {
  const flowWith = (n: number) => ({
    ini: state({
      root: true,
      $contentActions: [...Array.from({ length: n }, (_, i) => text(`m${i}`)), { input: { bypass: true } }],
      $defaultOutput: { stateId: 'fallback' },
    }),
    fallback: state(),
  })
  const budgetOf = (n: number) => {
    const a = analyzePackage(makePackage([{ name: 'botA', flow: flowWith(n) }]).root)
    return convertAnalysis(a).bots[0]!
  }

  it('conta mensagens da passada e sinaliza o que passa do teto de 15', () => {
    expect(budgetOf(10).budget.maxOutbound).toBe(10)
    expect(budgetOf(10).budget.exceeding).toHaveLength(0)
    const big = budgetOf(16)
    expect(big.budget.exceeding.length).toBeGreaterThan(0)
    expect(big.diagnostics.map((d) => d.code)).toContain('PASS_BUDGET_EXCEEDED')
  })

  it('awaitReply encerra a passada: as mensagens depois dele contam na passada seguinte', () => {
    const f = {
      ini: state({
        root: true,
        $contentActions: [text('a'), { input: { bypass: true } }],
        $defaultOutput: { stateId: 'q' },
      }),
      q: state({ $contentActions: [text('pergunta'), { input: { bypass: false } }], $defaultOutput: { stateId: 'z' } }),
      z: state({ $contentActions: [text('x'), text('y'), { input: { bypass: true } }], $defaultOutput: { stateId: 'fallback' } }),
      fallback: state(),
    }
    const a = analyzePackage(makePackage([{ name: 'botA', flow: f }]).root)
    const b = convertAnalysis(a).bots[0]!
    // Passada 1: a + pergunta (aguarda). Passada 2: x + y.
    expect(b.budget.maxOutbound).toBe(2)
  })
})
