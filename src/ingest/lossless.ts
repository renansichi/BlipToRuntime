import { LosslessNumber, parse, stringify } from 'lossless-json'

// JSON sem perda numerica (F1-03). Numeros que fazem ida e volta exata para
// `number` viram `number`; os demais (inteiros acima do limite seguro, "1.0",
// "1e3", "-0") ficam como LosslessNumber, que guarda o texto original.

function parseNumber(token: string): number | LosslessNumber {
  const n = Number(token)
  return Number.isFinite(n) && String(n) === token ? n : new LosslessNumber(token)
}

export function parseLossless(text: string): unknown {
  return parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text, undefined, parseNumber)
}

export function stringifyLossless(value: unknown): string {
  return stringify(value) ?? 'undefined'
}

export function isLosslessNumber(v: unknown): v is LosslessNumber {
  return v instanceof LosslessNumber
}

/** Valor numerico para uso em contagem/comparacao (perde precisao so aqui). */
export function toNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return v
  if (v instanceof LosslessNumber) return Number(v.value)
  return undefined
}

/** Igualdade estrutural que compara numeros pelo texto original. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a instanceof LosslessNumber || b instanceof LosslessNumber) {
    return a instanceof LosslessNumber && b instanceof LosslessNumber && a.value === b.value
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]))
  }
  const ka = Object.keys(a as object)
  const kb = Object.keys(b as object)
  if (ka.length !== kb.length) return false
  return ka.every(
    (k) => Object.hasOwn(b as object, k) && deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  )
}
