import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Garantias de projeto (Q02): offline, sem codigo Goatable, sem eval do JS de origem.
const srcDir = fileURLToPath(new URL('../src', import.meta.url))

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []
  })
}
const sources = walk(srcDir).map((p) => ({ p, text: readFileSync(p, 'utf8') }))

describe('restricoes do projeto', () => {
  it('nao importa modulos de rede', () => {
    const banned = /from ['"](node:)?(http|https|net|dns|tls|dgram|http2)['"]|\bfetch\(|XMLHttpRequest|WebSocket/
    expect(sources.filter((s) => banned.test(s.text)).map((s) => s.p)).toEqual([])
  })

  it('nao importa codigo Goatable nem avalia JS dinamicamente', () => {
    const banned = /kayros-(os|bot-engine|broker)|Goatable|\beval\(|new Function\(|node:vm/
    // Os commits de referencia aparecem apenas como constantes de texto no perfil.
    expect(
      sources.filter((s) => !s.p.endsWith('kayros-current-adapted.ts') && banned.test(s.text)).map((s) => s.p),
    ).toEqual([])
  })
})
