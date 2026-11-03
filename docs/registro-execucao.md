# Registro de execução

Situação dos artefatos: **gerado** (existe) ≠ **parametrizado** (valores confirmados) ≠ **aceito** (aceite registrado). Nenhuma jornada está parametrizada ou aceita.

## Fase 0 — Fundação e preparação do piloto

Data: 02/11/2026 · Versão do projeto: 0.1.0

| Tarefa | Situação | Evidência |
| --- | --- | --- |
| F0-01 Decisões e critérios | concluída | `docs/decisoes-e-criterios.md` |
| F0-02 Estrutura do projeto | concluída | `src/{ingest,analysis,ir,config,profile,emit,adapt,optimize,validate,report}`; Goatable não importado (`test/offline.test.ts`) |
| F0-03 Ambiente e dependências | concluída | `package.json` (versões exatas), `README.md`. Leitura de `.7z` adiada para F1-01 |
| F0-04 Checagem de tipos e testes | concluída | `npm run check`: tsc sem erros; 23 testes passando em 3 arquivos |
| F0-05 Validadores de configuração e perfil | concluída | `src/config`, `src/profile`, `src/diagnostics.ts`; `test/config.test.ts`, `test/kayros-document.test.ts` |
| F0-06 Responsáveis e dados do piloto | responsáveis definidos; **dados do piloto aguardando informação** | `docs/pendencias-e-responsaveis.md`: DEV, NEG e OPS = Renan (usuário). Contrato da API CPF, Recursos, fila, persistência e resultados esperados ainda não fornecidos (exigidos só a partir da F3) |
| F0-07 Piloto delimitado | concluída (casos aguardam NEG) | `docs/piloto-vivofixadados.md`: estados, caminhos P-01…P-08; resultados "a confirmar" |
| F0-08 Registro de execução | concluída | este arquivo |

### O que foi testado (resultado real)
- Configuração de exemplo (140 recursos, 35 aliases, 11 flows, 13 mapeamentos) é aceita; pendências saem como `parameter_required` (35 `REDIRECT_ALIAS_UNRESOLVED`, 11 `FLOW_ASSET_MISSING`).
- Rejeitados: instalação/publicação automática, `allowFakeIntegrationSuccess`, mudança de perfil/canal/versão, campo desconhecido em políticas, bot fora dos 13, segredo com valor, chave duplicada, aceite sem responsável/data/evidência.
- Validador do documento Kayros: coleções, ids duplicados, tipo de bloco fora do perfil, destino inexistente, `outgoingEdgeId` ausente (caso da amostra de abandono). As 11 amostras Kayros usam apenas blocos do perfil.
- Não coberto: validação de variáveis usadas, itens de menu e links entre arquivos (F2-09).

### Critério de conclusão da F0
Estrutura e verificações básicas: **atendido**. Contrato de configuração definido: **atendido**. Matriz inicial do piloto: **atendida**; responsáveis definidos (Renan nos três papéis); dados do piloto exigidos só a partir da F3.

### Decisões do responsável após a F0 (02/11/2026)
Ver `docs/pendencias-e-responsaveis.md`: contrato da API extraído do fluxo, persistência só em sessão com adaptação, fila única com aviso, resultados derivados pelo DEV e revisados, abandono rastreado, `expiration` em horas:minutos, sem organização/número no pacote.
- `expiration` = h:mm foi informado pelo responsável e não foi conferido no SDK Blip; revisar na F3-05 se divergir.

---

## Fase 1 — Ingestão e análise dos fluxos

Data: 02/11/2026

| Tarefa | Situação | Evidência |
| --- | --- | --- |
| F1-01 Leitura de `.7z` e pasta | concluída | `src/ingest/archive.ts` (7z-wasm, extração em memória, limites de itens/tamanho, caminhos validados, destino novo e vazio) e `package.ts`; teste extrai o `.7z` real |
| F1-02 Manifesto, tamanhos e hashes | concluída | 39/39 arquivos conferidos; ausência/divergência rejeita o bot, sem associar fluxo errado |
| F1-03 Envelopes e JSON sem perda | concluída | `{flow, globalActions}` e `configuracoes_gerais` conciliados (fluxo = original; variáveis = auxiliar); `lossless-json` preserva inteiros longos e `1.0` |
| F1-04 Inventário | concluída | `src/analysis/inventory.ts` |
| F1-05 Símbolos e referências | concluída | `symbols.ts`: namespaces, leituras/escritas, configurações e recursos |
| F1-06 Grafo | concluída | `graph.ts`: arestas literais, destinos dinâmicos com candidatos, Redirect/aliases, ciclos, sinais de canal |
| F1-07 Padrões de atenção | concluída | `patterns.ts` |
| F1-08 Saídas | concluída | `inventory.json`, `dependencies.json`, `diagnostics.json` via `npm run analyze` |
| F1-09 Testes | concluída | `test/ingest.test.ts`, `test/analysis.test.ts` |

