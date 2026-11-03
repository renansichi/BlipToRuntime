import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { analyzePackage, writeAnalysis } from './analysis/analyze.js'
import { countByCode } from './analysis/patterns.js'
import { loadConfigFile } from './config/load.js'
import { convertAnalysis, writeConversion } from './emit/convert.js'
import { dataReport, journeyReport, waitsReport } from './report/journey.js'
import { extractArchive } from './ingest/archive.js'
import { validateKayrosDocument } from './profile/validate-document.js'
import { compareDocuments } from './validate/compare.js'
import { validateImportSafety, validateReferences } from './validate/refs.js'

// Interface de linha de comando offline.
//   analyze <pacote|.7z> --out <pasta>
//   convert <pacote|.7z> --out <pasta> [--config <arquivo>] [--bot <nome>]... [--no-optimize] [--block-edges] [--prune]
//   report  <pacote|.7z> --bot <nome> --out <pasta> [--state <titulo>]...
//   verify  <pasta-ou-arquivo.json> [--import-safe] [--against <gerado.json>]
// Nao abre rede, nao executa scripts da origem e nao instala nem publica nada.

const USAGE = `Uso:
  analyze <pacote|arquivo.7z> --out <pasta>
  convert <pacote|arquivo.7z> --out <pasta> [--config <arquivo.json>] [--bot <nome>]... [--no-optimize] [--block-edges] [--prune]
  report  <pacote|arquivo.7z> --bot <nome> --out <pasta> [--state <titulo>]...
  verify  <pasta|arquivo.json> [--import-safe] [--against <gerado.json>]
  (convert) --test-entry "<titulo do estado>" [--preset <expressao>=<valor>]...  gera uma variante de TESTE que comeca no estado`

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
function flags(args: string[], name: string): string[] {
  return args.flatMap((a, i) => (a === name && args[i + 1] ? [args[i + 1] as string] : []))
}
function positional(args: string[]): string | undefined {
  const withValue = new Set(['--out', '--config', '--bot', '--state', '--against', '--test-entry', '--preset'])
  return args.find((a, i) => !a.startsWith('--') && !(i > 0 && withValue.has(args[i - 1] as string)))
}

async function resolveRoot(input: string, out: string): Promise<string | undefined> {
  const root = resolve(input)
  if (!existsSync(root)) {
    console.error(`Nao encontrado: ${root}`)
    return undefined
  }
  if (!statSync(root).isFile()) return root
  if (!root.toLowerCase().endsWith('.7z')) {
    console.error('Arquivo de entrada deve ser .7z.')
    return undefined
  }
  const dir = join(resolve(out), 'extraido')
  const files = await extractArchive(root, dir)
  const top = files[0]?.split(/[\\/]/)[0]
  return top ? join(dir, top) : dir
}

function jsonFiles(p: string): string[] {
  if (statSync(p).isFile()) return [p]
  return readdirSync(p, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? jsonFiles(join(p, e.name)) : e.name.endsWith('.json') ? [join(p, e.name)] : [],
  )
}

