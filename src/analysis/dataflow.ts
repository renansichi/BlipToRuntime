import type { BotSource } from '../ingest/package.js'
import { collectSymbols } from './symbols.js'

// Fluxo de dados entre bots (F3-03). Todos os bots do lote compartilham o mesmo
// contato na Blip; por isso "so escrito" so vale se NENHUM bot do pacote le o
// campo. Nomes com `{{` (chaves dinamicas) nunca entram como descartaveis.

export interface DataFlow {
  /** `${namespace}\0${name}` -> bots que escrevem / leem. */
  writers: Map<string, Set<string>>
  readers: Map<string, Set<string>>
}

const NS = new Set(['contact.extras', 'contact', 'context'])
const key = (ns: string, name: string): string => `${ns}\0${name}`

export function buildDataFlow(bots: BotSource[]): DataFlow {
  const writers = new Map<string, Set<string>>()
  const readers = new Map<string, Set<string>>()
  for (const bot of bots) {
    for (const u of collectSymbols(bot).uses) {
      if (!NS.has(u.namespace)) continue
      const m = u.kind === 'write' ? writers : readers
      const k = key(u.namespace, u.name)
      const s = m.get(k) ?? new Set<string>()
      s.add(bot.name)
      m.set(k, s)
    }
  }
  return { writers, readers }
}

/** Campos de contato escritos neste bot e lidos por nenhum bot do pacote. */
export function writeOnlyContactExtras(flow: DataFlow, bot: string): Set<string> {
  const out = new Set<string>()
  for (const [k, ws] of flow.writers) {
    const [ns, name] = k.split('\0') as [string, string]
    if (ns !== 'contact.extras' || !ws.has(bot) || name.includes('{{')) continue
    if ((flow.readers.get(k)?.size ?? 0) === 0) out.add(name)
  }
  return out
}

export interface EntryParameter {
  namespace: string
  name: string
  readers: string[]
  /** Bots do pacote que escrevem o campo (vazio = vem de fora do pacote). */
  writtenBy: string[]
}

/** Campos lidos em `bot` que ele proprio nunca escreve. */
export function entryParameters(flow: DataFlow, bot: string): { external: EntryParameter[]; fromChain: EntryParameter[] } {
  const external: EntryParameter[] = []
  const fromChain: EntryParameter[] = []
  for (const [k, rs] of flow.readers) {
    if (!rs.has(bot)) continue
    const [ns, name] = k.split('\0') as [string, string]
    const ws = flow.writers.get(k) ?? new Set<string>()
    if (ws.has(bot)) continue
    const p: EntryParameter = { namespace: ns, name, readers: [...rs].sort(), writtenBy: [...ws].sort() }
    ;(ws.size === 0 ? external : fromChain).push(p)
  }
  const sort = (a: EntryParameter, b: EntryParameter) => `${a.namespace}${a.name}`.localeCompare(`${b.namespace}${b.name}`)
  return { external: external.sort(sort), fromChain: fromChain.sort(sort) }
}
