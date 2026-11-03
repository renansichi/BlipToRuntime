import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { analyzePackage } from '../src/analysis/analyze.js'
import { buildDataFlow, entryParameters, writeOnlyContactExtras } from '../src/analysis/dataflow.js'

// Gera docs/piloto/parametros-de-entrada-vivofixadados.md e a lista de campos descartaveis
// (apendice do aceite de dados). Uso: npx tsx scripts/build-data-docs.ts <pacote>

const pkg = process.argv[2]
if (!pkg) throw new Error('Informe o pacote.')
const BOT = 'vivofixadados'
const a = analyzePackage(pkg)
const flow = buildDataFlow(a.pkg.bots)
const md = (s: string) => s.replaceAll('|', '\\|')

const params = entryParameters(flow, BOT)
const lines: string[] = [
  `# Parâmetros de entrada — ${BOT}`,
  '',
  'Decisão de 02/11/2026: campos **lidos e nunca escritos** pelo bot são **parâmetros de entrada**. Gerado de `entry-parameters.json` (ver `convert`).',
  '',
  '## Externos: nenhum bot do pacote os escreve',
  '',
  'A campanha, o router ou a entrada precisam preenchê-los (ou o bot deve aceitar que cheguem vazios). Sem fonte confirmada eles ficam como variáveis declaradas e vazias.',
  '',
  '| Namespace | Nome | Lido por |',
  '| --- | --- | --- |',
  ...params.external.map((p) => `| ${p.namespace} | ${md(p.name)} | ${p.readers.join(', ')} |`),
  '',
  '## Herdados de outro bot da cadeia',
  '',
  'Outro bot do pacote os escreve; chegam por `variablesToPass` do Typebot link **se o bot anterior da cadeia estiver convertido e ligado**. Se o cliente entrar direto neste bot, chegam vazios.',
  '',
  '| Namespace | Nome | Escrito por |',
  '| --- | --- | --- |',
  ...params.fromChain.map((p) => `| ${p.namespace} | ${md(p.name)} | ${p.writtenBy.join(', ')} |`),
  '',
]
writeFileSync('docs/piloto/parametros-de-entrada-vivofixadados.md', lines.join('\n'))

const cfgPath = 'config/piloto.config.json'
const keep = new Set<string>(existsSync(cfgPath) ? (JSON.parse(readFileSync(cfgPath, 'utf8')).dataPolicy?.keepContactExtras ?? []).filter((k: { bot: string }) => k.bot === BOT).map((k: { key: string }) => k.key) : [])
const w = [...writeOnlyContactExtras(flow, BOT)].filter((n) => !keep.has(n)).sort((x, y) => x.localeCompare(y))
const keptElsewhere: string[] = []
for (const [k, ws] of flow.writers) {
  const [ns, name] = k.split('\0') as [string, string]
  if (ns !== 'contact.extras' || !ws.has(BOT) || w.includes(name) || keep.has(name) || flow.readers.get(k)?.has(BOT)) continue
  const rs = [...(flow.readers.get(k) ?? [])]
  keptElsewhere.push(rs.length ? `${name} (lido por ${rs.join(', ')})` : `${name} (chave dinâmica)`)
}
for (const n of keep) keptElsewhere.push(`${n} (mantido por decisão do responsável: nome operacional)`)
const doc: string[] = [
  `# Campos de contato descartados — ${BOT}`,
  '',
  `Decisão de 02/11/2026 (“Descartar” os campos só escritos). Regra aplicada: o campo é descartado **somente se nenhum dos 13 bots do pacote o lê** (os bots compartilham o contato na Blip) e a chave não é dinâmica.`,
  '',
  `## Descartados (${w.length})`,
  '',
  ...w.map((n) => `- ${n}`),
  '',
  `## Mantidos (${keptElsewhere.length}): lidos por outro bot, de chave dinâmica ou mantidos por decisão`,
  '',
  ...keptElsewhere.sort().map((n) => `- ${n}`),
  '',
]
writeFileSync('docs/piloto/campos-descartados-vivofixadados.md', doc.join('\n'))
console.log(`parametros: ${params.external.length} externos, ${params.fromChain.length} da cadeia; descartados: ${w.length}; mantidos: ${keptElsewhere.length}`)
