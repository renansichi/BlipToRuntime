# Aprendizados do builder do Goatable (fluxo "Vivo ITV AH")

Registrado em 02/11/2026. Fontes: (1) montagem à mão de um recorte do bot `vivoitvah` em `dev.goatable.app`
(fluxo "Vivo ITV AH (manual)", rascunho, nada publicado); (2) dois exports reais do builder
(`vivo-itv-ah-manual.json`, como eu montei, e `vivo-itv-ah-manual-editado.json`, com as alterações do Renan);
(3) comparação com o `vivofixadados.json` gerado pelo conversor. Só o que foi observado; o não verificado está no fim.

## 1. O que o Renan mudou (manual → editado)

O conteúdo não mudou: textos, código, condição, botões, fila e variáveis são idênticos. Mudou só a **estrutura**:

| | Manual (eu) | Editado (Renan) |
| --- | --- | --- |
| Grupos | 9, um bloco em cada | 6 |
| Blocos | 9 | 9 |
| Arestas | 10 | 7 |
| #2 | Código | **Código + Condição** no mesmo grupo |
| #3 | Texto | **Texto + Encerrar sessão** |
| #6 | Texto | **Texto + Registrar evento** |

Regra que isso mostra (e que o conversor já segue: 0 blocos não finais com aresta em 597 grupos):

- Dentro de um grupo os blocos rodam em sequência, **sem aresta entre eles**.
- Só o **último** bloco do grupo carrega `outgoingEdgeId` (ou os itens de Condição e os botões, que têm o seu próprio).
- Bloco final sem aresta (`endSession`, `transferToQueue`) encerra o caminho.
- Um grupo por bloco, com aresta entre todos, funciona mas é o desenho "errado": arestas e grupos a mais.
  Foi o que eu fiz sem saber; o Renan consolidou.

Isso responde o "não verificado" anterior: **dá para empilhar blocos no mesmo grupo** (no editor, não soltando sobre o grupo no canvas como eu tentei).

## 2. Formato real do export do builder

Documento: `{id, createdAt, updatedAt, name, folderId, groups, events, variables, edges, publicId, organizationId, isArchived, isClosed}`.
O conversor emite só `{name, groups, events, variables, edges}` (o importador completa o resto).

| Elemento | Builder (export) | Conversor hoje |
| --- | --- | --- |
| Ids | UUID v7 (ordenados no tempo) | UUID v5 estável |
| Grupo | `{id, title:"Grupo #N", blocks, graphCoordinates}` | igual |
| Texto | `{action:"Enviar texto", body, to:"{{wa_id}}", channel:"{{channel}}", cards:[], buttons:[], sections:[]}`; **sem `credentialsId`** | igual, **mais `credentialsId:""`** |
| Botões | `{action:"Enviar botões", bodyText, buttons:[{id,title,outgoingEdgeId}], awaitReply:true, …}` | igual, mas **nenhum dos 42 botões tem `outgoingEdgeId`** |
| Aresta de botão | `{from:{itemId:<botão>, blockId}, to:{groupId}}`, e o `outgoingEdgeId` fica no objeto do botão | não emitida |
| Condição | `items[].content = {comparisons:[{id,value,variableId,comparisonOperator}]}` (sem `logicalOperator` com 1 comparação); ramos por item + "Senão" no `outgoingEdgeId` do bloco | `items[].content` sempre com `logicalOperator` (552 de 552) |
| Código | `options:{content}`; **o nome digitado no painel não foi gravado** | `options:{content, name}` |
| Registrar evento | `{eventName, payload:[]}` | igual |
| Transferir | `{queueId:<uuid real da fila>}`; a saída "Fora do horário" não foi ligada, então não há aresta | não emitido no piloto (sem fila configurada) |
| Encerrar sessão | `options:{}` | não emitido no piloto |
| Variáveis | as **27 de sistema vêm no export com `id == name`** (`wa_id`, `channel`, `last_message`…) + as do usuário com UUID | só as usadas, todas com UUID (inclusive `wa_id`, `channel`, `last_message`) |

## 3. Correção do documento anterior

Eu tinha escrito que o builder não gera `cards`, `sections` e `buttons` vazios. **Estava errado**: li isso da aba JSON do painel,
que mostra só os campos da action. O export gera os três vazios (nos blocos que o Renan salvou de novo; os Textos #6 e #7 do meu
export não os tinham, e passaram a tê-los no editado). A única diferença real do Texto é `credentialsId`, que o builder não grava.
Os arrays vazios, portanto, **não são desperdício a cortar**.

## 4. O que muda no conversor (a avaliar, em ordem de valor)

1. **Botões com saída nativa.** Hoje o conversor emite Condição depois da resposta e deixa o botão sem aresta. O builder liga cada
   botão ao próximo grupo (`from.itemId`) e tem saída "Outro". Reduz Conditions e variáveis `__eq_*`/`__ci_*` nos menus (42 botões
   no `vivofixadados`). Cuidado: texto digitado que não é botão cai em "Outro" (ou em "Entender texto digitado"); o Blip trata por regex.
2. **Fila e horário.** `transferToQueue` exige `queueId` real; o horário vem da fila e a saída "Fora do horário" substitui o script de
   horário + Condição (decisão de negócio: muda o comportamento).
3. **Fim do atendimento.** O motor encerra a sessão no handoff; a próxima mensagem abre sessão nova. O fluxo Blip que reage ao ticket
   fechado (estados "Nota", "Agradece Nota") precisa de outro desenho.
4. **Variáveis.** A Condição só enxerga variável declarada; declarar toda variável lida por Condição (o conversor já faz).
   Variáveis de sistema podem usar `id == name`, como o builder.
