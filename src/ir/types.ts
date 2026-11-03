import type { SourceRef } from '../analysis/types.js'
import type { JsonObject } from '../ingest/package.js'

// Modelo intermediario de migracao (spec 9.2). Preserva a semantica da origem
// (predicados ordenados, fases, efeitos) e a localizacao de cada elemento; o
// que o normalizador nao reconhece vai em `unknown` com diagnostico, nunca e
// descartado em silencio.

export type Effect =
  | 'pure'
  | 'sessionWrite'
  | 'persistentWrite'
  | 'http'
  | 'message'
  | 'analytics'
  | 'handoff'
  | 'suspend'
  | 'terminate'

export type BlipOp =
  | 'exists'
  | 'notExists'
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'matches'
  | 'greaterThan'
  | 'greaterThanOrEquals'
  | 'lessThan'
  | 'lessThanOrEquals'

export interface Predicate {
  /** `input` consulta a entrada atual; `context` uma variavel; `intent` e personalizada. */
  source: 'input' | 'context' | 'intent' | 'unknown'
  /** Variavel de contexto (so quando source = context). Residuo em source = input e ignorado. */
  variable?: string
  op: BlipOp | string
  values: string[]
  /** Posicao no array original (para rastreio). */
  pointer: string
}

export type ActionKind =
  | 'setVariable'
  | 'trackEvent'
  | 'mergeContact'
  | 'script'
  | 'http'
  | 'command'
  | 'redirect'
  | 'forwardToDesk'
  | 'leavingFromDesk'
  | 'unknown'

export interface MigrationAction {
  kind: ActionKind
  /** Tipo Blip original (`ExecuteScriptV2`, ...). */
  type: string
  source: SourceRef
  title?: string
  /** Condicoes de execucao da acao (AND entre elas). */
  conditions: Predicate[]
  continueOnError: boolean
  settings: JsonObject
  effect: Effect
}

export type MessageKind = 'text' | 'media' | 'select' | 'raw' | 'chatstate' | 'unknown'

export interface MigrationMessage {
  kind: MessageKind
  source: SourceRef
  mime: string
  /** Para `raw`: texto bruto; para `select`/`media`: o objeto de conteudo. */
  content: unknown
  /** SendRawMessage vs SendMessage. */
  viaRaw: boolean
}

export interface MigrationInput {
  /** Caminho JSON do item de input em $contentActions. */
  pointer: string
  bypass: boolean
  /** Minutos (expiration "h:mm"), se houver. */
  timeoutMinutes?: number
  /** Valor bruto de expiration. */
  timeoutRaw?: string
  validation?: { rule: string; regex?: string; error?: string }
  conditions: Predicate[]
  variable?: string
}

export type TargetRef =
  | { kind: 'state'; stateId: string }
  | { kind: 'dynamic'; variable: string; expression: string }

export interface OrderedExit {
  /** Posicao entre as saidas condicionais; -1 = padrao. */
  index: number
  predicates: Predicate[]
  target: TargetRef
  pointer: string
}

export interface MigrationState {
  source: SourceRef
  stateId: string
  title: string
  root: boolean
  enter: MigrationAction[]
  messages: MigrationMessage[]
  input: MigrationInput
  leave: MigrationAction[]
  afterStateChange: MigrationAction[]
  exits: OrderedExit[]
  defaultExit: OrderedExit | undefined
  whiteWall: boolean
}

export interface MigrationBot {
  name: string
  file: string
  states: MigrationState[]
  globalEnter: MigrationAction[]
  globalLeave: MigrationAction[]
  /** Chaves de configuracao exportadas (sem valores). */
  configKeys: string[]
}
