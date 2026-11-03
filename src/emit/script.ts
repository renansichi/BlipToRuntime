import { createHash } from 'node:crypto'
import { Parser, tokTypes, tokenizer } from 'acorn'
import type { SourceRef } from '../analysis/types.js'
import type { EmitCtx } from './context.js'
import { ref, translate, varNameOf } from './translate.js'

// Scripts (F2-06). A origem e analisada por estrutura sintatica (acorn), nunca
// executada. Mantemos o corpo da funcao verbatim e geramos um invólucro
// estatico que chama a funcao com argumentos em texto e grava a saida.
//
// A Blip interpola `{{x}}` dentro de strings do script; o Code do Kayros
// troca `{{x}}` por identificador, o que quebraria o literal. Por isso cada
// placeholder dentro de string/template vira concatenacao `__s({{x}})`.

const PLACEHOLDER = /\{\{([^{}]*)\}\}/g

interface Edit {
  start: number
  end: number
  text: string
}

export interface ScriptAnalysis {
  parses: boolean
  parseError?: string
  functionFound: boolean
  paramCount: number
}

export function analyzeScript(source: string, fn: string): ScriptAnalysis {
  try {
    const ast = Parser.parse(source, { ecmaVersion: 'latest' })
    const decl = ast.body.find((n) => n.type === 'FunctionDeclaration' && n.id?.name === fn)
    return {
      parses: true,
      functionFound: decl !== undefined,
      paramCount: decl && decl.type === 'FunctionDeclaration' ? decl.params.length : 0,
    }
  } catch (e) {
    return { parses: false, parseError: (e as Error).message, functionFound: false, paramCount: 0 }
  }
}

export interface TransformedSource {
  code: string
  prelude: string[]
  tokenized: boolean
}

/** Reescreve placeholders do codigo-fonte sem executar nada. */
export function transformSource(ctx: EmitCtx, source: string, at: SourceRef): TransformedSource {
  const prelude: string[] = []
  const edits: Edit[] = []
  const protectedRanges: [number, number][] = []

  const ph = (expr: string): string => {
    const t = translate(ctx, `{{${expr}}}`, at)
    prelude.push(...t.prelude)
    return t.text
  }

  try {
    const comments: { start: number; end: number }[] = []
    const toks = [
      ...tokenizer(source, {
        ecmaVersion: 'latest',
        onComment: (_b, _t, start, end) => comments.push({ start, end }),
      }),
    ]
    for (const c of comments) {
      protectedRanges.push([c.start, c.end])
      const raw = source.slice(c.start, c.end)
      if (raw.includes('{{')) edits.push({ start: c.start, end: c.end, text: raw.replaceAll('{{', '{ {') })
    }
    for (const t of toks) {
      const raw = source.slice(t.start, t.end)
      if (t.type === tokTypes.string) {
        protectedRanges.push([t.start, t.end])
        if (!raw.includes('{{')) continue
        const q = raw[0] as string
        const inner = raw.slice(1, -1)
        const parts: string[] = []
        let last = 0
        for (const m of inner.matchAll(PLACEHOLDER)) {
          const idx = m.index ?? 0
          if (idx > last) parts.push(q + inner.slice(last, idx) + q)
          parts.push(`__s(${ph(m[1] ?? '')})`)
          last = idx + m[0].length
        }
        if (last < inner.length) parts.push(q + inner.slice(last) + q)
        edits.push({ start: t.start, end: t.end, text: `(${q}${q} + ${parts.join(' + ')})` })
      } else if (t.type === tokTypes.template) {
        protectedRanges.push([t.start, t.end])
        if (!raw.includes('{{')) continue
        edits.push({
          start: t.start,
          end: t.end,
          text: raw.replace(PLACEHOLDER, (_w, e: string) => `\${__s(${ph(e)})}`),
        })
      } else if (t.type === tokTypes.regexp) {
        protectedRanges.push([t.start, t.end])
      }
    }
  } catch {
    // Tokenizacao falhou: o corpo segue verbatim (placeholders neutralizados abaixo).
    const code = source.replaceAll('{{', '{ {')
    ctx.warn('SOURCE_STRUCTURE_UNKNOWN', 'Script nao pode ser tokenizado; corpo mantido verbatim com `{{` neutralizado.', at)
    return { code, prelude, tokenized: false }
  }

  // Placeholders restantes em contexto de codigo (fora de string/comentario/template/regex).
  for (const m of source.matchAll(PLACEHOLDER)) {
    const idx = m.index ?? 0
    if (protectedRanges.some(([a, b]) => idx >= a && idx < b)) continue
    edits.push({ start: idx, end: idx + m[0].length, text: ph(m[1] ?? '') })
  }

  edits.sort((a, b) => b.start - a.start)
  let code = source
  for (const e of edits) code = code.slice(0, e.start) + e.text + code.slice(e.end)
  return { code, prelude: [...new Set(prelude)], tokenized: true }
}