5. **`name` do Código** não é gravado pelo builder; não depender dele (o otimizador usa `name == "gerado"` para reconhecer Codes gerados).
6. **`credentialsId:""`** é a única chave do Texto que o builder não grava: confirmar se o importador aceita a chave ausente e, se
   aceitar, deixar de emitir.
7. **Mais coisas no builder que o conversor emula:** follow-up por inatividade (opção do bloco, janela de 24h), "Reapresentar o grupo
   inteiro", "Entender texto digitado", evento Follow-up, Esperar, Teste A/B.

## 5. Modelo do canvas (da montagem manual)

- Arrastar da paleta cria um grupo; clicar não adiciona. Soltar sobre um grupo no canvas cria outro grupo.
- Salva sozinho. Mover um grupo deixa a seta desenhada errada até recarregar.
- Uma saída tem uma aresta: religar substitui a anterior.
- Condição escolhe variável por seletor (só declaradas); ramos avaliados em ordem.
- Transferir p/ humano: fila obrigatória; sessão parada após o handoff; horário copiado da fila ao salvar/publicar.
- Registrar evento: nome obrigatório (aceita `{{var}}`), payload opcional, grava em `journey_events` (best-effort).

## 6. Testes no Goatable (02/11/2026)

Três JSONs no formato do conversor, em `scenarios/builder-goatable/`, importados e executados no "Visualizar".
Ficaram como fluxos "Teste conversor … (importado)" no Goatable (rascunhos, nada publicado).

**Importação (teste 1)** — o importador aceitou o arquivo e preservou tudo, lido do JSON persistido:
`credentialsId:""` onde existia e ausente onde não existia; `name` do Código; `logicalOperator`; `outgoingEdgeId` dos botões
(remapeado). Os ids viram UUID v7. Então: Texto sem `credentialsId` e botões com aresta **são aceitos**; o `name` do Código
**é suportado** pelo modelo (só o campo do painel não o gravou na minha montagem manual: é falha do painel, não do modelo).

**Execução no Visualizar (testes 1 a 5)** — achados gerais:

- Botão clicado: `last_message` recebe o **título** do botão (`"Opção A"`).
- **Código não executa** ("SIMULADO: SCRIPT"): `setVariable` não grava nada. Nada que dependa de Código pode ser homologado
  no Visualizar; usar Set variable ou executar de verdade (canal de teste). Set variable executa.
- O simulador mostra "Encerrar sessão (preview: motor fecharia aqui)" e uma linha de variáveis expansível.
- O canvas mostra o UUID da variável no card do Set variable, e o simulador lista a variável pelo UUID; o valor persistido está
  certo (`variableId` remapeado). É só exibição. O canvas também mostra "e" para um `OR` importado.
- `POST /api/builder/flows/<id>/lock` respondeu 500 ao abrir o editor e o dev devolveu 503 em prefetches; não afetou a edição.
- O editor travou ao abrir o `vivofixadados` completo (2 MB, 539 grupos): o fluxo real não deve ir inteiro para o editor.

### Guia da Condição (consolidado)

Regra confirmada pelo Renan e pelos testes 2 a 5: **a branch só dispara se todas as suas comparações forem verdadeiras
(AND); as branches são avaliadas em ordem e a primeira que casa dispara; OR = várias branches com a mesma saída.** O painel não
tem E/OU e o `logicalOperator: "OR"` importado é ignorado (vira AND). O builder omite `logicalOperator` quando há uma comparação.

Valores internos dos operadores (painel → JSON) e comportamento no Visualizar (testes 4 e 5, com resultado esperado declarado
em `teste-4-esperado.json` e `teste-5-esperado.json`):

| Valor interno | Painel | No Visualizar | Emitido pelo conversor (13 bots) | Tratamento |
| --- | --- | --- | --- | --- |
| `Equal to` | Igual a | funciona | 3303 | |
| `Not equal` | Diferente de | funciona | 755 | |
| `Contains` | Contém | funciona | 4146 | |
| `Is empty` | Está vazio | funciona | 283 | |
| `Matches regex` | Casa com regex | funciona | 14 | |
| `Greater than` | Maior que | funciona (só numérico) | 2 | |
| `Less than` | Menor que | funciona (só numérico) | 4 | |
| `Is set` | Está preenchido | **falha** | 2034 | `Not equal ""` |
| `Starts with` | Começa com | **falha** | 379 | `Matches regex "^x"` |
| `Ends with` | Termina com | **falha** | 0 | `Matches regex "x$"` |
| `Greater or equal to` | Maior ou igual a | **falha** | 1 | duas branches: `Greater than` e `Equal to` |
| `Less or equal to` | Menor ou igual a | **falha** | 0 | duas branches: `Less than` e `Equal to` |
| `Does not contain` | Não contém | **falha** | 0 | não emitido |
| `Does not match regex` | Não casa com regex | **falha** | 0 | não emitido |

Os operadores que "falham" foram reconhecidos pelo painel (o card mostra o rótulo certo, e o painel grava o mesmo valor interno ao
escolhê-los), então não é nome errado; no Visualizar a condição nunca casa. Não se sabe se o motor real se comporta igual.
No teste 5 usei por engano `Greater or equal` e `Less or equal`; o painel mostrava o texto cru, e o nome certo (o do conversor) é
`... or equal to`, que também falhou.

Outros fatos medidos (teste 5, sem esperado declarado): `Contains` e `Equal to` **diferenciam maiúsculas e minúsculas**; não há
`trim` (`"abc "` ≠ `"abc"`); `Greater than` com texto (`"b" > "a"`) não casa, só numérico. O conversor já compensa caixa e acento com
variáveis derivadas (`__eq_*`, `__ci_*`).

