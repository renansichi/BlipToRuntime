import type { AdaptationRegistry } from '../adapt/registry.js'
import type { SourceRef } from '../analysis/types.js'
import type { Diagnostic, DiagnosticCode } from '../diagnostics.js'
import { diagnostic } from '../diagnostics.js'
import type { DocBuilder } from './builder.js'
import type { ConverterConfig } from '../config/schema.js'

export interface EmitDiagnostic extends Diagnostic {
  bot: string
  stateId?: string
  jsonPointer: string
}

export interface SecretExtraction {
  bot: string
  resourceKey: string
  source: { file: string; jsonPointer: string }
}

export interface SourceMapEntry {
  source: { bot: string; file: string; stateId?: string; jsonPointer: string; phase: string }
  target: { groupKeys: string[]; blockKeys: string[] }
  transformation: string
  adaptationIds: string[]
}

/** Estado compartilhado da emissao de UM bot. */
export class EmitCtx {
  readonly diags: EmitDiagnostic[] = []
  readonly secrets: SecretExtraction[] = []
  readonly sourceMap: SourceMapEntry[] = []
  /** Variaveis usadas em saidas dinamicas com destinos de fallback. */
  constructor(
    readonly bot: string,
    readonly file: string,
    readonly b: DocBuilder,
    readonly adapt: AdaptationRegistry,
    readonly config: ConverterConfig | undefined,
    /** Campos de contato escritos aqui e lidos por nenhum bot do pacote. */
    readonly writeOnlyKeys: ReadonlySet<string> = new Set(),
    /** Descartar essas escritas (decisao aceita na configuracao). */
    readonly discardWriteOnly = false,
    /** Otimizacoes de estrutura (F4); desligadas, gera o formato de referencia da F2. */
    readonly optimize = true,
    /**
     * Arestas que miram um bloco dentro do grupo (to.blockId). O importador do Kayros OS
     * (importFlow) descarta esse campo, entao o padrao e FALSO: so arestas para grupos.
     */
    readonly blockEdges = false,
  ) {}

  /** Credencial WhatsApp dos blocos de envio (da configuracao; vazia = a definir no Kayros). */
  get credentialsId(): string {
    return this.config?.target.whatsappCredentialsId ?? ''
  }

  warn(code: DiagnosticCode, message: string, at: SourceRef | { jsonPointer: string; stateId?: string }): void {
    const d: EmitDiagnostic = {
      ...diagnostic(code, message, `${this.file}#${at.jsonPointer}`),
      bot: this.bot,
      jsonPointer: at.jsonPointer,
    }
    if (at.stateId !== undefined) d.stateId = at.stateId
    this.diags.push(d)
  }

  map(
    at: SourceRef,
    transformation: string,
    target: { groupKeys: string[]; blockKeys: string[] },
    adaptationIds: string[] = [],
  ): void {
    const source: SourceMapEntry['source'] = { bot: this.bot, file: this.file, jsonPointer: at.jsonPointer, phase: at.phase }
    if (at.stateId !== undefined) source.stateId = at.stateId
    this.sourceMap.push({ source, target, transformation, adaptationIds })
  }
}