### Resultado real
- `npm run check`: `tsc` sem erros; **56 testes passando** em 5 arquivos.
- Execução sobre o `.7z` real: 0 erros técnicos; 13 bots, 1.629 estados, 6.377 ações, 39 arquivos conferidos.
- **Todas as contagens de referência foram reproduzidas**: 6.370 locais + 4 globais + 3 pós-mudança; 140 configurações; 887 inputs sem bypass; 441 timeouts; 401 saídas dinâmicas; 682 SetVariable com expiração; 1.395 MergeContact; 94 Redirect / 35 endereços / 70 com contexto; 1.621 scripts; 570+4 HTTP; 2.066 envios (1.215 sem digitação); 9 validadores; 3 inputs condicionais; tabela por bot (13 linhas).
- Padrões: 196 esperas sem envio (138 sem Redirect/Desk), 42 ProcessCommand, 19 HTTP Blip, 19 HTTP + 19 estados White Wall, 4 globais, 3 LeavingFromDesk, 1 condição de intenção, 2 configurações ausentes (placeholder), 4 recursos externos, 11 ids de Flow distintos (2 literais, 9 expressões; 31 ocorrências).
- Zero saídas literais para estado ausente.

### Achados novos (não estavam no inventário de lacunas)
1. **`config.dateTimeOffset`** é lido como `inputVariables` de ExecuteScript em `vivoitvplanos` e `vivoiptveitvplanos` e não existe no export desses bots. Não foi presumido valor; entra como `SOURCE_CONFIG_UNRESOLVED:inputVariables` (2 ocorrências), separado das 2 referências oficiais.
2. **Destinos dinâmicos:** 356 de 401 fecham por constantes (SetVariable) que são ids de estado; 45 não fecham (valor vem de script/HTTP) e ficam como `DYNAMIC_TARGET_UNRESOLVED`. No piloto, `idAbandono` fecha em todas as saídas.
3. **Credencial literal na origem:** há corpos de `ProcessHttp` com chave de acesso escrita no próprio fluxo (ex.: `chaveAcesso` em `Busca CepViabilidade`). A análise não copia corpos nem cabeçalhos; a conversão (F2-07) deve movê-la para um Recurso secreto. Recomenda-se tratar essa chave como exposta.
4. Nomes de alias e URLs que o fluxo escreve literalmente em Redirect/HTTP aparecem nos relatórios como estão; valores das entradas de configuração não são copiados.

### Limites
- Sinais de canal são heurísticos (texto em condições; 24 ocorrências) e informativos; nenhum caminho foi retirado.
- Candidatos de destino dinâmico só consideram constantes de SetVariable do mesmo bot.
- Não há emissão Kayros ainda (F2).


---

## Fase 2 — Modelo intermediário e geração nativa

Data: 02/11/2026 · Conversor 0.2.0

| Tarefa | Situação | Evidência |
| --- | --- | --- |
| F2-01 Modelo intermediário | concluída | `src/ir`: SourceRef, fases, predicados ordenados, efeitos, destinos literais/dinâmicos |
| F2-02 Configuração no pipeline | concluída | `convert --config`: aliases, filas, aceites; segredos fora do fluxo e dos relatórios |
| F2-03 Ids, grupos, blocos, arestas, mapa | concluída | `src/emit/builder.ts`, `ids.ts`, `context.ts`; ponteiros sincronizados; `mapping.json` |
| F2-04 Mensagens e captura | concluída | texto, mídia, botões/lista/texto (>10), raw, Flow; `awaitReply` + `replyVariableId` |
| F2-05 Set variable, Condition, Jump, link, terminais | concluída | `predicates.ts`, `seq.ts`, `state.ts`, `actions.ts` |
| F2-06 Scripts | concluída | `script.ts`: AST (acorn), invólucro estático, placeholders em strings/templates/comentários |
| F2-07 Webhook e journeyEvent | concluída | `actions.ts`: cópia imediata de `api_status`/`api_response`; segredos literais extraídos |
| F2-08 Adaptações | concluída | `src/adapt/registry.ts`: 167 propostas no lote, nenhuma nasce aceita |
| F2-09 Validação de grafo/variáveis | concluída | `src/validate/refs.ts` + `profile/validate-document.ts` |
| F2-10 Operações offline | concluída | `convert` e `verify` (README) |
| F2-11 Testes | concluída | `test/emit.test.ts` (42 testes); exemplo mínimo "nome" |