Resultados dos testes 4 e 5:

| Teste | Casos | Conforme o esperado |
| --- | --- | --- |
| 4 (`teste-4-or-por-branches.json`) | 16: OR de 5 branches, misto AND+OR, `Not equal ""`, `Is empty`, regex, `Less than`, "Senão", `Is set`, `Starts with` | 14 (falharam `Is set` e `Starts with`) |
| 5 (`teste-5-operadores-restantes.json`) | 14 com esperado: `Does not contain`, `Greater than`, `>=`, `<=`, `Ends with`, `Does not match regex`, regex como `Starts with`; mais 4 sem esperado | 9 (os 5 que falharam são os casos que deviam casar com `Does not contain`, `>=`, `<=`, `Ends with` e `Does not match regex`; os casos "não casa" desses operadores passam por acaso, já que a condição nunca casa) |

### Set variable: modos e teste 6 (`teste-6-set-variable-codigo.json`)

Painel do bloco: **Nome** (opcional, só no card), **Tipo**, **Variável alvo**, **Expressão / valor** (aceita `{{nome}}`) e a caixa
**"Tratar como código JavaScript (executar via VM)"**. Com a caixa marcada o campo vira editor de código e vale `setVariable(nome, valor)`
(dica do painel), o que permite **gravar várias variáveis num único bloco** (indicação do Renan). O JSON persistido é
`{type:"Custom", isCode:true, variableId:<alvo>, expressionToEvaluate:"<código>"}`; o `variableId` continua existindo, e o importador
aceitou um bloco em modo código **sem** `variableId`.

Tipos do seletor: Expressão / código (`Custom`), Limpar (vazio) (`Empty`), ID da sessão, ID aleatório, Nome do ambiente, Data e hora
agora, Hoje, Ontem, Amanhã, Momento do dia, Adicionar à lista, Remover último da lista, Remover primeiro da lista, Mapear listas paralelas.
Só `Custom` e `Empty` são emitidos hoje pelo conversor.

No Visualizar, **o modo código não é executado**: dos 8 casos (código com 2 `setVariable`, expressão que retorna valor, retorno + `setVariable`,
`{{x}}` interpolado, sem alvo, `{{y}}` em expressão) os 6 de código falharam em silêncio e os 2 controles (valor simples; dois Set
variable separados) passaram. O alvo recebeu o **texto do código** (`({{y}} * 2) + ""`, sem interpolar), e as variáveis do código não foram
gravadas. Nada disso diz como o motor real se comporta; ficou sem verificação: se o valor de retorno do código vai para o alvo (e se
sobrescreve o alvo com `undefined` quando só há `setVariable`) e se `{{x}}` dentro do código vira literal JS.

## 7. Mudanças feitas no conversor (02/11/2026)

Nova passada `normalizeConditions` (`src/emit/conditions.ts`), aplicada a todo documento emitido (completo e variantes de teste),
ligada por padrão (`normalizeConditions: false` desliga):

1. **OR vira uma branch por comparação**, na mesma ordem, cada uma com aresta própria para o mesmo grupo (o primeiro item mantém id e
   aresta; os demais têm ids estáveis derivados). Itens AND continuam uma branch com `logicalOperator: "AND"`; itens de uma
   comparação não levam `logicalOperator`, como no export do builder.
2. **Operadores que o Visualizar não executa** são trocados pelos equivalentes da tabela (`Is set`, `Starts with`, `Ends with`,
   `>=`, `<=`). Valores de regex são escapados. Um AND com `>=`/`<=` vira o produto das alternativas (teto de 16 branches; acima
   disso o item fica como está).
3. O simulador de teste (`test/helpers/sim.ts`) passou a avaliar a branch como AND, a semântica real do builder; antes tratava
   `OR` como "qualquer uma". Testes novos em `test/conditions.test.ts` e dois testes de `test/emit.test.ts` atualizados.

Efeito no `vivofixadados.json`: 559 → 830 branches; zero `Is set`, `Starts with` e OR com várias comparações; os cenários P-xx do piloto
continuam passando sob a semântica AND. O arquivo completo foi de 1,33 para 1,41 MB e o enxuto de teste de 846 para 874 KB.
Não reimportei os arquivos regenerados no Goatable (o editor trava com o fluxo completo).

### Fusão de Set variable (opt-in `mergeSetVariables`, `src/optimize/merge-set.ts`)

Decisão do Renan: **para só atribuir valores, usar o modo código do Set variable** (vários `setVariable` no mesmo bloco). Sequências de
`Set variable` no mesmo grupo viram **um `Set variable` com `isCode:true`**, uma linha `setVariable("nome", valor)` por variável. Regras:
só `Custom` sem código e `Empty`; `{{x}}` vira `__s({{x}})` concatenado aos literais (convenção dos Codes gerados); nada com
`{{resource.*}}` nem expressões; um Set que lê uma variável escrita antes na mesma sequência abre outra sequência (o código lê um retrato
das variáveis na entrada do bloco, então fundir mudaria o valor lido); bloco que carrega aresta fecha a sequência e a aresta passa ao bloco
fundido; destino de aresta só abre sequência; o mapa de origem aponta para o bloco fundido.

**Variável alvo:** o modo código mantém uma "variável alvo" e não se sabe se o retorno do código é gravado nela (o Visualizar não executa o
código e grava o texto dele no alvo). Por isso o alvo é uma variável interna, `__set_sink`, que ninguém lê: se o motor gravar o retorno
nela, nenhuma variável de negócio é afetada. Se o motor aceitar o modo código sem alvo, ela pode sair (o importador aceitou o bloco sem
`variableId`, mas o painel mostra "Variável alvo").

