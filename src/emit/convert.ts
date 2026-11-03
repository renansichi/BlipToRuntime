import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { AdaptationRegistry } from '../adapt/registry.js'
import type { Analysis } from '../analysis/analyze.js'
import type { ConverterConfig } from '../config/schema.js'
import type { Diagnostic } from '../diagnostics.js'
import { buildDataFlow, entryParameters, writeOnlyContactExtras } from '../analysis/dataflow.js'
import { collectSymbols } from '../analysis/symbols.js'
import { normalizeBot } from '../ir/normalize.js'
import { PROFILE_ID, REFERENCE_COMMITS, TARGET_LIMITS } from '../profile/kayros-current-adapted.js'
import { type OptimizeStats, optimizeDocument } from '../optimize/index.js'
import { type MergeSetStats, mergeSetVariables } from '../optimize/merge-set.js'
import { type PruneOptions, type PruneStats, pruneUnreadVariables } from '../optimize/prune.js'
import { type ConditionStats, normalizeConditions } from './conditions.js'
import { type DefaultsStats, omitEmptyDefaults } from './defaults.js'
import { externalReadNames, sanitizeVar } from './translate.js'
import { validateKayrosDocument } from '../profile/validate-document.js'
import { validateImportSafety, validateReferences } from '../validate/refs.js'
import type { EmitDiagnostic, SecretExtraction, SourceMapEntry } from './context.js'
import { analyzePassBudget, type BudgetReport } from '../analysis/budget.js'
import { type BotCoverage, computeCoverage, coverageTotals } from '../report/coverage.js'
import { slug } from './ids.js'
import { emitBot } from './state.js'

// Conversao do pacote (F2-03): analise -> IR -> emissao -> validacao -> arquivos.
// Reprodutivel: sem datas nem aleatoriedade; ids derivam da chave logica.

export const CONVERTER_VERSION = '0.4.0'

export interface ConvertedBot {
  name: string
  document: ReturnType<ReturnType<typeof emitBot>['b']['document']>
  stats: { states: number; groups: number; blocks: number; edges: number }
  diagnostics: EmitDiagnostic[]
  validation: Diagnostic[]
  secrets: SecretExtraction[]
  sourceMap: SourceMapEntry[]
  status: 'generated_for_review' | 'structurally_valid'
  optimization: OptimizeStats | undefined
  pruning?: PruneStats | undefined
  /** Compatibilidade da Condition com o builder (OR em branches, operadores executaveis). */
  conditions?: ConditionStats | undefined
  /** Fusao de Set variable consecutivos em um Set variable em modo codigo (opt-in). */
  merging?: MergeSetStats | undefined
  /** Campos vazios omitidos como o builder faz (`credentialsId`). */
  defaults?: DefaultsStats | undefined
  /** Opcoes usadas na poda: reaproveitadas ao gerar a versao enxuta. */
  pruneOptions?: PruneOptions | undefined
  budget: BudgetReport
  /** Variante de teste (entrada em um estado); ausente no bot completo. */
  variant?: string
}

export interface ConvertResult {
  bots: ConvertedBot[]
  adaptations: ReturnType<AdaptationRegistry['list']>
  pendingAcceptance: string[]
  sourceRunId: string
  coverage: BotCoverage[]
  /** Campos lidos pelo bot e nunca escritos por ele: vindos de fora do pacote ou de outro bot da cadeia. */
  entryParameters: { bot: string; external: ReturnType<typeof entryParameters>['external']; fromChain: ReturnType<typeof entryParameters>['fromChain'] }[]
}

