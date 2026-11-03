import type { BotSource, Json, JsonObject } from '../ingest/package.js'
import { esc } from './inventory.js'

// Tabelas de simbolos e referencias (F1-05). Le placeholders `{{...}}` em todas
// as strings do estado (exceto `$cardContent`, copia visual do conteudo) e
// classifica por namespace da Blip. Nao tenta "corrigir" grafias: a expressao
// original e preservada, inclusive `resource. flowIdDev` com espaco.

export type Namespace =
  | 'config'
  | 'contact'
  | 'contact.extras'
  | 'input'
  | 'state'
  | 'application'
  | 'tunnel'
  | 'resource'
  | 'calendar'
  | 'context'

export interface SymbolUse {
  bot: string
  /** Texto exato dentro de `{{ }}` (sem trim) ou a expressao de escrita. */
  expression: string
  namespace: Namespace
  /** Nome sem prefixo de namespace (para `config.apiHub` => `apiHub`). */
  name: string
  kind: 'read' | 'write'
  /** Origem da leitura: placeholder `{{ }}`, `inputVariables` de script ou condicao de saida. */
  via?: 'placeholder' | 'inputVariables' | 'condition'
  jsonPointer: string
}

const PLACEHOLDER = /\{\{([^{}]*)\}\}/g

export function classify(expression: string): { namespace: Namespace; name: string } {
  const e = expression.trim()
  const prefixes: [string, Namespace][] = [
    ['contact.extras.', 'contact.extras'],
    ['contact.', 'contact'],
    ['config.', 'config'],
    ['input.', 'input'],
    ['state.', 'state'],
    ['application.', 'application'],
    ['tunnel.', 'tunnel'],
    ['resource.', 'resource'],
    ['calendar.', 'calendar'],
  ]
  for (const [p, ns] of prefixes) if (e.startsWith(p)) return { namespace: ns, name: e.slice(p.length) }
  return { namespace: 'context', name: e }
}

/** Nome "base" da variavel de contexto: `obj@a.b` -> `obj`. */
const contextBase = (name: string): string => name.split('@')[0]?.trim() ?? name

function* strings(v: Json, pointer: string): Generator<[string, string]> {
  if (typeof v === 'string') yield [pointer, v]
  else if (Array.isArray(v)) for (let i = 0; i < v.length; i++) yield* strings(v[i], `${pointer}/${i}`)
  else if (typeof v === 'object' && v !== null) {
    for (const [k, x] of Object.entries(v as JsonObject)) {
      if (k === '$cardContent') continue
      yield* strings(x, `${pointer}/${esc(k)}`)
    }
  }
}

export interface SymbolTable {
  uses: SymbolUse[]
}

