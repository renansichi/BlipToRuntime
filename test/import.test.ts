import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { analyzePackage } from '../src/analysis/analyze.js'
import { validateConfig } from '../src/config/load.js'
import { convertAnalysis } from '../src/emit/convert.js'
import { compareDocuments } from '../src/validate/compare.js'
import { validateImportSafety } from '../src/validate/refs.js'
import { importLikeKayrosOs } from './helpers/importer-sim.js'
import { type ScenarioFile, check, runScenario } from './helpers/scenario-runner.js'
import { simulate } from './helpers/sim.js'

const LOTE = 'C:/Users/renan/Documents/Convert To Runtime/Analise Blip Kayros/2026-11-02T04-26-43-071Z-e44c3a22'
const root = (p: string) => fileURLToPath(new URL(p, import.meta.url))

describe.skipIf(!existsSync(LOTE))('importacao manual (F3-08): o que o conversor emite sobrevive ao importador do Kayros OS', () => {
  const a = analyzePackage(LOTE)
  const cfg = validateConfig(JSON.parse(readFileSync(root('../config/piloto.config.json'), 'utf8'))).config!
  const file = { bot: 'vivofixadados', ...JSON.parse(readFileSync(root('../scenarios/vivofixadados.piloto.json'), 'utf8')) } as ScenarioFile

  const gen = convertAnalysis(a, { onlyBots: ['vivofixadados'], config: cfg })
  const bot = gen.bots[0]!
  const imported = importLikeKayrosOs(bot.document as never)

  it('o formato padrao nao usa o que o importador descarta (to.blockId, Jump)', () => {
    expect(validateImportSafety(bot.document)).toEqual([])
    expect(JSON.stringify(bot.document)).not.toContain('"Jump"')
  })

  it('o rascunho importado confere com o gerado (forma, conteudo sem ids, destinos)', () => {
    const cmp = compareDocuments(bot.document, imported)
    expect(cmp.differences.slice(0, 5)).toEqual([])
    expect(cmp.ok).toBe(true)
    expect(cmp.groups.generated).toBe(cmp.groups.exported)
  })

  it('a conferencia detecta adulteracao no rascunho importado', () => {
    const tampered = importLikeKayrosOs(bot.document as never) as { groups: { blocks: { type: string; options?: { content?: string } }[] }[] }
    const code = tampered.groups.flatMap((g) => g.blocks).find((b) => b.type === 'Code' && b.options?.content?.includes('function run'))!
    code.options!.content += '\n// alterado'
    expect(compareDocuments(bot.document, tampered).ok).toBe(false)
    const dropped = importLikeKayrosOs(bot.document as never) as { edges: unknown[] }
    dropped.edges.pop()
    expect(compareDocuments(bot.document, dropped).ok).toBe(false)
  })

  it('os 16 cenarios do piloto dao o mesmo resultado no fluxo IMPORTADO (ids novos, sem blockId)', () => {
    const importedBot = { ...bot, document: imported as never }
    // Nomes de grupo/variavel sao preservados; so os ids mudam.
    for (const s of file.scenarios) {
      const base = s.config === 'none' ? convertAnalysis(a, { onlyBots: ['vivofixadados'] }).bots[0]! : bot
      const viaImport = { ...base, document: s.config === 'none' ? (importLikeKayrosOs(base.document as never) as never) : (importedBot.document as never) }
      // Os ids de estado usados em @state: sao os da ORIGEM (valores de variaveis), nao ids do documento.
      check(s, runScenario(a, viaImport, file, s))
    }
  })

  it('o formato com arestas para blocos (--block-edges) quebra apos a importacao: e por isso nao e o padrao', () => {
    const blk = convertAnalysis(a, { onlyBots: ['vivofixadados'], config: cfg, blockEdges: true }).bots[0]!
    const viaImport = { ...blk, document: importLikeKayrosOs(blk.document as never) as never }
    let diverged = 0
    for (const s of file.scenarios) {
      try {
        const t = simulate(viaImport.document as never, {
          ...s,
          resources: file.resources,
          vars: Object.fromEntries(Object.entries({ ...file.baseVars, ...(s.vars ?? {}) }).map(([k, v]) => [k, v.startsWith('@state:') ? (a.inventory.states.find((x) => x.bot === 'vivofixadados' && x.title === v.slice(7))!.stateId) : v])),
        })
        const want = runScenario(a, bot, file, s)
        if (JSON.stringify([t.messages, t.http, t.end]) !== JSON.stringify([want.messages, want.http, want.end])) diverged++
      } catch {
        diverged++
      }
    }
    expect(diverged).toBeGreaterThan(0)
  })

  it('variante de TESTE: a conversa comeca no CPF com as variaveis de teste e percorre o cenario P-01 a partir do evento start', () => {
    const r = convertAnalysis(a, { onlyBots: ['vivofixadados'], config: cfg, testEntries: [{ bot: 'vivofixadados', stateTitle: 'CPF', presets: { tipoPessoa: 'Pessoa Fisica', idAbandono: '@state:Direciona_Abandono' } }] })
    const v = r.bots.find((b) => b.variant === 'cpf')!
    expect(v.status).toBe('structurally_valid')
    expect(validateImportSafety(v.document)).toEqual([])
    const p01 = file.scenarios.find((s) => s.id === 'P-01')!
    const { startAt: _s, ...noStart } = p01
    const t = simulate(importLikeKayrosOs(v.document as never) as never, {
      ...noStart,
      resources: file.resources,
      vars: {},
    } as never)
    // Sem startAt: o evento start leva a "Entrada de teste" e depois ao CPF.
    expect(t.groups.slice(0, 2)).toEqual(['Entrada de teste', 'CPF'])
    expect(t.vars.tipoPessoa).toBe('Pessoa Fisica')
    expect(t.vars.idAbandono).toBe(a.inventory.states.find((x) => x.bot === 'vivofixadados' && x.title === 'Direciona_Abandono')!.stateId)
    // Nao ha outra entrada e a variante nao entra na cobertura nem nos relatorios do bot completo.
    expect(r.bots.filter((b) => !b.variant)).toHaveLength(1)
  })
})
