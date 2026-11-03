# Jornada vivofixadados — efeito original → bloco emitido

Gerado por `report`. Cada linha liga um elemento da Blip (arquivo + caminho JSON) ao que o conversor emitiu. “— (nao emitido)” indica adaptação (veja `adaptations.json`).

## CPF

Origem: `bots/vivofixadados-213cf7299e99/fluxo-vivofixadados-213cf7299e99.json#/configuracoes_gerais/fluxo/flow/6edb0c7c-d6e1-42b3-ab10-6ad3992286b1` · estado `6edb0c7c-d6e1-42b3-ab10-6ad3992286b1`

| Fase | Elemento original | Blocos emitidos | Adaptações |
| --- | --- | --- | --- |
| entrada | SetVariable — abandono - cpf | Set variable | ttl-session |
| entrada | SetVariable — etapaBi = Cpf | Set variable | ttl-session |
| entrada | TrackEvent — Cpf exibicao | journeyEvent |  |
| entrada | TrackEvent — Cpf 2 {{tunnel.owner}} exibicao | journeyEvent |  |
| entrada | MergeContact — Etapa Cpf (condicional) | Set variable | merge-contact-session |
| entrada | TrackEvent — Tracking “Cpf exibicao” | journeyEvent |  |
| conteudo | text text/plain | whatsapp-cloud |  |
| input | aguarda resposta (expiracao 0:25 = 25 min) | whatsapp-cloud awaitReply | input-timeout-followup |
| saida | ExecuteScript — semNumero | Code |  |
| saida | ExecuteScript — Valida cPF | Code |  |
| saida | MergeContact — Define CPF (condicional) | Set variable | merge-contact-session |
| saida | TrackEvent — CPF selecao I Verdadeiro (condicional) | journeyEvent |  |
| saida | TrackEvent — Cpf selecao I Falso (condicional) | journeyEvent |  |
| saida | TrackEvent — Cpf input (condicional) | journeyEvent |  |
| saida | TrackEvent — Cpf 2 {{tunnel.owner}} selecao - Correto (condicional) | journeyEvent |  |
| saida | TrackEvent — Cpf 2 {{tunnel.owner}} selecao - Errado (condicional) | journeyEvent |  |
| saida | TrackEvent — Cpf 2 {{tunnel.owner}} input (condicional) | journeyEvent |  |
| saida | MergeContact — 8.1 Cpf erro (condicional) | Set variable | merge-contact-session |
| decisao | input notExists → {{idAbandono}} | Condition / aresta | dynamic-destination-router |
| decisao | input exists → Valida CPF | Condition / aresta |  |
| decisao | padrao → Exceções | Condition / aresta |  |

## Valida CPF

Origem: `bots/vivofixadados-213cf7299e99/fluxo-vivofixadados-213cf7299e99.json#/configuracoes_gerais/fluxo/flow/274bf638-11e3-428c-812f-2c8d2eaa8ec6` · estado `274bf638-11e3-428c-812f-2c8d2eaa8ec6`

| Fase | Elemento original | Blocos emitidos | Adaptações |
| --- | --- | --- | --- |
| input | sem espera | — |  |
| saida | ExecuteScript — semNumero | Code |  |
| saida | ExecuteScript — Valida cPF | Code |  |
| saida | MergeContact — Define CPF (condicional) | Set variable | merge-contact-session |
| saida | TrackEvent — CPF selecao I Verdadeiro (condicional) | journeyEvent |  |
| saida | MergeContact — 8.1 Cpf erro (condicional) | Set variable | merge-contact-session |
| saida | ExecuteScript — Adiciona Variável BI (apenas cpf) (condicional) | Code |  |
| saida | TrackEvent — CPF selecao - CPF valido (condicional) | journeyEvent |  |
| saida | TrackEvent — CPF selecao - CPF invalido (condicional) | journeyEvent |  |
| saida | TrackEvent — CPF input (condicional) | journeyEvent |  |
| saida | TrackEvent — CPF audio (condicional) | journeyEvent |  |
| decisao | context:semNumero equals ["semNumero"] → Exceções | Condition / aresta |  |
| decisao | context:cpf equals ["false"] → DI CPF | Condition / aresta |  |
| decisao | context:cpf notEquals ["false"] → API Busca CPF | Condition / aresta |  |
| decisao | padrao → API Busca CPF | Condition / aresta |  |

## DI CPF

Origem: `bots/vivofixadados-213cf7299e99/fluxo-vivofixadados-213cf7299e99.json#/configuracoes_gerais/fluxo/flow/32c3d55c-d7ca-402b-8ee5-7c77f895add4` · estado `32c3d55c-d7ca-402b-8ee5-7c77f895add4`

