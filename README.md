# blip-kayros-converter

Conversor **offline** Blip → Kayros (perfil `kayros-current-adapted`). Entrega JSONs, relatório e instruções de importação manual. **Não** instala, publica nem associa número. Não altera os projetos Goatable (somente referência de leitura).

Especificação e tarefas: `../Analise Blip Kayros/` (`ESPECIFICACAO-…md`, `Tarefas.md`). Decisões e critérios: `docs/decisoes-e-criterios.md`.

## Estado
Fases 0, 1 e 2 concluídas; F3 concluída na parte DEV (importação e homologação dependem do responsável); F4 (otimização verificável) concluída; F5 concluída na parte DEV (cobertura e orçamento por passada); pacote de importação do piloto preparado (`piloto-import/`, não importado) — ver `docs/registro-execucao.md`. Existem `analyze`, `convert`, `report` e `verify`; `package` será documentado quando existir (F6-01). A saída é um pacote **para revisão**: não homologado nem aceito.

## Comandos de desenvolvimento
```bash
npm install
npm run analyze -- <pasta-do-pacote | arquivo.7z> --out <pasta-de-saida>
npm run convert -- <pasta-do-pacote | arquivo.7z> --out <pasta-de-saida> [--config arquivo.json] [--bot nome]
npm run report  -- <pacote|.7z> --bot <nome> --out <pasta> [--state "<titulo>"]...
npm run verify  -- <pasta-ou-arquivo.json>
npm run check      # tsc --noEmit + vitest
npm run typecheck
npm test
```

## Comando `analyze`
Lê um pacote do extrator Blip (pasta com `manifesto.json` ou `.7z`), confere tamanho e SHA-256 dos arquivos do manifesto e grava em `--out`:
- `inventory.json`: estados, ações, conteúdo, inputs e saídas, cada um com arquivo e caminho JSON; totais e tabela por bot.
- `dependencies.json`: chaves de configuração (sem valores), recursos externos, aliases de Redirect, destinos dinâmicos, grafos por bot, sinais de canal.
- `diagnostics.json`: erros técnicos e achados por padrão (`parameter_required`, `adaptation_required`…).
Não executa scripts da origem, não abre rede e não altera a origem. Código de saída 1 se houver erro técnico.

## Comando `convert`
Analisa, normaliza para o modelo intermediário e emite um JSON Kayros por bot (`groups`, `blocks`, `edges`, `events`, `variables`) no perfil `kayros-current-adapted`, mais:
- `manifest.json` (hashes, versões, perfil), `coverage.json` (todo elemento da origem tem tradução ou registro) e `passes.json` (pior caso de mensagens/chamadas por passada contra os tetos do motor), `entry-parameters.json` (campos lidos e nunca escritos pelo bot: externos x herdados da cadeia), `mapping.json` (origem → destino), `adaptations.json` (propostas, todas `proposed`), `diagnostics.json`, `validation/static.json`, `secrets-to-fill.json` (chaves de Recurso secreto, sem valores) e `reports/conversion.md`.
- Com `--config`, usa aliases, filas e aceites do arquivo de configuração rev. 2.0; sem ele, tudo que depende de dados externos sai como referência configurável ou alternativa declarada.
- Falha (código 1) se a origem tiver erro técnico ou se algum bot sair com erro estrutural. Ids são estáveis: a mesma entrada gera exatamente os mesmos arquivos.

`report` gera, por bot, `esperas-<bot>.md` (esperas sem envio com a evidência para remover ou perguntar), `dados-<bot>.md` (variáveis e extras de contato: escritas, leituras e recomendação temporário/durável) e, com `--state`, `jornada-<bot>.md` (elemento original → bloco emitido, com adaptações).

`verify` valida offline qualquer JSON Kayros (estrutura, ponteiros de aresta, variáveis declaradas, limites de menu), inclusive os já importados e exportados.

