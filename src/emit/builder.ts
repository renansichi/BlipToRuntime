import { stableId } from './ids.js'

// Construtor do nucleo executavel (F2-03): groups, blocks, edges, events,
// variables. Todo link cria a aresta E grava o ponteiro outgoingEdgeId na
// origem (bloco, item ou evento), mantendo os dois sincronizados (spec 5.2).

export interface KBlock {
  id: string
  type: string
  options?: Record<string, unknown>
  items?: KItem[]
  outgoingEdgeId?: string
}
export interface KItem {
  id: string
  content?: unknown
  outgoingEdgeId?: string
}
export interface KGroup {
  id: string
  title: string
  graphCoordinates: { x: number; y: number }
  blocks: KBlock[]
}
export interface KEdge {
  id: string
  from: { blockId?: string; itemId?: string; eventId?: string }
  to: { groupId: string; blockId?: string }
}
export interface KEvent {
  id: string
  type: string
  outgoingEdgeId?: string
  options?: Record<string, unknown>
  graphCoordinates: { x: number; y: number }
}
export interface KVariable {
  id: string
  name: string
  isSessionVariable: true
}

export type LinkFrom =
  | { kind: 'block'; block: KBlock }
  | { kind: 'item'; block: KBlock; item: KItem }
  | { kind: 'event'; event: KEvent }
  /** Item embutido em options (botoes/linhas de lista): grava `outgoingEdgeId` no objeto dado. */
  | { kind: 'optionItem'; block: KBlock; holder: { id: string; outgoingEdgeId?: string } }

export class DocBuilder {
  readonly groups: KGroup[] = []
  readonly edges: KEdge[] = []
  readonly events: KEvent[] = []
  private readonly vars = new Map<string, KVariable>()
  private readonly keys = new Set<string>()
  private col = 0
  private row = 0

  constructor(readonly namespace: string) {}

  /** Id estavel para uma chave logica; chaves repetidas sao erro de programacao. */
  id(key: string): string {
    return stableId(this.namespace, key)
  }

  private claim(key: string): string {
    if (this.keys.has(key)) throw new Error(`Chave logica duplicada: ${key}`)
    this.keys.add(key)
    return this.id(key)
  }

  variable(name: string): KVariable {
    let v = this.vars.get(name)
    if (!v) {
      v = { id: this.id(`var:${name}`), name, isSessionVariable: true }
      this.vars.set(name, v)
    }
    return v
  }

  hasVariable(name: string): boolean {
    return this.vars.has(name)
  }

  variableList(): KVariable[] {
    return [...this.vars.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  group(key: string, title: string): KGroup {
    const g: KGroup = {
      id: this.claim(`group:${key}`),
      title,
      graphCoordinates: { x: this.col * 460, y: this.row * 340 },
      blocks: [],
    }
    this.col++
    if (this.col >= 6) {
      this.col = 0
      this.row++
    }
    this.groups.push(g)
    return g
  }

  block(group: KGroup, key: string, type: string, options?: Record<string, unknown>): KBlock {
    const b: KBlock = { id: this.claim(`block:${key}`), type }
    if (options !== undefined) b.options = options
    group.blocks.push(b)
    return b
  }

  /** Cria item (ramo) de um bloco Condition. */
  item(block: KBlock, key: string, content: unknown): KItem {
    const it: KItem = { id: this.claim(`item:${key}`), content }
    ;(block.items ??= []).push(it)
    return it
  }

  /** Remove o item (ramo) de um bloco Condition que ainda nao tem aresta. */
  discardItem(block: KBlock, item: KItem): void {
    block.items = (block.items ?? []).filter((i) => i !== item)
  }

  /**
   * Desfaz as arestas de bloco que chegam a `blockId` (usado ao descartar um bloco recem-criado).
   * Devolve os blocos de origem para que possam ser religados.
   */
  removeEdgesTo(blockId: string): KBlock[] {
    const sources: KBlock[] = []
    for (const e of [...this.edges]) {
      if (e.to.blockId !== blockId || e.from.blockId === undefined || e.from.itemId !== undefined) continue
      this.edges.splice(this.edges.indexOf(e), 1)
      this.keys.delete(`edge:${e.from.blockId}`)
      for (const g of this.groups) {
        const src = g.blocks.find((b) => b.id === e.from.blockId)
        if (src) {
          delete src.outgoingEdgeId
          sources.push(src)
        }
      }
    }
    return sources
  }

  event(type: string, key: string, options?: Record<string, unknown>): KEvent {
    const e: KEvent = {
      id: this.claim(`event:${key}`),
      type,
      graphCoordinates: { x: -600, y: this.events.length * 200 },
    }
    if (options) e.options = options
    this.events.push(e)
    return e
  }

  /** Liga `from` ao grupo (e bloco opcional) de destino; sincroniza o ponteiro. */
  link(from: LinkFrom, toGroup: KGroup | string, toBlock?: KBlock | string): KEdge {
    const groupId = typeof toGroup === 'string' ? toGroup : toGroup.id
    const blockId = toBlock === undefined ? undefined : typeof toBlock === 'string' ? toBlock : toBlock.id
    const holderId =
      from.kind === 'block' ? from.block.id : from.kind === 'item' ? `${from.block.id}/${from.item.id}` : from.kind === 'event' ? from.event.id : `${from.block.id}/${from.holder.id}`
    const edge: KEdge = {
      id: this.claim(`edge:${holderId}`),
      from:
        from.kind === 'block'
          ? { blockId: from.block.id }
          : from.kind === 'item'
            ? { itemId: from.item.id, blockId: from.block.id }
            : from.kind === 'event'
              ? { eventId: from.event.id }
              : { itemId: from.holder.id, blockId: from.block.id },
      to: blockId === undefined ? { groupId } : { groupId, blockId },
    }
    if (from.kind === 'block') from.block.outgoingEdgeId = edge.id
    else if (from.kind === 'item') from.item.outgoingEdgeId = edge.id
    else if (from.kind === 'event') from.event.outgoingEdgeId = edge.id
    else from.holder.outgoingEdgeId = edge.id
    this.edges.push(edge)
    return edge
  }

  document(name: string): {
    name: string
    groups: KGroup[]
    events: KEvent[]
    variables: KVariable[]
    edges: KEdge[]
  } {
    return { name, groups: this.groups, events: this.events, variables: this.variableList(), edges: this.edges }
  }
}