| Fase | Elemento original | Blocos emitidos | Adaptações |
| --- | --- | --- | --- |
| entrada | SetVariable — etapaBi = CpfInvalido | Set variable | ttl-session |
| entrada | TrackEvent — Cpf invalido exibicao | journeyEvent |  |
| entrada | TrackEvent — Tracking “Cpf invalido exibicao” | journeyEvent |  |
| conteudo | text text/plain | whatsapp-cloud |  |
| input | aguarda resposta (expiracao 0:15 = 15 min) | whatsapp-cloud awaitReply | input-timeout-followup |
| decisao | input notExists → {{idAbandono}} | Condition / aresta | dynamic-destination-router |
| decisao | input exists → Valida CPF | Condition / aresta |  |
| decisao | padrao → Exceções | Condition / aresta |  |

## API Busca CPF

Origem: `bots/vivofixadados-213cf7299e99/fluxo-vivofixadados-213cf7299e99.json#/configuracoes_gerais/fluxo/flow/ff462f6e-80ac-4f21-9f11-d332d88d612f` · estado `ff462f6e-80ac-4f21-9f11-d332d88d612f`

| Fase | Elemento original | Blocos emitidos | Adaptações |
| --- | --- | --- | --- |
| input | sem espera | — |  |
| saida | ProcessHttp — Consulta CPF | Webhook, Set variable x2 |  |
| saida | MergeContact — Define CPF (condicional) | Code, Set variable x5 | merge-contact-session |
| saida | TrackEvent — Cpf selecao - Correto (condicional) | journeyEvent |  |
| saida | TrackEvent — Cpf selecao - Incorreto (condicional) | journeyEvent |  |
| saida | TrackEvent — Cpf input (condicional) | journeyEvent |  |
| decisao | input exists → API Dados Pessoais | Condition / aresta |  |
| decisao | padrao → API Dados Pessoais | Condition / aresta |  |

## API Dados Pessoais

Origem: `bots/vivofixadados-213cf7299e99/fluxo-vivofixadados-213cf7299e99.json#/configuracoes_gerais/fluxo/flow/8f190714-2062-4272-9eb6-43215732da8d` · estado `8f190714-2062-4272-9eb6-43215732da8d`

| Fase | Elemento original | Blocos emitidos | Adaptações |
| --- | --- | --- | --- |
| input | sem espera | — |  |
| saida | ExecuteScript — bodyDadosPessoais | Code |  |
| saida | ProcessHttp — API Dados Pessoais | Webhook, Set variable x2 |  |
| decisao | context:statusDadosPessoais startsWith ["3","4","5"] → Erro API Dados Pessoais | Condition / aresta |  |
| decisao | context:responseDadosPessoais@isValid contains ["false"] → Erro API Dados Pessoais | Condition / aresta |  |
| decisao | context:responseDadosPessoais@data equals ["null"] → Erro API Dados Pessoais | Condition / aresta |  |
| decisao | context:msgAtivaReagendamento equals ["true"] E context:contact.extras.vencimentoFatura exists → Valida Vencimento | Condition / aresta |  |
| decisao | context:confirmaDadosNovo equals ["true"] → API Fatura | Condition / aresta |  |
| decisao | context:alteraVencimentoNovo equals ["true"] → Vencimento WPP | Condition / aresta |  |
| decisao | context:dadosPessoaisVencimento equals ["true"] → API Fatura | Condition / aresta |  |
| decisao | input exists → Vencimento WPP | Condition / aresta |  |
| decisao | padrao → Vencimento WPP | Condition / aresta |  |

## Erro API Dados Pessoais

Origem: `bots/vivofixadados-213cf7299e99/fluxo-vivofixadados-213cf7299e99.json#/configuracoes_gerais/fluxo/flow/69eb4580-058c-4256-9f33-36ee6a86bda8` · estado `69eb4580-058c-4256-9f33-36ee6a86bda8`

| Fase | Elemento original | Blocos emitidos | Adaptações |
| --- | --- | --- | --- |
| conteudo | text text/plain | whatsapp-cloud |  |
| input | sem espera | — |  |
| decisao | input exists → Email | Condition / aresta |  |
| decisao | padrao → Email | Condition / aresta |  |

## Abandono CPF

Origem: `bots/vivofixadados-213cf7299e99/fluxo-vivofixadados-213cf7299e99.json#/configuracoes_gerais/fluxo/flow/99e09c5e-0d6c-49fc-abba-e2d66a90f06d` · estado `99e09c5e-0d6c-49fc-abba-e2d66a90f06d`