Ajustes que o novo formato exigiu: a poda nunca remove um Set variable em modo código e reconhece os `setVariable` dele como escritas; o
otimizador conta essas variáveis como escritas do bloco; o simulador de teste executa o modo código como um Código.

Efeito no `vivofixadados` (completo): blocos 1994 → 1480 (−26%): 173 Set variable em modo código, 163 simples e 446 Códigos;
JSON completo 1,41 → 1,36 MB e enxuto de teste 874 → 856 KB. Com Código em vez de modo código eram 1461 blocos (o Código se fundia
também com Códigos vizinhos); o modo código custa ~19 blocos a mais. Verificado por teste diferencial em todos os grupos (mesmas mensagens,
HTTP, eventos, fim e **todas** as variáveis finais).

## 8. Pendente de implementar no conversor (ver seção 4)

Botões com saída nativa; fila e horário (`transferToQueue` com `queueId` real e saída "Fora do horário"); estados pós-atendimento;
deixar de emitir `credentialsId:""` (o importador aceita sem); não depender do `name` do Código. Novos (seção 9): botões com `examples` +
`understandTypedReply` no lugar de `contains` por Condição; `Classificar resposta` para texto livre; `transferToQueue` com `outOfHoursEdgeId`
(remapear no importador/simulador); `Wait` com `secondsToWaitFor`.

## 9. Segunda montagem manual: "Vivo Abandono MsgAt AH (manual)" (02/11/2026)

Bot escolhido: `vivofixaabandonomsgatah` (o menor ainda não feito; 64 grupos no conversor). Montei o núcleo da mensagem ativa no
builder (Botões Sim/Não → Transferir p/ humano → saída "Fora do horário"; Não → agradecimento → Encerrar) e li o JSON persistido
(HTML do editor). Fluxo no Goatable: pasta "Teste Renan", rascunho, nada publicado. Ficaram ali, de propósito, um grupo Esperar e dois
Classificar resposta (um vazio) usados só para inspecionar painéis.

**Editor JSON dos blocos.** O painel de cada bloco de WhatsApp tem abas Form/JSON ("Options da action"): dá para colar o objeto
`options` e clicar **Aplicar** (validação por schema). Não cobre credencial, canal, destinatário nem "Aguardar resposta" (esses ficam
no form). Digitar JSON de uma linha no editor funciona sem duplicar chaves/colchetes.

**Botões (`whatsapp-cloud`, action `Enviar botões`).**
- Máximo 3 botões, título até 20 caracteres. Cada botão pode ter `examples: string[]` ("Outras formas de dizer este botão").
- Opções do bloco (fora do JSON de options): `awaitReply`, **`understandTypedReply`** ("Entender texto digitado": o motor tenta reconhecer o
  botão pelo título e pelos exemplos quando o cliente digita; se não reconhecer, segue como hoje), "Reapresentar o grupo inteiro"
  (reenvia todos os blocos do grupo; cuidado com Código/Webhook/Esperar) e follow-up por inatividade (janela de 24h da Meta).
- Saídas no card: uma por botão + **"Outro"**. Sem "Outro" ligado: reapresenta o menu; após 3 tentativas inválidas pausa em silêncio.
  Também vale o evento global "Inválida"; a saída "Outro" e o evento têm precedência sobre o padrão.
- Efeito para o conversor: `contains [sim, ok, vamos…]` do Blip pode virar exemplos do botão ("Sim") + `understandTypedReply`, sem Condição.

**Transferir p/ humano (`transferToQueue`).** Opções: `{queueId, outOfHoursEdgeId}`. Filas listadas: "Simples Celular" e "Tim-1".
A saída "Fora do horário" **não** é `outgoingEdgeId` do bloco: é uma aresta `from:{blockId}` (sem `itemId`) cujo id fica em
`options.outOfHoursEdgeId`. Ligada: com a fila fechada o cliente segue por ela; desligada: transfere sempre e a mensagem de fora do horário
da fila continua valendo. O horário é copiado da fila ao salvar/publicar. No Visualizar: "Handoff → fila (preview: motor para aqui)".
**O importador precisa remapear `outOfHoursEdgeId`** (como remapeia `outgoingEdgeId`); no simulador do conversor (`importer-sim.ts`) idem.

**Esperar (`Wait`).** `{secondsToWaitFor: "1"}` (string; aceita dígitos ou `{{var}}`; máximo 60 s, acima é saturado pelo motor).

**Classificar resposta (`classifyReply`).** `options.text` (padrão `{{last_message}}`); `items[]` com `content:{value, examples[]}`
(até 20 opções, cada uma vira uma saída); modelos prontos "Sim / Não / Atendente" (3 opções, 13 a 27 exemplos cada) e "Oferta: aceitar /
recusar / atendente"; "Usar IA quando não reconhecer"; salvar o resultado em variáveis. Saídas fixas: **Ofensa** (vence tudo, se ligada),
a opção reconhecida e **Não reconheceu** (sem ela, o motor desvia para o evento "Inválida"). Para sentimento: `{{last_sentiment}}`.
É o equivalente nativo do "input + conditions por texto" do Blip. O simulador do editor aproxima (frase igual ou contida num exemplo).

**Canvas.**
- Arrastar da paleta **às vezes só aparece depois** (a tela renderiza o grupo com atraso de uma ação). Eu repeti o arrasto e
  criei grupos duplicados: três `transferToQueue` (dois com `queueId:""`, fora da tela, em y≈-560) e dois Classificar. Conferir pelo
  JSON (`groups`) antes de repetir um arrasto.