### Resultado real
- `npm run check`: `tsc` sem erros; **98 testes passando** em 6 arquivos.
- Lote real: **13 bots convertidos em ~0,5 s, todos `structurally_valid`** (0 erros estruturais, 0 variáveis não declaradas, 0 arestas quebradas); `verify` confirma 13/13. Reprodutível (duas execuções geram arquivos idênticos).
- Tamanhos (grupos/blocos/arestas), ex.: `vivofixadados` 129 estados → 784 grupos, 1.879 blocos, 1.420 arestas. A relação ~6 grupos por estado vem da divisão por ações condicionais e **será reduzida na F4**.
- 167 adaptações propostas; 84 mudam regra de negócio e aguardam aceite (TTL, MergeContact, esperas sem envio, comandos Blip, timeout por follow-up, fila pendente, scripts incompatíveis, etc.).
- 331 ocorrências de segredo literal na origem viraram `{{resource.blip.<bot>.<chave>}}`; nenhum valor consta do pacote (teste confere contra os literais reais).

### Premissas NÃO verificadas contra um Kayros em execução (validar na F3-08)
1. `Typebot link` aceitar `{{resource.…}}` em `typebotId` (referência configurável quando o alias não está confirmado).
2. Retomada após `awaitReply` seguir para o próximo bloco do grupo, também para cliques de botão/lista sem aresta por item; e o valor capturado ser o `id` do item (usamos `value` ou texto da Blip).
3. Follow-up "Desviar para follow-up" acionar o evento `followUp` após o prazo (roteador por `timeout_state`).
4. Placeholders `{{x}}` dentro de Code virarem identificadores (como na amostra `{{last_message}}`), e `{{resource.x}}` valer no Code.
5. `credentialsId` fica vazio nos blocos WhatsApp e precisa ser definido na importação.
6. `Set variable` Custom com texto literal grava o literal.

### Achados da conversão
- **12 scripts não compilam em JavaScript padrão** (declaração duplicada, p.ex. `emailWithoutTrailingDot`); a Blip os aceita e o V8 do Kayros não. Mantidos verbatim e sinalizados (`SCRIPT_SYNTAX_INCOMPATIBLE`); precisam de correção manual.
- 16 scripts com número de parâmetros diferente das `inputVariables` (informativo).
- 92 ocorrências de elementos depois de uma ação terminal (Redirect/fila) não emitidos, listadas como `UNREACHABLE_AFTER_TERMINAL`.
- 45 destinos dinâmicos cujo conjunto não fecha seguem para o estado de exceção.

### Limites desta fase
Sem otimização (F4); espera sem envio usa pergunta genérica "Pode me confirmar…" (revisar por estado na F3-02); regex .NET não é traduzida (só sinalizada); comparações numéricas/data com cultura não verificadas; `state.*` e `calendar.*` ficam como variáveis declaradas sem fonte; expressão `input.message@…` depende do envelope de mensagem que o Kayros não expõe.


---

## Fase 3 — Adaptações críticas e aceite do piloto (parte DEV)

Data: 02/11/2026 · Conversor 0.3.0

