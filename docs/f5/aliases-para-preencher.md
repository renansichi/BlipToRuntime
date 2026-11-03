# Aliases de Redirect — para preencher

São 35 endereços distintos (94 ocorrências). Cada um é o **nome de uma aplicação na Blip**; o conversor não liga um alias a um bot por semelhança de nome.

Para cada alias informe, em `config/piloto.config.json` → `bindings.botAliases[]`:
- `targetLogicalBot`: um dos 13 bots do lote (se o destino é um deles), e/ou
- `targetImportedBotId`: o id do bot **já existente no Kayros** (se o destino é outro bot, por exemplo os fluxos do `Extrato Kayros`).

Sem isso, cada Redirect vira um `Typebot link` com referência configurável `{{resource.blip.link.<alias>}}`, a ser resolvida no remapeamento manual (guia de importação, seção 3).

| Alias (como na Blip) | Ocorrências | Com contexto | Usado por | Chave de Recurso gerada | Destino (preencher) |
| --- | ---: | ---: | --- | --- | --- |
| BKO VIVO [MSG ATIVA][AH] | 6 | 5 | fibrasubida17, vivofixadados, vivofixawhatsapp, vivoiptvwpp, vivoitvplanos | `blip.link.bko_vivo_msg_ativa_ah` |  |
| Brisanet [PLANOS] | 1 | 1 | vivoitvah | `blip.link.brisanet_planos` |  |
| leandro | 1 | 0 | vivoseguros | `blip.link.leandro` |  |
| seguroshmg | 1 | 1 | vivoseguros | `blip.link.seguroshmg` |  |
| superbot_vivo_main | 5 | 2 | vivoiptvwpp, vivoitvplanos, vivosegurocelular, vivoseguros | `blip.link.superbot_vivo_main` |  |
| testeTotal | 1 | 1 | vivototalplanoswppnovo | `blip.link.testetotal` |  |
| Vivo (Orch) | 1 | 1 | bkovivofixamsgativaah | `blip.link.vivo_orch` |  |
| Vivo Abandono [MSG ATIVA][AH] | 7 | 7 | fibrasubida17, vivofixadados, vivofixawhatsapp, vivoiptveitvplanos, vivoitvplanos, vivototaldados, vivototalplanoswppnovo | `blip.link.vivo_abandono_msg_ativa_ah` |  |
| Vivo BKO [AH] | 2 | 2 | vivototaldados, vivototalplanoswppnovo | `blip.link.vivo_bko_ah` |  |
| Vivo Controle [ TTK ] | 1 | 1 | vivoitvplanos | `blip.link.vivo_controle_ttk` |  |
| Vivo Controle 2023 [WPP] | 4 | 2 | bkovivofixamsgativaah, vivoitvplanos | `blip.link.vivo_controle_2023_wpp` |  |
| Vivo Fixa [DADOS] | 2 | 2 | fibrasubida17, vivofixawhatsapp | `blip.link.vivo_fixa_dados` |  |
| Vivo Fixa [WEBCHAT] | 2 | 2 | vivoiptveitvplanos, vivoitvplanos | `blip.link.vivo_fixa_webchat` |  |
| Vivo Fixa Hibrido [INICIO] | 6 | 2 | vivofixadados, vivoiptveitvplanos, vivoitvplanos, vivosegurocelular, vivoseguros, vivototaldados | `blip.link.vivo_fixa_hibrido_inicio` |  |
| Vivo Fixa Planos [RCS][PROD] | 2 | 2 | fibrasubida17, vivofixawhatsapp | `blip.link.vivo_fixa_planos_rcs_prod` |  |
| Vivo Fixa Planos [WPP][PROD] | 10 | 5 | bkovivofixamsgativaah, vivofixaabandonomsgatah, vivofixadados, vivoiptveitvplanos, vivoitvplanos, vivosegurocelular, vivoseguros, vivototaldados, vivototalplanoswppnovo | `blip.link.vivo_fixa_planos_wpp_prod` |  |
| Vivo IPTV [AH] | 1 | 1 | vivoiptvwpp | `blip.link.vivo_iptv_ah` |  |
| Vivo IPTV e ITV [CROSS][PLANOS] | 2 | 2 | vivofixadados, vivototaldados | `blip.link.vivo_iptv_e_itv_cross_planos` |  |
| Vivo IPTV e ITV [PLANOS] | 1 | 1 | vivofixadados | `blip.link.vivo_iptv_e_itv_planos` |  |
| Vivo IPTV ITV Fibra [HMG] | 1 | 1 | vivoiptvwpp | `blip.link.vivo_iptv_itv_fibra_hmg` |  |
| Vivo Itv [AH] | 2 | 2 | vivoiptveitvplanos, vivoitvplanos | `blip.link.vivo_itv_ah` |  |
| Vivo ITV [INICIO] | 2 | 1 | vivoitvah, vivoitvplanos | `blip.link.vivo_itv_inicio` |  |
| Vivo ITV [PLANOS] | 6 | 6 | fibrasubida17, vivofixadados, vivofixawhatsapp, vivoiptveitvplanos, vivototaldados | `blip.link.vivo_itv_planos` |  |
| Vivo ITV [PLANOS] [DEV] | 1 | 1 | vivoitvplanos | `blip.link.vivo_itv_planos_dev` |  |
| Vivo Itv Abandono_AH | 1 | 1 | vivoitvplanos | `blip.link.vivo_itv_abandono_ah` |  |
| Vivo ITV Controle [PLANOS] | 1 | 1 | vivoiptvwpp | `blip.link.vivo_itv_controle_planos` |  |
| Vivo Pesquisa de Satisfacao | 3 | 3 | fibrasubida17, vivofixadados, vivofixawhatsapp | `blip.link.vivo_pesquisa_de_satisfacao` |  |
| Vivo Pos Pago [Planos] | 1 | 1 | vivoitvplanos | `blip.link.vivo_pos_pago_planos` |  |
| Vivo Seguro Celular | 2 | 2 | vivofixadados, vivototaldados | `blip.link.vivo_seguro_celular` |  |
| Vivo Seguros | 2 | 2 | vivofixadados, vivototaldados | `blip.link.vivo_seguros` |  |
| Vivo SVA [PLANOS] [PRD] | 1 | 1 | vivoitvplanos | `blip.link.vivo_sva_planos_prd` |  |
| Vivo Total [DADOS] | 2 | 2 | vivototalplanoswppnovo | `blip.link.vivo_total_dados` |  |
| Vivo Total [PLANOS][WPP][NOVO] | 11 | 4 | bkovivofixamsgativaah, fibrasubida17, vivofixaabandonomsgatah, vivofixadados, vivofixawhatsapp, vivoiptveitvplanos, vivoitvplanos, vivosegurocelular, vivoseguros, vivototaldados | `blip.link.vivo_total_planos_wpp_novo` |  |
| Vivo Total Novo [WPP] | 1 | 1 | vivototalplanoswppnovo | `blip.link.vivo_total_novo_wpp` |  |
| vivosegurocelularhmg | 1 | 1 | vivosegurocelular | `blip.link.vivosegurocelularhmg` |  |