- Excluir grupo: clicar no título abre "Editar grupo" com **Excluir grupo** (pede confirmação; apaga as conexões). **Delete** com o painel
  aberto apaga o texto do título, não o grupo.
- Soltar um bloco perto de um grupo existente pode anexá-lo ao grupo; longe, cria grupo novo.
- Ao digitar na mensagem do Texto, `ctrl+a` antes de digitar deixou um "a" no começo; usar triple-click para selecionar.
- O Visualizar não mostra caixa de texto quando o passo espera botão: o "Entender texto digitado" não dá para testar ali.

**Execução no Visualizar.** Sim → "Handoff → fila … (preview: motor para aqui)" + "Fluxo finalizado"; Não → texto de agradecimento + "Encerrar
sessão (preview: motor fecharia aqui)". As saídas "Fora do horário" e "Outro" não são exercitadas pelo simulador.

### Regras de montagem combinadas com o Renan (02/11/2026)

- **Nome do grupo = propósito** (ex.: "Confirma continuar atendimento", "Direciona para atendente", "Fora do horário de atendimento",
  "Agradecimento final"). Renomear: clicar no título do grupo → campo "Título do grupo".
- **Vários blocos no mesmo grupo**, na ordem de execução (Texto → Registrar evento → Transferir; Registrar evento → Texto → Encerrar).
  No builder: arrastar o bloco da paleta até sobrepor o grupo e **manter ~2 s** antes de soltar; depois ajustar a posição entre os blocos.
  Eu não consigo segurar o mouse com a ferramenta de clique/arrasto; reproduzi o gesto disparando eventos de ponteiro pela página
  (pointerdown, movimentos, pausa de 2,5 s sobre a metade de baixo do último bloco do grupo, pointerup) e o bloco entrou no fim do grupo.
  Arrasto simples cai fora de grupo e cria grupo novo.
- **Só o necessário no fluxo final**: nada de grupos de teste (Esperar, Classificar vazio, duplicados).
- **O Visualizar não é verdade absoluta**: o que ele não executa pode funcionar no motor; o Renan testa o fluxo no fim.
  Os testes no Visualizar servem para conhecer os componentes.
- **Aba antiga trava o salvamento**: depois de uma atualização do servidor, a aba aberta mostra "Erro ao salvar — Server Action … was not
  found on the server". Recarregar descarta o que não foi salvo (e o aviso "Leave site?" impede navegar). Abrir o fluxo numa aba nova e
  conferir o JSON salvo antes de continuar. Uma aba velha com mudanças pendentes pode, ao voltar a salvar, sobrescrever o fluxo.
- Remover um grupo-destino apaga a aresta, mas o bloco de origem pode ficar com `outgoingEdgeId` (aparece ⚠ no bloco seguinte do mesmo grupo).

### Bot 2: `bkovivofixamsgativaah` — "Vivo BKO MsgAt AH (manual)"

Núcleo da jornada de atendimento humano da mensagem ativa (4 grupos, 12 blocos, 4 arestas): "Confirma continuar atendimento" (Botões Sim/Não
com exemplos: sim, quero, desejo, ok, vamos, pode ser, beleza, saber mais / nao, cancela, agora não, com "Entender texto digitado") →
Sim: "Direciona para atendente" (Texto + Registrar evento `AtendimentosRealizados` + Transferir p/ humano, fila Tim-1) → "Fora do horário" →
"Fora do horário de atendimento" (Registrar evento `Fora Horario Atendimento` + Texto + Encerrar); Não: "Agradecimento final" (Texto + Encerrar).
O script de horário (WORKSCHEDULE/CheckWorkTime) e a Condição `isWorkTime` do Blip ficam substituídos pela saída "Fora do horário" da fila
(decisão de negócio a confirmar). Não incluí o resto (cadastro de dados, pesquisa de satisfação, redirecionamentos).

### Bot 3: `vivoitvplanos` — "Vivo ITV Planos - Fechamento do pedido (manual)"

Recorte do fechamento da compra (7 grupos, 13 blocos, 9 arestas): "Confirma resumo do pedido" (Botões Correto ✅/Errado ❌) → "Aceite dos
termos" (Aceito ✅/Discordo ❌; Discordo → "Termos recusados", que volta ao aceite ou vai ao agradecimento) → "Conclui pedido na API"
(Webhook + Condição `api_ok` igual a `true`) → "Pedido realizado" (Texto com `{{idPedido}}` + Encerrar) ou "Erro ao concluir pedido" (Texto + Encerrar);
"Agradecimento final" (Texto + Encerrar). Fora do recorte: seleção de plano, CPF, telefone, e-mail, termos por API, redirecionamentos e a pesquisa.
Provisório (não vem do Blip): o texto de "Erro ao concluir pedido" e o destino do botão "Errado" (no Blip volta a "Checa oferta").

**Achados do builder neste bot**
- **Variáveis**: botão `(x)` do canvas → "+ Nova variável", nome + Enter cria (opção "Sessão" no formulário). Aparecem em "Custom"; as 27 de sistema
  não se criam. O seletor de variável da Condição e do mapeamento lista as custom e as de sistema (não filtra ao digitar).
- **Bloco "API" = tipo `Webhook`**: `options.webhook = {url, method, headers[], body}` (body é string JSON, aceita `"{{variavel}}"` em qualquer valor) e
  `responseVariableMapping = [{id, bodyPath, variableId}]` (ex.: `data.idPedido` → `idPedido`). A URL aceitou `{{resource.blip.vivoitvplanos.apiurl}}`.
  O motor grava sozinho `{{api_response}}` (body), `{{api_status}}` (HTTP), `{{api_ok}}` (true/false) e `{{api_debug}}`. O painel tem "Testar" e "Variáveis de teste".
  Equivale ao `ProcessHttp` + `isValid` do Blip: a Condição pode testar `api_ok`.
