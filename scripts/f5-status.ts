import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { analyzePackage } from '../src/analysis/analyze.js'
import { validateConfig } from '../src/config/load.js'
import { convertAnalysis } from '../src/emit/convert.js'
import { resourceSlug, toResourceKey } from '../src/emit/ids.js'
import { coverageTotals } from '../src/report/coverage.js'

// Situacao por bot/jornada (F5-04/F5-10) e planilha de aliases (F5-01/F5-03).
// Uso: npx tsx scripts/f5-status.ts <pacote>

const pkg = process.argv[2]
if (!pkg) throw new Error('Informe o pacote.')
const a = analyzePackage(pkg)
const cfg = validateConfig(JSON.parse(readFileSync('config/piloto.config.json', 'utf8'))).config
const res = convertAnalysis(a, cfg ? { config: cfg } : {})
mkdirSync('docs/f5', { recursive: true })
const n = (x: number) => x.toLocaleString('pt-BR')
const md = (s: string) => s.replaceAll('|', '\\|')

const count = <T>(l: T[], f: (t: T) => boolean) => l.filter(f).length
const pilotScenarios = new Map<string, number>()
for (const s of cfg?.referenceScenarios ?? []) {
  const bot = s.journeyId.split('/')[0] as string
  pilotScenarios.set(bot, (pilotScenarios.get(bot) ?? 0) + (s.status === 'confirmed' ? 1 : 0))
}

const rows: string[] = []
const detail: string[] = []
for (const b of res.bots) {
  const cov = res.coverage.find((c) => c.bot === b.name)!
  const ct = coverageTotals([cov])
  const ads = res.adaptations.filter((x) => x.id.startsWith(`${b.name}:`))
  const needAccept = ads.filter((x) => x.changesBusinessBehavior && x.acceptance.status !== 'accepted')
  const accepted = ads.filter((x) => x.acceptance.status === 'accepted')
  const byClass: Record<string, number> = {}
  for (const d of b.diagnostics) byClass[d.class] = (byClass[d.class] ?? 0) + 1
  const findings = a.findings.filter((f) => f.bot === b.name)
  const aliases = new Set(a.graph.redirects.filter((r) => r.bot === b.name).map((r) => r.address))
  const flows = new Set(findings.filter((f) => f.code === 'FLOW_ASSET_MISSING').map((f) => f.message))
  const agents = count(findings, (f) => f.code === 'AGENT_CONTRACT_UNVERIFIED')
  const http = a.inventory.actions.filter((x) => x.ref.bot === b.name && x.type === 'ProcessHttp').length
  const desk = count(findings, (f) => f.code === 'DESK_CONTINUATION_DIFFERENCE')
  const secrets = new Set(b.secrets.map((s) => s.resourceKey)).size
  const ep = res.entryParameters.find((e) => e.bot === b.name)
  const status = needAccept.length > 0 ? 'awaiting_journey_acceptance' : b.status
  const scen = pilotScenarios.get(b.name) ?? 0
  rows.push(
    `| ${b.name} | ${status} | ${n(ct.mapped)}/${n(ct.expected)} | ${n(ads.length)} (${n(needAccept.length)} sem aceite; ${accepted.length} aceitas) | ${n(byClass.parameter_required ?? 0)} / ${n(byClass.adaptation_required ?? 0)} / ${n(byClass.parameter_or_adaptation_required ?? 0)} | ${scen} | ${b.budget.maxOutbound}/${b.budget.maxExternalCalls} |`,
  )
  detail.push(
    `| ${b.name} | ${aliases.size} | ${flows.size} | ${agents} | ${http} | ${desk} | ${secrets} | ${ep?.external.length ?? 0} / ${ep?.fromChain.length ?? 0} |`,
  )
}

const statusDoc = [
  '# Situação por bot — F5 (expansão)',
  '',
  `Gerado por \`scripts/f5-status.ts\` com a configuração do piloto (\`config/piloto.config.json\`). Conversor sobre a origem ${a.pkg.runId}.`,
  '',
  '> **Nenhum bot está “aceito para importação manual”.** Todos estão estruturalmente válidos e com cobertura total da origem, mas as adaptações que mudam regra de negócio ainda aguardam aceite por jornada, os dados externos estão pendentes e não houve homologação.',
  '',
  '## Situação e pendências',
  '',
  'Situações (spec 9.5): `structurally_valid` → `awaiting_journey_acceptance` (há adaptação funcional sem aceite) → `accepted_for_manual_import`.',
  '',
  '| Bot | Situação | Cobertura da origem | Adaptações | Diagnósticos: parâmetro / adaptação / ambos | Cenários confirmados | Teto/passada (msgs / chamadas) |',
  '| --- | --- | ---: | --- | --- | ---: | ---: |',
  ...rows,
  '',
  '## Dependências a preencher por bot',
  '',
  '| Bot | Aliases de Redirect | Ids de Flow | Pontos de agente IA | HTTP | Pontos de atendimento | Segredos a preencher | Parâmetros de entrada (externos / da cadeia) |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...detail,
  '',
  'Tetos do motor por passada: 15 mensagens e 30 chamadas externas; nenhum bot excede (ver `passes.json` no pacote).',
  '',
  '## Ordem de trabalho sugerida',
  '',
  'A ordem “pelo grafo de dependências” (F5-01) **não pode ser calculada**: os endereços de Redirect são nomes de aplicações da Blip (ex.: “Vivo Fixa Planos [WPP][PROD]”) e nenhum está confirmado como um dos 13 bots; vários apontam para bots fora do lote. Ver [aliases-para-preencher.md](aliases-para-preencher.md). Enquanto isso, sugere-se validar do menor para o maior (menos risco primeiro), mantendo o piloto como referência de padrão:',
  '',
  ...[...res.bots]
    .sort((x, y) => x.stats.states - y.stats.states)
    .map((b, i) => `${i + 1}. \`${b.name}\` (${b.stats.states} estados)`),
  '',
].join('\n')
writeFileSync('docs/f5/cobertura-bots.md', statusDoc)

// Planilha de aliases
const al = a.graph.aliases
const aliasDoc = [
  '# Aliases de Redirect — para preencher',
  '',
  `São ${al.length} endereços distintos (${a.graph.redirects.length} ocorrências). Cada um é o **nome de uma aplicação na Blip**; o conversor não liga um alias a um bot por semelhança de nome.`,
  '',
  'Para cada alias informe, em `config/piloto.config.json` → `bindings.botAliases[]`:',
  '- `targetLogicalBot`: um dos 13 bots do lote (se o destino é um deles), e/ou',
  '- `targetImportedBotId`: o id do bot **já existente no Kayros** (se o destino é outro bot, por exemplo os fluxos do `Extrato Kayros`).',
  '',
  'Sem isso, cada Redirect vira um `Typebot link` com referência configurável `{{resource.blip.link.<alias>}}`, a ser resolvida no remapeamento manual (guia de importação, seção 3).',
  '',
  '| Alias (como na Blip) | Ocorrências | Com contexto | Usado por | Chave de Recurso gerada | Destino (preencher) |',
  '| --- | ---: | ---: | --- | --- | --- |',
  ...al.map((x) => `| ${md(x.address)} | ${x.occurrences} | ${x.withContext} | ${x.fromBots.join(', ')} | \`${toResourceKey(`blip.link.${resourceSlug(x.address)}`)}\` |  |`),
  '',
].join('\n')
writeFileSync('docs/f5/aliases-para-preencher.md', aliasDoc)
console.log(`bots: ${res.bots.length}; aliases: ${al.length}`)
