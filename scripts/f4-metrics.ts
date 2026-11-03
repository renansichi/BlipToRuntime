import { writeFileSync } from 'node:fs'
import { analyzePackage } from '../src/analysis/analyze.js'
import { convertAnalysis, type ConvertedBot } from '../src/emit/convert.js'
import { CONVERTER_VERSION } from '../src/emit/convert.js'

// Metricas antes/depois da F4 (F4-07). Uso: npx tsx scripts/f4-metrics.ts <pacote>
// "Antes" = formato de referencia da F2 (--no-optimize); "depois" = otimizado.

const pkg = process.argv[2]
if (!pkg) throw new Error('Informe o pacote.')
const a = analyzePackage(pkg)
const ref = convertAnalysis(a, { optimize: false })
const opt = convertAnalysis(a) // padrao: seguro para o importador do Kayros OS
const inl = convertAnalysis(a, { blockEdges: true }) // opt-in: arestas para blocos (nao sobrevive ao importador)

const types = (b: ConvertedBot) => {
  const m: Record<string, number> = {}
  for (const g of b.document.groups) for (const k of g.blocks) m[k.type] = (m[k.type] ?? 0) + 1
  return m
}
const scriptCodes = (b: ConvertedBot) =>
  b.document.groups.flatMap((g) => g.blocks).filter((k) => k.type === 'Code' && (k.options as { name?: string }).name !== 'gerado').length
const bytes = (b: ConvertedBot) => Buffer.byteLength(JSON.stringify(b.document))
const pct = (x: number, y: number) => (x === 0 ? '—' : `${(((y - x) / x) * 100).toFixed(0)}%`)
const n = (x: number) => x.toLocaleString('pt-BR')

const rows: string[] = []
const tot = { gi: 0, bi: 0, g0: 0, g1: 0, b0: 0, b1: 0, c0: 0, c1: 0, y0: 0, y1: 0, e0: 0, e1: 0 }
for (let i = 0; i < ref.bots.length; i++) {
  const r = ref.bots[i] as ConvertedBot
  const o = opt.bots[i] as ConvertedBot
  const l = inl.bots[i] as ConvertedBot
  const tr = types(r)
  const to = types(o)
  // Efeitos por execucao que nao podem mudar: mensagens, chamadas e eventos.
  for (const k of ['whatsapp-cloud', 'Webhook', 'journeyEvent', 'Typebot link', 'transferToQueue']) {
    if ((tr[k] ?? 0) !== (to[k] ?? 0)) throw new Error(`${r.name}: quantidade de ${k} mudou (${tr[k]} -> ${to[k]})`)
  }
  const c0 = tr.Code ?? 0
  const c1 = to.Code ?? 0
  tot.g0 += r.stats.groups; tot.g1 += o.stats.groups; tot.gi += l.stats.groups; tot.bi += l.stats.blocks
  tot.b0 += r.stats.blocks; tot.b1 += o.stats.blocks
  tot.c0 += c0; tot.c1 += c1
  tot.y0 += bytes(r); tot.y1 += bytes(o)
  tot.e0 += r.stats.edges; tot.e1 += o.stats.edges
  rows.push(
    `| ${r.name} | ${r.stats.states} | ${n(r.stats.groups)} → ${n(o.stats.groups)} (${pct(r.stats.groups, o.stats.groups)}) · com blockEdges ${n(l.stats.groups)} (${pct(r.stats.groups, l.stats.groups)}) | ${n(r.stats.blocks)} → ${n(o.stats.blocks)} (${pct(r.stats.blocks, o.stats.blocks)}) | ${n(c0)} → ${n(c1)} | ${n(scriptCodes(o))} | ${n(Math.round(bytes(r) / 1024))} → ${n(Math.round(bytes(o) / 1024))} KB (${pct(bytes(r), bytes(o))}) |`,
  )
}