export function convertAnalysis(a: Analysis, opts: {
    config?: ConverterConfig
    onlyBots?: string[]
    optimize?: boolean
    blockEdges?: boolean
    /** Descarta variaveis sem leitor (opt-in: o fluxo emitido perde gravacoes que so serviam a relatorios). */
    prune?: boolean
    /** Ajusta as Conditions ao builder (padrao: ligado). Desligar so para comparar com a semantica Blip bruta. */
    normalizeConditions?: boolean
    /** Funde Set variable consecutivos em um Set variable em modo codigo com varios `setVariable` (opt-in; ver src/optimize/merge-set.ts). */
    mergeSetVariables?: boolean
    /** Nao emite o que o builder omite por estar vazio (hoje: `credentialsId: ""`). Padrao: ligado. */
    omitEmptyDefaults?: boolean
    /** Variantes de TESTE: o mesmo bot com a conversa iniciando em um estado (homologacao de um trecho). */
    testEntries?: { bot: string; stateTitle: string; presets?: Record<string, string> }[]
  } = {}): ConvertResult {
  const adapt = new AdaptationRegistry(opts.config?.adaptations ?? [])
  const bots: ConvertedBot[] = []
  const botSources = a.pkg.bots.filter((b) => !opts.onlyBots || opts.onlyBots.includes(b.name))
  // Fluxo de dados sempre sobre o pacote inteiro: os bots compartilham o contato.
  const flow = buildDataFlow(a.pkg.bots)
  const entryParams: ConvertResult['entryParameters'] = []

  for (const src of botSources) {
    const { bot: mb } = normalizeBot(src)
    const usesStateNamespace = collectSymbols(src).uses.some((u) => u.namespace === 'state')
    const writeOnlyKeys = writeOnlyContactExtras(flow, mb.name)
    // Campos que o responsavel decidiu manter mesmo sem leitor no pacote (dataPolicy).
    for (const k of opts.config?.dataPolicy?.keepContactExtras ?? []) if (k.bot === mb.name) writeOnlyKeys.delete(k.key)
    const discardId = `${mb.name}:merge-contact-write-only-discard`
    const discardWriteOnly = opts.config?.adaptations.some((x) => x.id === discardId && x.acceptance.status === 'accepted') ?? false
    entryParams.push({ bot: mb.name, ...entryParameters(flow, mb.name) })
    const emitted = emitBot({ mb, dynamicTargets: a.graph.dynamicTargets, adapt, config: opts.config, usesStateNamespace, writeOnlyKeys, discardWriteOnly, optimize: opts.optimize ?? true, blockEdges: opts.blockEdges ?? false })
    const document = emitted.b.document(mb.name)
    const conditions = (opts.normalizeConditions ?? true) ? normalizeConditions(document) : undefined
    const optimization = opts.optimize ?? true ? optimizeDocument(document, emitted.ctx.sourceMap) : undefined
    // Variaveis sem leitor (so relatorio): lidas por outro bot do pacote ou levadas ao destino do redirect ficam.
    const protectedNames = new Set([...externalReadNames(a.pkg.bots, mb.name), 'redirect_context'])
    // Decisao de dados (dataPolicy): campos mantidos mesmo sem leitor (consumidos por Desk, campanhas...).
    for (const k of opts.config?.dataPolicy?.keepContactExtras ?? []) if (k.bot === mb.name) protectedNames.add(`contact_extras_${sanitizeVar(k.key)}`)
    const passNames = externalReadNames(a.pkg.bots, mb.name, { includeOwnWritten: true })
    const pruning = (opts.prune ?? false) ? pruneUnreadVariables(document, { protectedNames, passNames }, emitted.ctx.sourceMap) : undefined
    const merging = opts.mergeSetVariables ? mergeSetVariables(document, emitted.ctx.sourceMap) : undefined
    const defaults = (opts.omitEmptyDefaults ?? true) ? omitEmptyDefaults(document) : undefined
    const validation =[...validateKayrosDocument(document), ...validateReferences(document), ...(opts.blockEdges ? [] : validateImportSafety(document))]
    bots.push({
      name: mb.name,
      document,
      stats: {
        states: emitted.stats.states,
        groups: document.groups.length,
        blocks: document.groups.reduce((n, g) => n + g.blocks.length, 0),
        edges: document.edges.length,
      },
      diagnostics: emitted.ctx.diags,
      validation,
      secrets: emitted.ctx.secrets,
      sourceMap: emitted.ctx.sourceMap,
      status: validation.length === 0 ? 'structurally_valid' : 'generated_for_review',
      optimization,
      pruning,
      conditions,
      merging,
      defaults,
      pruneOptions: { protectedNames, passNames },
      budget: analyzePassBudget(document),
    })

    // Variantes de TESTE (homologacao de um trecho): o mesmo bot, com a conversa iniciando em um estado.
    for (const te of (opts.testEntries ?? []).filter((x) => x.bot === mb.name)) {
      const hits = mb.states.filter((s) => s.title === te.stateTitle)
      if (hits.length !== 1) throw new Error(`Entrada de teste: ${hits.length} estados chamados "${te.stateTitle}" em ${mb.name}.`)
      const resolve = (v: string) => (v.startsWith('@state:') ? (mb.states.find((s) => s.title === v.slice(7))?.stateId ?? v) : v)
      const presets = Object.fromEntries(Object.entries(te.presets ?? {}).map(([k, v]) => [k, resolve(v)]))
      const ve = emitBot({
        mb,
        dynamicTargets: a.graph.dynamicTargets,
        adapt: new AdaptationRegistry(opts.config?.adaptations ?? []),
        config: opts.config,
        usesStateNamespace,
        writeOnlyKeys,
        discardWriteOnly,
        optimize: opts.optimize ?? true,
        blockEdges: opts.blockEdges ?? false,
        testEntry: { stateId: (hits[0] as { stateId: string }).stateId, presets },
      })
      const vdoc = ve.b.document(`${mb.name} (teste: ${te.stateTitle})`)
      const vconditions = (opts.normalizeConditions ?? true) ? normalizeConditions(vdoc) : undefined
      if (opts.optimize ?? true) optimizeDocument(vdoc, ve.ctx.sourceMap)
      const vpruning = (opts.prune ?? false) ? pruneUnreadVariables(vdoc, { protectedNames, passNames }, ve.ctx.sourceMap) : undefined
      const vmerging = opts.mergeSetVariables ? mergeSetVariables(vdoc, ve.ctx.sourceMap) : undefined
      const vdefaults = (opts.omitEmptyDefaults ?? true) ? omitEmptyDefaults(vdoc) : undefined
      const vval =[...validateKayrosDocument(vdoc), ...validateReferences(vdoc), ...(opts.blockEdges ? [] : validateImportSafety(vdoc))]
      bots.push({
        name: mb.name,
        variant: slug(te.stateTitle),
        document: vdoc,
        stats: {
          states: ve.stats.states,
          groups: vdoc.groups.length,
          blocks: vdoc.groups.reduce((n, g) => n + g.blocks.length, 0),
          edges: vdoc.edges.length,
        },
        diagnostics: ve.ctx.diags,
        validation: vval,
        secrets: ve.ctx.secrets,
        sourceMap: ve.ctx.sourceMap,
        status: vval.length === 0 ? 'structurally_valid' : 'generated_for_review',
        optimization: undefined,
        pruning: vpruning,
        conditions: vconditions,
        merging: vmerging,
        defaults: vdefaults,
        pruneOptions: { protectedNames, passNames },
        budget: analyzePassBudget(vdoc),
      })
    }
  }
  // Cobertura (F5-09): nenhum elemento da origem pode sumir sem registro.
  const coverage = computeCoverage(a, bots.filter((b) => !b.variant))
  for (const c of coverage) {
    const bot = bots.find((x) => x.name === c.bot && !x.variant) as ConvertedBot
    for (const u of c.uncovered.slice(0, 50)) {
      bot.validation.push({
        code: 'KAYROS_COVERAGE_GAP',
        class: 'technical_error',
        message: `Elemento da origem (${u.kind}) sem traducao nem registro no mapa de origem.`,
        pointer: u.pointer,
        bot: c.bot,
      })
    }
    if (c.uncovered.length > 0) bot.status = 'generated_for_review'
  }
  // Passadas acima dos tetos do motor viram diagnostico (adaptacao: otimizar ou propor interacao adicional).
  for (const b of bots) {
    for (const p of b.budget.exceeding) {
      b.diagnostics.push({
        code: 'PASS_BUDGET_EXCEEDED',
        class: 'adaptation_required',
        message: `Passada ${p.start}: ${p.outbound} mensagens / ${p.externalCalls} chamadas externas (tetos ${TARGET_LIMITS.passMaxOutbound}/${TARGET_LIMITS.passMaxExternalCalls}).`,
        bot: b.name,
        jsonPointer: '',
      })
    }
  }
  return { bots, adaptations: adapt.list(), pendingAcceptance: adapt.pendingAcceptance(), sourceRunId: a.pkg.runId, entryParameters: entryParams, coverage }
}