async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv

  if (cmd === 'verify') {
    const target = positional(rest)
    if (!target || !existsSync(target)) {
      console.error(USAGE)
      return 2
    }
    const against = flag(rest, '--against')
    let bad = 0
    let n = 0
    if (against) {
      const exported = JSON.parse(readFileSync(resolve(target), 'utf8'))
      const generated = JSON.parse(readFileSync(resolve(against), 'utf8'))
      const errs = [...validateKayrosDocument(exported), ...validateReferences(exported)]
      const cmp = compareDocuments(generated, exported)
      console.log(`Estrutura do exportado: ${errs.length ? errs.length + ' erro(s)' : 'ok'}; grupos gerado ${cmp.groups.generated} x exportado ${cmp.groups.exported}.`)
      for (const e of errs.slice(0, 10)) console.error(`  - ${e.code}: ${e.message} ${e.pointer ?? ''}`)
      for (const d of cmp.differences.slice(0, 30)) console.error(`  - ${d}`)
      console.log(cmp.ok && errs.length === 0 ? 'Rascunho importado confere com o gerado.' : `Divergencias: ${cmp.differences.length}.`)
      return cmp.ok && errs.length === 0 ? 0 : 1
    }
    for (const f of jsonFiles(resolve(target))) {
      let doc: unknown
      try {
        doc = JSON.parse(readFileSync(f, 'utf8'))
      } catch (e) {
        console.error(`${f}: JSON invalido (${(e as Error).message})`)
        bad++
        continue
      }
      // So documentos com as colecoes do Kayros; ignora manifestos e relatorios.
      if (typeof doc !== 'object' || doc === null || !('groups' in doc) || !('edges' in doc)) continue
      n++
      const errs = [...validateKayrosDocument(doc), ...validateReferences(doc), ...(rest.includes('--import-safe') ? validateImportSafety(doc) : [])]
      if (errs.length) {
        bad++
        console.error(`${f}: ${errs.length} erro(s)`)
        for (const e of errs.slice(0, 10)) console.error(`  - ${e.code}: ${e.message} ${e.pointer ?? ''}`)
      } else console.log(`${f}: ok`)
    }
    console.log(`${n} documento(s) verificado(s), ${bad} com erro.`)
    return n === 0 || bad > 0 ? 1 : 0
  }

  if (cmd !== 'analyze' && cmd !== 'convert' && cmd !== 'report') {
    console.error(USAGE)
    return 2
  }
  const input = positional(rest)
  const out = flag(rest, '--out')
  if (!input || !out) {
    console.error(USAGE)
    return 2
  }
  const root = await resolveRoot(input, out)
  if (!root) return 2
  const a = analyzePackage(root)

  if (cmd === 'analyze') {
    const written = writeAnalysis(a, resolve(out))
    const t = a.inventory.totals
    console.log(`Pacote ${a.pkg.runId}: ${a.pkg.filesVerified} arquivos conferidos, ${t.bots} bots, ${t.states} estados, ${t.actionOccurrences} acoes.`)
    console.log('Achados:', JSON.stringify(countByCode(a.findings), null, 2))
    console.log(`Erros tecnicos: ${a.technical.length}`)
    for (const d of a.technical.slice(0, 20)) console.error(` - ${d.code}: ${d.message}`)
    console.log(`Gravado em ${resolve(out)}: ${written.join(', ')}`)
    return a.technical.length === 0 ? 0 : 1
  }

  if (cmd === 'report') {
    const botName = flag(rest, '--bot')
    if (!botName || !a.pkg.bots.some((b) => b.name === botName)) {
      console.error('Informe --bot com o nome tecnico de um bot do pacote.')
      return 2
    }
    const conv = convertAnalysis(a, { onlyBots: [botName] }).bots[0]
    if (!conv) return 1
    const states = flags(rest, '--state')
    const dir = resolve(out)
    mkdirSync(dir, { recursive: true })
    const written: string[] = []
    const put = (name: string, text: string) => {
      writeFileSync(join(dir, name), text)
      written.push(name)
    }
    put(`esperas-${botName}.md`, waitsReport(a, botName))
    put(`dados-${botName}.md`, dataReport(a, botName))
    if (states.length) put(`jornada-${botName}.md`, journeyReport(a, conv, states))
    console.log(`Gravado em ${dir}: ${written.join(', ')}`)
    return 0
  }

  // convert
  if (a.technical.length > 0) {
    console.error(`Origem com ${a.technical.length} erro(s) tecnico(s); corrija antes de converter:`)
    for (const d of a.technical.slice(0, 20)) console.error(` - ${d.code}: ${d.message}`)
    return 1
  }
  const cfgPath = flag(rest, '--config')
  let config
  if (cfgPath) {
    const r = loadConfigFile(resolve(cfgPath))
    if (!r.ok || !r.config) {
      console.error('Configuracao invalida:')
      for (const e of r.errors.slice(0, 20)) console.error(` - ${e.code}: ${e.message} ${e.pointer ?? ''}`)
      return 1
    }
    config = r.config
    console.log(`Configuracao carregada: ${r.pending.length} pendencia(s), ${r.unacceptedAdaptations.length} adaptacao(oes) sem aceite.`)
  }
  const only = flags(rest, '--bot')
  const entries = flags(rest, '--test-entry')
  const presets = Object.fromEntries(flags(rest, '--preset').map((p) => [p.slice(0, p.indexOf('=')), p.slice(p.indexOf('=') + 1)]))
  if (entries.length && only.length !== 1) {
    console.error('--test-entry exige exatamente um --bot.')
    return 2
  }
  const res = convertAnalysis(a, { ...(config ? { config } : {}), ...(only.length ? { onlyBots: only } : {}), ...(entries.length ? { testEntries: entries.map((stateTitle) => ({ bot: only[0] as string, stateTitle, presets })) } : {}), optimize: !rest.includes('--no-optimize'), blockEdges: rest.includes('--block-edges'), prune: rest.includes('--prune') })
  const written = writeConversion(res, resolve(out), config)
  for (const b of res.bots) {
    console.log(`${(b.name + (b.variant ? ' [teste ' + b.variant + ']' : '')).padEnd(26)} ${b.status}  grupos=${b.stats.groups} blocos=${b.stats.blocks} arestas=${b.stats.edges} erros=${b.validation.length} diagnosticos=${b.diagnostics.length}`)
  }
  console.log(`Adaptacoes propostas: ${res.adaptations.length} (${res.pendingAcceptance.length} mudam regra de negocio e aguardam aceite).`)
  console.log(`Gravado em ${resolve(out)} (${written.length} arquivos). Pacote para REVISAO: nao homologado nem aceito.`)
  return res.bots.every((b) => b.status === 'structurally_valid') ? 0 : 1
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  },
)
