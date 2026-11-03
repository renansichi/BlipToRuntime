import { describe, expect, it } from 'vitest'
import { normalizeConditions } from '../src/emit/conditions.js'

const BS = String.fromCharCode(92)
// Padroes validados no builder em 02/11/2026 (scenarios/builder-goatable/teste-4 e teste-5).
const cmp = (id: string, op: string, value?: string) => ({ id, variableId: 'v', comparisonOperator: op, ...(value === undefined ? {} : { value }) })
const doc = (content: unknown) => ({
  groups: [{ blocks: [{ id: 'b', type: 'Condition', items: [{ id: 'i', content, outgoingEdgeId: 'e' }], outgoingEdgeId: 'else' }] }],
  edges: [{ id: 'e', from: { itemId: 'i', blockId: 'b' }, to: { groupId: 'g' } }, { id: 'else', from: { blockId: 'b' }, to: { groupId: 'h' } }],
})
const items = (d: ReturnType<typeof doc>) => d.groups[0]!.blocks[0]!.items as { id: string; content: { logicalOperator?: string; comparisons: { comparisonOperator: string; value?: string }[] }; outgoingEdgeId: string }[]

describe('Condition compativel com o builder', () => {
  it('OR com varias comparacoes vira uma branch por comparacao, todas com a mesma saida, na mesma ordem', () => {
    const d = doc({ logicalOperator: 'OR', comparisons: ['sim', 'quero', 'yes'].map((v, n) => cmp(`c${n}`, 'Contains', v)) })
    const st = normalizeConditions(d as never)
    const it = items(d)
    expect(it.map((i) => i.content.comparisons.map((c) => c.value))).toEqual([['sim'], ['quero'], ['yes']])
    expect(it.every((i) => i.content.logicalOperator === undefined)).toBe(true)
    expect(it[0]!.id).toBe('i')
    expect(it[0]!.outgoingEdgeId).toBe('e')
    expect(new Set(it.map((i) => i.outgoingEdgeId)).size).toBe(3)
    for (const i of it) {
      const e = d.edges.find((x) => x.id === i.outgoingEdgeId)!
      expect(e.to).toEqual({ groupId: 'g' })
      expect(e.from).toEqual({ itemId: i.id, blockId: 'b' })
    }
    expect(d.edges.find((x) => x.id === 'else')!.to).toEqual({ groupId: 'h' })
    expect(st).toEqual({ orItemsExpanded: 1, branchesAdded: 2, operatorsRewritten: 0 })
  })

  it('AND continua uma branch com varias comparacoes e mantem logicalOperator AND', () => {
    const d = doc({ logicalOperator: 'AND', comparisons: [cmp('a', 'Equal to', '1'), cmp('b', 'Not equal', '2')] })
    normalizeConditions(d as never)
    expect(items(d)).toHaveLength(1)
    expect(items(d)[0]!.content).toMatchObject({ logicalOperator: 'AND' })
    expect(items(d)[0]!.content.comparisons).toHaveLength(2)
  })

  it('operadores que o Visualizar nao executa ganham equivalentes validados', () => {
    const d = doc({ logicalOperator: 'OR', comparisons: [cmp('a', 'Is set'), cmp('b', 'Starts with', 'a.b'), cmp('c', 'Ends with', 'x$')] })
    normalizeConditions(d as never)
    expect(items(d).map((i) => [i.content.comparisons[0]!.comparisonOperator, i.content.comparisons[0]!.value])).toEqual([
      ['Not equal', ''],
      ['Matches regex', '^a' + BS + '.b'],
      ['Matches regex', 'x' + BS + '$$'],
    ])
  })

  it('>= e <= viram duas branches (maior/menor ou igual); dentro de um AND, o produto das alternativas', () => {
    const d = doc({ logicalOperator: 'OR', comparisons: [cmp('a', 'Greater or equal to', '5')] })
    normalizeConditions(d as never)
    expect(items(d).map((i) => i.content.comparisons[0]!.comparisonOperator)).toEqual(['Greater than', 'Equal to'])
    const e = doc({ logicalOperator: 'AND', comparisons: [cmp('a', 'Equal to', 'x'), cmp('b', 'Less or equal to', '3')] })
    normalizeConditions(e as never)
    expect(items(e).map((i) => i.content.comparisons.map((c) => c.comparisonOperator))).toEqual([['Equal to', 'Less than'], ['Equal to', 'Equal to']])
    expect(items(e).every((i) => i.content.logicalOperator === 'AND')).toBe(true)
  })

  it('item sem comparacoes ou acima do teto de alternativas fica como esta', () => {
    const many = doc({ logicalOperator: 'AND', comparisons: Array.from({ length: 5 }, (_, n) => cmp(`c${n}`, 'Greater or equal to', String(n))) })
    normalizeConditions(many as never)
    expect(items(many)).toHaveLength(1)
    expect(items(many)[0]!.content.comparisons.map((c) => c.comparisonOperator)).toEqual(Array(5).fill('Greater or equal to'))
    const empty = doc({ comparisons: [] })
    normalizeConditions(empty as never)
    expect(items(empty)).toHaveLength(1)
  })
})