| Tarefa | Situação | Evidência |
| --- | --- | --- |
| F3-01 Piloto CPF completo | concluída (DEV) | 8 estados + formulário; `docs/piloto/jornada-vivofixadados.md` (efeito original → bloco emitido) |
| F3-02 Esperas sem envio | **concluída (decisões de 02/11/2026)** | `docs/piloto/esperas-vivofixadados.md`; adaptação por estado (`<bot>:wait-without-message:<id8>`); `fallback.kind="remove"` aceito remove a espera, `promptText` troca a pergunta |
| F3-03 Dados temporários x duráveis | **concluída (decisões de 02/11/2026)** | `docs/piloto/dados-vivofixadados.md`; padrão do pacote: tudo na sessão |
| F3-04 Registro de adaptações | concluída | `adaptations.json`: id, origem, original/proposto, motivo, impacto, aceite (sempre `proposed`) |
| F3-05 Timeout, concorrência, falha | concluída | P-06, P-07b, F-03 (timeout); P-04/P-05 (falha); sem fixture = erro; Recurso sem valor detectado |
| F3-06 Formulário e atendimento | concluída (DEV) | F-01..F-03, D-01, D-02; pós-atendimento como fluxo separado |
| F3-07 Cenários e testes isolados | concluída; **resultados confirmados em 02/11/2026** | `scenarios/`, `test/helpers/sim.ts`, `docs/piloto/cenarios-para-revisao.md` |
| F3-08 Primeira importação manual | **pendente (você)** | — |
| F3-09 Homologação e aceite | **pendente (você)** | — |
| F3-10 Correções e reestimativa | concluída (DEV) | abaixo |

### Resultado real
- `npm run check`: `tsc` sem erros; **124 testes passando** em 8 arquivos. 16 cenários executados no simulador sobre o fluxo emitido (CPF válido/inválido/sem dígitos, API 500, `isValid=false`, `data=null`, timeout, abandono com e sem retorno, pessoa jurídica em maiúsculas, formulário, retorno do formulário, atendimento com e sem fila).
- **Confirmação de negócio (02/11/2026, Renan):** os 15 cenários originais foram confirmados (evidência em `docs/piloto/aceite-cenarios-2026-11-02.md`; registrados em `config/piloto.config.json`, gerado por `scripts/build-pilot-config.ts`). Incluem os prazos de 25 min (CPF) e 60 min (abandono).
- **Um aceite de adaptação:** `bkovivofixamsgativaah:desk-queue-pending` (aviso + encerramento enquanto a fila não existir). Confirmar o resultado não aceita os mecanismos (follow-up, TTL, MergeContact na sessão, shim do envelope): seguem `proposed`.
- **Esperas sem envio do piloto (02/11/2026):** 5 estados decididos (`docs/piloto/aceite-esperas-2026-11-02.md`): *Bloco vazio final* removida; *F_04_UltimoImput*, *finalizar abandono* e *MSG Ativa Reagendamento* mantidas com a pergunta padrão aceita; *Redireciona_Bot BKO* removida (o Redirect de entrada já ocorre antes da espera, então não há adaptação). 4 aceites registrados; as demais esperas do lote seguem `proposed`.
- **Dados do piloto (02/11/2026):** campos escritos e lidos ficam só na sessão; marcadores só escritos são **descartados** (59 campos; 15 mantidos: 12 lidos por outro bot e 3 de nome operacional — `filaAH`, `prioridade`, `encerramentoAbandonoFormulario` — mantidos por decisão via `dataPolicy.keepContactExtras`, revisão aditiva do contrato; chaves dinâmicas nunca); campos só lidos são **parâmetros de entrada** (30 externos, 23 herdados da cadeia); TTL aceito sem expiração. Evidência: `docs/piloto/aceite-dados-2026-11-02.md`; 3 aceites (`ttl-session`, `merge-contact-session`, `merge-contact-write-only-discard`).
- **Efeito sobre cenário confirmado:** P-08 (EMPRESA grava a etapa do CPF) deixou de valer no pacote entregue; ele passa a verificar a comparação sem caixa **sem** o descarte (`config: none`) e o novo **P-08b** verifica que o marcador não é gravado. P-08b decorre da decisão de dados e consta como confirmada por ela.
- Todos os cenários do piloto passam também sobre o pacote gerado com a configuração do piloto (esperas e dados decididos).
- Nenhuma homologação foi feita e não há registros reais de conversa.

### Defeitos reais encontrados pelos cenários e corrigidos
1. **Condições sobre `obj@campo`** (ex.: `responseDadosPessoais@isValid`) liam uma variável nunca preenchida. Efeito: o erro de API **não** desviava para o caminho de erro, e ações condicionais (ex.: gravar o nome do cliente) eram puladas em silêncio. Agora o campo é materializado antes da comparação (JSON null vira `"null"`, como a regra escrita espera).
2. **Code lê um retrato das variáveis na entrada do bloco** (spec 7.2): escrita e leitura da mesma variável no mesmo Code não funcionam. Materializações e derivadas agora vão em Codes separados e em ordem.
3. `state.id`, `state.name`, `state.previous.*` (usados no estado de exceção) não tinham fonte: cada grupo de estado agora atualiza essas variáveis nos bots que as usam.