- **Condição**: o painel mostra "Branch 1" com Variável/Operador/Valor, "Adicionar comparação" e "Adicionar branch"; a saída "Senão" já existe.
  JSON: `items[{content:{comparisons:[{variableId:"api_ok", comparisonOperator:"Equal to", value:"true"}]}, outgoingEdgeId}]` e o `outgoingEdgeId` do bloco é o "Senão".
  `variableId` das variáveis de sistema é o próprio nome (`api_ok`).
- **Texto digitado em JSON de options**: `\n` literal vira quebra de linha; variáveis `{{planName}}` ficam no texto.
- No Visualizar, variável não preenchida aparece como `{{planName}}` e o Webhook é simulado ("Webhook simulado — continuar?") sem gravar `api_ok`,
  então a Condição cai no "Senão". Isso é limitação do simulador; o motor real pode se comportar diferente (o Renan testa no fim).

### Bots 4 a 11 (02/11/2026): duplicar o fluxo-base e adaptar

Depois dos três primeiros (montados do zero), os demais partiram de **Duplicar** (menu ⋯ da lista de fluxos) de um fluxo já pronto e foram adaptados
(textos, botões, URL, nomes). Duplicar copia grupos, blocos, arestas e variáveis custom, gera ids novos (os botões de grupos diferentes ficam com ids distintos
só no sufixo) e abre a cópia com o nome "… (cópia)"; renomear é pelo menu da lista (Renomear).

| Fluxo no Goatable (pasta "Teste Renan", rascunho) | Bot de origem | Recorte montado |
| --- | --- | --- |
| Vivo Abandono MsgAt AH (manual) | vivofixaabandonomsgatah | confirmação, transferência, fora do horário, agradecimento |
| Vivo BKO MsgAt AH (manual) | bkovivofixamsgativaah | idem, com eventos de jornada |
| Vivo ITV Planos - Fechamento do pedido (manual) | vivoitvplanos | resumo, termos, API de conclusão, pedido/erro |
| Vivo IPTV e ITV Planos - Fechamento do pedido (manual) | vivoiptveitvplanos | plano+termos (3 botões), termos recusados, API, pedido, erro volta à confirmação |
| Vivo Seguros - Resumo e conclusão do pedido (manual) | vivoseguros | resumo, Lista "Qual dado deseja corrigir?", API, pedido concluído |
| Vivo Seguro Celular - Resumo, código SMS e conclusão do pedido (manual) | vivosegurocelular | + pede código SMS (Texto que aguarda), valida código (Webhook + Condição `api_ok`), código inválido ("Reenviar Código") |
| Vivo IPTV WPP - Termos e conclusão do pedido (manual) | vivoiptvwpp | termo IPTV, termos negados, API, pedido, erro |
| Vivo Total Dados - Termos e conclusão (manual) | vivototaldados | termo do plano, recusa, aceite na API, pedido finalizado |
| Vivo Total Planos WPP Novo - Confirma endereço (manual) | vivototalplanoswppnovo | confirma endereço, Lista com 8 campos a corrigir, API de endereço, erro |
| Vivo Fixa WhatsApp - Confirma endereço e atendimento humano (manual) | vivofixawhatsapp | idem + opção de atendimento, transferência com "Fora do horário", encerramentos |
| Vivo Fibra Subida 17 - Confirma endereço e atendimento humano (manual) | fibrasubida17 | idem ao Fixa WhatsApp; só a URL do Webhook muda |
| Vivo Fixa Dados - CPF (manual) | vivofixadados | pede CPF (Texto que aguarda), valida com regex, CPF inválido (volta a validar), consulta GET na API + Condição `api_ok`, erro volta a pedir o CPF |

Textos, botões e nomes vêm dos estados do Blip (mensagens, `[opções]` dos botões, listas de `contains` como exemplos). **Provisório (não vem do Blip):** textos de erro dos
recortes iptveitv/totaldados, destino do botão "Errado" no ITV Planos, o laço Erro → Opção de atendimento no Fixa WhatsApp e as URLs `{{resource.blip.<bot>.<chave>}}`.
Variáveis custom foram criadas só quando o texto as usa (`planName`, `price`, `termo`, `idPedido`, `resumo`, `confirma`, `marca`… `cep`, `uf`, `somaPreco`).

**Novos achados do builder**
- **Lista** (`Enviar lista`): `options = {action, bodyText, buttonText, headerText, footerText, sections:[{title, rows:[{id,title}]}]}`; aceita "Aguardar resposta" e "Entender texto digitado"
  (cada linha vira uma saída no card, mais "Outro"). 8 linhas foram aceitas.
- **Encerrar sessão** tem "Motivo (opcional)" (`session.metadata.end_reason`, aceita `{{var}}`, 200 caracteres): aparece no relatório de "por que encerrou". É bloco terminal.
- Excluir o último bloco de um grupo **exclui o grupo**. Excluir um grupo apaga as arestas ligadas.
- Texto: com o campo vazio, `ctrl+a` digita um "a" (o texto fica "aOlá…"); clicar no campo, `ctrl+a`, digitar funciona só depois de haver texto. Conferir o cartão do bloco.
- Webhook: o painel mostra "Body (JSON)", "Variáveis de teste" e "Mapear resposta" (`bodyPath` → variável). A saída da Condição que sobra no fim do grupo é o "Senão".
- Duplicar não duplica o aviso de variáveis: as custom vêm junto, mas as novas têm de ser criadas no fluxo copiado.
- **Armadilhas da lista de fluxos:** um menu ⋯ que ficou aberto continua recebendo cliques; um clique "novo" em outra linha caiu em **Publicar** (nada foi publicado, o "Public ID" seguiu
  "publique primeiro") e em **Arquivar** (cancelei no diálogo). Recarregar a lista antes de abrir um menu e conferir de qual linha ele é. Uma duplicação foi feita no fluxo errado
  ("Vivo ITV AH (manual)") e a cópia foi excluída.