## Otimização (F4)
O `convert` aplica por padrão as otimizações da F4 (ação condicional inline, fusão de ações com a mesma condição, dedupe/fusão de Codes de apoio). `--no-optimize` gera o formato de referência da F2. O padrão é o formato **seguro para o importador do Kayros OS** (sem `to.blockId` nem `Jump`); `--block-edges` gera o formato mais compacto, que o importador atual deixaria incorreto. Regras, pré-condições e métricas: `docs/f4-metricas.md`. O teste `test/optimize.test.ts` prova que os dois formatos se comportam igual em todos os estados dos 13 bots (leva ~50 s).

## Importação manual do piloto
`npx tsx scripts/build-pilot-package.ts <pacote>` gera `piloto-import/` (ver o `LEIA-ME.md` de lá). Depois de importar e exportar o rascunho: `npm run verify -- <exportado.json> --against piloto-import/flows/kayros-current-adapted/<arquivo>.json`. `convert --test-entry "<estado>" --preset k=v` gera uma variante de teste que começa em um estado.

## Cenários e testes isolados
`scenarios/*.json` guardam cenários **derivados** do grafo (status `draft`: não confirmados por negócio). O simulador (`test/helpers/sim.ts`) executa o documento emitido com entradas e respostas HTTP **explícitas**; chamada sem fixture termina em `FIXTURE_MISSING`, nunca em sucesso genérico. Ele vive em `test/` porque executa o JavaScript dos scripts de origem (`node:vm`), o que o código do conversor nunca faz. Resumo para revisão: `docs/piloto/cenarios-para-revisao.md`.

## Estrutura
| Pasta | Fase | Responsabilidade |
| --- | --- | --- |
| `src/ingest` | F1 | Leitura do pacote, manifesto/hashes, envelopes, JSON sem perda |
| `src/analysis` | F1 | Inventário, símbolos, dependências, grafo, padrões de atenção |
| `src/ir` | F2 | Modelo intermediário (SourceRef, estados, efeitos) |
| `src/config` | F0 | Schema e validação da configuração rev. 2.0 (`validateConfig`, `loadConfigFile`) |
| `src/profile` | F0/F2 | Perfil `kayros-current-adapted`: blocos, eventos, limites; validador estrutural do documento |
| `src/emit` | F2 | Emissão `groups/blocks/edges/events/variables` |
| `src/adapt` | F2/F3 | Adaptações, alternativas nativas, aceite |
| `src/optimize` | F4 | Agrupamento/fusão com pré-condições |
| `src/validate` | F2/F3 | Validação estática e de cenários |
| `src/report` | F6 | Relatórios e pacote |
| `src/diagnostics.ts` | F0 | Códigos e classes: `parameter_required`, `adaptation_required`, `technical_error`… |

## Dependências (versões fixas) e justificativa
| Pacote | Versão | Uso |
| --- | --- | --- |
| `typescript` | 7.0.2 | Checagem de tipos (`noEmit`) |
| `vitest` | 5.1.0 | Testes isolados |
| `zod` | 4.6.7 | Schema da configuração |
| `lossless-json` | 4.3.3 | Ler JSON preservando inteiros longos/números (F1-03) |
| `acorn` | 8.19.0 | AST de JavaScript dos scripts de origem, sem executá-los (F2-06) |
| `@types/node` | 26.6.6 | Tipos |
| `7z-wasm` | 1.2.0 | Leitura de `.7z` offline, sem processo externo (extração em memória, limites de itens/tamanho, caminhos validados) |
| `tsx` | dev |  Executa a CLI em TypeScript |

## Proveniência de código reaproveitado
Nenhum código Goatable foi copiado até agora. Candidatos a revisão futura: `kayros-os/src/features/builder/blip-import/{converter,importer,layout}.ts` e `script-to-bot.ts`. Se algo for reaproveitado, registrar aqui arquivo de origem, commit (ver `docs/decisoes-e-criterios.md`) e adaptações.
