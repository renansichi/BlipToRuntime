import type { KBlock } from './builder.js'

// O export do builder do Kayros omite o que esta vazio ou no padrao (analise de 03/11/2026 sobre 12 fluxos
// montados no editor: nenhum bloco de envio traz `credentialsId`). O importador aceita o campo ausente
// (teste 1) e a credencial e definida no editor depois de importar, entao o conversor nao emite
// `credentialsId: ""`.

interface Doc {
  groups: { blocks: KBlock[] }[]
}

export interface DefaultsStats {
  /** Blocos de envio cujo `credentialsId` vazio foi omitido. */
  credentialsOmitted: number
}

export function omitEmptyDefaults(doc: Doc): DefaultsStats {
  const stats: DefaultsStats = { credentialsOmitted: 0 }
  for (const g of doc.groups) {
    for (const b of g.blocks) {
      if (b.type !== 'whatsapp-cloud' || !b.options) continue
      const o = b.options as Record<string, unknown>
      if (o.credentialsId === '') {
        delete o.credentialsId
        stats.credentialsOmitted++
      }
    }
  }
  return stats
}