- **Operadores da Condição no painel (pt-BR)**: Igual a, Diferente de, Contém, Não contém, Maior que, Maior ou igual a, Menor que, Menor ou igual a, Está preenchido, Está vazio,
  Começa com, Termina com, **Casa com regex**, Não casa com regex. No seletor de variável da Condição a lista não filtra ao digitar nem rola com a roda: **passar o mouse sobre a seta
  inferior rola a lista**; `last_message` fica depois de `last_intent`.
- **CPF no Visualizar** (fluxo "Vivo Fixa Dados - CPF"): `last_message` **Casa com regex** `^\D*(\d\D*){11}$` rejeitou "123" e aceitou "529.982.247-25" (executa no simulador, "Condição rejeitada/aceita");
  `{{last_message}}` dentro da URL do Webhook GET é interpolado. O método do Webhook é um seletor (GET, POST, PUT, PATCH, DELETE).
- **Sessão expirada**: o sinal é "Erro ao salvar — An unexpected response was received from the server" (e, mais cedo, "Server Action … was not found"). Abrir o fluxo numa aba nova
  redireciona para `/auth/sign-in`; é preciso entrar de novo (o agente não digita senha). Alterações não salvas da aba antiga se perdem.

### Análise dos JSONs exportados (03/11/2026)

Os 12 fluxos foram exportados pelo menu ⋯ → Exportar (download em `Downloads\vivo-<nome>.json`) e copiados para `scenarios/builder-goatable/exports/`
(2 a 9 grupos, 5 a 11 blocos, 4 a 9 arestas por fluxo; 54 Texto/Botões/Lista, 19 `endSession`, 11 `Webhook`, 10 `Condition`, 4 `transferToQueue`, 2 `journeyEvent`).
Checagens feitas por script sobre todos os arquivos: **0 arestas sem origem, 0 arestas órfãs, 0 destinos inexistentes, 0 blocos com saída que não sejam o último do grupo**; toda `{{variável}}`
usada nos textos está declarada (as de `resource.*` não contam).

**Formato do export (confirmado)**
- Raiz: `id, createdAt, updatedAt, name, folderId, groups, events, variables, edges, publicId (null), organizationId, isArchived, isClosed`.
- Grupo: `id, title, blocks, graphCoordinates{x,y}`. Evento: só `start` (`id, type, outgoingEdgeId, graphCoordinates`).
- Aresta: `{id, from, to:{groupId}}` com `from` em três formas: `{eventId}`, `{blockId}` (saída do bloco: último bloco do grupo, **Senão** da Condição e **Fora do horário** da fila) e `{blockId, itemId}`
  (botão ou branch da Condição). Nunca `to.blockId`.
- Variáveis: as 27 de sistema têm `id == name` e `isSessionVariable:true`; as custom têm UUID v7 e `isSessionVariable:false`. A Condição referencia a de sistema pelo nome (`variableId:"api_ok"`,
  `"last_message"`) e a custom pelo UUID.
- IDs gerados pelo editor são UUID v7; o `id` de botão digitado à mão (`b1`) é preservado, o de **linha de Lista** é regenerado (UUID).
- Opções que o editor **grava**: Texto `{to:"{{wa_id}}", channel:"{{channel}}", action, body, cards:[], buttons:[], sections:[]}` (+ `awaitReply` quando marcado); Botões `{to, channel, action, bodyText, buttons[{id,title,examples?,outgoingEdgeId?}], awaitReply, understandTypedReply}`;
  Lista `{…, bodyText, buttonText, headerText, footerText, sections[{title, rows[{id,title}]}], awaitReply, understandTypedReply}`; `endSession {}`; `journeyEvent {eventName, payload:[]}`;
  `transferToQueue {queueId, outOfHoursEdgeId}`; `Webhook {webhook:{url, method, headers:[], body}, responseVariableMapping:[{id, bodyPath, variableId}]}`;
  `Condition` sem opções, com `items[{id, content:{comparisons[{id, variableId, comparisonOperator, value}]}, outgoingEdgeId}]` e `outgoingEdgeId` no próprio bloco (= Senão).
- **Ausentes no export do builder, presentes no que o conversor emite**: `credentialsId`, `replyVariableId`, `followUp` (nos Botões); `isCustomBody`, `timeout`, `queryParams`, `id` nos headers (no Webhook).
  Ou seja, o builder omite o que está no padrão; o importador aceitou o formato mais completo do conversor nos testes 1 a 6. Os operadores gravados são os nomes em inglês (`Equal to`, `Matches regex`).
- `Texto` que aguarda resposta guarda `awaitReply:true` em `options` e **não** tem `understandTypedReply` (só Botões e Lista têm).
- Condição de um só branch + Senão: o branch vira `items[0]` e o Senão é o `outgoingEdgeId` do bloco; sem aresta no Senão o campo some.

**Observações sobre os fluxos montados**
- **Variáveis sobrando**: Duplicar leva todas as variáveis custom do fluxo de origem. Sobraram sem uso: `termo`, `planoEscolhido1`, `somaPreco`, `email`, `cpf`, `resumo`, `confirma` em 7 dos 12 fluxos
  (Fixa WhatsApp e Fibra Subida 17 têm 15 custom e usam 10). A poda do conversor (variáveis sem leitor) já cobre isso; no builder é preciso apagá-las à mão.
