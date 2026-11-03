import { describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  DEFAULT_ARCHIVE_LIMITS,
  extractArchive,
  isSafeRelativePath,
  parseLossless,
  readPackage,
  stringifyLossless,
  deepEqual,
} from '../src/ingest/index.js'
import { checkEntries, parseArchiveListing } from '../src/ingest/archive.js'
import { makePackage, pathOf, state } from './helpers/make-package.js'

const codes = (r: { diagnostics: { code: string }[] }) => r.diagnostics.map((d) => d.code)

describe('JSON sem perda', () => {
  it('preserva inteiros longos, 1.0, 1e3, -0, vazios e null', () => {
    const text = '{"a":12345678901234567890,"b":1.0,"c":1e3,"d":-0,"e":"","f":null,"g":[],"h":7}'
    const v = parseLossless(text) as Record<string, unknown>
    expect(typeof v.h).toBe('number')
    expect(typeof v.a).toBe('object')
    expect(stringifyLossless(v)).toBe(text)
    expect(v.e).toBe('')
    expect(v.f).toBeNull()
  })

  it('preserva Unicode e remove BOM', () => {
    const v = parseLossless('\ufeff{"t":"Está certo ✅ \\u00e7"}') as { t: string }
    expect(v.t).toBe('Está certo ✅ ç')
  })

  it('deepEqual compara numeros pelo texto original', () => {
    expect(deepEqual(parseLossless('{"a":1.0}'), parseLossless('{"a":1.0}'))).toBe(true)
    expect(deepEqual(parseLossless('{"a":1.0}'), parseLossless('{"a":1}'))).toBe(false)
    expect(deepEqual(parseLossless('{"a":12345678901234567890}'), parseLossless('{"a":12345678901234567891}'))).toBe(false)
  })
})

describe('arquivo .7z: caminhos e limites', () => {
  it('rejeita caminhos inseguros', () => {
    for (const p of ['../x.json', '/abs.json', 'C:/x.json', 'a/../../b', 'a\\b', '', 'a//b']) {
      expect(isSafeRelativePath(p), p).toBe(false)
    }
    expect(isSafeRelativePath('run/bots/x/fluxo.json')).toBe(true)
  })

  it('checkEntries aplica limites e caminhos', () => {
    const ok = [{ path: 'a/b.json', size: 10, isDirectory: false }]
    expect(() => checkEntries(ok, DEFAULT_ARCHIVE_LIMITS)).not.toThrow()
    expect(() => checkEntries([{ path: '../evil', size: 1, isDirectory: false }], DEFAULT_ARCHIVE_LIMITS)).toThrow(/inseguro/)
    expect(() => checkEntries(ok, { ...DEFAULT_ARCHIVE_LIMITS, maxFileBytes: 5 })).toThrow(/excede/)
    expect(() => checkEntries(ok, { ...DEFAULT_ARCHIVE_LIMITS, maxFiles: 0 })).toThrow(/limite/)
    expect(() => checkEntries(ok, { ...DEFAULT_ARCHIVE_LIMITS, maxTotalBytes: 5 })).toThrow(/Total/)
  })

  it('parseArchiveListing le a listagem -slt', () => {
    const lines = ['Path = /a.7z', 'Type = 7z', '', '----------', 'Path = run/x.json', 'Size = 12', 'Attributes = A -rw-', '', 'Path = run/d', 'Size = 0', 'Folder = +', '']
    expect(parseArchiveListing(lines)).toEqual([
      { path: 'run/x.json', size: 12, isDirectory: false },
      { path: 'run/d', size: 0, isDirectory: true },
    ])
  })

  const archive = 'C:/Users/renan/Documents/Convert To Runtime/Extrato Blip/2026-11-02T04-26-43-071Z-e44c3a22.7z'
  it.skipIf(!existsSync(archive))('extrai o .7z real e confere os 39 arquivos do manifesto', async () => {
    const out = join(mkdtempSync(join(tmpdir(), 'blip-7z-')), 'x')
    const written = await extractArchive(archive, out)
    expect(written.length).toBeGreaterThanOrEqual(40)
    const pkg = readPackage(join(out, '2026-11-02T04-26-43-071Z-e44c3a22'))
    expect(pkg.diagnostics).toEqual([])
    expect(pkg.filesVerified).toBe(39)
    expect(pkg.bots).toHaveLength(13)
    // Reextrair no mesmo destino (nao vazio) e recusado.
    await expect(extractArchive(archive, out)).rejects.toThrow(/vazio/)
  }, 60_000)
})

