import { createHash } from 'node:crypto'
import type { SourceRef } from '../analysis/types.js'
import type { Predicate } from '../ir/types.js'
import type { EmitCtx } from './context.js'
import { materializeAccess, varNameOf } from './translate.js'

// Predicados Blip -> Condition do Kayros (spec 7.3). Preserva a semantica de
// comparacao da Blip: igualdade ignora caixa e acento; contains/startsWith
// ignoram caixa (sem trim); regex usa as flags explicitas; operadores
// negativos com varios valores significam "nenhum deles" (AND), nunca OR de
// desigualdades. Quando o operador nativo difere, a variavel esquerda e
// normalizada por um Code curto antes da Condition.

export interface Comparison {
  id: string
  variableId: string
  comparisonOperator: string
  value?: string
}
export interface ConditionContent {
  logicalOperator: 'AND' | 'OR'
  comparisons: Comparison[]
}
export interface Decision {
  /**
   * Materializacoes (obj@campo). Vao num Code ANTERIOR ao de `pre`: o Code do Kayros le as
   * variaveis como um retrato da entrada do bloco, entao uma escrita nao e vista na mesma execucao.
   */
  stage1: string[]
  /** Instrucoes JS para um Code anterior a Condition (derivadas/booleano). */
  pre: string[]
  /** Funcoes auxiliares usadas por `pre`. */
  helpers: Set<'n' | 's'>
  content: ConditionContent
}

const NEGATIVE = new Set(['notEquals', 'notContains'])
const NATIVE: Record<string, string> = {
  exists: 'Is set',
  notExists: 'Is empty',
  equals: 'Equal to',
  notEquals: 'Not equal',
  contains: 'Contains',
  notContains: 'Does not contain',
  startsWith: 'Starts with',
  endsWith: 'Ends with',
  matches: 'Matches regex',
  greaterThan: 'Greater than',
  greaterThanOrEquals: 'Greater or equal to',
  lessThan: 'Less than',
  lessThanOrEquals: 'Less or equal to',
}

/** Normalizacao de igualdade da Blip: sem acento, sem caixa. */
export const normEq = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
export const normCi = (s: string): string => s.toLowerCase()

export const HELPER_JS = {
  n: 'const __n = function (x) { return String(x === undefined || x === null ? "" : x).normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase(); };',
  s: 'const __s = function (x) { return String(x === undefined || x === null ? "" : x); };',
} as const

const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 8)
const j = (s: string) => JSON.stringify(s)

function leftName(ctx: EmitCtx, p: Predicate, at: SourceRef, pre: string[]): string {
  if (p.source === 'input') return varNameOf(ctx, 'input.content', at)
  if (p.source === 'context' && p.variable?.includes('@')) {
    // Acesso estruturado (obj@campo): materializado antes da comparacao.
    if (/^input.(content|message)@/.test(p.variable)) {
      ctx.warn('INPUT_ENVELOPE_UNAVAILABLE', `Leitura de ${p.variable} (tipo/metadados da mensagem recebida) nao existe no Kayros; a comparacao nao casara.`, at)
      ctx.adapt.propose(
        {
          slug: 'input-message-envelope',
          kind: 'validation',
          originalBehavior: 'Condicao le o tipo/metadados da mensagem recebida (ex.: audio, imagem, documento).',
          proposedBehavior: 'Variavel auxiliar nunca preenchida: o ramo nao e tomado ate o tipo de mensagem ser obtido (evento reply captura tipo e nome do input).',
          reason: 'O envelope da mensagem da Blip nao e exposto como variavel no Kayros.',
          changesBusinessBehavior: true,
          targetStrategy: 'parameter-required',
        },
        at,
      )
    }
    const m = materializeAccess(ctx, p.variable, at, true)
    pre.push(m.line)
    return m.name
  }
  if (p.source === 'context' && p.variable) return varNameOf(ctx, p.variable, at)
  if (p.source === 'intent') {
    ctx.warn('INTENT_CONDITION_CUSTOM', 'Condicao por intencao personalizada: sem equivalente; variavel intent_custom nunca preenchida.', at)
    ctx.adapt.propose(
      {
        slug: 'custom-intent-condition',
        kind: 'validation',
        originalBehavior: 'Saida condicionada a intencao reconhecida pela plataforma Blip.',
        proposedBehavior: 'Comparacao com a variavel intent_custom (nao preenchida): o ramo nao e tomado ate haver provedor de intencao.',
        reason: 'last_intent do Kayros nao substitui uma intencao personalizada da Blip.',
        changesBusinessBehavior: true,
        targetStrategy: 'parameter-required',
      },
      at,
    )
    return varNameOf(ctx, 'intent_custom', at)
  }
  ctx.warn('SOURCE_STRUCTURE_UNKNOWN', `Predicado sem fonte reconhecida (${p.source}).`, at)
  return varNameOf(ctx, 'unknown_source', at)
}

