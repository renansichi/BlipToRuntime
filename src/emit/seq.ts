import type { SourceRef } from '../analysis/types.js'
import type { Predicate } from '../ir/types.js'
import type { DocBuilder, KBlock, KGroup } from './builder.js'
import type { EmitCtx } from './context.js'
import { buildDecision, codeBody, emitDecisionPre } from './predicates.js'

// Sequencia de blocos de uma passagem por estado. Acoes com condicao de
// execucao pulam blocos: uma Condition leva ao corpo da acao e o ramo "senao"
// salta para o bloco seguinte (uma aresta pode mirar um bloco dentro do mesmo
// grupo, spec 5.2). Sem otimizacao (`ctx.optimize = false`) cada acao
// condicional usa dois grupos extras, o formato de referencia da F2.

export class Seq {
  /** Grupo corrente (onde novos blocos sao anexados). */
  cur: KGroup
  /** Verdadeiro depois de um bloco terminal (link para outro bot, fila, fim). */
  terminated = false
  /** Condition cujo ramo "senao" ainda aponta para "o proximo bloco que existir". */
  private pendingElse: KBlock[] = []

  constructor(
    readonly ctx: EmitCtx,
    readonly prefix: string,
    first: KGroup,
    /** Contador compartilhado com as sequencias aninhadas (chaves logicas unicas). */
    private readonly counter: { n: number } = { n: 0 },
  ) {
    this.cur = first
  }

  get b(): DocBuilder {
    return this.ctx.b
  }

  key(hint: string): string {
    return `${this.prefix}:${hint}${this.counter.n++}`
  }

  add(type: string, options: Record<string, unknown> | undefined, hint = 'b'): KBlock {
    const blk = this.b.block(this.cur, this.key(hint), type, options)
    this.resolvePending(this.cur, blk)
    return blk
  }

  /** Aponta os ramos "senao" pendentes para `blk` (mesmo grupo). */
  private resolvePending(group: KGroup, blk: KBlock): void {
    for (const c of this.pendingElse) this.b.link({ kind: 'block', block: c }, group, blk)
    this.pendingElse = []
  }

  last(): KBlock | undefined {
    return this.cur.blocks[this.cur.blocks.length - 1]
  }

  /** Verdadeiro se algum ramo "senao" ainda espera um destino (passagem mal fechada). */
  hasPending(): boolean {
    return this.pendingElse.length > 0
  }

  /** Bloco Code com instrucoes; ignorado se vazio. */
  code(lines: string[], helpers: Set<'n' | 's'> = new Set()): KBlock | undefined {
    if (lines.length === 0) return undefined
    return this.add('Code', { name: 'gerado', content: codeBody(helpers, lines) }, 'code')
  }

  newGroup(hint: string, title: string): KGroup {
    return this.b.group(this.key(hint), title)
  }

  /** Liga o fim da passagem ao grupo dado (continuacao). */
  closeTo(target: KGroup, toBlock?: KBlock): void {
    if (!this.last()) {
      // Grupo vazio: um bloco sem efeito carrega a transicao (e recebe os "senao" pendentes).
      // Jump nao serve: o importador do Kayros OS nao remapeia seus ids.
      this.add('Code', { name: 'gerado', content: '// passagem sem efeito' }, 'pass')
    }
    const last = this.last() as KBlock
    const pending = this.pendingElse
    this.pendingElse = []
    for (const c of pending) this.b.link({ kind: 'block', block: c }, target, toBlock)
    // Se o ultimo bloco e justamente um "senao" pendente (corpo isolado em outro grupo), ja foi ligado acima.
    if (!pending.includes(last)) this.b.link({ kind: 'block', block: last }, target, toBlock)
  }

  /**
   * Executa `body` somente se todos os predicados forem verdadeiros; senao segue
   * adiante. Predicados desconhecidos nao executam o corpo (ja diagnosticados).
   */
  conditional(preds: Predicate[], at: SourceRef, body: (s: Seq) => void): void {
    if (preds.length === 0) {
      body(this)
      return
    }
    const dec = buildDecision(this.ctx, preds, at, this.key('cond'))
    if (!dec) return
    emitDecisionPre(this, [dec])

    if (!this.ctx.blockEdges) return this.conditionalSeparateGroups(dec, body)

    const before = this.pendingElse
    const cond = this.add('Condition', undefined, 'cnd')
    const item = this.b.item(cond, this.key('item'), dec.content)
    const startLen = this.cur.blocks.length
    const wasTerminated = this.terminated
    this.terminated = false
    body(this)
    const bodyBlocks = this.cur.blocks.slice(startLen)
    if (bodyBlocks.length === 0) {
      // Nada a executar: a Condition seria inutil. Desfaz a ligacao dos "senao" anteriores a ela.
      this.cur.blocks.splice(startLen - 1, 1)
      this.b.discardItem(cond, item)
      this.b.removeEdgesTo(cond.id)
      this.pendingElse = before
      this.terminated = wasTerminated
      return
    }
    if (this.terminated) {
      // O corpo termina a conversa (link/fila/fim): nao pode "cair" no bloco seguinte do grupo.
      const base = this.cur.title.split(' · ')[0] ?? this.cur.title
      const act = this.newGroup('act', `${base} · acao condicional`)
      this.cur.blocks.splice(startLen)
      act.blocks.push(...bodyBlocks)
      this.b.link({ kind: 'item', block: cond, item }, act)
    } else {
      this.b.link({ kind: 'item', block: cond, item }, this.cur, bodyBlocks[0])
    }
    this.terminated = wasTerminated
    this.pendingElse.push(cond)
  }

  /** Formato de referencia: grupo da acao + grupo de continuacao. */
  private conditionalSeparateGroups(dec: NonNullable<ReturnType<typeof buildDecision>>, body: (s: Seq) => void): void {
    const base = this.cur.title.split(' · ')[0] ?? this.cur.title
    const act = this.newGroup('act', `${base} · acao condicional`)
    const next = this.newGroup('next', `${base} · continuacao`)
    const cond = this.add('Condition', undefined, 'cnd')
    const item = this.b.item(cond, this.key('item'), dec.content)
    this.b.link({ kind: 'item', block: cond, item }, act)
    this.b.link({ kind: 'block', block: cond }, next)

    const inner = new Seq(this.ctx, this.prefix, act, this.counter)
    body(inner)
    if (!inner.terminated) inner.closeTo(next)
    this.cur = next
  }
}