### Adaptações novas no piloto
- `flow-reply-detection`: `input.message@content = Sent` vira `flow_response` preenchido.
- `script-reads-message-envelope`: 64 scripts (23 distintos) fazem `JSON.parse` do envelope da mensagem; o conversor remonta um envelope com o conteúdo e o retorno do Flow (`#wa.interactive.nfm_reply.*`). **Metadados de anúncio (`#wa.referral.*`, campanhas) não existem no Kayros e chegam ausentes.**
- `input-message-envelope`: leituras de `input.content@type` (tipo da mensagem: áudio, imagem…) nunca casam até o tipo ser obtido.

### Reestimativa (F3-10)
- A parte de engenharia das fases 0–3 foi concluída; o motor já converte e valida estruturalmente os 13 bots. O que resta de DEV: **F4** (reduzir ~6 grupos por estado e fundir blocos, 3–5 dias), **F5** (por jornada: cenários, ajustes por padrão novo, relatórios; 4–7 dias com o motor atual) e **F6** (empacotamento, 2–4 dias). Estimativa DEV restante: **9–16 dias úteis** (antes: 15–23 a partir deste ponto).
- O caminho crítico passou a ser **seu**: confirmar cenários, informar contratos/Recursos/fila, importar e homologar (F3-08/09; F5-03/05/07/08). Esses tempos não estão na estimativa.

### Premissas ainda NÃO verificadas num Kayros em execução (validar na F3-08)
As seis da F2 e mais: `flow_response` chegar preenchido no retorno do Flow com o formato esperado pelo shim; `api_response` com corpo textual de erro; `followUp` desviar ao evento após o prazo.


---

## Fase 4 — Organização e otimização verificável

Data: 02/11/2026 · Conversor 0.4.0

| Tarefa | Situação | Evidência |
| --- | --- | --- |
| F4-01 Agrupamento por responsabilidade | concluída | um grupo por estado de negócio; ações condicionais deixam de gerar grupos extras; efeitos externos (Webhook, mensagem, evento, link) continuam blocos próprios e identificáveis |
| F4-02 Fusão de sequências e passagens vazias | concluída | ação condicional inline; fusão de ações consecutivas com a mesma condição (pré-condição: nenhuma escrita na variável lida); `MergeContact` todo descartado não gera nem a Condition |
| F4-03 Cálculos puros adjacentes | concluída | dedupe de derivadas com fluxo de dados por grupo; fusão de Codes gerados independentes; scripts de origem nunca são tocados |
| F4-04 Menus, condições e saltos | concluída (escopo realista) | saltos internos viraram arestas para blocos do mesmo grupo; menus/saídas já eram diretos (uma Condition por estado) |
| F4-05 Layout, títulos e referências | parcial | títulos por estado e “· ação condicional” só nos corpos isolados; coordenadas em grade por ordem de criação; mapa de origem externo ao JSON. **Layout visual fino não foi tratado** |
| F4-06 Comparação antes/depois | concluída | `test/optimize.test.ts`: referência × otimizado em todos os estados dos 13 bots (≈9,7 mil execuções), igualdade de mensagens, chamadas, eventos, links, variáveis, trilha e fim; teste de sensibilidade confirma que a comparação enxerga defeitos |
| F4-07 Métricas e padrão de manutenção | concluída; **aguarda seu aceite do padrão** | `docs/f4-metricas.md` |

### Resultado real
- `npm run check`: `tsc` sem erros; testes passando (inclui o diferencial, ~50 s).
- Grupos: **6.863 → 2.058 (−70%) com arestas para blocos (`--block-edges`)**; `vivofixadados` 784 → 170 para 129 estados. **Corrigido depois (ver “Preparação da importação”): o padrão passou a ser o formato seguro para o importador, com −6% de grupos.** Blocos −4% (o resto é efeito de negócio). Code de apoio −17%. JSON −9%.
- As quantidades de mensagens, Webhooks, eventos, links e transferências são idênticas antes e depois (conferidas a cada execução do script de métricas).
- Cenários do piloto (16) e o pacote com a configuração do piloto continuam passando.

