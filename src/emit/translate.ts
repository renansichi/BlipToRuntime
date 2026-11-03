import { createHash } from 'node:crypto'
import { classify, collectSymbols } from '../analysis/symbols.js'
import type { BotSource } from '../ingest/package.js'
import type { SourceRef } from '../analysis/types.js'
import type { EmitCtx } from './context.js'
import { toResourceKey } from './ids.js'

// Interpolacao Blip -> Kayros (spec 4.4, 7.2). Resolve primeiro a semantica
// Blip (namespaces) e depois escolhe a representacao Kayros. Trocar so os
// delimitadores nao basta: `obj@a.b` e `{{a|b}}` viram variaveis materializadas
// por um bloco Code antes do uso.

const PLACEHOLDER = /\{\{([^{}]*)\}\}/g

export const sanitizeVar = (s: string): string => {
  const t = s.trim().replace(/[^A-Za-z0-9_]/g, '_')
  return /^[0-9]/.test(t) ? `_${t}` : t || '_'
}

const short = (s: string): string => createHash('sha256').update(s).digest('hex').slice(0, 8)

export interface Translated {
  text: string
  /** Instrucoes JS para um Code anterior ao bloco que usa `text`. */
  prelude: string[]
}

/** Nome da variavel Kayros (ou chave de Recurso) para uma expressao Blip simples. */
export function mapName(
  ctx: EmitCtx,
  expr: string,
  at: SourceRef,
): { kind: 'var'; name: string } | { kind: 'resource'; key: string } {
  const { namespace, name } = classify(expr)
  switch (namespace) {
    case 'config':
      return { kind: 'resource', key: toResourceKey(`blip.${ctx.bot}.${name}`) }
    case 'resource': {
      if (name !== name.trim() || /\s/.test(name)) {
        ctx.warn('EXTERNAL_RESOURCE_UNRESOLVED', `Recurso externo ${JSON.stringify(expr)} com espaco na grafia original; nome sanitizado, confirmar.`, at)
      }
      return { kind: 'resource', key: `blip.ext.${sanitizeVar(name)}` }
    }
    case 'contact.extras':
      return { kind: 'var', name: `contact_extras_${sanitizeVar(name)}` }
    case 'contact':
      return { kind: 'var', name: `contact_${sanitizeVar(name)}` }
    case 'input':
      return { kind: 'var', name: name === 'content' ? 'input_content' : `input_${sanitizeVar(name)}` }
    case 'state':
    case 'application':
    case 'tunnel':
    case 'calendar':
      return { kind: 'var', name: `${namespace}_${sanitizeVar(name)}` }
    default:
      return { kind: 'var', name: sanitizeVar(name) }
  }
}

/** Referencia `{{...}}` Kayros para a expressao simples; declara a variavel quando e variavel. */
export function ref(ctx: EmitCtx, expr: string, at: SourceRef): string {
  const m = mapName(ctx, expr, at)
  if (m.kind === 'resource') return `{{resource.${m.key}}}`
  ctx.b.variable(m.name)
  return `{{${m.name}}}`
}

export function varNameOf(ctx: EmitCtx, expr: string, at: SourceRef): string {
  const m = mapName(ctx, expr, at)
  if (m.kind === 'resource') return m.key
  ctx.b.variable(m.name)
  return m.name
}

const jsStr = (s: string): string => JSON.stringify(s)

/**
 * `obj@a.b`: le o caminho a.b do JSON em `obj` (objeto ja reidratado ou texto JSON) e grava o
 * resultado em uma variavel `mat_*`. Ausente => ""; JSON null => "" em texto e "null" em
 * comparacoes (a regra escrita como `equals null` espera casar com null).
 */
export function materializeAccess(
  ctx: EmitCtx,
  expr: string,
  at: SourceRef,
  nullAsText: boolean,
): { name: string; line: string } {
  const at1 = expr.indexOf('@')
  const base = expr.slice(0, at1)
  const path = expr.slice(at1 + 1).split('.').filter((p) => p !== '')
  const name = `mat_${short(expr)}${nullAsText ? '_c' : ''}`
  const baseRef = ref(ctx, base, at)
  ctx.b.variable(name)
  const keys = JSON.stringify(path)
  const nullOut = nullAsText ? '"null"' : '""'
  const line = `(function () { let o = ${baseRef.startsWith('{{resource.') ? '""' : baseRef}; if (typeof o === "string") { try { o = JSON.parse(o); } catch (e) {} } let v = o; for (const k of ${keys}) { v = (v === null || v === undefined) ? undefined : v[k]; } setVariable(${jsStr(name)}, v === undefined ? "" : v === null ? ${nullOut} : (typeof v === "object" ? JSON.stringify(v) : String(v))); })();`
  return { name, line }
}