const sha = (s: string): string => createHash('sha256').update(s).digest('hex')
const json = (v: unknown): string => JSON.stringify(v, null, 2) + '\n'

function countBy<T>(items: T[], key: (t: T) => string): Record<string, number> {
  const m: Record<string, number> = {}
  for (const i of items) m[key(i)] = (m[key(i)] ?? 0) + 1
  return Object.fromEntries(Object.entries(m).sort(([x], [y]) => x.localeCompare(y)))
}

export function writeConversion(r: ConvertResult, outDir: string, config?: ConverterConfig): string[] {
  const files = new Map<string, string>()
  const fileOf = (b: ConvertedBot) => `flows/${PROFILE_ID}/${b.name}${b.variant ? `.teste-${b.variant}` : ''}.json`
  // Os fluxos saem compactos (sem indentacao): o importador so le o JSON e o tamanho conta.
  for (const b of r.bots) files.set(fileOf(b), `${JSON.stringify(b.document)}
`)

  files.set('mapping.json', json({ schemaVersion: '2.0', profile: PROFILE_ID, bots: r.bots.filter((b) => !b.variant).map((b) => ({ bot: b.name, entries: b.sourceMap })) }))
  files.set('adaptations.json', json({ schemaVersion: '2.0', adaptations: r.adaptations, pendingAcceptance: r.pendingAcceptance }))
  files.set(
    'diagnostics.json',
    json({
      schemaVersion: '2.0',
      summary: countBy(r.bots.filter((b) => !b.variant).flatMap((b) => b.diagnostics), (d) => d.code),
      perBot: r.bots.filter((b) => !b.variant).map((b) => ({ bot: b.name, diagnostics: b.diagnostics })),
    }),
  )
  files.set(
    'validation/static.json',
    json({
      schemaVersion: '2.0',
      perBot: r.bots.map((b) => ({ bot: b.name, status: b.status, stats: b.stats, errors: b.validation })),
    }),
  )
  files.set(
    'secrets-to-fill.json',
    json({
      schemaVersion: '2.0',
      note: 'Recursos secretos a preencher no gerenciador do Kayros. Os valores NAO constam do pacote.',
      resources: groupSecrets(r.bots.filter((b) => !b.variant).flatMap((b) => b.secrets)),
    }),
  )
  files.set(
    'entry-parameters.json',
    json({
      schemaVersion: '2.0',
      note: 'external: lidos e nunca escritos por bot algum do pacote (campanha/router/entrada precisam preenche-los). fromChain: escritos por outro bot da cadeia e herdados via Typebot link (variablesToPass).',
      perBot: r.entryParameters,
    }),
  )
  files.set(
    'coverage.json',
    json({
      schemaVersion: '2.0',
      note: 'Todo estado, acao, conteudo, input e saida da origem tem entrada no mapa de origem (traducao, adaptacao, omissao justificada ou nao emitido apos acao terminal).',
      perBot: r.coverage,
    }),
  )
  files.set(
    'passes.json',
    json({
      schemaVersion: '2.0',
      limits: {
        maxOutboundPerPass: TARGET_LIMITS.passMaxOutbound,
        maxExternalCallsPerPass: TARGET_LIMITS.passMaxExternalCalls,
        passDeadlineMs: TARGET_LIMITS.passDeadlineMs,
        maxBotHopsPerPass: TARGET_LIMITS.passMaxBotHops,
      },
      note: 'Pior caminho de cada passada (entre suspensoes) no fluxo emitido. Ramos exclusivos nao se somam. Ciclos sem suspensao sao cortados na contagem.',
      perBot: r.bots.map((b) => ({ bot: b.name, ...b.budget })),
    }),
  )
  files.set('reports/conversion.md', report(r))

  const manifest = {
    schemaVersion: '2.0',
    converterVersion: CONVERTER_VERSION,
    profile: PROFILE_ID,
    referenceCommits: REFERENCE_COMMITS,
    source: { runId: r.sourceRunId },
    configuration: config ? { status: config.status } : null,
    delivery: { automaticInstall: false, publish: false, bindPhoneNumber: false, manualImport: true },
    bots: r.bots.map((b) => ({ bot: b.name, status: b.status, file: fileOf(b), ...(b.variant ? { variant: `teste-${b.variant}` } : {}), stats: b.stats })),
    files: [...files].map(([path, text]) => ({ path, bytes: Buffer.byteLength(text), sha256: sha(text) })).sort((x, y) => x.path.localeCompare(y.path)),
  }
  files.set('manifest.json', json(manifest))

  const written: string[] = []
  for (const [p, text] of files) {
    const abs = join(outDir, ...p.split('/'))
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, text)
    written.push(p)
  }
  return written.sort()
}