### Defeitos que o teste diferencial e a reestruturação expuseram
- Quando o corpo de uma ação condicional termina a conversa, mover os blocos para outro grupo deixava o “senão” ligado duas vezes; corrigido.
- Remover um Code redundante que era destino de aresta deixava a aresta apontando para um bloco inexistente; agora a aresta é religada ao próximo bloco ou o bloco fica.
- Nomes de variáveis internas (`__dec_*`) dependem de contadores internos e **mudam entre os dois formatos**; são temporárias e não contam como comportamento.

### Limites
- A equivalência é demonstrada **sobre o simulador** (que interpreta os blocos emitidos), não sobre um Kayros real.
- Entradas pseudo-aleatórias não esgotam todos os caminhos; 2 execuções por estado.
- O pacote inteiro (14,5 MB) excede o corpo de 10 MiB de uma importação: importar bot a bot.


---

## Fase 5 — Expansão e validação por jornada (parte DEV)

Data: 02/11/2026 · Conversor 0.4.0

O motor já converte os 13 bots (as famílias de padrão foram tratadas nas fases 2–4). Esta fase fechou as verificações que valem para o lote inteiro e organizou o que depende de você.

| Tarefa | Situação | Evidência |
| --- | --- | --- |
| F5-01 Ordem pelo grafo | **não calculável** | Os endereços de Redirect são nomes de aplicações da Blip (35), nenhum confirmado como um dos 13 bots; vários apontam para bots fora do lote. Planilha: `docs/f5/aliases-para-preencher.md`. Ordem provisória por tamanho em `docs/f5/cobertura-bots.md` |
| F5-02 Expansão por família | concluída (DEV) | os mesmos emissores cobrem conteúdo/menus, coleta/validação, HTTP, abandono, agentes e atendimento nos 13 bots |
| F5-03 Dados por unidade | **pendente (você)** | aliases, Recursos, contratos, Flows, agentes, filas, persistência (tabelas por bot em `docs/f5/cobertura-bots.md`) |
| F5-04 Padrões de incompatibilidade | concluída (DEV) | nenhum caminho apagado; cada padrão tem tradução ou adaptação proposta; nenhuma consulta/pedido/gravação simulada |
| F5-05 Cenários por jornada | **pendente** | só o piloto tem cenários confirmados (16 + formulário/atendimento) |
| F5-06 Limites por passada | concluída | `src/analysis/budget.ts`, `passes.json`: nenhuma passada passa de 15 mensagens / 30 chamadas externas (maior: `vivototalplanoswppnovo`, 12 / 15) |
| F5-07/08 Importação e homologação | **pendente (você)** | |
| F5-09 Cobertura conciliada | concluída | `src/report/coverage.ts`, `coverage.json`: **16.902 de 16.902** elementos (1.629 estados, 1.629 inputs, 6.377 ações, 2.066 conteúdos, 5.201 saídas) com tradução ou registro rastreável, nos dois formatos |
| F5-10 Lista por bot e relatório | parcial | `docs/f5/cobertura-bots.md`; as 13 caixas de cobertura (F5-B01..B13) seguem abertas por falta de aceite |

### Resultado real
- `npm run check`: `tsc` sem erros; **142 testes** passando (inclui cobertura, orçamento por passada e o diferencial, ~50 s).
- Situação dos 13 bots: `structurally_valid` + cobertura total, mas todos `awaiting_journey_acceptance` (adaptações que mudam regra de negócio sem aceite), exceto o que o piloto já decidiu. **Nenhum está `accepted_for_manual_import`.**
- O que antes sumia em silêncio agora é registrado: elementos depois de uma ação terminal (`skipped-after-terminal`), saídas inalcançáveis (`exit-unreachable`), inputs (`input-*`) e cada saída (`exit-*`).
- `Tarefas.md` atualizado (44 caixas marcadas, 32 abertas); a versão anterior está em `Analise Blip Kayros/historico/`.

