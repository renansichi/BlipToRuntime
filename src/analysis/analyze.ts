import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Diagnostic } from '../diagnostics.js'
import { readPackage, type SourcePackage } from '../ingest/package.js'
import { type GraphResult, buildGraph } from './graph.js'
import { buildInventory } from './inventory.js'
import { type Finding, countByCode, detectPatterns } from './patterns.js'
import { collectSymbols, externalResources, resolveConfigs } from './symbols.js'
import type { Inventory } from './types.js'

// Orquestra a analise (F1-08): le o pacote, inventaria, resolve simbolos, monta
// o grafo, detecta padroes e escreve inventory.json, dependencies.json e
// diagnostics.json. Nao executa scripts, nao abre rede e nao altera a origem.

export interface Analysis {
  pkg: SourcePackage
  inventory: Inventory
  graph: GraphResult
  findings: Finding[]
  configs: {
    bot: string
    keys: string[]
    missing: { key: string; uses: string[] }[]
    missingOther: { key: string; via: string; uses: string[] }[]
    unused: string[]
  }[]
  externalResources: { expression: string; bots: string[]; occurrences: number }[]
  /** Diagnosticos tecnicos (ingestao + estrutura). Vazio = pacote integro. */
  technical: Diagnostic[]
}

export function analyzePackage(root: string): Analysis {
  const pkg = readPackage(root)
  const { inventory, diagnostics } = buildInventory(pkg)
  const graph = buildGraph(pkg.bots, inventory)

  const configs: Analysis['configs'] = []
  const missingForPatterns: { bot: string; key: string; uses: string[]; via: string }[] = []
  const extByBot: { bot: string; expression: string; uses: string[] }[] = []
  const extAgg = new Map<string, { bots: Set<string>; n: number }>()

  for (const bot of pkg.bots) {
    const table = collectSymbols(bot)
    const r = resolveConfigs(bot, table)
    configs.push({ bot: bot.name, keys: bot.configs.map((c) => c.key), missing: r.missing, missingOther: r.missingOther, unused: r.unused })
    for (const m of r.missing) missingForPatterns.push({ bot: bot.name, key: m.key, uses: m.uses, via: 'placeholder' })
    for (const m of r.missingOther) missingForPatterns.push({ bot: bot.name, key: m.key, uses: m.uses, via: m.via })
    for (const [expression, uses] of externalResources(table)) {
      extByBot.push({ bot: bot.name, expression, uses })
      const a = extAgg.get(expression) ?? { bots: new Set<string>(), n: 0 }
      a.bots.add(bot.name)
      a.n += uses.length
      extAgg.set(expression, a)
    }
  }

  const findings = detectPatterns(pkg.bots, inventory, graph, missingForPatterns, extByBot)

  const technical: Diagnostic[] = [...pkg.diagnostics, ...diagnostics]
  for (const g of graph.bots) {
    for (const d of g.danglingLiteral) {
      technical.push({
        code: 'SOURCE_LITERAL_TARGET_MISSING',
        class: 'technical_error',
        message: `Saida literal de ${d.from} aponta para estado ausente ${d.to}.`,
        pointer: d.pointer,
        bot: d.bot,
      })
    }
  }

  return {
    pkg,
    inventory,
    graph,
    findings,
    configs,
    externalResources: [...extAgg].map(([expression, a]) => ({ expression, bots: [...a.bots].sort(), occurrences: a.n })),
    technical,
  }
}

/**
 * Escreve os artefatos de analise em `outDir`. Nao copia valores das entradas de configuracao,
 * nem corpos e cabecalhos HTTP; URIs e enderecos aparecem como escritos no fluxo (sem query string).
 */
export function writeAnalysis(a: Analysis, outDir: string): string[] {
  mkdirSync(outDir, { recursive: true })
  const files: string[] = []
  const put = (name: string, data: unknown) => {
    writeFileSync(join(outDir, name), JSON.stringify(data, null, 2) + '\n', { flag: 'w' })
    files.push(name)
  }
  const { inventory, graph } = a

  put('inventory.json', {
    schemaVersion: '1.0',
    source: { runId: a.pkg.runId, router: a.pkg.router, filesVerified: a.pkg.filesVerified },
    totals: inventory.totals,
    actionTypes: inventory.actionTypes,
    contentTypes: inventory.contentTypes,
    perBot: inventory.perBot,
    states: inventory.states,
    actions: inventory.actions,
    content: inventory.content.map(({ isTypingIndicator, ...c }) => ({ ...c, typingIndicator: isTypingIndicator })),
  })

  put('dependencies.json', {
    schemaVersion: '1.0',
    // Apenas chaves: valores das entradas de configuracao nao sao copiados.
    configurations: a.configs,
    externalResources: a.externalResources,
    redirectAliases: graph.aliases,
    redirects: graph.redirects,
    dynamicTargets: graph.dynamicTargets,
    graphs: graph.bots,
    channelSignals: graph.channelSignals,
  })

  const summary = countByCode(a.findings)
  put('diagnostics.json', {
    schemaVersion: '1.0',
    technicalErrors: a.technical,
    summary,
    findings: a.findings,
  })
  return files
}
