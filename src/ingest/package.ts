import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { type Diagnostic, diagnostic } from '../diagnostics.js'
import { isSafeRelativePath } from './archive.js'
import { deepEqual, parseLossless } from './lossless.js'

// Leitura do pacote extraido (F1-01..03): manifesto, tamanhos, hashes, envelopes
// `{flow, globalActions}` e `configuracoes_gerais`, e conciliacao entre o
// contrato principal, o original e o arquivo auxiliar de variaveis.

export type Json = unknown
export type JsonObject = { [k: string]: Json }

export interface FileRef {
  /** Caminho relativo ao pacote, com `/`. */
  path: string
  bytes: number
  sha256: string
}

export interface ConfigEntry {
  key: string
  value: Json
  jsonPointer: string
}

export interface BotSource {
  /** Identidade tecnica (`nome_bot`), nunca o nome sanitizado do arquivo. */
  name: string
  safe: string
  identifier: string | null
  files: { original: FileRef; principal: FileRef; variaveis: FileRef }
  flow: JsonObject
  globalActions: JsonObject | null
  configs: ConfigEntry[]
}

export interface SourcePackage {
  root: string
  runId: string
  router: string
  manifest: JsonObject
  bots: BotSource[]
  /** Quantidade de arquivos do manifesto conferidos (tamanho + SHA-256). */
  filesVerified: number
  diagnostics: Diagnostic[]
}

const isObj = (v: Json): v is JsonObject => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: Json): string | undefined => (typeof v === 'string' ? v : undefined)

export function sha256Hex(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex')
}

/** Resolve um caminho do manifesto (aceita `\`) para um caminho seguro dentro de `root`. */
function resolveInside(root: string, manifestPath: string): { rel: string; abs: string } | undefined {
  const rel = manifestPath.split('\\').join('/')
  if (!isSafeRelativePath(rel)) return undefined
  const abs = resolve(root, ...rel.split('/'))
  return abs.startsWith(resolve(root) + sep) ? { rel, abs } : undefined
}

export function readPackage(root: string): SourcePackage {
  const diagnostics: Diagnostic[] = []
  const absRoot = resolve(root)
  const manifestPath = resolve(absRoot, 'manifesto.json')
  const empty = (): SourcePackage => ({
    root: absRoot, runId: '', router: '', manifest: {}, bots: [], filesVerified: 0, diagnostics,
  })

  if (!existsSync(manifestPath)) {
    diagnostics.push(diagnostic('SOURCE_MANIFEST_INVALID', `manifesto.json ausente em ${absRoot}.`))
    return empty()
  }
  let manifest: Json
  try {
    manifest = parseLossless(readFileSync(manifestPath, 'utf8'))
  } catch (e) {
    diagnostics.push(diagnostic('SOURCE_JSON_INVALID', `manifesto.json invalido: ${(e as Error).message}`))
    return empty()
  }
  if (!isObj(manifest) || !Array.isArray(manifest.bots)) {
    diagnostics.push(diagnostic('SOURCE_MANIFEST_INVALID', 'manifesto.json sem lista `bots`.'))
    return empty()
  }

  const bots: BotSource[] = []
  let filesVerified = 0
  for (const entry of manifest.bots as Json[]) {
    if (!isObj(entry) || !str(entry.nome_bot) || !isObj(entry.arquivos)) {
      diagnostics.push(diagnostic('SOURCE_MANIFEST_INVALID', 'Entrada de bot invalida no manifesto.'))
      continue
    }
    const name = str(entry.nome_bot) as string
    const refs = {} as BotSource['files']
    const raw: Partial<Record<keyof BotSource['files'], string>> = {}
    let complete = true
    for (const kind of ['original', 'principal', 'variaveis'] as const) {
      const f = (entry.arquivos as JsonObject)[kind]
      const path = isObj(f) ? str(f.path) : undefined
      const bytes = isObj(f) && typeof f.bytes === 'number' ? f.bytes : undefined
      const sha = isObj(f) ? str(f.sha256) : undefined
      if (!path || bytes === undefined || !sha) {
        diagnostics.push(diagnostic('SOURCE_MANIFEST_INVALID', `${name}: arquivo "${kind}" incompleto no manifesto.`))
        complete = false
        continue
      }
      const where = resolveInside(absRoot, path)
      if (!where) {
        diagnostics.push(diagnostic('SOURCE_ARCHIVE_UNSAFE', `${name}: caminho inseguro no manifesto: ${path}.`))
        complete = false
        continue
      }
      if (!existsSync(where.abs) || !statSync(where.abs).isFile()) {
        diagnostics.push(diagnostic('SOURCE_FILE_MISSING', `${name}: arquivo ausente ${where.rel}.`, where.rel))
        complete = false
        continue
      }
      const data = readFileSync(where.abs)
      filesVerified++
      if (data.byteLength !== bytes) {
        diagnostics.push(diagnostic('SOURCE_SIZE_MISMATCH', `${where.rel}: ${data.byteLength} bytes, manifesto ${bytes}.`, where.rel))
        complete = false
      }
      if (sha256Hex(data) !== sha) {
        diagnostics.push(diagnostic('SOURCE_HASH_MISMATCH', `${where.rel}: SHA-256 diverge do manifesto.`, where.rel))
        complete = false
      }
      refs[kind] = { path: where.rel, bytes, sha256: sha }
      raw[kind] = data.toString('utf8')
    }
    // Nunca associar um fluxo ao bot errado: so segue com arquivos integros.
    if (!complete) continue
    const bot = buildBot(name, entry, refs, raw as Record<keyof BotSource['files'], string>, diagnostics)
    if (bot) bots.push(bot)
  }

  return {
    root: absRoot,
    runId: str(manifest.run_id) ?? '',
    router: str(manifest.router) ?? '',
    manifest,
    bots,
    filesVerified,
    diagnostics,
  }
}

