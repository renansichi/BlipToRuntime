import { readFileSync } from 'node:fs'
import { type Diagnostic, diagnostic } from '../diagnostics.js'
import { type ConverterConfig, configSchema } from './schema.js'

// Carregador e validador da configuracao (F0-05). Separa tres classes:
//   errors  -> technical_error (arquivo/contrato invalido; bloqueia o uso)
//   pending -> parameter_required (null explicito; nao bloqueia a geracao)
// Adaptacoes funcionais nao aceitas sao listadas em `unacceptedAdaptations`.

export interface ConfigResult {
  ok: boolean
  config?: ConverterConfig
  errors: Diagnostic[]
  pending: Diagnostic[]
  unacceptedAdaptations: string[]
}

export function loadConfigFile(path: string): ConfigResult {
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    return fail([diagnostic('CONFIG_SCHEMA_INVALID', `JSON invalido em ${path}: ${(e as Error).message}`)])
  }
  return validateConfig(raw)
}

function fail(errors: Diagnostic[]): ConfigResult {
  return { ok: false, errors, pending: [], unacceptedAdaptations: [] }
}

export function validateConfig(raw: unknown): ConfigResult {
  const parsed = configSchema.safeParse(raw)
  if (!parsed.success) {
    return fail(
      parsed.error.issues.map((i) =>
        diagnostic('CONFIG_SCHEMA_INVALID', i.message, '/' + i.path.join('/')),
      ),
    )
  }
  const cfg = parsed.data
  const errors: Diagnostic[] = []

  duplicates(errors, cfg.bindings.resources.map((r) => r.targetResourceKey), '/bindings/resources', 'targetResourceKey')
  duplicates(errors, cfg.bindings.botAliases.map((a) => a.sourceAddress), '/bindings/botAliases', 'sourceAddress')
  duplicates(errors, cfg.bindings.integrations.map((i) => i.bindingKey), '/bindings/integrations', 'bindingKey')
  duplicates(errors, cfg.bindings.agents.map((a) => a.bindingKey), '/bindings/agents', 'bindingKey')
  duplicates(errors, cfg.manualImportMappings.map((m) => m.logicalBot), '/manualImportMappings', 'logicalBot')
  duplicates(errors, cfg.adaptations.map((a) => a.id), '/adaptations', 'id')
  duplicates(errors, cfg.referenceScenarios.map((s) => s.id), '/referenceScenarios', 'id')

  // Segredos: o modelo nunca carrega o valor (spec 16.1).
  cfg.bindings.resources.forEach((r, i) => {
    if (r.isSecret && r.overrideValue !== null) secret(errors, `/bindings/resources/${i}/overrideValue`)
  })
  cfg.bindings.missingConfigurations.forEach((m, i) => {
    if (m.isSecret && m.value !== null) secret(errors, `/bindings/missingConfigurations/${i}/value`)
  })
  cfg.bindings.externalResources.forEach((x, i) => {
    if (x.isSecret === true && x.value !== null) secret(errors, `/bindings/externalResources/${i}/value`)
  })

  // Aceite: so vale com responsavel, data e evidencia (nunca automatico).
  const unaccepted: string[] = []
  cfg.adaptations.forEach((a, i) => {
    const acc = a.acceptance
    if (acc.status === 'accepted') {
      if (!acc.responsible || !acc.date || !acc.evidenceFile) {
        errors.push(
          diagnostic('CONFIG_ACCEPTANCE_INCOMPLETE', `Adaptacao ${a.id} aceita sem responsavel, data ou evidencia.`, `/adaptations/${i}/acceptance`),
        )
      }
    } else if (a.changesBusinessBehavior) {
      unaccepted.push(a.id)
    }
  })
  cfg.referenceScenarios.forEach((s, i) => {
    if (s.status === 'confirmed' && (!s.businessConfirmation.responsible || !s.businessConfirmation.date)) {
      errors.push(
        diagnostic('CONFIG_ACCEPTANCE_INCOMPLETE', `Cenario ${s.id} confirmado sem responsavel ou data.`, `/referenceScenarios/${i}/businessConfirmation`),
      )
    }
    if (s.status === 'confirmed' && s.expectedEndState === null) {
      errors.push(diagnostic('CONFIG_SCHEMA_INVALID', `Cenario ${s.id} confirmado sem expectedEndState.`, `/referenceScenarios/${i}/expectedEndState`))
    }
  })
  const adaptationIds = new Set(cfg.adaptations.map((a) => a.id))
  cfg.bindings.integrations.forEach((x, i) => {
    if (x.fallbackAdaptationId && !adaptationIds.has(x.fallbackAdaptationId)) {
      errors.push(diagnostic('CONFIG_SCHEMA_INVALID', `fallbackAdaptationId inexistente: ${x.fallbackAdaptationId}.`, `/bindings/integrations/${i}/fallbackAdaptationId`))
    }
  })
  cfg.referenceScenarios.forEach((s, i) =>
    s.acceptedAdaptationIds.forEach((id) => {
      if (!adaptationIds.has(id)) {
        errors.push(diagnostic('CONFIG_SCHEMA_INVALID', `acceptedAdaptationIds referencia adaptacao inexistente: ${id}.`, `/referenceScenarios/${i}/acceptedAdaptationIds`))
      }
    }),
  )

  return {
    ok: errors.length === 0,
    config: cfg,
    errors,
    pending: collectPending(cfg),
    unacceptedAdaptations: unaccepted,
  }
}

