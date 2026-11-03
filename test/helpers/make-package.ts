import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

// Monta pacotes sinteticos no formato do extrator (manifesto + original +
// principal + variaveis) para testar a ingestao sem depender do lote real.

export interface MiniBot {
  name: string
  flow: Record<string, unknown>
  globalActions?: Record<string, unknown>
  configs?: { key: string; value: unknown }[]
  /** Texto bruto de `{flow, globalActions}` (permite numeros como 1.0 ou inteiros longos). */
  rawOriginal?: string
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex')

export const state = (over: Record<string, unknown> = {}) => ({
  $contentActions: [{ input: { bypass: true } }],
  $conditionOutputs: [],
  $enteringCustomActions: [],
  $leavingCustomActions: [],
  $defaultOutput: { stateId: 'fallback' },
  $title: 'Estado',
  root: false,
  ...over,
})

export type Files = Map<string, string>

/**
 * O manifesto sempre descreve os arquivos ORIGINAIS; `tamper` altera os arquivos
 * gravados em disco depois disso (simula corrupcao, ausencia ou troca).
 */
export function makePackage(bots: MiniBot[], tamper?: (files: Files) => void) {
  const root = mkdtempSync(join(tmpdir(), 'blip-pkg-'))
  const files: Files = new Map()
  const manifestBots = bots.map((b) => {
    const safe = `${b.name}-abc123`
    const globalActions = b.globalActions ?? { $enteringCustomActions: [], $leavingCustomActions: [] }
    const original = b.rawOriginal ?? JSON.stringify({ flow: b.flow, globalActions })
    const configs = (b.configs ?? []).map((c) => ({ key: c.key, value: c.value }))
    const principal =
      `{"configuracoes_gerais":{"variaveis":{"nome_bot":${JSON.stringify(b.name)},` +
      `"identificador_fluxo":${JSON.stringify(`id-${b.name}`)},` +
      `"variaveis_de_configuracao":${JSON.stringify(configs)}},"fluxo":${original}}}`
    const paths = {
      original: `originais/${safe}/tentativa-1/export-original.json`,
      principal: `bots/${safe}/fluxo-${safe}.json`,
      variaveis: `bots/${safe}/${safe}-Variaveis_de_configuracao.json`,
    }
    const content = { original, principal, variaveis: JSON.stringify(configs) }
    const arquivos: Record<string, unknown> = {}
    for (const k of ['original', 'principal', 'variaveis'] as const) {
      files.set(paths[k], content[k])
      arquivos[k] = { path: paths[k].split('/').join('\\'), bytes: Buffer.byteLength(content[k]), sha256: sha(content[k]) }
    }
    return { nome_bot: b.name, safe, arquivos }
  })
  const manifest = { schema_version: 1, run_id: 'run-teste', router: 'router-teste', bots: manifestBots }

  tamper?.(files)
  for (const [p, text] of files) {
    const abs = join(root, ...p.split('/'))
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, text)
  }
  writeFileSync(join(root, 'manifesto.json'), JSON.stringify(manifest, null, 2))
  return { root, files, manifest }
}

/** Caminho de um dos arquivos de um bot, como gravado no pacote. */
export const pathOf = (bot: string, kind: 'original' | 'principal' | 'variaveis') => {
  const safe = `${bot}-abc123`
  return {
    original: `originais/${safe}/tentativa-1/export-original.json`,
    principal: `bots/${safe}/fluxo-${safe}.json`,
    variaveis: `bots/${safe}/${safe}-Variaveis_de_configuracao.json`,
  }[kind]
}
