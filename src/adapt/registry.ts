import type { SourceRef } from '../analysis/types.js'
import type { ConverterConfig } from '../config/schema.js'

// Registro de adaptacoes (F2-08). O emissor PROPOE adaptacoes quando traduz uma
// capacidade que o Kayros atual nao tem; nenhuma nasce aceita. O aceite vem da
// configuracao (config.adaptations) e exige responsavel, data e evidencia.

export type AdaptationKind = 'presentation' | 'data' | 'validation' | 'integration' | 'handoff' | 'termination' | 'wait'

export interface AdaptationSpec {
  /** Slug estavel; o id final e `<bot>:<slug>` ou `<bot>:<slug>:<escopo>`. */
  slug: string
  /** Escopo opcional (ex.: id curto do estado) para decisoes que precisam de aceite individual. */
  scope?: string
  kind: AdaptationKind
  originalBehavior: string
  proposedBehavior: string
  reason: string
  changesBusinessBehavior: boolean
  targetStrategy: string
  fallbackKind?: string
}

export interface Adaptation {
  id: string
  sourceLocations: { bot: string; file: string; jsonPointer: string }[]
  journeyId: string
  originalBehavior: string
  proposedBehavior: string
  reason: string
  kind: AdaptationKind
  changesBusinessBehavior: boolean
  targetStrategy: string
  fallback: { kind: string | null; queueBindingKey: null; logicalFlow: null; promptText: string | null; retryPolicy: null; endReason: null }
  acceptance: { status: 'proposed' | 'accepted' | 'needs_revision' | 'rejected'; responsible: string | null; date: string | null; evidenceFile: string | null }
  validationScenarioIds: string[]
  /** Quantidade total de ocorrencias (sourceLocations e limitado). */
  occurrences: number
}

const MAX_LOCATIONS = 50

export class AdaptationRegistry {
  private readonly items = new Map<string, Adaptation>()

  constructor(private readonly accepted: ConverterConfig['adaptations'] = []) {}

  propose(spec: AdaptationSpec, at: SourceRef): string {
    const id = spec.scope ? `${at.bot}:${spec.slug}:${spec.scope}` : `${at.bot}:${spec.slug}`
    let a = this.items.get(id)
    if (!a) {
      const prior = this.accepted.find((x) => x.id === id)
      a = {
        id,
        sourceLocations: [],
        journeyId: at.bot,
        originalBehavior: spec.originalBehavior,
        proposedBehavior: spec.proposedBehavior,
        reason: spec.reason,
        kind: spec.kind,
        changesBusinessBehavior: spec.changesBusinessBehavior,
        targetStrategy: spec.targetStrategy,
        fallback: { kind: prior?.fallback.kind ?? spec.fallbackKind ?? null, queueBindingKey: null, logicalFlow: null, promptText: prior?.fallback.promptText ?? null, retryPolicy: null, endReason: null },
        acceptance: prior ? { ...prior.acceptance } : { status: 'proposed', responsible: null, date: null, evidenceFile: null },
        validationScenarioIds: prior ? [...prior.validationScenarioIds] : [],
        occurrences: 0,
      }
      this.items.set(id, a)
    }
    a.occurrences++
    if (a.sourceLocations.length < MAX_LOCATIONS) {
      a.sourceLocations.push({ bot: at.bot, file: at.file, jsonPointer: at.jsonPointer })
    }
    return id
  }

  list(): Adaptation[] {
    return [...this.items.values()].sort((a, b) => a.id.localeCompare(b.id))
  }

  /** Ids de adaptacoes que mudam regra de negocio e ainda nao foram aceitas. */
  pendingAcceptance(): string[] {
    return this.list().filter((a) => a.changesBusinessBehavior && a.acceptance.status !== 'accepted').map((a) => a.id)
  }
}
