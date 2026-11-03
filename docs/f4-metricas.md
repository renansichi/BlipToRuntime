# Métricas da F4 — antes × depois

Conversor 0.4.0 · origem 2026-11-02T04-26-43-071Z-e44c3a22. “Antes” é o formato de referência da F2 (`convert --no-optimize`); “depois” é o otimizado **seguro para o importador** (padrão). “com blockEdges” é o otimizado que usa arestas para blocos dentro do grupo (`--block-edges`).

> **Atenção (descoberta na preparação da importação):** o importador do Kayros OS (`importFlow` → `regenerate-bot-structure.ts`) grava as arestas só com `to.groupId` e **descarta `to.blockId`**, e não remapeia os ids de um bloco `Jump`. O formato “com blockEdges” depende de `to.blockId`; depois de importado ele se comporta diferente (teste `test/import.test.ts`). Por isso o padrão é o formato seguro, com ganho bem menor de grupos. O ganho maior só vale se o importador passar a preservar `to.blockId` (correção no Kayros OS, que este projeto não altera) ou se o JSON for gravado por outro caminho.

O que **não** muda (verificado em cada execução deste script e no teste diferencial): a quantidade de mensagens (`whatsapp-cloud`), chamadas (`Webhook`), eventos (`journeyEvent`), links entre bots e transferências. O que muda é a estrutura que os envolve (grupos, arestas, blocos de apoio).

| Bot | Estados | Grupos | Blocos | Code (todos) | Code de script de origem | Tamanho do JSON |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| vivofixawhatsapp | 200 | 1.028 → 958 (-7%) · com blockEdges 268 (-74%) | 3.722 → 3.665 (-2%) | 758 → 736 | 280 | 2.445 → 2.391 KB (-2%) |
| vivofixadados | 129 | 785 → 737 (-6%) · com blockEdges 171 (-78%) | 2.417 → 2.374 (-2%) | 525 → 506 | 148 | 1.594 → 1.557 KB (-2%) |
| bkovivofixamsgativaah | 89 | 186 → 186 (0%) · com blockEdges 90 (-52%) | 834 → 834 (0%) | 124 → 124 | 21 | 433 → 433 KB (0%) |
| vivofixaabandonomsgatah | 25 | 66 → 64 (-3%) · com blockEdges 26 (-61%) | 235 → 233 (-1%) | 44 → 43 | 6 | 130 → 128 KB (-1%) |
| vivoitvplanos | 105 | 357 → 331 (-7%) · com blockEdges 111 (-69%) | 1.235 → 1.207 (-2%) | 240 → 225 | 50 | 857 → 835 KB (-3%) |
| vivoitvah | 23 | 36 → 36 (0%) · com blockEdges 24 (-33%) | 188 → 188 (0%) | 23 → 23 | 7 | 95 → 95 KB (0%) |
| vivoiptvwpp | 333 | 1.126 → 1.060 (-6%) · com blockEdges 346 (-69%) | 4.961 → 4.895 (-1%) | 1.044 → 1.011 | 280 | 2.924 → 2.872 KB (-2%) |
| vivoiptveitvplanos | 59 | 168 → 156 (-7%) · com blockEdges 72 (-57%) | 739 → 726 (-2%) | 137 → 130 | 38 | 484 → 474 KB (-2%) |
| vivototalplanoswppnovo | 140 | 723 → 705 (-2%) · com blockEdges 206 (-72%) | 2.926 → 2.907 (-1%) | 551 → 541 | 192 | 1.835 → 1.821 KB (-1%) |
| vivototaldados | 111 | 489 → 455 (-7%) · com blockEdges 145 (-70%) | 1.890 → 1.861 (-2%) | 349 → 337 | 127 | 1.214 → 1.189 KB (-2%) |
| fibrasubida17 | 201 | 1.030 → 960 (-7%) · com blockEdges 270 (-74%) | 3.738 → 3.681 (-2%) | 760 → 738 | 280 | 2.452 → 2.399 KB (-2%) |
| vivosegurocelular | 114 | 440 → 396 (-10%) · com blockEdges 174 (-60%) | 1.562 → 1.514 (-3%) | 351 → 325 | 103 | 933 → 896 KB (-4%) |
| vivoseguros | 100 | 435 → 415 (-5%) · com blockEdges 161 (-63%) | 1.433 → 1.409 (-2%) | 322 → 308 | 89 | 894 → 877 KB (-2%) |
| **Total** | 1.629 | **6.869 → 6.459 (-6%)** · com blockEdges 2.064 (-70%) | 25.880 → 25.494 (-1%) | 5.228 → 5.047 (-3%) | — | 16.291 → 15.966 KB (-2%) |

## Leitura

- **Grupos por estado**: referência 4.2; formato seguro 4.0; com blockEdges 1.3. No formato seguro cada corrida de ações com a mesma condição ainda custa 2 grupos (corpo e continuação), porque a aresta só pode apontar para um grupo; com blockEdges a Condition salta blocos dentro do mesmo grupo. O que sobra além disso são roteadores de destino calculado, o roteador de timeout e perguntas com validação.
- **Blocos** caem pouco: a maior parte são scripts de origem (`Code`), mensagens, Webhooks, eventos e `Set variable`, que representam efeitos de negócio e não podem ser fundidos.
- **Code de apoio** (normalizações de caixa/acento, materializações de `obj@campo`, booleanos) cai pela remoção de repetições e pela fusão de Codes adjacentes independentes.

## Regras de otimização e suas pré-condições

| Regra | Pré-condição | Não faz |
| --- | --- | --- |
| Ação condicional inline (só `--block-edges`) | A `Condition` salta blocos dentro do mesmo grupo (`to.blockId`); corpo que **termina a conversa** continua isolado | Não é seguro para o importador do Kayros OS |
| Fusão de ações consecutivas com a mesma condição | Mesmas condições, nenhuma ação anterior da corrida escreve variável lida pela condição, ação não terminal | Não reordena ações |
| Descarte de ação toda descartada | Só com adaptação **aceita** (`merge-contact-write-only-discard`) | Não descarta sem aceite |
| Dedupe de derivadas (`__eq_*`, `__ci_*`, `__dec_*`, `mat_*`) | Mesma linha já calculada, origem não reescrita, sem entrada alternativa que quebre a garantia (fluxo de dados por grupo); `mat_rnd_*` (sorteio) nunca | Não toca em scripts de origem |
| Fusão de Codes gerados adjacentes | O segundo não lê variável que o primeiro escreve (o Code lê um retrato na entrada) e não é destino de aresta | Não funde scripts de origem |

Prova de equivalência: `test/optimize.test.ts` executa referência e otimizado em **todos os estados dos 13 bots**, com entradas, variáveis e respostas HTTP pseudo-aleatórias determinísticas, e compara mensagens, chamadas, eventos, links, variáveis finais, trilha de estados e fim. Um teste de sensibilidade confirma que remover blocos do otimizado é detectado.

## Tamanho para importação

O pacote inteiro (13 bots) tem ~15,5 MB, acima do corpo de 10 MiB aceito por requisição de importação (spec 6.2). Cada bot isolado tem de ~90 KB a ~2,4 MB: importe **bot a bot**.