export function collectSymbols(bot: BotSource): SymbolTable {
  const uses: SymbolUse[] = []
  const scan = (v: Json, base: string) => {
    for (const [pointer, s] of strings(v, base)) {
      for (const m of s.matchAll(PLACEHOLDER)) {
        const expr = m[1] ?? ''
        const { namespace, name } = classify(expr)
        uses.push({
          bot: bot.name,
          expression: expr,
          namespace,
          name: namespace === 'context' ? contextBase(name) : name,
          kind: 'read',
          via: 'placeholder',
          jsonPointer: pointer,
        })
      }
    }
  }
  const write = (namespace: Namespace, name: string, pointer: string) => {
    if (name === '') return
    uses.push({ bot: bot.name, expression: `${namespace}.${name}`, namespace, name, kind: 'write', jsonPointer: pointer })
  }

  const walkActions = (list: Json, base: string, key: string) => {
    if (!Array.isArray(list)) return
    list.forEach((a, i) => {
      const p = `${base}/${key}/${i}`
      scan(a, p)
      if (typeof a !== 'object' || a === null) return
      const act = a as JsonObject
      const s = (typeof act.settings === 'object' && act.settings !== null ? act.settings : {}) as JsonObject
      const out = (k: string) => {
        if (typeof s[k] === 'string') write('context', s[k] as string, `${p}/settings/${k}`)
      }
      switch (act.type) {
        case 'SetVariable':
          out('variable')
          break
        case 'ExecuteScript':
        case 'ExecuteScriptV2':
          out('outputVariable')
          // Leituras de contexto declaradas em inputVariables.
          if (Array.isArray(s.inputVariables)) {
            s.inputVariables.forEach((iv, j) => {
              if (typeof iv === 'string') {
                const { namespace, name } = classify(iv)
                uses.push({
                  bot: bot.name, expression: iv, namespace,
                  name: namespace === 'context' ? contextBase(name) : name,
                  kind: 'read', via: 'inputVariables', jsonPointer: `${p}/settings/inputVariables/${j}`,
                })
              }
            })
          }
          break
        case 'ProcessHttp':
          out('responseStatusVariable')
          out('responseBodyVariable')
          break
        case 'ProcessCommand':
          out('variable')
          break
        case 'MergeContact':
          if (typeof s.extras === 'object' && s.extras !== null) {
            for (const k of Object.keys(s.extras)) write('contact.extras', k, `${p}/settings/extras/${esc(k)}`)
          }
          break
        default:
      }
    })
  }

  const states = Object.entries(bot.flow)
  for (const [id, raw] of states) {
    if (typeof raw !== 'object' || raw === null) continue
    const st = raw as JsonObject
    const base = `/configuracoes_gerais/fluxo/flow/${esc(id)}`
    walkActions(st.$enteringCustomActions, base, '$enteringCustomActions')
    walkActions(st.$leavingCustomActions, base, '$leavingCustomActions')
    walkActions(st.$afterStateChangedActions, base, '$afterStateChangedActions')
    if (Array.isArray(st.$contentActions)) {
      st.$contentActions.forEach((c, i) => scan(c, `${base}/$contentActions/${i}`))
    }
    if (Array.isArray(st.$conditionOutputs)) {
      st.$conditionOutputs.forEach((o, i) => {
        scan(o, `${base}/$conditionOutputs/${i}`)
        // Condicoes leem a variavel de contexto/entrada nomeada.
        const conds = typeof o === 'object' && o !== null ? (o as JsonObject).conditions : undefined
        if (Array.isArray(conds)) {
          conds.forEach((c, j) => {
            const cond = c as JsonObject
            if (cond && cond.source === 'context' && typeof cond.variable === 'string') {
              const { namespace, name } = classify(cond.variable)
              uses.push({
                bot: bot.name, expression: cond.variable, namespace,
                name: namespace === 'context' ? contextBase(name) : name,
                kind: 'read', via: 'condition', jsonPointer: `${base}/$conditionOutputs/${i}/conditions/${j}/variable`,
              })
            }
          })
        }
      })
    }
    if (st.$defaultOutput !== undefined) scan(st.$defaultOutput, `${base}/$defaultOutput`)
  }
  if (bot.globalActions) {
    const g = '/configuracoes_gerais/fluxo/globalActions'
    walkActions(bot.globalActions.$enteringCustomActions, g, '$enteringCustomActions')
    walkActions(bot.globalActions.$leavingCustomActions, g, '$leavingCustomActions')
  }
  return { uses }
}

export interface ConfigResolution {
  bot: string
  /** `config.x` referenciado mas sem chave no export do mesmo bot. */
  missing: { key: string; uses: string[] }[]
  /** Referencias a `config.x` ausente vindas de inputVariables/condicoes (fora do inventario de referencia; nao presumir valor). */
  missingOther: { key: string; via: string; uses: string[] }[]
  /** Chaves exportadas e nunca referenciadas no proprio bot. */
  unused: string[]
}

export function resolveConfigs(bot: BotSource, table: SymbolTable): ConfigResolution {
  const keys = new Set(bot.configs.map((c) => c.key))
  const refs = new Map<string, string[]>()
  const other = new Map<string, { via: string; uses: string[] }>()
  for (const u of table.uses) {
    if (u.namespace === 'config' && u.kind === 'read') {
      if (u.via === 'placeholder') {
        const arr = refs.get(u.name) ?? []
        arr.push(u.jsonPointer)
        refs.set(u.name, arr)
      } else {
        const o = other.get(u.name) ?? { via: u.via ?? '', uses: [] }
        o.uses.push(u.jsonPointer)
        other.set(u.name, o)
      }
    }
  }
  const missing = [...refs].filter(([k]) => !keys.has(k)).map(([key, uses]) => ({ key, uses }))
  const missingOther = [...other]
    .filter(([k]) => !keys.has(k))
    .map(([key, o]) => ({ key, via: o.via, uses: o.uses }))
  const used = new Set([...refs.keys(), ...other.keys()])
  const unused = [...keys].filter((k) => !used.has(k))
  return { bot: bot.name, missing, missingOther, unused }
}

/** Expressoes `resource.*` (recursos externos nao exportados), grafia preservada. */
export function externalResources(table: SymbolTable): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const u of table.uses) {
    if (u.namespace === 'resource' && u.kind === 'read') {
      const arr = out.get(u.expression) ?? []
      arr.push(u.jsonPointer)
      out.set(u.expression, arr)
    }
  }
  return out
}
