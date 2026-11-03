import { createHash } from 'node:crypto'

// Ids estaveis do pacote (F2-03): derivados da chave logica, nunca de dados de
// cliente nem de segredos. Mesma origem + mesma configuracao => mesmos ids.
// Formato UUID (v5-like) porque transferToQueue exige uuid e o editor os usa.

export function stableId(namespace: string, key: string): string {
  const h = createHash('sha256').update(`${namespace}\u0000${key}`).digest()
  h[6] = ((h[6] ?? 0) & 0x0f) | 0x50
  h[8] = ((h[8] ?? 0) & 0x3f) | 0x80
  const x = h.subarray(0, 16).toString('hex')
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`
}

export function slug(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'x'
  )
}

/** Chave de Recurso valida no Kayros OS: [A-Za-z0-9_.]+ com no maximo 100 caracteres. */
export const RESOURCE_KEY_PATTERN = /^[A-Za-z0-9_.]+$/
export const RESOURCE_KEY_MAX = 100

/** Trecho de chave de Recurso: sem acento, so [A-Za-z0-9_], minusculo. */
export function resourceSlug(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase() || 'x'
  )
}

/** Garante o padrao do Kayros OS: caracteres invalidos viram "_" e chaves longas ganham hash no fim. */
export function toResourceKey(raw: string): string {
  const clean = raw.replace(/[^A-Za-z0-9_.]/g, '_')
  if (clean.length <= RESOURCE_KEY_MAX) return clean
  const h = stableId('resource-key', raw).slice(0, 8)
  return `${clean.slice(0, RESOURCE_KEY_MAX - 9)}_${h}`
}