export function translate(ctx: EmitCtx, input: string, at: SourceRef): Translated {
  const prelude: string[] = []
  const text = input.replace(PLACEHOLDER, (whole, raw: string) => {
    const expr = raw
    const trimmed = expr.trim()
    if (trimmed === '') return whole

    // {{a|b}}: sorteio entre alternativas literais.
    if (!trimmed.includes('@') && trimmed.includes('|') && !/^(config|contact|input|state|application|tunnel|resource|calendar)\./.test(trimmed)) {
      const alts = trimmed.split('|')
      const name = `mat_rnd_${short(trimmed)}`
      ctx.b.variable(name)
      prelude.push(`setVariable(${jsStr(name)}, ${JSON.stringify(alts)}[Math.floor(Math.random() * ${alts.length})]);`)
      ctx.adapt.propose(
        {
          slug: 'random-alternatives',
          kind: 'presentation',
          originalBehavior: 'Texto com alternativas {{a|b}} sorteadas pela plataforma.',
          proposedBehavior: 'Sorteio equivalente em bloco Code antes da mensagem.',
          reason: 'O interpolador do Kayros nao sorteia alternativas.',
          changesBusinessBehavior: false,
          targetStrategy: 'code-materialization',
        },
        at,
      )
      return `{{${name}}}`
    }

    // {{obj@a.b}}: acesso estruturado materializado antes do uso.
    if (trimmed.indexOf('@') > 0) {
      const m = materializeAccess(ctx, trimmed, at, false)
      prelude.push(m.line)
      return `{{${m.name}}}`
    }


    if (/^calendar\./.test(trimmed)) {
      ctx.warn('SOURCE_CONFIG_UNRESOLVED', `Campo de calendario ${JSON.stringify(trimmed)} sem fonte no Kayros; variavel declarada e nao preenchida.`, at)
    }
    return ref(ctx, expr, at)
  })
  return { text, prelude: [...new Set(prelude)] }
}

const kayrosName = (namespace: string, name: string): string =>
  namespace === 'contact.extras' ? `contact_extras_${sanitizeVar(name)}` : namespace === 'contact' ? `contact_${sanitizeVar(name)}` : namespace === 'input' ? (name === 'content' ? 'input_content' : `input_${sanitizeVar(name)}`) : ['state', 'application', 'tunnel', 'calendar'].includes(namespace) ? `${namespace}_${sanitizeVar(name)}` : sanitizeVar(name)

/**
 * Nomes de variavel Kayros que OUTROS bots do pacote podem herdar deste. Campos de contato sao
 * compartilhados (qualquer leitura conta). Variaveis de contexto so chegam a outro bot por heranca
 * do Typebot link: contam quando o outro bot as le sem nunca escreve-las (e entrada dele). `state_*`
 * e `input_*` sao do proprio bot e nao entram. Config e Recurso nao sao variaveis; chaves
 * dinamicas (`{{`) nao entram. `includeOwnWritten`: conta tambem o que o outro bot le e escreve
 * (lista do que vale levar no Typebot link).
 */
export function externalReadNames(bots: BotSource[], bot: string, opts: { includeOwnWritten?: boolean } = {}): Set<string> {
  const out = new Set<string>()
  for (const other of bots) {
    if (other.name === bot) continue
    const uses = collectSymbols(other).uses.filter((u) => !u.name.includes('{{') && u.namespace !== 'config' && u.namespace !== 'resource')
    const own = new Set(uses.filter((u) => u.kind === 'write').map((u) => kayrosName(u.namespace, u.name)))
    for (const u of uses) {
      if (u.kind !== 'read' || u.namespace === 'state' || u.namespace === 'input') continue
      const n = kayrosName(u.namespace, u.name)
      if (opts.includeOwnWritten || u.namespace === 'contact.extras' || u.namespace === 'contact' || !own.has(n)) out.add(n)
    }
  }
  return out
}
