// Classes e codigos de diagnostico (spec 9.5). Separam parametro ausente,
// adaptacao funcional e erro tecnico do artefato.

export type DiagnosticClass =
  | 'parameter_required'
  | 'adaptation_required'
  | 'parameter_or_adaptation_required'
  | 'informational_or_acceptance_required'
  | 'technical_error'

export const DIAGNOSTIC_CODES = {
  SOURCE_CONFIG_UNRESOLVED: 'parameter_required',
  REDIRECT_ALIAS_UNRESOLVED: 'parameter_required',
  CONTEXT_TTL_DIFFERENCE: 'adaptation_required',
  CONTACT_PERSISTENCE_UNCONFIRMED: 'parameter_or_adaptation_required',
  WAIT_WITHOUT_MESSAGE: 'adaptation_required',
  BLIP_COMMAND_UNMAPPED: 'adaptation_required',
  AGENT_CONTRACT_UNVERIFIED: 'parameter_or_adaptation_required',
  FLOW_ASSET_MISSING: 'parameter_or_adaptation_required',
  DESK_CONTINUATION_DIFFERENCE: 'adaptation_required',
  TARGET_EDGE_INVALID: 'technical_error',
  PRESENTATION_CHANGED: 'informational_or_acceptance_required',
  // Contrato de configuracao (F0-05)
  CONFIG_SCHEMA_INVALID: 'technical_error',
  CONFIG_POLICY_VIOLATION: 'technical_error',
  CONFIG_SECRET_VALUE_PRESENT: 'technical_error',
  CONFIG_DUPLICATE_KEY: 'technical_error',
  CONFIG_ACCEPTANCE_INCOMPLETE: 'technical_error',
  CONFIG_PARAMETER_PENDING: 'parameter_required',
  PROFILE_MISMATCH: 'technical_error',
  // Ingestao e analise da origem (F1)
  SOURCE_ARCHIVE_UNSAFE: 'technical_error',
  SOURCE_ARCHIVE_LIMIT: 'technical_error',
  SOURCE_MANIFEST_INVALID: 'technical_error',
  SOURCE_FILE_MISSING: 'technical_error',
  SOURCE_FILE_UNLISTED: 'technical_error',
  SOURCE_SIZE_MISMATCH: 'technical_error',
  SOURCE_HASH_MISMATCH: 'technical_error',
  SOURCE_JSON_INVALID: 'technical_error',
  SOURCE_ENVELOPE_UNKNOWN: 'technical_error',
  SOURCE_BOT_MISMATCH: 'technical_error',
  SOURCE_FLOW_DIVERGES: 'technical_error',
  SOURCE_CONFIG_DIVERGES: 'technical_error',
  SOURCE_STRUCTURE_UNKNOWN: 'technical_error',
  SOURCE_LITERAL_TARGET_MISSING: 'technical_error',
  DYNAMIC_TARGET_UNRESOLVED: 'parameter_required',
  EXTERNAL_RESOURCE_UNRESOLVED: 'parameter_required',
  MERGE_CONTACT_PERSISTENCE: 'parameter_or_adaptation_required',
  INTENT_CONDITION_CUSTOM: 'parameter_or_adaptation_required',
  INPUT_VALIDATION_DECLARED: 'adaptation_required',
  GLOBAL_ACTION_PLACEMENT: 'adaptation_required',
  // Emissao (F2)
  SCRIPT_SYNTAX_INCOMPATIBLE: 'adaptation_required',
  SCRIPT_ARITY_MISMATCH: 'informational_or_acceptance_required',
  UNREACHABLE_AFTER_TERMINAL: 'informational_or_acceptance_required',
  MENU_OPTIONS_EXCEED_LIMIT: 'adaptation_required',
  INTEGRATION_CONTRACT_PENDING: 'parameter_or_adaptation_required',
  SECRET_EXTRACTED_FROM_SOURCE: 'parameter_required',
  INPUT_ENVELOPE_UNAVAILABLE: 'adaptation_required',
  PASS_BUDGET_EXCEEDED: 'adaptation_required',
  KAYROS_COVERAGE_GAP: 'technical_error',
  KAYROS_IMPORT_UNSAFE: 'technical_error',
  // Estrutura do JSON emitido
  KAYROS_STRUCTURE_INVALID: 'technical_error',
  KAYROS_REFERENCE_INVALID: 'technical_error',
  KAYROS_VARIABLE_UNDECLARED: 'technical_error',
  KAYROS_BLOCK_TYPE_UNSUPPORTED: 'technical_error',
} as const satisfies Record<string, DiagnosticClass>

export type DiagnosticCode = keyof typeof DIAGNOSTIC_CODES

export interface Diagnostic {
  code: DiagnosticCode
  class: DiagnosticClass
  message: string
  /** Caminho no documento validado (ex.: /bindings/resources/3/overrideValue). */
  pointer?: string
  /** Bot de origem, quando o diagnostico vem da analise da origem. */
  bot?: string
}

export function diagnostic(
  code: DiagnosticCode,
  message: string,
  pointer?: string,
): Diagnostic {
  return pointer === undefined
    ? { code, class: DIAGNOSTIC_CODES[code], message }
    : { code, class: DIAGNOSTIC_CODES[code], message, pointer }
}
