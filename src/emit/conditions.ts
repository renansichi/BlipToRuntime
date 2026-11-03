import type { KBlock, KEdge, KItem } from './builder.js'
import { stableId } from './ids.js'

// Compatibilidade da Condition com o builder do Kayros (testes de 02/11/2026, docs/aprendizados-builder-goatable.md):
//
//  - Uma branch (item) so dispara quando TODAS as suas comparacoes sao verdadeiras; o builder nao tem OR dentro da
//    branch (o `logicalOperator: "OR"` importado e ignorado e a branch vira AND). OR = varias branches com a mesma saida.
//  - O Visualizar nao executa `Is set`, `Starts with`, `Ends with`, `Does not contain`, `Does not match regex` nem
//    `Greater/Less or equal to`. Os equivalentes validados sao emitidos no lugar: `Is set` -> `Not equal ""`,
//    `Starts with x` -> `Matches regex "^x"`, `Ends with x` -> `Matches regex "x$"`, `>=`/`<=` -> duas branches (`>`/`<` ou `=`).
//
// A ordem das branches e preservada (a primeira que casa dispara), entao trocar um item por varios consecutivos
// nao muda o resultado. O primeiro item mantem o id e a aresta originais; os demais ganham ids estaveis derivados.

interface Cmp {
  id: string
  variableId: string
  comparisonOperator: string
  value?: string
}
interface Content {
  logicalOperator?: 'AND' | 'OR'
  comparisons: Cmp[]
}
interface Doc {
  groups: { blocks: KBlock[] }[]
  edges: KEdge[]
}

export interface ConditionStats {
  /** Itens OR com varias comparacoes que viraram uma branch por comparacao. */
  orItemsExpanded: number
  /** Branches acrescentadas (por OR e por `>=`/`<=`). */
  branchesAdded: number
  /** Comparacoes trocadas por um operador executavel (`Is set`, `Starts with`, `Ends with`). */
  operatorsRewritten: number
}

/** Teto de branches geradas por um item (produto de alternativas); acima disso o item fica como esta. */
const MAX_ALTERNATIVES = 16

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Alternativas (OR) equivalentes a UMA comparacao, so com operadores que o builder executa. */
function rewrite(c: Cmp): { alts: Cmp[]; changed: boolean } {
  const v = c.value ?? ''
  switch (c.comparisonOperator) {
    case 'Is set':
      return { alts: [{ id: c.id, variableId: c.variableId, comparisonOperator: 'Not equal', value: '' }], changed: true }
    case 'Starts with':
      return { alts: [{ ...c, comparisonOperator: 'Matches regex', value: `^${escapeRegex(v)}` }], changed: true }
    case 'Ends with':
      return { alts: [{ ...c, comparisonOperator: 'Matches regex', value: `${escapeRegex(v)}$` }], changed: true }
    case 'Greater or equal to':
      return { alts: [{ ...c, comparisonOperator: 'Greater than' }, { ...c, id: stableId(c.id, 'eq'), comparisonOperator: 'Equal to' }], changed: true }
    case 'Less or equal to':
      return { alts: [{ ...c, comparisonOperator: 'Less than' }, { ...c, id: stableId(c.id, 'eq'), comparisonOperator: 'Equal to' }], changed: true }
    default:
      return { alts: [c], changed: false }
  }
}

/** Cada alternativa e uma lista de comparacoes (AND) que, sozinha, faz a branch disparar. */
function alternatives(content: Content): { alts: Cmp[][]; rewritten: number } | undefined {
  const per = content.comparisons.map(rewrite)
  const rewritten = per.filter((p) => p.changed).length
  if (per.length <= 1 || content.logicalOperator !== 'AND') {
    // Um unico predicado, ou OR: cada alternativa de cada comparacao e uma branch.
    return { alts: per.flatMap((p) => p.alts.map((c) => [c])), rewritten }
  }
  // AND: produto cartesiano das alternativas de cada comparacao.
  let acc: Cmp[][] = [[]]
  for (const p of per) {
    acc = acc.flatMap((prefix) => p.alts.map((c) => [...prefix, c]))
    if (acc.length > MAX_ALTERNATIVES) return undefined
  }
  return { alts: acc, rewritten }
}

export function normalizeConditions(doc: Doc): ConditionStats {
  const stats: ConditionStats = { orItemsExpanded: 0, branchesAdded: 0, operatorsRewritten: 0 }
  const edgeById = new Map(doc.edges.map((e) => [e.id, e]))
  const added: KEdge[] = []

  for (const g of doc.groups) {
    for (const b of g.blocks) {
      if (b.type !== 'Condition' || !b.items) continue
      const next: KItem[] = []
      for (const it of b.items) {
        const content = it.content as Content | undefined
        if (!content || !Array.isArray(content.comparisons) || content.comparisons.length === 0) {
          next.push(it)
          continue
        }
        const res = alternatives(content)
        if (!res) {
          next.push(it)
          continue
        }
        if (content.comparisons.length > 1 && content.logicalOperator !== 'AND') stats.orItemsExpanded++
        stats.operatorsRewritten += res.rewritten
        const origEdge = it.outgoingEdgeId ? edgeById.get(it.outgoingEdgeId) : undefined
        res.alts.forEach((cmps, i) => {
          const id = i === 0 ? it.id : stableId(it.id, `alt${i}`)
          const outgoingEdgeId = i === 0 || !it.outgoingEdgeId ? it.outgoingEdgeId : stableId(it.outgoingEdgeId, `alt${i}`)
          const body: Content = cmps.length > 1 ? { logicalOperator: 'AND', comparisons: cmps } : { comparisons: cmps }
          next.push({ ...it, id, content: body, ...(outgoingEdgeId ? { outgoingEdgeId } : {}) })
          if (i > 0) {
            stats.branchesAdded++
            if (origEdge && outgoingEdgeId) added.push({ id: outgoingEdgeId, from: { ...origEdge.from, itemId: id }, to: { ...origEdge.to } })
          }
        })
      }
      b.items = next
    }
  }
  doc.edges.push(...added)
  return stats
}