function report(r: ConvertResult): string {
  const lines: string[] = []
  lines.push('# Relatorio de conversao', '')
  lines.push(`Perfil: \`${PROFILE_ID}\` · conversor ${CONVERTER_VERSION} · origem ${r.sourceRunId}`, '')
  lines.push('> Pacote **gerado para revisao**. Nao esta homologado nem aceito; as adaptacoes abaixo exigem aceite por jornada antes da importacao manual.', '')
  lines.push('| Bot | Situacao | Estados | Grupos | Blocos | Arestas | Erros estruturais | Diagnosticos |', '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |')
  for (const b of r.bots) {
    lines.push(`| ${b.name}${b.variant ? ` (teste: ${b.variant})` : ''} | ${b.status} | ${b.stats.states} | ${b.stats.groups} | ${b.stats.blocks} | ${b.stats.edges} | ${b.validation.length} | ${b.diagnostics.length} |`)
  }
  const cov = coverageTotals(r.coverage)
  lines.push('', `Cobertura da origem: **${cov.mapped.toLocaleString('pt-BR')} de ${cov.expected.toLocaleString('pt-BR')}** elementos com traducao ou registro rastreavel (ver \`coverage.json\`).`)
  lines.push('', '## Orcamento por passada', '', `Tetos do motor: ${TARGET_LIMITS.passMaxOutbound} mensagens e ${TARGET_LIMITS.passMaxExternalCalls} chamadas externas por passada.`, '', '| Bot | Passadas | Max. mensagens | Max. chamadas externas | Acima do teto |', '| --- | ---: | ---: | ---: | ---: |')
  for (const b of r.bots) lines.push(`| ${b.name} | ${b.budget.passes} | ${b.budget.maxOutbound} | ${b.budget.maxExternalCalls} | ${b.budget.exceeding.length} |`)
  lines.push('', '## Adaptacoes propostas', '', '| Id | Tipo | Muda regra de negocio | Ocorrencias | Aceite |', '| --- | --- | --- | ---: | --- |')
  for (const a of r.adaptations) {
    lines.push(`| ${a.id} | ${a.kind} | ${a.changesBusinessBehavior ? 'sim' : 'nao'} | ${a.occurrences} | ${a.acceptance.status} |`)
  }
  lines.push('', `Adaptacoes que mudam regra de negocio e aguardam aceite: **${r.pendingAcceptance.length}**.`)
  return lines.join('\n') + '\n'
}

function groupSecrets(all: SecretExtraction[]): { bot: string; resourceKey: string; occurrences: number; sources: SecretExtraction['source'][] }[] {
  const m = new Map<string, { bot: string; resourceKey: string; occurrences: number; sources: SecretExtraction['source'][] }>()
  for (const s of all) {
    const k = `${s.bot}|${s.resourceKey}`
    const e = m.get(k) ?? { bot: s.bot, resourceKey: s.resourceKey, occurrences: 0, sources: [] }
    e.occurrences++
    if (e.sources.length < 20) e.sources.push(s.source)
    m.set(k, e)
  }
  return [...m.values()].sort((a, b) => `${a.bot}${a.resourceKey}`.localeCompare(`${b.bot}${b.resourceKey}`))
}
