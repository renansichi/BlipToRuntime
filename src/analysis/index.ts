// Analise (F1): inventario, simbolos, dependencias, grafo, padroes de atencao.
export { analyzePackage, writeAnalysis, type Analysis } from './analyze.js'
export { buildInventory, scanBot } from './inventory.js'
export { collectSymbols, resolveConfigs, externalResources, classify } from './symbols.js'
export { buildGraph, stronglyConnected } from './graph.js'
export { detectPatterns, countByCode, type Finding } from './patterns.js'
export type * from './types.js'
