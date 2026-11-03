# Pendências externas e responsáveis (F0-06)

Papéis: **DEV** (implementação), **NEG** (resultados e aceite), **OPS** (configurações reais, importação, homologação). Os três papéis são exercidos pelo usuário (confirmado em 02/11/2026). Isso vale para aceites, confirmações e homologação; como não há segunda pessoa revisando, cada aceite exige evidência registrada em arquivo.

| Papel | Nome |
| --- | --- |
| DEV | Renan (usuário) |
| NEG | Renan (usuário) |
| OPS | Renan (usuário) |

## Decisões do responsável (02/11/2026)
| Tema | Decisão | Efeito |
| --- | --- | --- |
| Contrato API CPF | Extrair do fluxo (ProcessHttp do JSON); o responsável confirma | DEV monta o contrato a partir da origem; segredos/valores dos Recursos são preenchidos depois no Kayros |
| Persistência | Só sessão + adaptação registrada | Dados duráveis do piloto viram adaptação (re-perguntar); nenhum serviço novo |
| Atendimento | Fila única + aviso fora do horário | `transferToQueue` só com fila informada; sem fila, ramo alternativo explícito |
| Resultados P-01…P-08 | DEV deriva do grafo, responsável revisa | Lista entregue para aprovar/corrigir, com evidência em arquivo |
| Abandono (`idAbandono`) | DEV rastreia os valores possíveis e propõe o mapa de destinos; responsável confirma | Destino desconhecido cai em tratamento documentado, nunca no primeiro estado |
| Formato de `expiration` | Horas:minutos (`0:25` = 25 min; `1:0` = 1 h) — informado pelo responsável, ainda não conferido no SDK Blip | Base do mapeamento de timeout (F3-05); revisar se a conferência divergir |
| Organização, número e bot de entrada | Não necessários: os JSONs serão importados manualmente | `organizationId`, `phoneNumberId`, `entryLogicalBot` deixam de ser pendência |

## Prioridade 1 — dados do piloto (`vivofixadados`, recorte CPF)
| # | Pendência | Fonte esperada | Quem confirma | Impacto se faltar | Alternativa nativa proposta |
| --- | --- | --- | --- | --- | --- |
| 1 | Contrato API CPF: URL (`config.apiHub`), método, autenticação, erros | Documento da API / equipe do serviço | OPS | F3-01/F3-09 bloqueados | Consulta não é executada; caminho segue para pergunta contextualizada/atendimento, sem sucesso fabricado |
| 2 | Valor/override dos Recursos `apiHub`, `apiurl` e tokens (segredos só no gerenciador de Recursos) | Ambiente alvo | OPS | Webhook sem destino | Ramo "não configurado" explícito |
| 3 | Destino dinâmico `idAbandono` e regras de abandono | Responsável da jornada | NEG | Timeout sem destino | Abandono para fluxo `vivofixaabandonomsgatah` somente se alias confirmado |
| 4 | Persistência para MergeContact/extras (API ou base existente, chave do cliente, escopo, expiração) | Equipe de dados | OPS | Dados duráveis só na sessão | Re-perguntar dado; declarar adaptação |
| 5 | Fila, horário e alternativa fora do horário (Desk) | Operação de atendimento | OPS | `transferToQueue` sem fila | Pergunta contextualizada/encerramento aceito |
| 6 | Resultados de negócio dos casos P-01…P-08 | Negócio | NEG | F3-07 | — |
| 7 | Organização, número (`phoneNumberId`) e responsáveis de homologação | Operação | OPS | F3-08/F3-09 | — |

## Prioridade 2 — expansão (F5)
Aliases dos 35 destinos de Redirect · regras de router/entrada · definições dos Flows Meta (11 expressões; ids/Data Exchange) · agentes White Wall (prompts, memória, contrato; 10 agrupamentos) · filas dos 3 pontos Desk · pós-atendimento (`LeavingFromDesk` ×3) · 2 configurações ausentes (`config.autoriza`, `config.apiurl`) · 4 recursos externos (`resource.routerKey`, `flowId`, `flowIdDev`, `resource. flowIdDev` — grafia preservada) · 123 agrupamentos de integração · intenção personalizada "Nao finalizou".

## Como a ferramenta usa isto
`loadConfigFile()` devolve `pending` (diagnósticos `parameter_required`) a partir dos `null` do arquivo de configuração. Pendência não impede a análise estrutural (F1) nem a geração para revisão.
