import { readFileSync, writeFileSync } from 'node:fs'
import { analyzePackage } from '../src/analysis/analyze.js'
import { validateConfig } from '../src/config/load.js'
import { convertAnalysis } from '../src/emit/convert.js'

// Gera config/piloto.config.json a partir do modelo de exemplo + cenarios
// confirmados + aceites registrados. Uso:
//   npx tsx scripts/build-pilot-config.ts <pacote>
// Nao inventa aceite: so registra o que consta em docs/piloto/aceite-cenarios-2026-11-02.md.

const EVIDENCE = 'docs/piloto/aceite-cenarios-2026-11-02.md'
const RESPONSIBLE = 'Renan'
const DATE = '2026-11-02'

const pkg = process.argv[2]
if (!pkg) throw new Error('Informe o pacote.')
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'))
const cfg = read('examples/configuracao.exemplo.json')
const a = analyzePackage(pkg)

interface Sc { id: string; title: string; startAt?: string; input: unknown[]; http: unknown[]; vars?: Record<string, string>; expect: { groups?: string[]; messages?: string[]; http?: string[][]; end?: string; endDetail?: string; vars?: Record<string, string> } }
const files: { bot: string; scenarios: Sc[] }[] = [
  { bot: 'vivofixadados', scenarios: read('scenarios/vivofixadados.piloto.json').scenarios },
  ...read('scenarios/formulario-atendimento.json').files,
]

// Adaptacao aceita: aviso + encerramento do atendimento sem fila (so no bot do cenario D-01/D-02).
const deskId = 'bkovivofixamsgativaah:desk-queue-pending'
const conv = convertAnalysis(a, { onlyBots: ['bkovivofixamsgativaah'] })
const desk = conv.adaptations.find((x) => x.id === deskId)
if (!desk) throw new Error(`Adaptacao ${deskId} nao gerada.`)
const { occurrences: _o, ...deskFields } = desk
// Esperas sem envio do piloto (docs/piloto/aceite-esperas-2026-11-02.md).
const WAITS_EVIDENCE = 'docs/piloto/aceite-esperas-2026-11-02.md'
const DEFAULT_PROMPT = 'Pode me confirmar para continuarmos?'
const waitDecisions: [string, 'remove' | 'keep'][] = [
  ['51550a60', 'remove'], // Bloco vazio final
  ['cd52b86a', 'keep'], // F_04_UltimoImput
  // Redireciona_Bot BKO (adfa7312): decisao "remover" registrada so na evidencia; o Redirect de entrada
  // vem antes da espera, entao nenhuma adaptacao de espera e gerada para o estado.
  ['5e7c8d2b', 'keep'], // finalizar abandono
  ['13af0f48', 'keep'], // MSG Ativa Reagendamento
]
const pilotWaits = convertAnalysis(a, { onlyBots: ['vivofixadados'] }).adaptations
const waitAdaptations = waitDecisions.map(([id8, decision]) => {
  const id = `vivofixadados:wait-without-message:${id8}`
  const ad = pilotWaits.find((x) => x.id === id)
  if (!ad) throw new Error(`Adaptacao ${id} nao gerada.`)
  const { occurrences: _w, ...fields } = ad
  return {
    ...fields,
    fallback: { ...fields.fallback, kind: decision === 'remove' ? 'remove' : 'contextual-question', promptText: decision === 'remove' ? null : DEFAULT_PROMPT },
    acceptance: { status: 'accepted', responsible: RESPONSIBLE, date: DATE, evidenceFile: WAITS_EVIDENCE },
  }
})

// Dados do piloto (docs/piloto/aceite-dados-2026-11-02.md).
const DATA_EVIDENCE = 'docs/piloto/aceite-dados-2026-11-02.md'
const dataAdaptations = ['ttl-session', 'merge-contact-session', 'merge-contact-write-only-discard'].map((slug) => {
  const id = `vivofixadados:${slug}`
  const ad = pilotWaits.find((x) => x.id === id)
  if (!ad) throw new Error(`Adaptacao ${id} nao gerada.`)
  const { occurrences: _d, ...fields } = ad
  return { ...fields, acceptance: { status: 'accepted', responsible: RESPONSIBLE, date: DATE, evidenceFile: DATA_EVIDENCE } }
})

// Campos de nome operacional mantidos apesar de nenhum bot do pacote le-los (decisao de 02/11/2026).
cfg.dataPolicy = {
  keepContactExtras: ['filaAH', 'prioridade', 'encerramentoAbandonoFormulario'].map((key) => ({
    bot: 'vivofixadados',
    key,
    reason: 'Nome operacional: pode ser lido por Desk, regra de roteamento ou campanha fora dos bots (aceite-dados-2026-11-02.md).',
  })),
}

cfg.adaptations = [
  { ...deskFields, validationScenarioIds: ['D-01', 'D-02'], acceptance: { status: 'accepted', responsible: RESPONSIBLE, date: DATE, evidenceFile: EVIDENCE } },
  ...waitAdaptations,
  ...dataAdaptations,
]

cfg.referenceScenarios = files.flatMap((f) =>
  f.scenarios.map((s) => ({
    id: s.id,
    journeyId: `${f.bot}/${s.id.startsWith('D') ? 'atendimento' : s.id.startsWith('F') ? 'formulario' : 'cpf'}`,
    status: 'confirmed',
    sourceEvidenceFile: s.id === 'P-08b' ? 'docs/piloto/aceite-dados-2026-11-02.md' : 'docs/piloto/cenarios-para-revisao.md',
    inputSequence: s.input,
    httpFixtures: s.http,
    expectedMessages: s.expect.messages ?? [],
    expectedBusinessEffects: [
      ...(s.expect.http ?? []).map(([m, u]) => `${m} ${u}`),
      ...Object.entries(s.expect.vars ?? {}).map(([k, v]) => `${k} = ${v}`),
    ],
    expectedEndState: { end: s.expect.end ?? null, detail: s.expect.endDetail ?? null, path: s.expect.groups ?? [] },
    acceptedAdaptationIds: s.id.startsWith('D') ? [deskId] : s.id === 'P-08b' ? ['vivofixadados:merge-contact-write-only-discard'] : [],
    businessConfirmation: { responsible: RESPONSIBLE, date: DATE },
    homologationEvidenceFile: null,
  })),
)
cfg.status = 'pilot_decisions_recorded'
cfg.description = 'Configuracao do piloto: cenarios confirmados pelo responsavel em 02/11/2026, aceite do aviso de atendimento sem fila e decisoes sobre esperas e dados do piloto. Demais valores seguem pendentes (null). Nao e configuracao nativa do Kayros.'

const r = validateConfig(cfg)
if (!r.ok) throw new Error(JSON.stringify(r.errors, null, 2))
writeFileSync('config/piloto.config.json', JSON.stringify(cfg, null, 2) + '\n')
console.log(`config/piloto.config.json: ${cfg.referenceScenarios.length} cenarios confirmados, ${cfg.adaptations.length} adaptacoes aceitas, ${r.pending.length} pendencias.`)
