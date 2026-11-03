import type { Analysis } from '../analysis/analyze.js'
import type { ConvertedBot } from '../emit/convert.js'

// Conciliacao de cobertura (F5-09): todo estado, acao, conteudo, input e saida da origem
// precisa ter uma entrada no mapa de origem (traducao, adaptacao rastreada, omissao
// justificada ou "nao emitido apos acao terminal"). O que ficar sem entrada e um defeito:
// significaria um elemento sumindo em silencio.

export type ElementKind = 'state' | 'action' | 'content' | 'input' | 'exit'

export interface BotCoverage {
  bot: string
  expected: Record<ElementKind, number>
  mapped: Record<ElementKind, number>
  /** Elementos por tipo de transformacao (um elemento pode ter varias entradas; conta a primeira). */
  byTransformation: Record<string, number>
  uncovered: { kind: ElementKind; pointer: string }[]
}

const KINDS: ElementKind[] = ['state', 'action', 'content', 'input', 'exit']

export function computeCoverage(a: Analysis, bots: ConvertedBot[]): BotCoverage[] {
  return bots.map((b) => {
    const mappedBy = new Map<string, string>()
    for (const e of b.sourceMap) if (!mappedBy.has(e.source.jsonPointer)) mappedBy.set(e.source.jsonPointer, e.transformation)

    const expected: { kind: ElementKind; pointer: string }[] = []
    for (const s of a.inventory.states.filter((x) => x.bot === b.name)) {
      expected.push({ kind: 'state', pointer: s.pointer }, { kind: 'input', pointer: s.input.pointer })
      for (const e of s.exits) expected.push({ kind: 'exit', pointer: e.pointer })
    }
    for (const x of a.inventory.actions.filter((y) => y.ref.bot === b.name)) expected.push({ kind: 'action', pointer: x.ref.jsonPointer })
    for (const x of a.inventory.content.filter((y) => y.ref.bot === b.name)) expected.push({ kind: 'content', pointer: x.ref.jsonPointer })

    const count = (): Record<ElementKind, number> => ({ state: 0, action: 0, content: 0, input: 0, exit: 0 })
    const exp = count()
    const map = count()
    const byTransformation: Record<string, number> = {}
    const uncovered: BotCoverage['uncovered'] = []
    for (const el of expected) {
      exp[el.kind]++
      const t = mappedBy.get(el.pointer)
      if (t === undefined) {
        uncovered.push(el)
        continue
      }
      map[el.kind]++
      byTransformation[t] = (byTransformation[t] ?? 0) + 1
    }
    return {
      bot: b.name,
      expected: exp,
      mapped: map,
      byTransformation: Object.fromEntries(Object.entries(byTransformation).sort(([x], [y]) => x.localeCompare(y))),
      uncovered,
    }
  })
}

export const coverageTotals = (c: BotCoverage[]): { expected: number; mapped: number } => ({
  expected: c.reduce((n, x) => n + KINDS.reduce((m, k) => m + x.expected[k], 0), 0),
  mapped: c.reduce((n, x) => n + KINDS.reduce((m, k) => m + x.mapped[k], 0), 0),
})
