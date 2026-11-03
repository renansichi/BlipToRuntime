import { stableId } from '../emit/ids.js'
import { HELPER_JS } from '../emit/predicates.js'
import type { KBlock, KEdge, KGroup } from '../emit/builder.js'
import type { SourceMapEntry } from '../emit/context.js'

// Fusao de `Set variable` consecutivos (F4-c). Cada Set variable e um bloco; varios seguidos podem virar UM `Set variable`
// em modo codigo ("Tratar como codigo JavaScript") com um `setVariable(nome, valor)` por linha, o que reduz blocos e o
// tamanho do JSON importado.
//
// Regras (o Codigo le um retrato das variaveis na entrada do bloco, spec 7.2):
//  - so entram Set variable simples: `Custom` sem codigo, com texto e `{{variavel}}`, ou `Empty`; nada com `{{resource.*}}`
//    nem expressoes (`{{=...}}`, `{{a|b}}`);
//  - um Set que le (`{{x}}`) uma variavel escrita antes, na mesma sequencia, comeca outra sequencia: sozinho ele veria o
//    valor novo; fundido veria o antigo;
//  - a sequencia para num bloco que carrega aresta (ele e o ultimo e a aresta passa para o bloco fundido) ou num bloco
//    que e destino de aresta (ele abre a sequencia);
//  - o modo codigo mantem uma "variavel alvo" cujo comportamento nao foi verificado (o Visualizar nao executa o codigo e grava
//    o texto dele no alvo). Por isso o alvo e uma variavel interna (`__set_sink`) que ninguem le: se o motor gravar o retorno
//    do codigo nela, nenhuma variavel de negocio e afetada;
//
// `{{x}}` dentro de codigo e substituido pelo valor como literal JS (convencao dos Codes gerados: `__s({{x}})`).

interface Doc {
  groups: KGroup[]
  edges: KEdge[]
  variables: { id: string; name: string }[]
}

export interface MergeSetStats {
  /** Blocos Set variable que entraram em alguma fusao. */
  setBlocksMerged: number
  /** Blocos a menos no documento (membros - 1 por sequencia). */
  blocksRemoved: number
}

const PLACEHOLDER = /\{\{([^{}]*)\}\}/g
/** Alvo do Set variable em modo codigo: so existe para o bloco ter um alvo; ninguem le. */
export const SINK = '__set_sink'
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/

interface Piece { lit?: string; ref?: string }

/** Parte a expressao em literais e referencias simples; `undefined` se tiver algo que nao da para traduzir com seguranca. */
function pieces(expr: string): Piece[] | undefined {
  const out: Piece[] = []
  let last = 0
  for (const m of expr.matchAll(PLACEHOLDER)) {
    const name = (m[1] ?? '').trim()
    if (!IDENT.test(name)) return undefined
    if (m.index > last) out.push({ lit: expr.slice(last, m.index) })
    out.push({ ref: name })
    last = m.index + m[0].length
  }
  if (last < expr.length) out.push({ lit: expr.slice(last) })
  // `{{` ou `}}` soltos sobrando no texto: deixar como esta.
  return out.some((p) => p.lit !== undefined && /\{\{|\}\}/.test(p.lit)) ? undefined : out
}

const jsExpr = (ps: Piece[]): string => (ps.length === 0 ? '""' : ps.map((p) => (p.ref !== undefined ? `__s({{${p.ref}}})` : JSON.stringify(p.lit))).join(' + '))

interface Member {
  block: KBlock
  name: string
  ps: Piece[]
}

export function mergeSetVariables(doc: Doc, sourceMap: SourceMapEntry[] = []): MergeSetStats {
  const stats: MergeSetStats = { setBlocksMerged: 0, blocksRemoved: 0 }
  const varName = new Map(doc.variables.map((v) => [v.id, v.name]))
  const edgeTargets = new Set(doc.edges.flatMap((e) => (e.to.blockId ? [e.to.blockId] : [])))
  const removed = new Map<string, string>()
  let sink: string | undefined
  const sinkId = (): string => {
    if (!sink) {
      const found = doc.variables.find((v) => v.name === SINK)
      sink = found?.id ?? stableId('merge-set', SINK)
      if (!found) doc.variables.push({ id: sink, name: SINK, isSessionVariable: true } as { id: string; name: string })
    }
    return sink
  }

  const member = (b: KBlock): Member | undefined => {
    if (b.type !== 'Set variable') return undefined
    const o = (b.options ?? {}) as { type?: string; variableId?: unknown; expressionToEvaluate?: unknown; isCode?: unknown }
    const name = varName.get(String(o.variableId))
    if (!name) return undefined
    if (o.type === 'Empty') return { block: b, name, ps: [] }
    if (o.type !== 'Custom' || o.isCode === true || typeof o.expressionToEvaluate !== 'string') return undefined
    const ps = pieces(o.expressionToEvaluate)
    return ps ? { block: b, name, ps } : undefined
  }

  const build = (run: Member[]): KBlock => {
    const needsHelper = run.some((m) => m.ps.some((p) => p.ref !== undefined))
    const lines = run.map((m) => `setVariable(${JSON.stringify(m.name)}, ${jsExpr(m.ps)});`)
    const first = run[0]!.block
    const last = run[run.length - 1]!.block
    const merged: KBlock = {
      id: first.id,
      type: 'Set variable',
      options: { type: 'Custom', isCode: true, variableId: sinkId(), expressionToEvaluate: [...(needsHelper ? [HELPER_JS.s] : []), ...lines].join('\n') },
    }
    if (last.outgoingEdgeId) {
      merged.outgoingEdgeId = last.outgoingEdgeId
      const e = doc.edges.find((x) => x.id === last.outgoingEdgeId)
      if (e) e.from = { ...e.from, blockId: first.id }
    }
    for (const m of run.slice(1)) removed.set(m.block.id, first.id)
    stats.setBlocksMerged += run.length
    stats.blocksRemoved += run.length - 1
    return merged
  }

  for (const g of doc.groups) {
    const out: KBlock[] = []
    let run: Member[] = []
    let written = new Set<string>()
    const flush = () => {
      if (run.length >= 2) out.push(build(run))
      else for (const m of run) out.push(m.block)
      run = []
      written = new Set()
    }
    for (const b of g.blocks) {
      const m = member(b)
      if (!m) {
        flush()
        out.push(b)
        continue
      }
      const reads = m.ps.flatMap((p) => (p.ref !== undefined ? [p.ref] : []))
      const prev = run[run.length - 1]
      if (run.length > 0 && (edgeTargets.has(b.id) || prev?.block.outgoingEdgeId || reads.some((r) => written.has(r)))) flush()
      run.push(m)
      written.add(m.name)
      // Quem carrega aresta fecha a sequencia (a aresta passa para o bloco fundido).
      if (b.outgoingEdgeId) flush()
    }
    flush()
    g.blocks = out
  }

  if (removed.size > 0) for (const e of sourceMap) e.target.blockKeys = [...new Set(e.target.blockKeys.map((id) => removed.get(id) ?? id))]
  return stats
}
