import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { analyzePackage } from '../src/analysis/analyze.js'
import { validateConfig } from '../src/config/load.js'
import { convertAnalysis, writeConversion } from '../src/emit/convert.js'
import { slimDocument } from '../src/optimize/slim.js'
import { validateKayrosDocument } from '../src/profile/validate-document.js'
import { validateImportSafety, validateReferences } from '../src/validate/refs.js'

// Gera o pacote de IMPORTACAO MANUAL do piloto (F3-08) em piloto-import/:
//  - o bot vivofixadados completo (o que iria para producao, apos aceite);
//  - 3 variantes de TESTE que comecam no trecho do piloto (CPF, abandono, formulario);
//  - LEIA-ME.md (passo a passo), recursos a criar, roteiro de homologacao e modelo de evidencias.
// Uso: npx tsx scripts/build-pilot-package.ts <pacote>

const pkg = process.argv[2]
if (!pkg) throw new Error('Informe o pacote.')
const BOT = 'vivofixadados'
const OUT = 'piloto-import'
const cfgRes = validateConfig(JSON.parse(readFileSync('config/piloto.config.json', 'utf8')))
if (!cfgRes.config) throw new Error('config/piloto.config.json invalida')
const cfg = cfgRes.config

const a = analyzePackage(pkg)
const common = { tipoPessoa: 'Pessoa Fisica', idAbandono: '@state:Direciona_Abandono' }
const entries = [
  { bot: BOT, stateTitle: 'CPF', presets: { ...common } },
  { bot: BOT, stateTitle: 'Abandono CPF', presets: { ...common, 'tunnel.owner': 'teste', identificadorPedido: '123456', abandono2D: '@state:Abandono Geral 2D' } },
  { bot: BOT, stateTitle: 'Flows Email, CPF e Vencimento', presets: { ...common, flowsDadosPessoais: 'ID_DO_FLOW_DE_TESTE', cpf: '52998224725' } },
]
const res = convertAnalysis(a, { onlyBots: [BOT], config: cfg, testEntries: entries, prune: true, mergeSetVariables: true })
mkdirSync(OUT, { recursive: true })
const written = writeConversion(res, OUT, cfg)

const full = res.bots.find((b) => !b.variant)!
const variants = res.bots.filter((b) => b.variant)
for (const b of res.bots) {
  const unsafe = validateImportSafety(b.document)
  if (b.status !== 'structurally_valid' || unsafe.length) throw new Error(`${b.name}/${b.variant ?? 'completo'} nao esta pronto para importar.`)
}

// ---- Variantes ENXUTAS dos testes: so os grupos alcancaveis da entrada, sem variaveis sem leitor, ids curtos ----
const lean: { variant: string; file: string; groups: number; bytes: number }[] = []
for (const b of variants) {
  const doc = structuredClone(b.document)
  const st = slimDocument(doc, b.pruneOptions)
  const bad = [...validateKayrosDocument(doc), ...validateReferences(doc), ...validateImportSafety(doc)]
  if (bad.length) throw new Error(`Variante enxuta ${b.variant} invalida: ${bad[0]?.message}`)
  const file = `flows/kayros-current-adapted/${BOT}.teste-${b.variant}.enxuto.json`
  const text = `${JSON.stringify(doc)}
`
  writeFileSync(`${OUT}/${file}`, text)
  lean.push({ variant: b.variant as string, file, groups: doc.groups.length, bytes: Buffer.byteLength(text) })
  console.log(`enxuto ${b.variant}: ${doc.groups.length}/${b.document.groups.length} grupos, ${st.setBlocksRemoved} Set variable e ${st.variablesRemoved} variaveis a menos, ${st.idsShortened} ids curtos, ${Buffer.byteLength(text)} bytes`)
}

// ---- Recursos a criar (chaves {{resource.X}} usadas no bot completo) ----
const text = JSON.stringify(full.document)
const used = new Map<string, number>()
for (const m of text.matchAll(/\{\{resource\.([^{}]+)\}\}/g)) used.set(m[1] as string, (used.get(m[1] as string) ?? 0) + 1)
const configRows = new Map(cfg.bindings.resources.filter((r) => r.bot === BOT).map((r) => [r.targetResourceKey, r]))
const secretExtracted = new Set(full.secrets.map((s) => s.resourceKey))
const mk = (s: string) => s.replaceAll('|', '\\|')
const resRows = [...used]
  .sort(([x], [y]) => x.localeCompare(y))
  .map(([key, n]) => {
    const c = configRows.get(key)
    const kind = secretExtracted.has(key) ? 'SECRETO (literal removido do fluxo)' : c?.isSecret ? 'SECRETO (nome indica segredo)' : c ? 'comum' : key.startsWith('blip.link.') ? 'link entre bots (id do bot de destino)' : key.startsWith('blip.ext.') ? 'recurso externo da Blip (nao exportado)' : 'a confirmar'
    const where = c
      ? `${c.source.file} → chave \`${c.sourceKey}\``
      : secretExtracted.has(key)
        ? 'Valor literal escrito no corpo/cabecalho de um ProcessHttp do fluxo original (veja `secrets-to-fill.json`)'
        : key.startsWith('blip.link.')
          ? 'Id do bot de destino no Kayros (ver `docs/f5/aliases-para-preencher.md`)'
          : '—'
    return `| \`${key}\` | ${kind} | ${n} | ${mk(where)} |`
  })

