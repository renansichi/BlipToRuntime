import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import type { SevenZipModuleFactory } from '7z-wasm'
import { type Diagnostic, diagnostic } from '../diagnostics.js'

// Extracao controlada de .7z (F1-01): lista primeiro, valida caminhos e limites,
// extrai em memoria (WASM, sem processo externo) e so entao grava, caminho a
// caminho, num diretorio de destino novo e vazio. O arquivo original nunca e
// alterado e nenhum conteudo extraido e executado.

export interface ArchiveLimits {
  maxFiles: number
  maxFileBytes: number
  maxTotalBytes: number
}

export const DEFAULT_ARCHIVE_LIMITS: ArchiveLimits = {
  maxFiles: 500,
  maxFileBytes: 64 * 1024 * 1024,
  maxTotalBytes: 256 * 1024 * 1024,
}

export interface ArchiveEntry {
  path: string
  size: number
  isDirectory: boolean
}

export class ArchiveError extends Error {
  constructor(readonly diagnostic: Diagnostic) {
    super(diagnostic.message)
  }
}

/** Caminho relativo seguro: sem raiz, sem unidade, sem `..`, sem NUL, sem backslash. */
export function isSafeRelativePath(p: string): boolean {
  if (p === '' || p.includes('\0') || p.includes('\\')) return false
  if (p.startsWith('/') || /^[A-Za-z]:/.test(p)) return false
  return p.split('/').every((seg) => seg !== '..' && seg !== '')
}

export function parseArchiveListing(lines: string[]): ArchiveEntry[] {
  const entries: ArchiveEntry[] = []
  let cur: Record<string, string> | null = null
  let inFiles = false
  for (const line of lines) {
    if (line === '----------') {
      inFiles = true
      continue
    }
    if (!inFiles) continue
    if (line.trim() === '') {
      if (cur?.Path !== undefined) push(cur)
      cur = null
      continue
    }
    const i = line.indexOf(' = ')
    if (i < 0) continue
    cur ??= {}
    cur[line.slice(0, i)] = line.slice(i + 3)
  }
  if (cur?.Path !== undefined) push(cur)
  return entries

  function push(r: Record<string, string>) {
    entries.push({
      path: r.Path ?? '',
      size: Number(r.Size ?? 0),
      isDirectory: (r.Folder ?? '') === '+' || (r.Attributes ?? '').startsWith('D'),
    })
  }
}

export function checkEntries(entries: ArchiveEntry[], limits: ArchiveLimits): void {
  const files = entries.filter((e) => !e.isDirectory)
  if (files.length > limits.maxFiles) {
    throw new ArchiveError(diagnostic('SOURCE_ARCHIVE_LIMIT', `Arquivo com ${files.length} itens (limite ${limits.maxFiles}).`))
  }
  let total = 0
  for (const e of entries) {
    if (!isSafeRelativePath(e.path)) {
      throw new ArchiveError(diagnostic('SOURCE_ARCHIVE_UNSAFE', `Caminho inseguro no arquivo: ${JSON.stringify(e.path)}.`))
    }
    if (e.size > limits.maxFileBytes) {
      throw new ArchiveError(diagnostic('SOURCE_ARCHIVE_LIMIT', `${e.path}: ${e.size} bytes excede ${limits.maxFileBytes}.`))
    }
    total += e.size
  }
  if (total > limits.maxTotalBytes) {
    throw new ArchiveError(diagnostic('SOURCE_ARCHIVE_LIMIT', `Total descompactado ${total} bytes excede ${limits.maxTotalBytes}.`))
  }
}

/**
 * Extrai `archivePath` em `outDir` (que deve nao existir ou estar vazio).
 * Retorna os caminhos relativos gravados.
 */
export async function extractArchive(
  archivePath: string,
  outDir: string,
  limits: ArchiveLimits = DEFAULT_ARCHIVE_LIMITS,
): Promise<string[]> {
  mkdirSync(outDir, { recursive: true })
  if (readdirSync(outDir).length > 0) {
    throw new ArchiveError(diagnostic('SOURCE_ARCHIVE_UNSAFE', `Diretorio de extracao nao esta vazio: ${outDir}.`))
  }

  const lines: string[] = []
  const mod = (await import('7z-wasm')) as unknown as { default: SevenZipModuleFactory }
  const z = await mod.default({ print: (s: string) => lines.push(s), printErr: (s: string) => lines.push(s) })
  z.FS.writeFile('/in.7z', readFileSync(archivePath))

  z.callMain(['l', '-slt', '/in.7z'])
  const entries = parseArchiveListing(lines)
  if (entries.length === 0) {
    throw new ArchiveError(diagnostic('SOURCE_ARCHIVE_UNSAFE', 'Nao foi possivel listar o arquivo .7z.'))
  }
  checkEntries(entries, limits)

  z.FS.mkdir('/out')
  z.callMain(['x', '/in.7z', '-o/out', '-y'])

  const base = resolve(outDir)
  const written: string[] = []
  for (const e of entries.filter((x) => !x.isDirectory)) {
    const data = z.FS.readFile(`/out/${e.path}`) as Uint8Array
    if (data.byteLength !== e.size) {
      throw new ArchiveError(diagnostic('SOURCE_SIZE_MISMATCH', `${e.path}: extraido ${data.byteLength} bytes, listado ${e.size}.`))
    }
    const target = resolve(base, ...e.path.split('/'))
    if (!target.startsWith(base + sep)) {
      throw new ArchiveError(diagnostic('SOURCE_ARCHIVE_UNSAFE', `Caminho escapa do destino: ${e.path}.`))
    }
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, data, { flag: 'wx' })
    written.push(e.path)
  }
  return written.map((p) => join(p))
}
