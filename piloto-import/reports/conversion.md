# Relatorio de conversao

Perfil: `kayros-current-adapted` · conversor 0.4.0 · origem 2026-11-02T04-26-43-071Z-e44c3a22

> Pacote **gerado para revisao**. Nao esta homologado nem aceito; as adaptacoes abaixo exigem aceite por jornada antes da importacao manual.

| Bot | Situacao | Estados | Grupos | Blocos | Arestas | Erros estruturais | Diagnosticos |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| vivofixadados | structurally_valid | 129 | 597 | 1480 | 1418 | 0 | 343 |
| vivofixadados (teste: cpf) | structurally_valid | 129 | 598 | 1481 | 1419 | 0 | 343 |
| vivofixadados (teste: abandono-cpf) | structurally_valid | 129 | 598 | 1481 | 1419 | 0 | 343 |
| vivofixadados (teste: flows-email-cpf-e-vencimento) | structurally_valid | 129 | 598 | 1481 | 1419 | 0 | 343 |

Cobertura da origem: **1.541 de 1.541** elementos com traducao ou registro rastreavel (ver `coverage.json`).

## Orcamento por passada

Tetos do motor: 15 mensagens e 30 chamadas externas por passada.

| Bot | Passadas | Max. mensagens | Max. chamadas externas | Acima do teto |
| --- | ---: | ---: | ---: | ---: |
| vivofixadados | 58 | 6 | 11 | 0 |
| vivofixadados | 58 | 5 | 11 | 0 |
| vivofixadados | 58 | 5 | 11 | 0 |
| vivofixadados | 58 | 5 | 11 | 0 |

## Adaptacoes propostas

| Id | Tipo | Muda regra de negocio | Ocorrencias | Aceite |
| --- | --- | --- | ---: | --- |
| vivofixadados:blip-command | integration | sim | 4 | proposed |
| vivofixadados:compound-condition-code | validation | nao | 18 | proposed |
| vivofixadados:dynamic-destination-router | presentation | nao | 36 | proposed |
| vivofixadados:dynamic-raw-payload | presentation | nao | 5 | proposed |
| vivofixadados:flow-reply-detection | validation | sim | 33 | proposed |
| vivofixadados:html-markup-to-whatsapp | presentation | nao | 18 | proposed |
| vivofixadados:input-message-envelope | validation | sim | 17 | proposed |
| vivofixadados:input-regex-validation | validation | nao | 1 | proposed |
| vivofixadados:input-timeout-followup | wait | sim | 41 | proposed |
| vivofixadados:merge-contact-session | data | sim | 60 | accepted |
| vivofixadados:merge-contact-write-only-discard | data | sim | 103 | accepted |
| vivofixadados:redirect-context | integration | nao | 10 | proposed |
| vivofixadados:script-reads-message-envelope | validation | sim | 7 | proposed |
| vivofixadados:script-syntax-incompatible | validation | sim | 2 | proposed |
| vivofixadados:ttl-session | data | sim | 73 | accepted |
| vivofixadados:typing-indicator-dropped | presentation | nao | 63 | proposed |
| vivofixadados:wait-without-message:13af0f48 | wait | sim | 1 | accepted |
| vivofixadados:wait-without-message:51550a60 | wait | sim | 1 | accepted |
| vivofixadados:wait-without-message:5e7c8d2b | wait | sim | 1 | accepted |
| vivofixadados:wait-without-message:cd52b86a | wait | sim | 1 | accepted |

Adaptacoes que mudam regra de negocio e aguardam aceite: **6**.