// ---- Roteiro de homologacao (cenarios confirmados) ----
const sc1 = JSON.parse(readFileSync('scenarios/vivofixadados.piloto.json', 'utf8')).scenarios as { id: string; title: string; startAt?: string; input: unknown[]; expect: { groups?: string[]; messages?: string[]; http?: string[][]; end?: string } }[]
const sc2 = (JSON.parse(readFileSync('scenarios/formulario-atendimento.json', 'utf8')).files as { bot: string; scenarios: typeof sc1 }[]).filter((f) => f.bot === BOT).flatMap((f) => f.scenarios)
const stepTxt = (x: unknown) => (typeof x === 'string' ? `enviar “${x}”` : (x as { timeout?: boolean }).timeout ? 'não responder até o prazo' : 'concluir o formulário (Flow)')
const variantOf = (t?: string) => (t === 'CPF' ? 'teste-cpf' : t === 'Abandono CPF' ? 'teste-abandono-cpf' : t?.startsWith('Flows') ? 'teste-flows-email-cpf-e-vencimento' : '—')
const how = (s: (typeof sc1)[number]) =>
  s.id === 'P-04' ? 'Forçar status 500 na API de dados pessoais (ambiente de teste/mock)' : s.id.startsWith('P-05') ? 'Forçar resposta 200 com isValid=false / data=null (mock)' : s.id === 'P-03' ? 'Responder um texto sem dígitos' : s.id.startsWith('P-08') ? 'Variável tipoPessoa = EMPRESA (já no preset do teste: alterar o preset)' : s.id === 'P-02' ? 'CPF inválido, depois CPF válido' : 'CPF válido de teste'
const rot = [...sc1, ...sc2].map(
  (s) => `| ${s.id} | ${mk(s.title)} | \`${variantOf(s.startAt)}\` | ${s.input.map(stepTxt).join(' → ')} | ${mk(how(s))} | ${mk((s.expect.groups ?? []).join(' → '))}${s.expect.messages?.length ? ` · mensagem: “${mk(s.expect.messages.join(' / '))}”` : ''} |  |  |`,
)