describe('readPackage', () => {
  const bot = (name: string, extra: Record<string, unknown> = {}) => ({
    name,
    flow: { s1: state({ root: true, $title: 'Inicio' }), fallback: state({ $title: 'Excecoes' }) },
    configs: [{ key: 'apiHub', value: 'https://exemplo' }],
    ...extra,
  })

  it('le pacote integro e preserva identidade tecnica e configuracoes', () => {
    const { root } = makePackage([bot('botA'), bot('botB')])
    const pkg = readPackage(root)
    expect(pkg.diagnostics).toEqual([])
    expect(pkg.filesVerified).toBe(6)
    expect(pkg.bots.map((b) => b.name)).toEqual(['botA', 'botB'])
    expect(pkg.bots[0]?.identifier).toBe('id-botA')
    expect(pkg.bots[0]?.configs[0]?.jsonPointer).toBe('/configuracoes_gerais/variaveis/variaveis_de_configuracao/0/value')
  })

  it('identidades repetidas entre bots nao se misturam', () => {
    const { root } = makePackage([bot('botA'), bot('botB')])
    const pkg = readPackage(root)
    // Mesmos ids de estado ("s1") nos dois bots, cada um no seu fluxo.
    expect(Object.keys(pkg.bots[0]?.flow ?? {})).toEqual(Object.keys(pkg.bots[1]?.flow ?? {}))
    expect(pkg.bots[0]?.flow).not.toBe(pkg.bots[1]?.flow)
  })

  it('detecta arquivo ausente sem associar fluxo ao bot errado', () => {
    const { root } = makePackage([bot('botA'), bot('botB')], (f) => f.delete(pathOf('botA', 'principal')))
    const pkg = readPackage(root)
    expect(codes(pkg)).toContain('SOURCE_FILE_MISSING')
    expect(pkg.bots.map((b) => b.name)).toEqual(['botB'])
  })

  it('detecta hash e tamanho divergentes', () => {
    const { root } = makePackage([bot('botA')], (f) => f.set(pathOf('botA', 'original'), '{"flow":{},"globalActions":{} }'))
    const c = codes(readPackage(root))
    expect(c).toContain('SOURCE_HASH_MISMATCH')
    expect(c).toContain('SOURCE_SIZE_MISMATCH')
  })

  it('detecta nome_bot divergente do manifesto', () => {
    const { root } = makePackage([bot('botA')], (f) => {
      const p = pathOf('botA', 'principal')
      f.set(p, (f.get(p) as string).replace('"nome_bot":"botA"', '"nome_bot":"botX"'))
    })
    // O arquivo adulterado tambem muda hash: o bot e rejeitado antes de ser associado.
    const pkg = readPackage(root)
    expect(pkg.bots).toHaveLength(0)
    expect(pkg.diagnostics.length).toBeGreaterThan(0)
  })

  it('arquivo incompleto (JSON truncado) gera SOURCE_JSON_INVALID', () => {
    const { root } = makePackage([bot('botA')], (f) => f.set(pathOf('botA', 'principal'), '{"configuracoes_gerais":'))
    expect(codes(readPackage(root))).toContain('SOURCE_HASH_MISMATCH')
  })

  it('envelope desconhecido e reportado', () => {
    const { root } = makePackage([bot('botA', { rawOriginal: '{"semFlow":{}}' })])
    expect(codes(readPackage(root))).toContain('SOURCE_ENVELOPE_UNKNOWN')
  })

  it('preserva inteiros longos e numeros do original em flow == principal', () => {
    const raw = '{"flow":{"s1":{"root":true,"$title":"I","$contentActions":[],"$conditionOutputs":[],"$enteringCustomActions":[{"type":"SetVariable","settings":{"variable":"v","value":"1","expiration":12345678901234567890}}],"$leavingCustomActions":[],"$defaultOutput":{"stateId":"s1"}}},"globalActions":{}}'
    const { root } = makePackage([bot('botA', { rawOriginal: raw })])
    const pkg = readPackage(root)
    expect(pkg.diagnostics).toEqual([])
    const text = stringifyLossless(pkg.bots[0]?.flow)
    expect(text).toContain('12345678901234567890')
  })

  it('manifesto ausente e invalido', () => {
    expect(codes(readPackage(join(tmpdir(), 'nao-existe-blip')))).toContain('SOURCE_MANIFEST_INVALID')
  })

  it('caminho inseguro no manifesto e recusado', () => {
    const { root } = makePackage([bot('botA')])
    const mp = join(root, 'manifesto.json')
    const m = JSON.parse(readFileSync(mp, 'utf8'))
    m.bots[0].arquivos.original.path = '..\\..\\fora.json'
    writeFileSync(mp, JSON.stringify(m))
    expect(codes(readPackage(root))).toContain('SOURCE_ARCHIVE_UNSAFE')
  })
})
