import { expect } from 'vitest'
import { type Scenario, type Trace, simulate } from './sim.js'
import type { Analysis } from '../../src/analysis/analyze.js'
import type { ConvertedBot } from '../../src/emit/convert.js'

export interface Spec extends Scenario {
  expect: {
    groups?: string[]
    messages?: string[]
    http?: [string, string][]
    events?: string[]
    end?: string
    endDetail?: string
    vars?: Record<string, string>
    varsNonEmpty?: string[]
  }
  /** `none`: executa sobre o pacote gerado SEM a configuracao do piloto (isola a semantica). */
  config?: 'none'
}
export interface ScenarioFile {
  bot: string
  resources: Record<string, string>
  baseVars: Record<string, string>
  scenarios: Spec[]
}

const isSubsequence = (needle: string[], hay: string[]): boolean => {
  let i = 0
  for (const h of hay) if (h === needle[i]) i++
  return i === needle.length
}

export function runScenario(a: Analysis, converted: ConvertedBot, file: ScenarioFile, s: Spec): Trace {
  const stateId = (title: string) => {
    const hit = a.inventory.states.find((x) => x.bot === converted.name && x.title === title)
    if (!hit) throw new Error(`estado inexistente: ${title}`)
    return hit.stateId
  }
  const resolve = (v: string) => (v.startsWith('@state:') ? stateId(v.slice(7)) : v)
  return simulate(converted.document as never, {
    ...s,
    resources: file.resources,
    vars: Object.fromEntries(Object.entries({ ...file.baseVars, ...(s.vars ?? {}) }).map(([k, v]) => [k, resolve(v)])),
  })
}

export function check(s: Spec, t: Trace): void {
  const e = s.expect
  expect(t.end.kind, `fim inesperado: ${JSON.stringify(t.end)} trilha=${t.groups.join(' > ')}`).toBe(e.end ?? t.end.kind)
  if (e.endDetail !== undefined) expect(t.end.detail).toBe(e.endDetail)
  if (e.groups) expect(isSubsequence(e.groups, t.groups), `trilha=${t.groups.join(' > ')}`).toBe(true)
  for (const m of e.messages ?? []) expect(t.messages.some((x) => x.text.includes(m)), `mensagem ausente: ${m}`).toBe(true)
  if (e.http) expect(t.http.map((h) => [h.method, h.url])).toEqual(e.http.map(([m, u]) => [m, expect.stringContaining(u)]))
  for (const ev of e.events ?? []) expect(t.events.map((x) => x.name), `evento ausente: ${ev}`).toContain(ev)
  for (const [k, v] of Object.entries(e.vars ?? {})) expect(t.vars[k] ?? '', `variavel ${k}`).toBe(v)
  for (const k of e.varsNonEmpty ?? []) expect(t.vars[k] ?? '', `variavel ${k} deveria estar preenchida`).not.toBe('')
  expect(t.missingResources.size, `Recursos sem valor: ${[...t.missingResources].join(', ')}`).toBe(0)
}
