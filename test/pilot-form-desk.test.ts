import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { analyzePackage } from '../src/analysis/analyze.js'
import { validateConfig } from '../src/config/load.js'
import { convertAnalysis } from '../src/emit/convert.js'
import { type ScenarioFile, type Spec, check, runScenario } from './helpers/scenario-runner.js'

const LOTE = 'C:/Users/renan/Documents/Convert To Runtime/Analise Blip Kayros/2026-11-02T04-26-43-071Z-e44c3a22'
const root = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const spec = JSON.parse(readFileSync(root('../scenarios/formulario-atendimento.json'), 'utf8')) as { files: ScenarioFile[] }

describe.skipIf(!existsSync(LOTE))('piloto — formulario (WhatsApp Flow) e atendimento humano', () => {
  const a = analyzePackage(LOTE)
  const example = () => validateConfig(JSON.parse(readFileSync(root('../examples/configuracao.exemplo.json'), 'utf8'))).config!

  for (const file of spec.files) {
    for (const s of file.scenarios as (Spec & { queue?: string })[]) {
      it(`${s.id} (${file.bot}) — ${s.title}`, () => {
        let config
        if (s.queue) {
          config = example()
          config.bindings.queues = config.bindings.queues.map((q) => (q.sourceBot === file.bot ? { ...q, targetQueueId: s.queue as string, status: 'confirmed' } : q))
        }
        const converted = convertAnalysis(a, { onlyBots: [file.bot], ...(config ? { config } : {}) }).bots[0]!
        expect(converted.status).toBe('structurally_valid')
        check(s, runScenario(a, converted, file, s))
      })
    }
  }

  it('config/piloto.config.json: 16 cenarios confirmados, coerentes com os arquivos, e aceites com evidencia', () => {
    const r = validateConfig(JSON.parse(readFileSync(root('../config/piloto.config.json'), 'utf8')))
    expect(r.errors).toEqual([])
    const cfg = r.config!
    const ids = cfg.referenceScenarios.map((s) => s.id).sort()
    const fromFiles = [
      ...(JSON.parse(readFileSync(root('../scenarios/vivofixadados.piloto.json'), 'utf8')).scenarios as { id: string }[]),
      ...spec.files.flatMap((f) => f.scenarios),
    ].map((s) => s.id).sort()
    expect(ids).toEqual(fromFiles)
    expect(ids).toHaveLength(16)
    expect(cfg.referenceScenarios.every((s) => s.status === 'confirmed' && s.businessConfirmation.responsible === 'Renan' && s.expectedEndState !== null)).toBe(true)
    expect(cfg.adaptations.map((x) => x.id)).toEqual(expect.arrayContaining(['bkovivofixamsgativaah:desk-queue-pending']))
    expect(cfg.adaptations.every((x) => x.acceptance.status === 'accepted' && x.acceptance.responsible === 'Renan' && x.acceptance.evidenceFile)).toBe(true)
    expect(cfg.adaptations.find((x) => x.id === 'bkovivofixamsgativaah:desk-queue-pending')!.acceptance).toMatchObject({ status: 'accepted', responsible: 'Renan', evidenceFile: 'docs/piloto/aceite-cenarios-2026-11-02.md' })
    // O aceite e propagado ao pacote e sai da lista de pendentes; as demais seguem propostas.
    const out = convertAnalysis(a, { onlyBots: ['bkovivofixamsgativaah'], config: cfg })
    expect(out.adaptations.find((x) => x.id === 'bkovivofixamsgativaah:desk-queue-pending')?.acceptance.status).toBe('accepted')
    expect(out.pendingAcceptance).not.toContain('bkovivofixamsgativaah:desk-queue-pending')
    expect(out.pendingAcceptance.length).toBeGreaterThan(0)
  })

  it('o padrao de formulario fica registrado como adaptacao (shim do envelope) a validar na homologacao', () => {
    const r = convertAnalysis(a, { onlyBots: ['vivofixadados'] })
    const ids = r.adaptations.map((x) => x.id)
    expect(ids).toEqual(expect.arrayContaining(['vivofixadados:flow-reply-detection', 'vivofixadados:script-reads-message-envelope']))
    expect(r.adaptations.find((x) => x.id === 'vivofixadados:script-reads-message-envelope')?.targetStrategy).toBe('envelope-shim')
  })

  it('o pos-atendimento nao entra no fluxo principal: adaptacao de fluxo separado, sem retomar sessao encerrada', () => {
    const r = convertAnalysis(a, { onlyBots: ['bkovivofixamsgativaah'] })
    const ad = r.adaptations.find((x) => x.id === 'bkovivofixamsgativaah:post-attendance-separate-flow')
    expect(ad?.changesBusinessBehavior).toBe(true)
    expect(ad?.acceptance.status).toBe('proposed')
  })
})
