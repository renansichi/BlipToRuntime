// Tipos da analise da origem (F1). Toda ocorrencia carrega SourceRef: arquivo e
// caminho JSON sao a localizacao oficial (spec 9.2).

export type Phase =
  | 'globalEnter'
  | 'globalLeave'
  | 'enter'
  | 'content'
  | 'input'
  | 'leave'
  | 'afterStateChange'

export interface SourceRef {
  bot: string
  /** Arquivo do contrato principal, relativo ao pacote (com `/`). */
  file: string
  stateId?: string
  phase: Phase
  jsonPointer: string
  ordinal: number
}

export interface ActionRecord {
  ref: SourceRef
  type: string
  id?: string
  title?: string
  /** Quantidade de condicoes de execucao da acao. */
  conditions: number
  /** URI sem query string (ProcessHttp/ProcessCommand); nunca corpo nem cabecalhos. */
  uri?: string
  method?: string
  /** Redirect: endereco de destino e se carrega contexto. */
  address?: string
  hasContext?: boolean
  /** SetVariable: tem expiracao. */
  expiration?: number | string
  variable?: string
}

export interface ContentRecord {
  ref: SourceRef
  type: 'SendMessage' | 'SendRawMessage'
  mime: string
  /** Texto bruto de SendRawMessage JSON (para detectar formularios); nao vai ao inventario serializado. */
  isTypingIndicator: boolean
}

export interface ExitRecord {
  /** Posicao entre as saidas condicionais; -1 = saida padrao. */
  index: number
  kind: 'literal' | 'dynamic'
  /** Id literal do estado ou a expressao `{{variavel}}`. */
  target: string
  conditions: number
  pointer: string
}

export interface InputRecord {
  /** Caminho JSON do item de input em $contentActions. */
  pointer: string
  bypass: boolean
  /** Valor bruto de `expiration` (ex.: "0:25"). */
  expiration?: string
  validation?: { rule: string }
  conditions: number
  variable?: string
}

export interface StateRecord {
  bot: string
  stateId: string
  title: string
  root: boolean
  pointer: string
  input: InputRecord
  enterActions: number
  leaveActions: number
  afterActions: number
  contentSends: number
  /** Envios de conteudo excluindo indicador de digitacao. */
  contentMessages: number
  exits: ExitRecord[]
  whiteWall: boolean
  desk: boolean
}

export interface BotInventory {
  bot: string
  identifier: string | null
  files: { original: string; principal: string; variaveis: string }
  states: number
  localActions: number
  configs: number
  inputsNoBypass: number
  timeouts: number
  httpLocal: number
  scripts: number
  redirect: number
}

export interface Inventory {
  totals: {
    bots: number
    states: number
    localActions: number
    globalActions: number
    afterStateChangeActions: number
    actionOccurrences: number
    configs: number
    contentSends: number
    contentMessages: number
    inputs: number
    inputsNoBypass: number
    timeouts: number
    dynamicExits: number
    setVariableWithExpiration: number
    mergeContact: number
    redirectOccurrences: number
    redirectDistinctAddresses: number
    redirectWithContext: number
    scripts: number
    httpLocal: number
    httpGlobal: number
    inputValidations: number
    conditionalInputs: number
  }
  actionTypes: Record<string, number>
  contentTypes: Record<string, number>
  perBot: BotInventory[]
  states: StateRecord[]
  actions: ActionRecord[]
  content: ContentRecord[]
}