function secret(errors: Diagnostic[], pointer: string) {
  errors.push(diagnostic('CONFIG_SECRET_VALUE_PRESENT', 'Segredo nao pode ser gravado na configuracao; usar o gerenciador de Recursos do Kayros.', pointer))
}

function duplicates(errors: Diagnostic[], keys: string[], base: string, field: string) {
  const seen = new Set<string>()
  for (const k of keys) {
    if (seen.has(k)) errors.push(diagnostic('CONFIG_DUPLICATE_KEY', `${field} duplicado: ${k}.`, base))
    seen.add(k)
  }
}

/** null explicito = pendencia (spec 16.1); nunca recebe valor presumido. */
function collectPending(cfg: ConverterConfig): Diagnostic[] {
  const out: Diagnostic[] = []
  const pend = (
    code: 'SOURCE_CONFIG_UNRESOLVED' | 'REDIRECT_ALIAS_UNRESOLVED' | 'FLOW_ASSET_MISSING' | 'CONFIG_PARAMETER_PENDING' | 'CONTACT_PERSISTENCE_UNCONFIRMED' | 'AGENT_CONTRACT_UNVERIFIED' | 'DESK_CONTINUATION_DIFFERENCE',
    msg: string,
    ptr: string,
  ) => out.push(diagnostic(code, msg, ptr))

  // target.organizationId/phoneNumberId/entryLogicalBot nao sao pendencias: a
  // importacao e manual e o conversor nao associa numero (decisao de 02/11/2026).

  cfg.bindings.missingConfigurations.forEach((m, i) => {
    if (m.value === null && !m.isSecret) pend('SOURCE_CONFIG_UNRESOLVED', `${m.sourceExpression} sem valor/destino confirmado (${m.bot}).`, `/bindings/missingConfigurations/${i}`)
    if (m.isSecret) pend('SOURCE_CONFIG_UNRESOLVED', `${m.sourceExpression} e segredo: preencher no gerenciador de Recursos (${m.bot}).`, `/bindings/missingConfigurations/${i}`)
  })
  cfg.bindings.externalResources.forEach((x, i) => {
    if (x.targetResourceKey === null) pend('SOURCE_CONFIG_UNRESOLVED', `Recurso externo ${JSON.stringify(x.sourceExpression)} sem destino.`, `/bindings/externalResources/${i}`)
  })
  cfg.bindings.botAliases.forEach((a, i) => {
    if (a.targetLogicalBot === null) pend('REDIRECT_ALIAS_UNRESOLVED', `Alias ${JSON.stringify(a.sourceAddress)} (${a.count} ocorrencias) sem bot confirmado.`, `/bindings/botAliases/${i}`)
  })
  cfg.bindings.queues.forEach((q, i) => {
    if (q.targetQueueId === null) pend('DESK_CONTINUATION_DIFFERENCE', `Fila de ${q.sourceBot} (${q.sourceStateId}) sem destino.`, `/bindings/queues/${i}`)
  })
  cfg.bindings.whatsappFlows.forEach((f, i) => {
    if (f.targetFlowId === null) pend('FLOW_ASSET_MISSING', `Flow ${f.sourceExpression} sem id de destino/definicao.`, `/bindings/whatsappFlows/${i}`)
  })
  cfg.bindings.agents.forEach((a, i) => {
    if (a.targetMode === undefined || a.targetMode === null) pend('AGENT_CONTRACT_UNVERIFIED', `Agente ${a.bindingKey} sem modo de destino/contrato.`, `/bindings/agents/${i}`)
  })
  cfg.bindings.integrations.forEach((x, i) => {
    if (x.contractFile === null) pend('CONFIG_PARAMETER_PENDING', `Integracao ${x.bindingKey} sem contrato confirmado.`, `/bindings/integrations/${i}`)
  })
  if (cfg.bindings.persistentStorage.kind === null) pend('CONTACT_PERSISTENCE_UNCONFIRMED', 'Armazenamento duravel nao confirmado.', '/bindings/persistentStorage')
  if (cfg.bindings.postAttendance.logicalFlow === null) pend('DESK_CONTINUATION_DIFFERENCE', 'Fluxo de pos-atendimento nao definido.', '/bindings/postAttendance')
  if (cfg.bindings.entryRouting.ruleFile === null) pend('CONFIG_PARAMETER_PENDING', 'Regras de roteamento de entrada nao fornecidas.', '/bindings/entryRouting')
  cfg.sourceAssets.forEach((s, i) => {
    if (s.filePath === null) pend('CONFIG_PARAMETER_PENDING', `Insumo externo "${s.id}" nao fornecido.`, `/sourceAssets/${i}`)
  })
  return out
}
