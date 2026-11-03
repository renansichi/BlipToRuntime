import { z } from 'zod'
import { KNOWN_BOTS, PROFILE_ID, REFERENCE_COMMITS } from '../profile/kayros-current-adapted.js'

// Contrato da configuracao revisao 2.0 (spec 16.1). Objetos que carregam
// politicas e escopo sao estritos: campo desconhecido nao pode alterar politica
// silenciosamente. Listas de bindings aceitam campos extras (localizacoes etc.).

const nullableString = z.string().nullable()
const bot = z.enum(KNOWN_BOTS)
const jsonPointer = z.string().startsWith('/')

const sourceLocation = z.looseObject({
  bot: z.string(),
  file: z.string(),
  jsonPointer,
})

const resource = z.looseObject({
  bot,
  sourceKey: z.string().min(1),
  targetResourceKey: z.string().min(1),
  type: z.string(),
  isSecret: z.boolean(),
  source: z.looseObject({ file: z.string(), jsonPointer }),
  sourceValuePresent: z.boolean(),
  overrideValue: z.string().nullable(),
  status: z.string(),
})

const missingConfiguration = z.looseObject({
  bot,
  sourceExpression: z.string().startsWith('config.'),
  targetResourceKey: z.string().min(1),
  isSecret: z.boolean(),
  value: z.string().nullable(),
  status: z.string(),
})

const externalResource = z.looseObject({
  sourceExpression: z.string().startsWith('resource.'),
  targetResourceKey: nullableString,
  value: z.string().nullable(),
  isSecret: z.boolean().nullable(),
  status: z.string(),
})

const botAlias = z.looseObject({
  sourceAddress: z.string().min(1),
  count: z.number().int().positive(),
  targetLogicalBot: z.union([bot, z.null()]),
  targetImportedBotId: nullableString,
  status: z.string(),
})

const queue = z.looseObject({
  sourceBot: bot,
  sourceStateId: z.string().min(1),
  targetQueueId: nullableString,
  businessHoursSource: nullableString,
  outOfHoursAlternative: nullableString,
  status: z.string(),
})

const whatsappFlow = z.looseObject({
  sourceExpression: z.string().min(1),
  kind: z.enum(['literal', 'expression']),
  targetResourceKey: nullableString,
  targetFlowId: nullableString,
  definitionFile: nullableString,
  endpointContractFile: nullableString,
  status: z.string(),
})

const agent = z.looseObject({
  bindingKey: z.string().min(1),
  sourceBot: bot,
  sourceProvider: z.string(),
  sourceLocations: z.array(sourceLocation),
})

const integration = z.looseObject({
  bindingKey: z.string().min(1),
  sourceBot: bot,
  method: z.string(),
  targetMode: z.string(),
  contractFile: nullableString,
  endpointResourceKey: nullableString,
  authenticationResourceKeys: z.array(z.string()),
  fallbackAdaptationId: nullableString,
  status: z.string(),
  sourceLocations: z.array(sourceLocation),
})

const acceptance = z.strictObject({
  status: z.enum(['proposed', 'accepted', 'needs_revision', 'rejected']),
  responsible: nullableString,
  date: nullableString,
  evidenceFile: nullableString,
})

export const adaptation = z.strictObject({
  id: z.string().min(1),
  sourceLocations: z.array(sourceLocation),
  journeyId: nullableString,
  originalBehavior: z.string().min(1),
  proposedBehavior: z.string().min(1),
  reason: z.string().min(1),
  kind: z.enum(['presentation', 'data', 'validation', 'integration', 'handoff', 'termination', 'wait']),
  changesBusinessBehavior: z.boolean(),
  targetStrategy: z.string().min(1),
  fallback: z.strictObject({
    kind: nullableString,
    queueBindingKey: nullableString,
    logicalFlow: nullableString,
    promptText: nullableString,
    retryPolicy: nullableString,
    endReason: nullableString,
  }),
  acceptance,
  validationScenarioIds: z.array(z.string()),
})

export const referenceScenario = z.strictObject({
  id: z.string().min(1),
  journeyId: z.string().min(1),
  status: z.enum(['draft', 'confirmed']),
  sourceEvidenceFile: nullableString,
  inputSequence: z.array(z.unknown()),
  httpFixtures: z.array(z.unknown()),
  expectedMessages: z.array(z.unknown()),
  expectedBusinessEffects: z.array(z.unknown()),
  expectedEndState: z.unknown().nullable(),
  acceptedAdaptationIds: z.array(z.string()),
  businessConfirmation: z.strictObject({ responsible: nullableString, date: nullableString }),
  homologationEvidenceFile: nullableString,
})

const sourceAsset = z.looseObject({
  id: z.string().min(1),
  filePath: nullableString,
  responsible: nullableString,
  confirmation: nullableString,
  status: z.string(),
})