| Fase | Elemento original | Blocos emitidos | Adaptações |
| --- | --- | --- | --- |
| entrada | MergeContact — blocoAnterior (condicional) | Set variable | merge-contact-session |
| entrada | MergeContact — 44. Carrrinho abandonado wpp (condicional) | Set variable | merge-contact-session |
| entrada | MergeContact — Etapa Carrinho abandonado (condicional) | Set variable | merge-contact-session |
| entrada | ExecuteScript — bodyAbandono1 | Code |  |
| entrada | ProcessHttp — API Abandono1 | Webhook, Set variable x2 |  |
| conteudo | text text/plain | whatsapp-cloud |  |
| conteudo | chatstate application/vnd.lime.chatstate+json | — (nao emitido) | typing-indicator-dropped |
| conteudo | raw application/json | whatsapp-cloud |  |
| input | aguarda resposta (expiracao 1:0 = 60 min) | whatsapp-cloud awaitReply | input-timeout-followup |
| saida | ExecuteScript — bodyRetorno1 (condicional) | Code |  |
| saida | ProcessHttp — API Retomada 1 | Webhook, Set variable x2 |  |
| saida | SetVariable — retomada (condicional) | Set variable |  |
| decisao | input notExists → {{abandono2D}} | Condition / aresta | dynamic-destination-router |
| decisao | input exists → Valida CPF | Condition / aresta |  |
| decisao | padrao → GPT - salva input | Condition / aresta |  |

## Exceções

Origem: `bots/vivofixadados-213cf7299e99/fluxo-vivofixadados-213cf7299e99.json#/configuracoes_gerais/fluxo/flow/fallback` · estado `fallback`

| Fase | Elemento original | Blocos emitidos | Adaptações |
| --- | --- | --- | --- |
| entrada | TrackEvent — Excecoes exibicao | journeyEvent |  |
| entrada | TrackEvent — Excecoes origem (condicional) | journeyEvent |  |
| entrada | SetVariable — blocoAnterior | Set variable | ttl-session |
| entrada | ExecuteScript — adicionaVariavelBI | Code |  |
| entrada | SetVariable — blocoAnteriorIA | Set variable |  |
| input | sem espera | — |  |
| decisao | input notExists → {{idAbandono}} | Condition / aresta | dynamic-destination-router |
| decisao | context:input.content@type contains ["audio","image","documento","arquivo","pdf","mp4"] → Msg Arquivos | Condition / aresta |  |
| decisao | input exists → GPT - salva input | Condition / aresta |  |
| decisao | padrao → Início | Condition / aresta |  |

## Flows Email, CPF e Vencimento

Origem: `bots/vivofixadados-213cf7299e99/fluxo-vivofixadados-213cf7299e99.json#/configuracoes_gerais/fluxo/flow/f1c50ea9-3cdf-4bf6-be41-a192934403cf` · estado `f1c50ea9-3cdf-4bf6-be41-a192934403cf`

| Fase | Elemento original | Blocos emitidos | Adaptações |
| --- | --- | --- | --- |
| entrada | SetVariable — etapaBi = FlowsEmailCpfVencimento | Set variable | ttl-session |
| entrada | TrackEvent — Tracking “Flows email cpf vencimento exibicao” | journeyEvent |  |
| entrada | MergeContact — flowsEmailCpfVencimento | Set variable | merge-contact-session |
| entrada | ExecuteScript — flowsDadosPessoais (condicional) | Code |  |
| entrada | MergeContact — Definir contato | Set variable | merge-contact-session |
| entrada | ExecuteScript — flowsDadosPessoaisTeste (condicional) | Code |  |
| conteudo | chatstate application/vnd.lime.chatstate+json | — (nao emitido) | typing-indicator-dropped |
| conteudo | raw application/json | whatsapp-cloud |  |
| input | aguarda resposta (expiracao 0:25 = 25 min) | whatsapp-cloud awaitReply | input-timeout-followup |
| saida | ExecuteScript — SET Inf Email, CPF, Vencimento (condicional) | Code |  |
| saida | MergeContact — salva dados, BI (condicional) | Code, Set variable x7 | merge-contact-session |
| saida | SetVariable — cpf | Set variable |  |
| saida | ExecuteScript — Adiciona Variável (condicional) | Code |  |
| saida | SetVariable — dadosPessoaisVencimento (condicional) | Set variable | ttl-session |
| saida | TrackEvent — Flows agendamento - valido (condicional) | journeyEvent |  |
| saida | TrackEvent — Flows agendamento - invalido (condicional) | journeyEvent |  |
| saida | TrackEvent — Flows agendamento input (condicional) | journeyEvent |  |
| saida | SetVariable — abandono - celular | Set variable | ttl-session |
| saida | TrackEvent — Flows dados pessoais audio (condicional) | journeyEvent |  |
| saida | SetVariable — Set resultadoFlows to input.message | Set variable |  |
| saida | MergeContact — Set phoneNumber (condicional) | Code, Set variable | merge-contact-session |
| decisao | input notExists → {{idAbandono}} | Condition / aresta | dynamic-destination-router |
| decisao | input equals ["continuar"] → Email | Condition / aresta |  |
| decisao | input equals ["testeVivo"] → Abandono Geral 2D | Condition / aresta |  |
| decisao | context:input.message@content equals ["Sent"] E context:cpf notEquals ["null"] E context:contact.email exists → API Busca CPF | Condition / aresta |  |
| decisao | padrao → Exceções | Condition / aresta |  |