function buildBot(
  name: string,
  entry: JsonObject,
  files: BotSource['files'],
  raw: Record<keyof BotSource['files'], string>,
  diagnostics: Diagnostic[],
): BotSource | undefined {
  const parse = (kind: keyof BotSource['files']): Json | undefined => {
    try {
      return parseLossless(raw[kind])
    } catch (e) {
      diagnostics.push(diagnostic('SOURCE_JSON_INVALID', `${files[kind].path}: ${(e as Error).message}`, files[kind].path))
      return undefined
    }
  }
  const principal = parse('principal')
  const original = parse('original')
  const variaveis = parse('variaveis')
  if (principal === undefined || original === undefined || variaveis === undefined) return undefined

  // Envelope do contrato principal: configuracoes_gerais.{variaveis,fluxo}.
  const cg = isObj(principal) ? principal.configuracoes_gerais : undefined
  const vars = isObj(cg) ? cg.variaveis : undefined
  const fluxo = isObj(cg) ? cg.fluxo : undefined
  if (!isObj(vars) || !isObj(fluxo) || !isObj(fluxo.flow)) {
    diagnostics.push(diagnostic('SOURCE_ENVELOPE_UNKNOWN', `${files.principal.path}: envelope sem configuracoes_gerais.fluxo.flow.`, files.principal.path))
    return undefined
  }
  // Envelope do original: {flow, globalActions}.
  if (!isObj(original) || !isObj(original.flow)) {
    diagnostics.push(diagnostic('SOURCE_ENVELOPE_UNKNOWN', `${files.original.path}: envelope sem flow.`, files.original.path))
    return undefined
  }

  if (str(vars.nome_bot) !== name) {
    diagnostics.push(diagnostic('SOURCE_BOT_MISMATCH', `${files.principal.path}: nome_bot "${String(vars.nome_bot)}" difere do manifesto "${name}".`, files.principal.path))
    return undefined
  }
  if (!deepEqual(fluxo, original)) {
    diagnostics.push(diagnostic('SOURCE_FLOW_DIVERGES', `${name}: fluxo do contrato principal difere do original.`, files.principal.path))
    return undefined
  }

  const list = Array.isArray(vars.variaveis_de_configuracao) ? (vars.variaveis_de_configuracao as Json[]) : []
  if (!deepEqual(list, variaveis)) {
    diagnostics.push(diagnostic('SOURCE_CONFIG_DIVERGES', `${name}: variaveis do contrato principal diferem do arquivo auxiliar.`, files.variaveis.path))
  }
  const configs: ConfigEntry[] = []
  list.forEach((c, i) => {
    if (isObj(c) && typeof c.key === 'string') {
      configs.push({
        key: c.key,
        value: c.value,
        jsonPointer: `/configuracoes_gerais/variaveis/variaveis_de_configuracao/${i}/value`,
      })
    } else {
      diagnostics.push(diagnostic('SOURCE_STRUCTURE_UNKNOWN', `${name}: configuracao ${i} sem chave.`, files.principal.path))
    }
  })

  return {
    name,
    safe: str(entry.safe) ?? '',
    identifier: str(vars.identificador_fluxo) ?? null,
    files,
    flow: fluxo.flow,
    globalActions: isObj(fluxo.globalActions) ? fluxo.globalActions : null,
    configs,
  }
}