const HELPERS =
  'const __s = function (x) { return x === undefined || x === null ? "" : (typeof x === "object" ? JSON.stringify(x) : String(x)); };'

/**
 * Envelope compativel de `input.message`: scripts da Blip fazem JSON.parse do envelope e leem
 * `metadata["#wa.interactive.nfm_reply.json_response"]`. No Kayros o retorno do Flow chega em
 * `flow_response`; o shim remonta o envelope so com o que existe (conteudo e retorno do Flow).
 */
const ENVELOPE_SHIM =
  'const __env = function (content, fr) { const m = {}; if (fr) { m["#wa.interactive.nfm_reply.json_response"] = fr; m["#wa.interactive.nfm_reply.response_json"] = fr; } return JSON.stringify({ type: fr ? "application/json" : "text/plain", content: fr ? "Sent" : content, metadata: m }); };'

export interface ScriptSpec {
  source: string
  fn: string
  inputVariables: string[]
  outputVariable?: string
}

export interface BuiltScript {
  code: string
  prelude: string[]
  analysis: ScriptAnalysis
  outputVariable?: string
}

export function buildScript(ctx: EmitCtx, spec: ScriptSpec, at: SourceRef): BuiltScript {
  const analysis = analyzeScript(spec.source, spec.fn)
  if (!analysis.parses) {
    ctx.warn('SCRIPT_SYNTAX_INCOMPATIBLE', `Script nao compila em JavaScript padrao (${analysis.parseError}); precisa de correcao antes de executar no Kayros.`, at)
    ctx.adapt.propose(
      {
        slug: 'script-syntax-incompatible',
        kind: 'validation',
        originalBehavior: 'Script aceito pelo interpretador da Blip.',
        proposedBehavior: 'Script mantido verbatim e sinalizado; requer correcao manual porque o Code do Kayros (V8) rejeita a sintaxe.',
        reason: 'Diferenca de interpretador JavaScript entre as plataformas.',
        changesBusinessBehavior: true,
        targetStrategy: 'manual-fix',
      },
      at,
    )
  } else if (!analysis.functionFound) {
    ctx.warn('SCRIPT_SYNTAX_INCOMPATIBLE', `Funcao ${JSON.stringify(spec.fn)} nao encontrada no script.`, at)
  } else if (analysis.paramCount !== spec.inputVariables.length) {
    ctx.warn('SCRIPT_ARITY_MISMATCH', `Funcao ${spec.fn} declara ${analysis.paramCount} parametro(s) e recebe ${spec.inputVariables.length}.`, at)
  }

  if (spec.inputVariables.some((v) => /^input.message$/.test(v))) {
    ctx.warn('INPUT_ENVELOPE_UNAVAILABLE', 'Script recebe input.message (envelope da mensagem Blip); emitido shim com conteudo e flow_response. Metadados de anuncio nao existem no Kayros.', at)
    ctx.adapt.propose(
      {
        slug: 'script-reads-message-envelope',
        kind: 'validation',
        originalBehavior: 'Script le o envelope completo da mensagem recebida (metadados do WhatsApp).',
        proposedBehavior: 'Argumento remontado por um shim (conteudo + retorno do Flow em metadata); metadados de anuncio (#wa.referral.*) nao existem no Kayros e chegam ausentes.',
        reason: 'O envelope input.message nao existe no Kayros; o retorno do Flow chega em flow_response.',
        changesBusinessBehavior: true,
        targetStrategy: 'envelope-shim',
      },
      at,
    )
  }
  const t = transformSource(ctx, spec.source, at)
  const needsEnvelope = spec.inputVariables.includes('input.message')
  const args = spec.inputVariables.map((iv) => {
    if (iv === 'input.message') return `__env(__s(${ref(ctx, 'input.content', at)}), __s(${ref(ctx, 'flow_response', at)}))`
    return `__s(${ref(ctx, iv, at)})`
  })
  const lines = [
    HELPERS,
    ...(needsEnvelope ? [ENVELOPE_SHIM] : []),
    t.code,
    'var __result;',
    `try { __result = ${spec.fn}(${args.join(', ')}); } catch (__e) { setVariable("script_error", String(__e && __e.message ? __e.message : __e)); }`,
  ]
  ctx.b.variable('script_error')
  if (spec.outputVariable) {
    const out = varNameOf(ctx, spec.outputVariable, at)
    lines.push(`if (__result !== undefined) { setVariable(${JSON.stringify(out)}, __s(__result)); }`)
    return { code: lines.join('\n'), prelude: t.prelude, analysis, outputVariable: out }
  }
  return { code: lines.join('\n'), prelude: t.prelude, analysis }
}

export const scriptHash = (s: string): string => createHash('sha256').update(s).digest('hex').slice(0, 8)