### Achados
- O pacote gera `passes.json` com os tetos do motor lidos de `kayros-bot-engine` (`MAX_OUTBOUND_PER_PASS=15`, `MAX_EXTERNAL_CALLS_PER_PASS=30`, `PASS_DEADLINE_MS=25000`, `MAX_BOT_HOPS_PER_PASS=50`). O `timeout: 30` dos Webhooks emitidos é maior que o prazo da passada (25 s); o motor usa o que sobra, então o teto efetivo é o da passada.
- Muitas passadas têm retorno possível sem aguardar (ciclos estáticos); o motor os corta pelos tetos. É informativo, não defeito do conversor.
- Os 35 aliases são em maioria bots que **não estão** entre os 13 (ex.: “Vivo Controle 2023 [WPP]”, “Vivo Pesquisa de Satisfacao”); para esses, o destino tende a ser um fluxo Kayros existente (ver `Extrato Kayros`).


---

## Preparação da importação do piloto (F3-08) — o que NÃO foi executado

Data: 02/11/2026 · Conversor 0.4.0. **Nada foi importado, publicado ou testado num Kayros.** A importação é manual (Q11); aqui ficou pronto o que ela exige.

### Descobertas ao ler o importador do Kayros OS (somente leitura)
Lido em `kayros-os/src/features/builder/api/{service,regenerate-bot-structure}.ts` e `resources/types.ts`:

1. **`importFlow` descarta `to.blockId` das arestas** (grava só `to.groupId`) e **não remapeia os ids do bloco `Jump`**. O formato otimizado da F4 dependia de `to.blockId`: depois de importado ele se comporta diferente (teste `test/import.test.ts`). **O padrão agora é o formato seguro** (grupos separados para o corpo e a continuação de ações condicionais; a pergunta com validação ganhou grupo próprio; grupo vazio usa um `Code` sem efeito em vez de `Jump`). O ganho de grupos caiu de −70% para **−6%**. O formato antigo continua disponível com `--block-edges`, para o caso de o importador vir a preservar `to.blockId` (correção no Kayros OS, fora deste projeto).
2. **O importador troca os ids de botões e linhas de lista.** Por isso o id deixou de carregar o valor da opção; o motor captura o **título** do botão como resposta (`reply: o.title`, conferido no simulador do motor). As 604 opções do lote têm `value` nulo, então o texto da Blip continua igual.
3. **Chaves de Recurso só aceitam `[A-Za-z0-9_.]` e até 100 caracteres.** As chaves geradas com hífen (`access-token`, aliases de link) eram inválidas; agora usam `_`.
4. **Defeito corrigido:** os segredos extraídos do fluxo (ex.: cabeçalho `access-token`) saíam no JSON com uma chave diferente da listada em `secrets-to-fill.json` (o tradutor remapeava `{{resource.*}}`). Um teste confere agora que toda chave de segredo listada aparece no fluxo.
5. O importador injeta as variáveis de sessão que faltarem e **respeita as declaradas** pelo fluxo (sem duplicar); regrava variáveis de Set variable, Condition, `replyVariableId` e mapeamentos de Webhook. Substituímos o importador por uma réplica de teste (`test/helpers/importer-sim.ts`) e os 16 cenários do piloto dão o mesmo resultado no fluxo importado.

### O que ficou pronto
- `piloto-import/` (gerado por `scripts/build-pilot-package.ts`): bot `vivofixadados` completo + **3 variantes de teste** que começam no CPF, no abandono e no formulário (com variáveis de teste), `LEIA-ME.md` (passo a passo, Recursos a criar com origem do valor, roteiro de homologação P-/F-), `manual-import-map.json`, `homologacao-resultados.md` e pasta `evidencias/`.
- `verify <exportado.json> --against <gerado.json>`: confere o rascunho importado e exportado com o gerado (tipos de bloco, conteúdo sem ids, destinos); `verify --import-safe`.
- `convert --test-entry "<estado>" [--preset expressão=valor]`; `target.whatsappCredentialsId` na configuração.
- `test/import.test.ts`: o fluxo gerado sobrevive à réplica do importador; a conferência detecta adulteração; o formato com `--block-edges` quebra depois de importado.

### Premissas ainda não verificadas (vão aparecer na homologação)
Clique em botão/lista seguir para o próximo bloco do grupo; follow-up disparando o evento `followUp`; `{{resource.…}}` dentro de `Code` e em `typebotId`; `flow_response` no retorno do Flow; semântica exata de `Set variable` com texto literal.

## Próxima fase
F3-08/F3-09 (importar, conferir com `verify --against` e homologar o piloto), seguidos do preenchimento dos aliases. F6 só depois dos aceites.