const jsPred = (p: Predicate, left: string): string => {
  const vals = `[${p.values.map(j).join(', ')}]`
  switch (p.op) {
    case 'exists': return `__s(${left}) !== ""`
    case 'notExists': return `__s(${left}) === ""`
    case 'equals': return `${vals}.some(function (v) { return __n(${left}) === __n(v); })`
    case 'notEquals': return `${vals}.every(function (v) { return __n(${left}) !== __n(v); })`
    case 'contains': return `${vals}.some(function (v) { return __s(${left}).toLowerCase().indexOf(__s(v).toLowerCase()) >= 0; })`
    case 'notContains': return `${vals}.every(function (v) { return __s(${left}).toLowerCase().indexOf(__s(v).toLowerCase()) < 0; })`
    case 'startsWith': return `${vals}.some(function (v) { return __s(${left}).toLowerCase().indexOf(__s(v).toLowerCase()) === 0; })`
    case 'endsWith': return `${vals}.some(function (v) { var a = __s(${left}).toLowerCase(), b = __s(v).toLowerCase(); return a.length >= b.length && a.slice(a.length - b.length) === b; })`
    case 'matches': return `${vals}.some(function (v) { try { return new RegExp(v).test(__s(${left})); } catch (e) { return false; } })`
    case 'greaterThan': return `${vals}.some(function (v) { return Number(${left}) > Number(v); })`
    case 'greaterThanOrEquals': return `${vals}.some(function (v) { return Number(${left}) >= Number(v); })`
    case 'lessThan': return `${vals}.some(function (v) { return Number(${left}) < Number(v); })`
    case 'lessThanOrEquals': return `${vals}.some(function (v) { return Number(${left}) <= Number(v); })`
    default: return 'false'
  }
}

/** Converte predicados (AND) em uma Condition. Retorna undefined se algum operador e desconhecido. */
/**
 * `input.message@content equals Sent` e como a Blip detecta a resposta de um WhatsApp Flow. No
 * Kayros a resposta estruturada chega em `flow_response` (spec 7.6): vira "Is set"/"Is empty".
 */
function flowReplyRewrite(ctx: EmitCtx, p: Predicate, at: SourceRef): Predicate {
  if (p.source === 'context' && p.variable === 'input.message@content' && p.values.length === 1 && p.values[0] === 'Sent' && (p.op === 'equals' || p.op === 'notEquals')) {
    ctx.adapt.propose(
      {
        slug: 'flow-reply-detection',
        kind: 'validation',
        originalBehavior: 'Resposta de formulario (WhatsApp Flow) detectada por input.message@content = Sent.',
        proposedBehavior: 'Detectada por flow_response preenchido (retorno estruturado do Flow no Kayros); validar na homologacao.',
        reason: 'O envelope da mensagem recebida nao existe no Kayros; o retorno do Flow chega em flow_response.',
        changesBusinessBehavior: true,
        targetStrategy: 'flow-response-variable',
      },
      at,
    )
    return { source: 'context', variable: 'flow_response', op: p.op === 'equals' ? 'exists' : 'notExists', values: [], pointer: p.pointer }
  }
  return p
}