const md = [
  '# Métricas da F4 — antes × depois',
  '',
  `Conversor ${CONVERTER_VERSION} · origem ${a.pkg.runId}. “Antes” é o formato de referência da F2 (\`convert --no-optimize\`); “depois” é o otimizado **seguro para o importador** (padrão). “com blockEdges” é o otimizado que usa arestas para blocos dentro do grupo (\`--block-edges\`).`,
  '',
  '> **Atenção (descoberta na preparação da importação):** o importador do Kayros OS (`importFlow` → `regenerate-bot-structure.ts`) grava as arestas só com `to.groupId` e **descarta `to.blockId`**, e não remapeia os ids de um bloco `Jump`. O formato “com blockEdges” depende de `to.blockId`; depois de importado ele se comporta diferente (teste `test/import.test.ts`). Por isso o padrão é o formato seguro, com ganho bem menor de grupos. O ganho maior só vale se o importador passar a preservar `to.blockId` (correção no Kayros OS, que este projeto não altera) ou se o JSON for gravado por outro caminho.',
  '',
  'O que **não** muda (verificado em cada execução deste script e no teste diferencial): a quantidade de mensagens (`whatsapp-cloud`), chamadas (`Webhook`), eventos (`journeyEvent`), links entre bots e transferências. O que muda é a estrutura que os envolve (grupos, arestas, blocos de apoio).',
  '',
  '| Bot | Estados | Grupos | Blocos | Code (todos) | Code de script de origem | Tamanho do JSON |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...rows,
  `| **Total** | ${n(a.inventory.totals.states)} | **${n(tot.g0)} → ${n(tot.g1)} (${pct(tot.g0, tot.g1)})** · com blockEdges ${n(tot.gi)} (${pct(tot.g0, tot.gi)}) | ${n(tot.b0)} → ${n(tot.b1)} (${pct(tot.b0, tot.b1)}) | ${n(tot.c0)} → ${n(tot.c1)} (${pct(tot.c0, tot.c1)}) | — | ${n(Math.round(tot.y0 / 1024))} → ${n(Math.round(tot.y1 / 1024))} KB (${pct(tot.y0, tot.y1)}) |`,
  '',
  '## Leitura',
  '',
  `- **Grupos por estado**: referência ${(tot.g0 / a.inventory.totals.states).toFixed(1)}; formato seguro ${(tot.g1 / a.inventory.totals.states).toFixed(1)}; com blockEdges ${(tot.gi / a.inventory.totals.states).toFixed(1)}. No formato seguro cada corrida de ações com a mesma condição ainda custa 2 grupos (corpo e continuação), porque a aresta só pode apontar para um grupo; com blockEdges a Condition salta blocos dentro do mesmo grupo. O que sobra além disso são roteadores de destino calculado, o roteador de timeout e perguntas com validação.`,
  '- **Blocos** caem pouco: a maior parte são scripts de origem (`Code`), mensagens, Webhooks, eventos e `Set variable`, que representam efeitos de negócio e não podem ser fundidos.',
  '- **Code de apoio** (normalizações de caixa/acento, materializações de `obj@campo`, booleanos) cai pela remoção de repetições e pela fusão de Codes adjacentes independentes.',
  '',
  '## Regras de otimização e suas pré-condições',
  '',
  '| Regra | Pré-condição | Não faz |',
  '| --- | --- | --- |',
  '| Ação condicional inline (só `--block-edges`) | A `Condition` salta blocos dentro do mesmo grupo (`to.blockId`); corpo que **termina a conversa** continua isolado | Não é seguro para o importador do Kayros OS |',
  '| Fusão de ações consecutivas com a mesma condição | Mesmas condições, nenhuma ação anterior da corrida escreve variável lida pela condição, ação não terminal | Não reordena ações |',
  '| Descarte de ação toda descartada | Só com adaptação **aceita** (`merge-contact-write-only-discard`) | Não descarta sem aceite |',
  '| Dedupe de derivadas (`__eq_*`, `__ci_*`, `__dec_*`, `mat_*`) | Mesma linha já calculada, origem não reescrita, sem entrada alternativa que quebre a garantia (fluxo de dados por grupo); `mat_rnd_*` (sorteio) nunca | Não toca em scripts de origem |',
  '| Fusão de Codes gerados adjacentes | O segundo não lê variável que o primeiro escreve (o Code lê um retrato na entrada) e não é destino de aresta | Não funde scripts de origem |',
  '',
  'Prova de equivalência: `test/optimize.test.ts` executa referência e otimizado em **todos os estados dos 13 bots**, com entradas, variáveis e respostas HTTP pseudo-aleatórias determinísticas, e compara mensagens, chamadas, eventos, links, variáveis finais, trilha de estados e fim. Um teste de sensibilidade confirma que remover blocos do otimizado é detectado.',
  '',
  '## Tamanho para importação',
  '',
  'O pacote inteiro (13 bots) tem ~15,5 MB, acima do corpo de 10 MiB aceito por requisição de importação (spec 6.2). Cada bot isolado tem de ~90 KB a ~2,4 MB: importe **bot a bot**.',
  '',
].join('\n')
writeFileSync('docs/f4-metricas.md', md)
console.log(md.split('\n').slice(0, 24).join('\n'))
