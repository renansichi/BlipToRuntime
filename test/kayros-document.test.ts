import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateKayrosDocument } from '../src/validate/index.js'

const doc = (): any => ({
  groups: [
    { id: 'g1', title: 'A', blocks: [{ id: 'b1', type: 'whatsapp-cloud', outgoingEdgeId: 'e2' }] },
    { id: 'g2', title: 'B', blocks: [{ id: 'b2', type: 'Code' }] },
  ],
  events: [{ id: 'ev1', type: 'start', outgoingEdgeId: 'e1' }],
  variables: [{ id: 'v1', name: 'cpf' }],
  edges: [
    { id: 'e1', from: { eventId: 'ev1' }, to: { groupId: 'g1' } },
    { id: 'e2', from: { blockId: 'b1' }, to: { groupId: 'g2', blockId: 'b2' } },
  ],
})

describe('validateKayrosDocument', () => {
  it('aceita documento minimo coerente', () => {
    expect(validateKayrosDocument(doc())).toEqual([])
  })

  it('exige as quatro colecoes', () => {
    const d = doc()
    delete d.edges
    expect(validateKayrosDocument(d)[0]?.code).toBe('KAYROS_STRUCTURE_INVALID')
  })

  it('rejeita id duplicado, tipo de bloco fora do perfil e destino inexistente', () => {
    const d = doc()
    d.groups[1].blocks[0].id = 'b1'
    d.groups[1].blocks[0].type = 'Espera independente'
    d.edges[1].to.groupId = 'nao-existe'
    const codes = validateKayrosDocument(d).map((x) => x.code)
    expect(codes).toContain('KAYROS_STRUCTURE_INVALID')
    expect(codes).toContain('KAYROS_BLOCK_TYPE_UNSUPPORTED')
    expect(codes).toContain('TARGET_EDGE_INVALID')
  })

  it('detecta outgoingEdgeId apontando para aresta ausente (caso da amostra de abandono)', () => {
    const d = doc()
    d.events[0].outgoingEdgeId = 'ausente'
    expect(validateKayrosDocument(d).map((x) => x.code)).toContain('TARGET_EDGE_INVALID')
  })

  it('exige evento start', () => {
    const d = doc()
    d.events = []
    d.edges = d.edges.slice(1)
    expect(validateKayrosDocument(d).length).toBeGreaterThan(0)
  })

  const samples = 'C:/Users/renan/Documents/Convert To Runtime/Extrato Kayros'
  it.skipIf(!existsSync(samples))('amostras Kayros usam apenas blocos do perfil', () => {
    for (const f of readdirSync(samples).filter((n) => n.endsWith('.json'))) {
      const out = validateKayrosDocument(JSON.parse(readFileSync(join(samples, f), 'utf8')))
      expect(out.filter((d) => d.code === 'KAYROS_BLOCK_TYPE_UNSUPPORTED'), f).toEqual([])
    }
  })
})