export function buildDecision(ctx: EmitCtx, rawPreds: Predicate[], at: SourceRef, key: string): Decision | undefined {
  if (rawPreds.length === 0) return undefined
  const preds = rawPreds.map((p) => flowReplyRewrite(ctx, p, at))
  const pre: string[] = []
  const stage1: string[] = []
  const helpers = new Set<'n' | 's'>()
  const comparisons: Comparison[] = []
  let seq = 0
  const cid = () => ctx.b.id(`cmp:${key}:${seq++}`)

  for (const p of preds) {
    if (!(p.op in NATIVE)) {
      ctx.warn('SOURCE_STRUCTURE_UNKNOWN', `Operador de comparacao desconhecido: ${JSON.stringify(p.op)}.`, at)
      return undefined
    }
  }

  const simple = preds.length === 1 || preds.every((p) => p.values.length <= 1 || p.op === 'exists' || p.op === 'notExists')
  if (!simple) {
    // Mistura de AND entre condicoes com OR entre valores: um booleano calculado.
    helpers.add('n').add('s')
    const exprs = preds.map((p) => jsPred(p, `{{${leftName(ctx, p, at, stage1)}}}`))
    const name = `__dec_${hash(key)}`
    ctx.b.variable(name)
    pre.push(`setVariable(${j(name)}, (${exprs.map((e) => `(${e})`).join(' && ')}) ? "true" : "false");`)
    ctx.adapt.propose(
      {
        slug: 'compound-condition-code',
        kind: 'validation',
        originalBehavior: 'Condicoes combinando AND entre predicados e OR entre valores.',
        proposedBehavior: 'Booleano calculado em Code e comparado a "true".',
        reason: 'Uma Condition do Kayros usa um unico operador logico por ramo.',
        changesBusinessBehavior: false,
        targetStrategy: 'code-boolean',
      },
      at,
    )
    comparisons.push({ id: cid(), variableId: ctx.b.variable(name).id, comparisonOperator: 'Equal to', value: 'true' })
    return { stage1: [...new Set(stage1)], pre, helpers, content: { logicalOperator: 'AND', comparisons } }
  }

  let logical: 'AND' | 'OR' = 'AND'
  for (const p of preds) {
    const left = leftName(ctx, p, at, stage1)
    const op = NATIVE[p.op] as string
    const leftVar = ctx.b.variable(left)
    if (p.op === 'exists' || p.op === 'notExists') {
      comparisons.push({ id: cid(), variableId: leftVar.id, comparisonOperator: op })
      continue
    }
    if (p.values.length === 0) {
      // Sem valores o ramo nunca casa na Blip; "Is empty" e "Is set" simultaneos nao existem.
      ctx.warn('SOURCE_STRUCTURE_UNKNOWN', `Predicado ${p.op} sem valores; ramo nao sera tomado.`, at)
      return undefined
    }
    let variableId = leftVar.id
    let values = p.values
    if (p.op === 'equals' || p.op === 'notEquals') {
      const d = `__eq_${left}`
      helpers.add('n')
      pre.push(`setVariable(${j(d)}, __n({{${left}}}));`)
      variableId = ctx.b.variable(d).id
      values = values.map(normEq)
    } else if (p.op === 'contains' || p.op === 'notContains' || p.op === 'startsWith' || p.op === 'endsWith') {
      const d = `__ci_${left}`
      helpers.add('s')
      pre.push(`setVariable(${j(d)}, __s({{${left}}}).toLowerCase());`)
      variableId = ctx.b.variable(d).id
      values = values.map(normCi)
    } else if (p.op === 'matches') {
      for (const v of values) {
        if (v.length > 500 || /\(\?<[A-Za-z]|\\p\{|\(\?i\)/.test(v)) {
          ctx.warn('INPUT_VALIDATION_DECLARED', 'Regex fora do limite (500) ou com sintaxe .NET; revisar a traducao.', at)
        }
      }
    }
    if (preds.length === 1) logical = NEGATIVE.has(p.op) ? 'AND' : 'OR'
    for (const v of values) comparisons.push({ id: cid(), variableId, comparisonOperator: op, value: v })
  }
  return { stage1: [...new Set(stage1)], pre: [...new Set(pre)], helpers, content: { logicalOperator: logical, comparisons } }
}

/** Corpo de um Code com helpers + instrucoes. */
export function codeBody(helpers: Set<'n' | 's'>, lines: string[]): string {
  return [...[...helpers].map((h) => HELPER_JS[h]), ...lines].join('\n')
}

/** Emite os Codes de apoio das decisoes, em dois estagios (materializacao e derivadas). */
export function emitDecisionPre(seq: { code: (lines: string[], helpers?: Set<'n' | 's'>) => unknown }, decs: Decision[]): void {
  seq.code([...new Set(decs.flatMap((d) => d.stage1))])
  seq.code([...new Set(decs.flatMap((d) => d.pre))], new Set(decs.flatMap((d) => [...d.helpers])))
}