- Nenhum fluxo tem `credentialsId`; os blocos de envio ficaram sem credencial e o painel não reclamou ao salvar (a credencial/canal vem de `to`/`channel`, `{{wa_id}}` e `{{channel}}`).
- `publicId` é `null` em todos: nada foi publicado.

**O que isso muda no conversor (lista para a seção 8)**
1. Botões com `examples` e `understandTypedReply:true` no lugar do `contains` por Condição (o Blip tem ~42 botões só no `vivofixadados`).
2. `Lista` quando houver mais de 3 opções (ex.: "Qual dado deseja corrigir?"), com `sections[].rows[]` e ids de linha gerados pelo conversor.
3. `transferToQueue {queueId, outOfHoursEdgeId}` com aresta `from:{blockId}` para o "Fora do horário"; precisa de fila real.
4. Condição com Webhook: usar `api_ok`/`api_status` (variáveis de sistema, `variableId` = nome) no lugar de `responseX@isValid`/`statusX`.
5. `Casa com regex` = `Matches regex` (já usado) e `last_message` como entrada do texto digitado.
6. Não emitir `credentialsId:""`, `replyVariableId:""`, `timeout`/`isCustomBody` padrão quando vazios (o builder os omite); confirmar no importador antes.
7. Agrupar blocos que o Blip separa só por "SendMessage + chat-state composing" no mesmo grupo (ordem = execução), como foi feito à mão.

### Ajustes aplicados ao conversor (03/11/2026) e o que ficou de fora

Aplicado (204 testes verdes; pacote do piloto regenerado):
- **Item 6 (parcial): `credentialsId` vazio deixa de ser emitido** (`src/emit/defaults.ts`, opção `omitEmptyDefaults`, padrão ligado; estatística em `ConvertedBot.defaults`). No `vivofixadados`: 103 blocos de envio sem o
  campo (antes 103 com `""`), 1.359.382 → 1.357.425 bytes. O LEIA-ME do pacote foi atualizado. **Não** removi `timeout:30`, `isCustomBody` e `queryParams:[]` do Webhook: o builder os omite, mas o
  efeito no motor real (timeout padrão, tratamento do corpo) não foi verificado.
- **Item 3 (preparo): a saída "Fora do horário" do `transferToQueue` passa a ser entendida pelo conversor.** O validador confere que `options.outOfHoursEdgeId` aponta para uma aresta que parte do próprio bloco; o
  enxugamento (`slim`) segue essa aresta ao calcular grupos alcançáveis; o simulador de importação já remapeia qualquer `*EdgeId`. Nada é emitido ainda: continua faltando fila real e decisão de negócio
  (trocar script de horário + Condição pela saída da fila).
- **Regressão sobre o builder (`test/builder-exports.test.ts`, 20 testes):** os 12 fluxos exportados passam em `validateKayrosDocument` e `validateImportSafety`; nenhum bloco de envio traz `credentialsId`;
  "Fora do horário" é aresta `from:{blockId}`; `omitEmptyDefaults` e a validação de `outOfHoursEdgeId`. Fixtures em `scenarios/builder-goatable/exports/`. (Os ramos de Condição sem aresta
  que o validador de referências aponta em 4 fluxos são os ramos de sucesso que deixei sem destino de propósito.)

Não aplicado, com o motivo:
- **Item 4 (`api_ok`/`api_status` no lugar de `responseX@isValid`/`statusX`):** o conversor já copia `api_status`/`api_response` para as variáveis do Blip logo após cada Webhook e as Condições reproduzem o teste do Blip
  (`status startsWith 3/4/5`, `isValid`). Trocar por `api_ok` muda a regra (HTTP 2xx não significa `isValid:true`) e exige reescrever os predicados; fica como decisão de negócio por integração.
- **Item 1 (Botões com `examples` + `understandTypedReply`) e item 2 (Lista):** a Lista para 4 a 10 opções já existia no emissor (`messages.ts`). Ligar `understandTypedReply` sem ligar cada botão a uma saída
  (aresta no botão, em vez da Condição depois da resposta) deixaria o texto digitado sem destino; a troca precisa reestruturar `state.ts` (menu → saídas nativas) e foi mantida como próxima etapa.
- **Item 5 e 7:** `Matches regex` sobre `last_message` já é o que o conversor emite para `Starts with`/`Ends with`; agrupar blocos do mesmo estado já é o comportamento do emissor (um grupo por estado).

## 10. Não verificado

- Se os operadores que falham no Visualizar funcionam no motor real (canal de teste), e se `Matches regex` com `^`/`$` se comporta igual lá.
- Efeito da opção "Sessão" nas variáveis.
- Por que o painel do Código não gravou o `name` na montagem manual.
- Se o retorno do código em modo código é gravado na variável alvo, e se `{{x}}` dentro do código vira literal JS (a fusão depende da convenção dos Codes gerados).
- Execução do `vivofixadados` regenerado de ponta a ponta (o editor não carrega o fluxo completo; usar um recorte).
- Se o motor real reconhece o botão a partir de texto digitado (`understandTypedReply` + `examples`) e como o "Outro" se comporta; o Visualizar não permite digitar nesse passo.
- Se a saída "Fora do horário" (`outOfHoursEdgeId`) segue mesmo com a fila aberta/fechada como descrito, e se o importador remapeia esse id (testar importando um JSON com `outOfHoursEdgeId`).
- Execução do Classificar resposta (reconhecimento, "Não reconheceu", "Ofensa") e a forma exata das saídas "Não reconheceu"/"Ofensa" no JSON (não ligadas nesta montagem).
