// Perfil de destino fixo: Kayros atual, sem extensoes de engine/editor (spec 1.2, 5).

export const PROFILE_ID = 'kayros-current-adapted' as const

export const REFERENCE_COMMITS = {
  os: '826b73258ab93ea80e347c5fb9a9501bc7791372',
  engine: 'b1f69987406fc6714068ba5106ef50dea00f9f3d',
  broker: '4b5f67612e6001ff0f5793d6259cf8df55cd23d1',
} as const

/** Tipos de bloco que o perfil pode emitir (amostras Kayros + spec 5.3). */
export const SUPPORTED_BLOCK_TYPES = [
  'whatsapp-cloud',
  'database',
  'kayros-tools',
  'Set variable',
  'Condition',
  'Jump',
  'Typebot link',
  'Webhook',
  'Code',
  'Wait',
  'transferToQueue',
  'journeyEvent',
  'askAgent',
  'classifyReply',
  'Return',
  'AbTest',
  'pauseSession',
  'endSession',
] as const

export type SupportedBlockType = (typeof SUPPORTED_BLOCK_TYPES)[number]

/** Precedencia de eventos (spec 5.3): o primeiro vence. */
export const EVENT_PRECEDENCE = [
  'followUp',
  'command',
  'offensive',
  'invalidReply',
  'reply',
] as const

export const EVENT_TYPES = ['start', ...EVENT_PRECEDENCE] as const

/** Limites do destino usados pelos validadores (spec 5.5, 6.2, 7.2, 7.3, 7.4, 7.5). */
export const TARGET_LIMITS = {
  buttonsMax: 3,
  buttonTitleMax: 20,
  listItemsMax: 10,
  listTitleMax: 24,
  regexMaxLength: 500,
  regexTimeoutMs: 50,
  codeTimeoutMs: 10_000,
  apiResponseMaxChars: 48_000,
  importMaxBodyBytes: 10 * 1024 * 1024,
  importMaxBots: 30,
  resourceCacheSeconds: 30,
  /** Tetos por passada do motor (config do bot-engine): excedeu, a sessao e encerrada. */
  passMaxOutbound: 15,
  passMaxExternalCalls: 30,
  passMaxBotHops: 50,
  passDeadlineMs: 25_000,
} as const

export const WHATSAPP_CHANNEL = 'whatsapp' as const

/** Os 13 bots tecnicos do lote de referencia (Tarefas.md, F5). */
export const KNOWN_BOTS = [
  'bkovivofixamsgativaah',
  'fibrasubida17',
  'vivofixaabandonomsgatah',
  'vivofixadados',
  'vivofixawhatsapp',
  'vivoiptveitvplanos',
  'vivoiptvwpp',
  'vivoitvah',
  'vivoitvplanos',
  'vivosegurocelular',
  'vivoseguros',
  'vivototaldados',
  'vivototalplanoswppnovo',
] as const