const manualImportMapping = z.strictObject({
  logicalBot: bot,
  generatedBotId: nullableString,
  importedBotId: nullableString,
  publicId: nullableString,
  exportAfterImportFile: nullableString,
  status: z.string(),
})

export const configSchema = z.strictObject({
  schemaVersion: z.literal('2.0'),
  status: z.string(),
  description: z.string(),
  source: z.strictObject({
    runId: z.string().min(1),
    router: z.string().min(1),
    extractedPackagePath: z.string().min(1),
    manifestPath: z.string().min(1),
  }),
  target: z.strictObject({
    profile: z.literal(PROFILE_ID),
    referenceCommits: z.strictObject({
      os: z.literal(REFERENCE_COMMITS.os),
      engine: z.literal(REFERENCE_COMMITS.engine),
      broker: z.literal(REFERENCE_COMMITS.broker),
    }),
    channel: z.literal('whatsapp'),
    /** Id da credencial WhatsApp do Kayros usada nos blocos de envio (opcional; vazio = definir no editor). */
    whatsappCredentialsId: nullableString.optional(),
    organizationId: nullableString,
    phoneNumberId: nullableString,
    phoneName: nullableString,
    entryLogicalBot: z.union([bot, z.null()]),
  }),
  delivery: z.strictObject({
    jsonFiles: z.literal(true),
    conversionReport: z.literal(true),
    automaticInstall: z.literal(false),
    publish: z.literal(false),
    bindPhoneNumber: z.literal(false),
    manualImport: z.literal(true),
  }),
  policies: z.strictObject({
    adaptUnsupportedBehavior: z.literal(true),
    doNotDropSourcePaths: z.literal(true),
    allowFakeIntegrationSuccess: z.literal(false),
    allowKayrosCodeChanges: z.literal(false),
    nonWhatsappChannels: z.literal('remain_in_origin'),
    presentationChanges: z.literal('allow_when_result_is_preserved'),
    functionalChanges: z.literal('journey_acceptance_required'),
    businessApis: z.literal('preserve_compatible_contracts'),
    blipSpecificIntegrations: z.literal('adapt_case_by_case'),
    temporaryData: z.literal('session'),
    durableData: z.literal('existing_storage_when_confirmed'),
    ttl: z.literal('preserve_when_supported_else_declared_adaptation'),
    newExternalService: z.literal('only_after_demonstrated_need'),
    waitWithoutMessage: z.literal('remove_if_dispensable_else_contextual_question'),
    postAttendance: z.literal('separate_flow_existing_automation_else_documented_manual'),
    verification: z.literal('derived_scenarios_business_confirmation_and_available_real_traces'),
  }),
  bindings: z.strictObject({
    resources: z.array(resource),
    missingConfigurations: z.array(missingConfiguration),
    externalResources: z.array(externalResource),
    botAliases: z.array(botAlias),
    queues: z.array(queue),
    whatsappFlows: z.array(whatsappFlow),
    agents: z.array(agent),
    integrations: z.array(integration),
    persistentStorage: z.looseObject({
      kind: nullableString,
      connectionResourceKey: nullableString,
      contractFile: nullableString,
      customerKeyRule: nullableString,
      botScopeRule: nullableString,
      status: z.string(),
    }),
    postAttendance: z.looseObject({
      logicalFlow: nullableString,
      triggerIntegration: nullableString,
      manualProcedureFile: nullableString,
      status: z.string(),
    }),
    entryRouting: z.looseObject({ ruleFile: nullableString, status: z.string() }),
  }),
  /**
   * Politica de dados (opcional, revisao aditiva do contrato 2.0): campos de contato que o responsavel
   * quer MANTER mesmo quando nenhum bot do pacote os le (ex.: consumidos por Desk ou campanhas).
   */
  dataPolicy: z
    .strictObject({
      keepContactExtras: z.array(z.strictObject({ bot, key: z.string().min(1), reason: z.string().min(1) })),
    })
    .optional(),
  adaptations: z.array(adaptation),
  referenceScenarios: z.array(referenceScenario),
  manualImportMappings: z.array(manualImportMapping),
  readiness: z.strictObject({
    generationAllowedWithParameters: z.literal(true),
    activationRequiresRequiredValues: z.literal(true),
    activationRequiresFunctionalAdaptationAcceptance: z.literal(true),
    activationRequiresReferenceValidation: z.literal(true),
    notes: z.string(),
  }),
  sourceAssets: z.array(sourceAsset),
  // Modelos de preenchimento: aceitos como documentacao, nao validados como registros.
  adaptationTemplate: z.unknown().optional(),
  referenceScenarioTemplate: z.unknown().optional(),
})

export type ConverterConfig = z.infer<typeof configSchema>