const fileOf = (variant?: string) => `flows/kayros-current-adapted/${BOT}${variant ? `.teste-${variant}` : ''}.json`
const md = `# Importação manual do piloto — ${BOT}

Gerado por \`scripts/build-pilot-package.ts\` (conversor ${'0.4.0'}). **Nada aqui foi importado, publicado ou testado num Kayros.** Estas etapas são suas (decisão Q11: sem instalador automático).

## 1. O que há na pasta

| Arquivo | Para quê |
| --- | --- |
| \`${fileOf()}\` | O bot completo (${full.stats.groups} grupos, ${full.stats.blocks} blocos). É o que iria para produção, **só depois do aceite** |
| ${variants.map((v) => `\`${fileOf(v.variant)}\``).join('<br>')} | Variantes de **teste**: o mesmo bot, mas a conversa já **começa** no trecho (CPF, abandono, formulário), depois de gravar variáveis de teste. Evita atravessar o início do fluxo na homologação |
| ${lean.map((l) => `\`${l.file}\` (${Math.round(l.bytes / 1024)} KB, ${l.groups} grupos)`).join('<br>')} | **Versões enxutas dos testes** (para importar primeiro). Mesmo comportamento a partir da entrada de teste, mas só com os grupos alcançáveis dela, sem gravações de variáveis que ninguém lê e com ids curtos (o importador regenera todos os ids). Texto e valores não mudam |
| \`secrets-to-fill.json\` | Recursos secretos a criar (sem valores) |
| \`entry-parameters.json\` | Campos que o bot lê e ninguém no pacote escreve (parâmetros de entrada) |
| \`adaptations.json\`, \`mapping.json\`, \`diagnostics.json\`, \`coverage.json\`, \`passes.json\` | Rastreabilidade e relatórios |
| \`manual-import-map.json\` | Matriz a preencher (ids gerados × importados) |
| \`homologacao-resultados.md\` | Modelo para registrar as evidências |

Os JSONs são **seguros para o importador do Kayros OS**: sem \`to.blockId\` nas arestas e sem bloco \`Jump\` (o importador descarta o primeiro e não remapeia o segundo).

## 2. Antes de importar

1. **Recursos** (Kayros OS): crie as chaves abaixo (os valores **não** estão no pacote; copie do Blip). Segredos como Recurso **secreto**.
2. **Credencial WhatsApp**: os blocos de envio saem sem \`credentialsId\` (o builder também não grava o campo vazio). Isso é o esperado: depois de importar, defina a credencial **no editor do Kayros**, em cada bloco de envio (ou pelo mecanismo de configuração da plataforma). O pacote não depende de nenhum id de credencial.
3. **Fila de atendimento**: sem fila configurada, o atendimento usa o aviso aceito e encerra (não afeta o recorte CPF).

### Recursos usados no bot

| Chave do Recurso | Tipo | Usos | De onde vem o valor |
| --- | --- | ---: | --- |
${resRows.join('\n')}

## 3. Importar (um arquivo por vez)

1. No Kayros OS, **Fluxos → Importar** e escolha o JSON. O fluxo entra como rascunho com o nome “… (importado)”.
2. Importe primeiro a **versão enxuta** do teste (ex.: \`.teste-cpf.enxuto\`). Se ela se comportar, importe as demais e, por último, o completo. Se o Kayros recusar o arquivo por tamanho ou ids, a recusa vem da importação, não do conteúdo: avise com a mensagem.
3. **Exporte o rascunho importado** e confira:

\`\`\`bash
npm run verify -- <exportado.json> --against ${OUT}/${lean[0]?.file ?? fileOf('cpf')}
\`\`\`

   O comando valida a estrutura e compara, grupo a grupo, tipos de bloco, conteúdo (sem ids) e destinos. Variáveis extras de sessão que o importador injeta são esperadas.
4. **Typebot link**: o id de destino sai como \`{{resource.blip.link.<alias>}}\` (ou o id da configuração). Crie esses Recursos com o **id interno** do bot de destino (não o publicId) — veja \`docs/f5/aliases-para-preencher.md\`. Para o roteiro abaixo, os links só importam no abandono e no fim do fluxo.
5. Registre ids gerados × importados × publicId em \`manual-import-map.json\`.

## 4. Homologação (F3-09)

Publique **somente a variante de teste** em um número/canal de teste e execute o roteiro. Para cada linha, registre o resultado em \`homologacao-resultados.md\` e guarde a evidência (print/log) em \`evidencias/\`.

| Id | Cenário confirmado | Variante | Ações do cliente | Como provocar | Esperado | Observado | Evidência |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rot.join('\n')}

**O que o roteiro não prova**: P-04/P-05 exigem forçar respostas da API (mock ou ambiente de teste); sem isso ficam como “simulado nos testes isolados”. Os prazos (25 min/60 min) levam esse tempo real — para acelerar, use o ambiente de teste com prazo reduzido (e registre que foi reduzido).

Pontos para observar na homologação (premissas ainda **não verificadas** num Kayros real):
- o clique em botão/lista segue para o próximo bloco do grupo e o texto capturado é o **título**;
- o follow-up por inatividade dispara o evento \`followUp\` depois do prazo (roteador por \`timeout_state\`);
- \`{{resource.…}}\` funciona dentro de blocos \`Code\` e em \`typebotId\`;
- \`flow_response\` chega preenchido no retorno do Flow.

## 5. Se algo não confere

Rode \`npm run verify -- <exportado.json> --against <gerado>\` e envie a saída. Reimportar gera ids novos (não é idempotente): refaça o remapeamento da matriz.
`
writeFileSync(`${OUT}/LEIA-ME.md`, md)
writeFileSync(
  `${OUT}/manual-import-map.json`,
  JSON.stringify(
    {
      schemaVersion: '2.0',
      note: 'Preencher depois de importar (F3-08). O importador regenera todos os ids.',
      rows: [{ logicalBot: BOT, variant: null }, ...variants.map((v) => ({ logicalBot: BOT, variant: `teste-${v.variant}` }))]
        .map((r) => ({ ...r, generatedFile: fileOf(r.variant?.replace('teste-', '') ?? undefined), importedBotId: null, publicId: null, exportAfterImportFile: null, status: 'not_imported' }))
        .concat(lean.map((l) => ({ logicalBot: BOT, variant: `teste-${l.variant}.enxuto`, generatedFile: l.file, importedBotId: null, publicId: null, exportAfterImportFile: null, status: 'not_imported' }))),
    },
    null,
    2,
  ) + '\n',
)
mkdirSync(`${OUT}/evidencias`, { recursive: true })
writeFileSync(`${OUT}/evidencias/.gitkeep`, '')
writeFileSync(
  `${OUT}/homologacao-resultados.md`,
  `# Resultados da homologação do piloto\n\nResponsável: Renan · Ambiente: _(preencher)_ · Data: _(preencher)_\n\n| Id | Resultado (ok / divergiu / não testado) | Observado | Evidência (arquivo em evidencias/) | Mudança de regra aceita? |\n| --- | --- | --- | --- | --- |\n${[...sc1, ...sc2].map((s) => `| ${s.id} | | | | |`).join('\n')}\n`,
)
console.log(`${OUT}: ${written.length} arquivos; bot completo ${full.stats.groups} grupos; ${variants.length} variantes de teste; ${used.size} Recursos.`)
