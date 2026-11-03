const fs = require('fs')
const rep = (file, pairs) => {
  let t = fs.readFileSync(file, 'utf8')
  for (const [a, b] of pairs) { if (!t.includes(a)) throw new Error(`nao achei em ${file}: ${a.slice(0, 80)}`); t = t.replace(a, b) }
  fs.writeFileSync(file, t)
}
rep('test/emit.test.ts', [
  [
    "  it('ate 3 opcoes viram botoes; ids preservam value ou texto', () => {\n    const { blocks } = convert(flowWith(3))\n    const b = blocks().find((x) => x.options?.action === 'Enviar botões')!\n    expect(b.options?.buttons.map((x: any) => x.id)).toEqual(['Opcao 0', 'v1', 'v2'])\n  })",
    "  it('ate 3 opcoes viram botoes: o titulo e o texto capturado; o id e estavel e sem significado (o importador o troca)', () => {\n    const { blocks } = convert(flowWith(3))\n    const b = blocks().find((x) => x.options?.action === 'Enviar botões')!\n    expect(b.options?.buttons.map((x: any) => x.title)).toEqual(['Opcao 0', 'Opcao 1', 'Opcao 2'])\n    const ids = b.options?.buttons.map((x: any) => x.id)\n    expect(new Set(ids).size).toBe(3)\n    expect(ids.every((i: string) => /^[0-9a-f-]{36}$/.test(i))).toBe(true)\n  })",
  ],
  [
    "  it('otimizado: a condicao pula blocos dentro do mesmo grupo (sem grupos extras)', () => {\n    const ref = convert(condAction(), { optimize: false })\n    const opt = convert(condAction())",
    "  it('padrao (seguro para o importador): sem to.blockId e sem Jump', () => {\n    const { bot } = convert(condAction())\n    expect(validateImportSafety(bot.document)).toEqual([])\n    expect(bot.document.edges.every((e) => e.to.blockId === undefined)).toBe(true)\n  })\n  it('blockEdges: a condicao pula blocos dentro do mesmo grupo (sem grupos extras)', () => {\n    const ref = convert(condAction(), { optimize: false })\n    const opt = convert(condAction(), { blockEdges: true })",
  ],
  [
    "    const back = bot.document.edges.find((e) => e.id === err.outgoingEdgeId)!\n    expect(back.to.blockId).toBe(ask.id)",
    "    const back = bot.document.edges.find((e) => e.id === err.outgoingEdgeId)!\n    // O importador descarta to.blockId: a pergunta tem grupo proprio e a repeticao volta ao INICIO dele.\n    expect(back.to.blockId).toBeUndefined()\n    expect(bot.document.groups.find((g) => g.id === back.to.groupId)!.blocks[0]!.id).toBe(ask.id)",
  ],
  ["function convert(flow: Record<string, unknown>, opts: { name?: string; config?: Parameters<typeof convertAnalysis>[1] extends infer O ? O : never; globalActions?: Record<string, unknown>; optimize?: boolean } = {}) {", "function convert(flow: Record<string, unknown>, opts: { name?: string; config?: Parameters<typeof convertAnalysis>[1] extends infer O ? O : never; globalActions?: Record<string, unknown>; optimize?: boolean; blockEdges?: boolean } = {}) {"],
  ["...(opts.optimize === undefined ? {} : { optimize: opts.optimize }) } as never)", "...(opts.optimize === undefined ? {} : { optimize: opts.optimize }), ...(opts.blockEdges === undefined ? {} : { blockEdges: opts.blockEdges }) } as never)"],
  ["import { validateReferences } from '../src/validate/refs.js'", "import { validateImportSafety, validateReferences } from '../src/validate/refs.js'"],
])
rep('test/optimize.test.ts', [
  [
    "  const ref = convertAnalysis(a, { optimize: false })\n  const opt = convertAnalysis(a)\n\n  it('o otimizado e estruturalmente valido nos 13 bots e menor que a referencia', () => {\n    expect(opt.bots.every((b) => b.status === 'structurally_valid')).toBe(true)\n    for (let i = 0; i < opt.bots.length; i++) {\n      const r = ref.bots[i]!\n      const o = opt.bots[i]!\n      expect(o.stats.groups, o.name).toBeLessThan(r.stats.groups)\n      expect(o.stats.blocks, o.name).toBeLessThanOrEqual(r.stats.blocks)\n    }\n    const total = (res: typeof ref, k: 'groups' | 'blocks') => res.bots.reduce((n, b) => n + b.stats[k], 0)\n    expect(total(opt, 'groups')).toBeLessThan(total(ref, 'groups') * 0.4)\n  })",
    "  const ref = convertAnalysis(a, { optimize: false })\n  const opt = convertAnalysis(a) // padrao: seguro para o importador (sem to.blockId)\n  const inl = convertAnalysis(a, { blockEdges: true }) // opt-in: arestas para blocos\n\n  it('os dois formatos otimizados sao estruturalmente validos nos 13 bots e menores que a referencia', () => {\n    expect(opt.bots.every((b) => b.status === 'structurally_valid')).toBe(true)\n    expect(inl.bots.every((b) => b.status === 'structurally_valid')).toBe(true)\n    for (let i = 0; i < opt.bots.length; i++) {\n      const r = ref.bots[i]!\n      expect(opt.bots[i]!.stats.groups, opt.bots[i]!.name).toBeLessThanOrEqual(r.stats.groups)\n      expect(opt.bots[i]!.stats.blocks, opt.bots[i]!.name).toBeLessThanOrEqual(r.stats.blocks)\n      expect(inl.bots[i]!.stats.groups, inl.bots[i]!.name).toBeLessThan(r.stats.groups)\n    }\n    const total = (res: typeof ref, k: 'groups' | 'blocks') => res.bots.reduce((n, b) => n + b.stats[k], 0)\n    expect(total(opt, 'groups')).toBeLessThan(total(ref, 'groups'))\n    expect(total(inl, 'groups')).toBeLessThan(total(ref, 'groups') * 0.4)\n  })\n\n  it('so o formato padrao e seguro para o importador do Kayros OS', () => {\n    for (const b of opt.bots) expect(validateImportSafety(b.document), b.name).toEqual([])\n    for (const b of ref.bots) expect(validateImportSafety(b.document), b.name).toEqual([])\n    // O formato com arestas para blocos depende de to.blockId, que o importador descarta.\n    expect(inl.bots.some((b) => validateImportSafety(b.document).length > 0)).toBe(true)\n  })",
  ],
  ["import { validateReferences } from '../src/validate/refs.js'", "import { validateImportSafety, validateReferences } from '../src/validate/refs.js'"],
  [
    "    for (let i = 0; i < ref.bots.length; i++) {\n      const rb = ref.bots[i]!\n      const ob = opt.bots[i]!",
    "    for (const [label, fmt, trials] of [['seguro', opt, 2], ['blockEdges', inl, 1]] as const) {\n    for (let i = 0; i < ref.bots.length; i++) {\n      const rb = ref.bots[i]!\n      const ob = fmt.bots[i]!",
  ],
  ["        for (let trial = 0; trial < 2; trial++) {", "        for (let trial = 0; trial < trials; trial++) {"],
  [
    "            diffs.push(`${rb.name}/${s.title} #${trial}\n",
    "            diffs.push(`[${label}] ${rb.name}/${s.title} #${trial}\n",
  ],
  ["    expect(compared).toBeGreaterThan(3000)", "    expect(compared).toBeGreaterThan(4500)"],
])
console.log('ok')
