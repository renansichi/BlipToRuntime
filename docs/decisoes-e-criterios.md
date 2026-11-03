# Decisões confirmadas e critérios verificáveis (F0-01)

Fonte: `Analise Blip Kayros/ESPECIFICACAO-CONVERSOR-BLIP-KAYROS.md` (revisão 2.0, 02/11/2026), seção 1.1.
Cada decisão traz o critério que o projeto deve conseguir demonstrar e onde a verificação ocorre.

| Decisão | Regra | Critério verificável | Onde |
| --- | --- | --- | --- |
| Q01 | Entregas por etapas: piloto → expansão → 13 bots, aceite por jornada | Relatório com situação por jornada (`analyzed` … `accepted_for_manual_import`); caixa de F5-Bxx só marcada com aceite | F5, F6 |
| Q02 | Projeto separado e offline | Nenhum import de código Goatable; nenhum acesso de rede na conversão (teste que falha em `fetch`/`net`) | F0-04, F2-10 |
| Q03/Q04 | Manter o Kayros atual; adaptar o incompatível e registrar | Perfil `kayros-current-adapted` fixo; blocos fora de `SUPPORTED_BLOCK_TYPES` são erro (`KAYROS_BLOCK_TYPE_UNSUPPORTED`) | `src/profile` |
| Q05 | APIs de negócio compatíveis preservadas; integrações Blip adaptadas caso a caso | Cada ProcessHttp com binding `preserve_compatible_http` ou adaptação registrada | F2-07, F5 |
| Q06 | Só jornadas WhatsApp; outros canais ficam na origem | `target.channel` = `whatsapp` (schema); dependências de outros canais listadas no relatório | config, F1-06 |
| Q07 | Apresentação livre se preserva resultado; mudança funcional exige aceite | `Adaptation.changesBusinessBehavior` + `acceptance` com responsável/data/evidência; aceite incompleto é `CONFIG_ACCEPTANCE_INCOMPLETE` | `src/config` |
| Q08 | Temporário na sessão; durável em API/base existente; novo serviço só com necessidade demonstrada | `persistentStorage.kind = null` gera `CONTACT_PERSISTENCE_UNCONFIRMED`; nunca gravação fictícia | config, F3-03 |
| Q09 | Espera dispensável removida; necessária vira pergunta contextualizada | Diagnóstico `WAIT_WITHOUT_MESSAGE` por ocorrência (196 candidatas) | F1-07, F3-02 |
| Q10 | Transferência nativa; pós-atendimento em fluxo separado | `bindings.postAttendance` + `queues`; fila nula não vira UUID fictício | F3-06 |
| Q11 | Só JSON + relatório + instruções manuais | `delivery.automaticInstall/publish/bindPhoneNumber` = `false` (schema literal) | config |
| Q12 | Cenários de referência, testes isolados, homologação das integrações críticas | `referenceScenarios` + fixtures HTTP explícitas; sucesso genérico proibido (`allowFakeIntegrationSuccess=false`) | F3-07 |
| Q13 | Inventário de lacunas + configuração preenchível | Pendências saem de `validateConfig().pending` | `src/config` |
| Q14 | Campos parametrizáveis; alternativa sem simular sucesso | `null` explícito = `parameter_required`, não bloqueia geração | `src/config` |
| Q15 | Cenários derivados, confirmados com negócio, confrontados com registros reais | Cenário `confirmed` exige responsável, data e `expectedEndState` | `src/config` |

## Entradas
- Lote: `Analise Blip Kayros/2026-11-02T04-26-43-071Z-e44c3a22/` (39 arquivos no manifesto: 13 originais, 13 contratos principais, 13 variáveis).
- SHA-256 do `.7z`: `fa45a1be7fa45f003ba400dd3f6a85cb7ce0a76b9af9a317a6f04a7ce234fef9`.
- Router: `vivofixacarrinho4router`. Coleta 02/11/2026 01:26–01:34 (São Paulo), sequencial.

## Revisões Goatable de referência (somente leitura)
| Repositório | Commit |
| --- | --- |
| kayros-bot-engine | `b1f69987406fc6714068ba5106ef50dea00f9f3d` |
| kayros-os | `826b73258ab93ea80e347c5fb9a9501bc7791372` |
| kayros-broker | `4b5f67612e6001ff0f5793d6259cf8df55cd23d1` |

Esses valores estão fixados em `src/profile/kayros-current-adapted.ts` e exigidos pelo schema da configuração.

## Totais de referência (alvo da F1)
13 bots · 1.629 estados · 6.377 ações (6.370 locais + 4 globais + 3 pós-mudança) · 140 configurações · 35 nomes de Redirect (94 ocorrências) · 682 SetVariable com expiração · 1.395 MergeContact · 441 timeouts · 401 saídas dinâmicas.
