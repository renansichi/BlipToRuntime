import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { omitEmptyDefaults } from '../src/emit/defaults.js'
import { slimDocument } from '../src/optimize/slim.js'
import { validateKayrosDocument } from '../src/profile/validate-document.js'
import { validateImportSafety } from '../src/validate/refs.js'

// Fluxos montados a mao no builder do Goatable (exportados em 03/11/2026): o que o editor grava tem de passar
// nos validadores do conversor, e as regras do conversor que dependem desse formato ficam travadas aqui.

const dir = fileURLToPath(new URL('../scenarios/builder-goatable/exports/', import.meta.url))
const files = readdirSync(dir).filter((f) => f.endsWith('.json'))
const load = (f: string) => JSON.parse(readFileSync(dir + f, 'utf8'))

describe('exports do builder', () => {
  it('ha os 12 fluxos exportados', () => expect(files.length).toBe(12))

  it.each(files)('%s passa no validador de estrutura e e seguro para o importador', (f) => {
    const d = load(f)
    expect(validateKayrosDocument(d)).toEqual([])
    expect(validateImportSafety(d)).toEqual([])
  })

  it('o builder nao grava credentialsId nos blocos de envio', () => {
    for (const f of files) {
      for (const g of load(f).groups) for (const b of g.blocks) if (b.type === 'whatsapp-cloud') expect('credentialsId' in b.options).toBe(false)
    }
  })

  it('a saida "Fora do horario" da fila e uma aresta do bloco apontada por options.outOfHoursEdgeId', () => {
    const d = load('vivo-abandono-msgat-ah-manual.json')
    const tq = d.groups.flatMap((g: { blocks: { type: string; id: string; options: { outOfHoursEdgeId?: string } }[] }) => g.blocks).find((b: { type: string }) => b.type === 'transferToQueue')
    const edge = d.edges.find((e: { id: string }) => e.id === tq.options.outOfHoursEdgeId)
    expect(edge.from).toEqual({ blockId: tq.id })
    expect(tq.outgoingEdgeId).toBeUndefined()
  })
})

describe('omitEmptyDefaults', () => {
  const doc = () => ({
    groups: [
      {
        blocks: [
          { id: 'a', type: 'whatsapp-cloud', options: { action: 'Enviar texto', credentialsId: '', body: 'oi' } },
          { id: 'b', type: 'whatsapp-cloud', options: { action: 'Enviar texto', credentialsId: 'cred-1', body: 'oi' } },
          { id: 'c', type: 'endSession', options: { credentialsId: '' } },
        ],
      },
    ],
  })

  it('remove credentialsId vazio dos blocos de envio e conta', () => {
    const d = doc()
    expect(omitEmptyDefaults(d as never)).toEqual({ credentialsOmitted: 1 })
    expect('credentialsId' in (d.groups[0]!.blocks[0]!.options as object)).toBe(false)
  })

  it('mantem credencial preenchida e nao mexe em outros tipos de bloco', () => {
    const d = doc()
    omitEmptyDefaults(d as never)
    expect((d.groups[0]!.blocks[1]!.options as { credentialsId: string }).credentialsId).toBe('cred-1')
    expect((d.groups[0]!.blocks[2]!.options as { credentialsId: string }).credentialsId).toBe('')
  })
})

describe('transferToQueue com saida "Fora do horario"', () => {
  const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
  const q = '026bb49c-fcd2-4544-bcc8-b35b9bbc535a'
  const mk = (edgeFrom: string) =>
    ({
      groups: [
        { id: U(1), title: 'Transfere', graphCoordinates: { x: 0, y: 0 }, blocks: [{ id: U(2), type: 'transferToQueue', options: { queueId: q, outOfHoursEdgeId: U(10) } }] },
        { id: U(3), title: 'Fora do horario', graphCoordinates: { x: 0, y: 0 }, blocks: [{ id: U(4), type: 'endSession', options: {} }] },
      ],
      events: [{ id: U(5), type: 'start', outgoingEdgeId: U(11), graphCoordinates: { x: 0, y: 0 } }],
      variables: [],
      edges: [
        { id: U(11), from: { eventId: U(5) }, to: { groupId: U(1) } },
        { id: U(10), from: { blockId: edgeFrom }, to: { groupId: U(3) } },
      ],
    }) as never

  it('valido quando a aresta parte do proprio bloco', () => expect(validateKayrosDocument(mk(U(2)))).toEqual([]))

  it('invalido quando a aresta de "Fora do horario" parte de outro bloco', () => {
    const r = validateKayrosDocument(mk(U(4)))
    expect(r.some((x) => x.code === 'TARGET_EDGE_INVALID')).toBe(true)
  })

  it('o enxugamento mantem o grupo alcancavel so por essa saida', () => {
    const d = mk(U(2)) as unknown as Parameters<typeof slimDocument>[0]
    const st = slimDocument(d)
    expect(st.groupsRemoved).toBe(0)
    expect(d.groups.length).toBe(2)
  })
})
