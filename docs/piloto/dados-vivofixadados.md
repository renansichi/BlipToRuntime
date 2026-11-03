# Dados temporarios x duraveis — vivofixadados

Evidencia de uso dentro do proprio bot. **Nao ha como saber, so pelos arquivos, se outro sistema le o contato da Blip**; essa decisao e do responsavel (Q08: duravel somente com API/base existente confirmada).
Padrao do pacote: tudo na sessao (adaptacao `merge-contact-session`).

| Namespace | Nome | Escritas | Leituras | Situacao no bot | Recomendacao |
| --- | --- | ---: | ---: | --- | --- |
| contact.extras | 19. Vencimento | 2 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | 19.1 Vencimento erro | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | 2. Confirma dados | 2 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | 2.1 Altera dados wpp | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | 24.1 Data de agendamento 1 erro | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | 24.2 Data de agendamento 1 invalida | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | 24.2.1 Data de agendamento 1 invalida erro | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | 25.1 Data de agendamento 2 erro | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | 25.2 Data de agendamento 2 invalida | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | 25.2.1 Data de agendamento 2 invalida erro | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | 26. API 04 Data instalacao | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | 27.1 Opt-in erro | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | 28. Finalizacao | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | 29. Confirmacao | 3 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | 33. Ultimo input | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | 38. Nome | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | 39. Nome mae | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | 40. Data Nascimento | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | 42. Erro padrao wpp | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | 44. Carrrinho abandonado wpp | 13 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | 49. Agradecimento | 2 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | 52. Encerra conversa | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | 53. Mensagem AH | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | 7. Email | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | 7. Exibe planos | 3 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | 7.1 Email erro | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | 7.1 Exibe planos erro | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | 8. Cpf | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | 8.1 Cpf erro | 2 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | autoSku | 0 | 18 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact.extras | bairro | 0 | 8 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact.extras | banco | 2 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | bankNumber | 2 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | blocoAnterior | 13 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | bodySHA256 | 2 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | bodywCI | 2 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | canal | 4 | 14 | escrito e lido no bot | sessao (duravel so se a informacao precisar existir em uma nova conversa) |
| contact.extras | carrinhoVivo | 1 | 2 | escrito e lido no bot | sessao (duravel so se a informacao precisar existir em uma nova conversa) |
| contact.extras | cep | 0 | 11 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact.extras | cepSHA256 | 2 | 4 | escrito e lido no bot | sessao (duravel so se a informacao precisar existir em uma nova conversa) |
| contact.extras | cid | 0 | 3 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact.extras | comboSku | 0 | 3 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact.extras | complemento | 0 | 7 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact.extras | cpf | 6 | 27 | escrito e lido no bot | sessao (duravel so se a informacao precisar existir em uma nova conversa) |
| contact.extras | cpfSHA256 | 2 | 4 | escrito e lido no bot | sessao (duravel so se a informacao precisar existir em uma nova conversa) |
| contact.extras | data1 | 4 | 4 | escrito e lido no bot | sessao (duravel so se a informacao precisar existir em uma nova conversa) |
| contact.extras | data2 | 4 | 4 | escrito e lido no bot | sessao (duravel so se a informacao precisar existir em uma nova conversa) |
| contact.extras | data3 | 2 | 2 | escrito e lido no bot | sessao (duravel so se a informacao precisar existir em uma nova conversa) |
| contact.extras | dataAgendamento{{contadorDeAgendamento}} | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | dataAgendamento1 | 0 | 3 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact.extras | dataAgendamento2 | 0 | 2 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact.extras | dataNascimento | 3 | 13 | escrito e lido no bot | sessao (duravel so se a informacao precisar existir em uma nova conversa) |
| contact.extras | emailSHA256 | 2 | 4 | escrito e lido no bot | sessao (duravel so se a informacao precisar existir em uma nova conversa) |
| contact.extras | encerramentoAbandonoFormulario | 2 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | Etapa Agradecimento final | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | Etapa Carrinho abandonado | 12 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | Etapa Cpf | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | Etapa Email | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | Etapa Erro padrao | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | Etapa Termo recusa | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | Etapa Termos | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | Etapa Vencimento | 2 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | fibra_cross_iptv_itv_inicio | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | fibra_cross_iptv_itv_sem_interesse | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | fibra_cross_pergunta_itv | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | filaAH | 2 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | filaNova | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | finalDescription | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | flow_dados_pessoais | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | flowsEmailCpfVencimento | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | formulario_data_agendamento1 | 3 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | formulario_data_agendamento2 | 3 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | gclid | 0 | 3 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact.extras | identificadorPedido | 1 | 63 | escrito e lido no bot | sessao (duravel so se a informacao precisar existir em uma nova conversa) |
| contact.extras | identificadorPedidoTotal | 2 | 6 | escrito e lido no bot | sessao (duravel so se a informacao precisar existir em uma nova conversa) |
| contact.extras | initialDescription | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | logradouro | 0 | 9 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact.extras | mensagemITV | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | modalidade | 4 | 43 | escrito e lido no bot | sessao (duravel so se a informacao precisar existir em uma nova conversa) |
| contact.extras | modalidadeUpsell | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | nomeMae | 3 | 12 | escrito e lido no bot | sessao (duravel so se a informacao precisar existir em uma nova conversa) |
| contact.extras | numAgencia | 2 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | numConta | 2 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | numEndereco | 0 | 8 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact.extras | numResidencia | 0 | 1 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact.extras | operadora | 2 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | pedidoFinalizadoFixa | 3 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | pedidoFinalizadoFixaHora | 3 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | planName | 0 | 7 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact.extras | planoDescription | 0 | 1 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact.extras | planoIptv | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | planoTV | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | price | 1 | 9 | escrito e lido no bot | sessao (duravel so se a informacao precisar existir em uma nova conversa) |
| contact.extras | priceNovo | 1 | 1 | escrito e lido no bot | sessao (duravel so se a informacao precisar existir em uma nova conversa) |
| contact.extras | priceNum | 2 | 8 | escrito e lido no bot | sessao (duravel so se a informacao precisar existir em uma nova conversa) |
| contact.extras | Primeira Mensagem | 2 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | primeiraMensagem | 3 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | prioridade | 4 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | protocoloWci | 0 | 13 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact.extras | responseSHA256 | 2 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | responseWci | 2 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | sexo | 1 | 5 | escrito e lido no bot | sessao (duravel so se a informacao precisar existir em uma nova conversa) |
| contact.extras | skuTV | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | statusSHA256 | 2 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | statusWci | 2 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | tecnologia | 0 | 3 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact.extras | telefoneSHA256 | 2 | 4 | escrito e lido no bot | sessao (duravel so se a informacao precisar existir em uma nova conversa) |
| contact.extras | termo | 4 | 3 | escrito e lido no bot | sessao (duravel so se a informacao precisar existir em uma nova conversa) |
| contact.extras | tipoCompra | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | tipoFatura | 2 | 4 | escrito e lido no bot | sessao (duravel so se a informacao precisar existir em uma nova conversa) |
| contact.extras | total_cross_iptv_inicio | 1 | 0 | so escrito (BI/consumo externo?) | decidir: sessao basta se ninguem consome depois da conversa; duravel se outro sistema le o contato |
| contact.extras | type | 0 | 3 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact.extras | uf | 0 | 15 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact.extras | url | 0 | 3 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact.extras | utmCampaign | 0 | 3 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact.extras | utmCampaign2 | 0 | 3 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact.extras | UtmCampaign2 | 0 | 3 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact.extras | utmMedium | 0 | 3 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact.extras | UtmMedium | 0 | 3 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact.extras | utmSource | 0 | 3 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact.extras | UtmSource | 0 | 3 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact.extras | utmTerm | 2 | 79 | escrito e lido no bot | sessao (duravel so se a informacao precisar existir em uma nova conversa) |
| contact.extras | vencimentoFatura | 2 | 13 | escrito e lido no bot | sessao (duravel so se a informacao precisar existir em uma nova conversa) |
| contact | city | 0 | 13 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact | email | 0 | 28 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact | identity | 0 | 13 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact | name | 0 | 24 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact | phoneNumber | 0 | 11 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact | source | 0 | 10 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact | whatsAppBsuid | 0 | 12 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| contact | whatsAppWaId | 0 | 12 | so lido (vem de fora: entrada/campanha/router) | parametro: definir quem preenche (entrada/campanha) |
| context | abandono | 13 | 13 | escrito e lido no bot | sessao (TTL vira adaptacao `ttl-session`) |
| context | abandono2D | 1 | 6 | escrito e lido no bot | sessao |
| context | abandono2F | 1 | 4 | escrito e lido no bot | sessao |
| context | abandonoCross | 1 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | alteraNome | 0 | 2 | so lido (vem de fora: entrada/campanha/router) | sessao |
| context | alteraVencimentoNovo | 1 | 1 | escrito e lido no bot | sessao (TTL vira adaptacao `ttl-session`) |
| context | audioUrl | 1 | 1 | escrito e lido no bot | sessao |
| context | blocoAnterior | 2 | 22 | escrito e lido no bot | sessao (TTL vira adaptacao `ttl-session`) |
| context | blocoAnteriorIA | 1 | 1 | escrito e lido no bot | sessao |
| context | bloqueio | 1 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | bodyAbandono1 | 12 | 12 | escrito e lido no bot | sessao |
| context | bodyAbandono2 | 3 | 3 | escrito e lido no bot | sessao |
| context | bodyAbandonoFinal | 2 | 2 | escrito e lido no bot | sessao |
| context | bodyAbandonoUpsell | 1 | 1 | escrito e lido no bot | sessao |
| context | bodyAguardandoVT | 2 | 2 | escrito e lido no bot | sessao |
| context | bodyComplementarDados | 1 | 1 | escrito e lido no bot | sessao |
| context | bodyConcluido | 4 | 4 | escrito e lido no bot | sessao |
| context | bodyDadosCompletos | 1 | 1 | escrito e lido no bot | sessao |
| context | bodyDadosPessoais | 1 | 1 | escrito e lido no bot | sessao |
| context | bodyDataInstalacao | 7 | 7 | escrito e lido no bot | sessao |
| context | bodyFatura | 1 | 1 | escrito e lido no bot | sessao |
| context | bodyLead | 1 | 1 | escrito e lido no bot | sessao |
| context | bodyLeadTotal | 2 | 2 | escrito e lido no bot | sessao |
| context | bodyNegadoUpsell | 1 | 1 | escrito e lido no bot | sessao |
| context | bodyRetorno1 | 12 | 12 | escrito e lido no bot | sessao |
| context | bodyRetorno2 | 3 | 3 | escrito e lido no bot | sessao |
| context | bodyTermo | 1 | 1 | escrito e lido no bot | sessao |
| context | bold | 1 | 16 | escrito e lido no bot | sessao |
| context | canal | 0 | 2 | so lido (vem de fora: entrada/campanha/router) | sessao |
| context | chatgptResponse | 0 | 2 | so lido (vem de fora: entrada/campanha/router) | sessao |
| context | complemento | 0 | 1 | so lido (vem de fora: entrada/campanha/router) | sessao |
| context | confirmaDadosNovo | 1 | 1 | escrito e lido no bot | sessao (TTL vira adaptacao `ttl-session`) |
| context | contadorDeAgendamento | 4 | 6 | escrito e lido no bot | sessao |
| context | conteudoAPI | 2 | 2 | escrito e lido no bot | sessao |
| context | cpf | 4 | 10 | escrito e lido no bot | sessao |
| context | dadosPessoais | 1 | 3 | escrito e lido no bot | sessao |
| context | dadosPessoaisVencimento | 1 | 1 | escrito e lido no bot | sessao (TTL vira adaptacao `ttl-session`) |
| context | data1 | 2 | 14 | escrito e lido no bot | sessao (TTL vira adaptacao `ttl-session`) |
| context | data2 | 2 | 8 | escrito e lido no bot | sessao (TTL vira adaptacao `ttl-session`) |
| context | data3 | 2 | 3 | escrito e lido no bot | sessao (TTL vira adaptacao `ttl-session`) |
| context | dataHora | 1 | 1 | escrito e lido no bot | sessao |
| context | dataNovas | 2 | 5 | escrito e lido no bot | sessao |
| context | datasDeAgendamento | 6 | 7 | escrito e lido no bot | sessao |
| context | datasEscolhidas | 4 | 16 | escrito e lido no bot | sessao |
| context | destiny | 0 | 1 | so lido (vem de fora: entrada/campanha/router) | sessao |
| context | emailCpfVencimento | 1 | 4 | escrito e lido no bot | sessao |
| context | empresa | 1 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | empresaAthena | 0 | 1 | so lido (vem de fora: entrada/campanha/router) | sessao |
| context | escolhaData | 1 | 4 | escrito e lido no bot | sessao |
| context | escolheuMaisInfo | 3 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | etapaBi | 22 | 2 | escrito e lido no bot | sessao (TTL vira adaptacao `ttl-session`) |
| context | Fatura | 1 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | figurinha | 1 | 12 | escrito e lido no bot | sessao |
| context | flowdadospessoais | 1 | 0 | so escrito (BI/consumo externo?) | sessao (TTL vira adaptacao `ttl-session`) |
| context | flowsAgendamento | 1 | 6 | escrito e lido no bot | sessao |
| context | flowsDadosPessoais | 2 | 2 | escrito e lido no bot | sessao |
| context | idAbandono | 1 | 23 | escrito e lido no bot | sessao |
| context | idCarrossel | 1 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | idPedidoEndereco | 0 | 1 | so lido (vem de fora: entrada/campanha/router) | sessao |
| context | idPedidoFinal | 1 | 2 | escrito e lido no bot | sessao |
| context | idRedireciona | 1 | 1 | escrito e lido no bot | sessao |
| context | inputUsuario | 2 | 1 | escrito e lido no bot | sessao (TTL vira adaptacao `ttl-session`) |
| context | interagiu | 2 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | isWorkTime | 2 | 4 | escrito e lido no bot | sessao |
| context | italico | 1 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | limpaEmail | 2 | 2 | escrito e lido no bot | sessao |
| context | limpaEmoji | 2 | 2 | escrito e lido no bot | sessao |
| context | mensagemCross | 5 | 2 | escrito e lido no bot | sessao (TTL vira adaptacao `ttl-session`) |
| context | menu | 3 | 2 | escrito e lido no bot | sessao |
| context | menuAbandono | 3 | 3 | escrito e lido no bot | sessao |
| context | menuDataDeAgendamento | 4 | 3 | escrito e lido no bot | sessao |
| context | metaclientemail | 2 | 7 | escrito e lido no bot | sessao |
| context | metaclientphone | 0 | 1 | so lido (vem de fora: entrada/campanha/router) | sessao |
| context | metadata | 0 | 3 | so lido (vem de fora: entrada/campanha/router) | sessao |
| context | modalidade | 1 | 0 | so escrito (BI/consumo externo?) | sessao (TTL vira adaptacao `ttl-session`) |
| context | msgAtivaReagendamento | 1 | 2 | escrito e lido no bot | sessao (TTL vira adaptacao `ttl-session`) |
| context | numeroOpcoes | 1 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | oauthPlanilhaResponse | 1 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | oauthPlanilhaStatus | 1 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | oauthResponse | 1 | 1 | escrito e lido no bot | sessao |
| context | oauthStatus | 1 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | optin | 0 | 1 | so lido (vem de fora: entrada/campanha/router) | sessao |
| context | pedidoFinalizado | 2 | 0 | so escrito (BI/consumo externo?) | sessao (TTL vira adaptacao `ttl-session`) |
| context | pedidoFinalizadoFixa | 3 | 0 | so escrito (BI/consumo externo?) | sessao (TTL vira adaptacao `ttl-session`) |
| context | planoEscolhido | 1 | 10 | escrito e lido no bot | sessao |
| context | planoEscolhido1 | 1 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | planoUnico | 1 | 1 | escrito e lido no bot | sessao |
| context | pontoReferencia | 0 | 1 | so lido (vem de fora: entrada/campanha/router) | sessao |
| context | portabilidade | 1 | 0 | so escrito (BI/consumo externo?) | sessao (TTL vira adaptacao `ttl-session`) |
| context | priceNum | 2 | 2 | escrito e lido no bot | sessao |
| context | primeiraMensagem | 1 | 1 | escrito e lido no bot | sessao |
| context | produtoEscolhido | 3 | 0 | so escrito (BI/consumo externo?) | sessao (TTL vira adaptacao `ttl-session`) |
| context | projectId | 2 | 49 | escrito e lido no bot | sessao |
| context | projectType | 1 | 33 | escrito e lido no bot | sessao |
| context | quantidadeData | 3 | 0 | so escrito (BI/consumo externo?) | sessao (TTL vira adaptacao `ttl-session`) |
| context | random.guid | 0 | 3 | so lido (vem de fora: entrada/campanha/router) | sessao |
| context | reagendar | 1 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | recipientId | 1 | 1 | escrito e lido no bot | sessao |
| context | regiao | 0 | 1 | so lido (vem de fora: entrada/campanha/router) | sessao |
| context | response | 1 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | responseAbandono1 | 12 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | responseAbandono2 | 3 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | responseAbandonoFinal | 2 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | responseAbandonoUpsell | 1 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | responseAguardandoVT | 2 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | responseAnalyticsParabens | 3 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | responseAnalyticsTransaction | 3 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | responseComplementar | 1 | 2 | escrito e lido no bot | sessao |
| context | responseComplementarDados | 1 | 2 | escrito e lido no bot | sessao |
| context | responseConcluido | 4 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | responseCpf | 1 | 8 | escrito e lido no bot | sessao |
| context | responseDadosCompletos | 1 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | responseDadosPessoais | 1 | 2 | escrito e lido no bot | sessao |
| context | responseDataInstalacao | 7 | 10 | escrito e lido no bot | sessao |
| context | responseEnviaAudio | 1 | 1 | escrito e lido no bot | sessao |
| context | responseEnviaAudioApi | 1 | 1 | escrito e lido no bot | sessao |
| context | responseFatura | 1 | 2 | escrito e lido no bot | sessao |
| context | responseFbPurchase | 1 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | responseLead | 1 | 3 | escrito e lido no bot | sessao |
| context | responseLeadTotal | 2 | 2 | escrito e lido no bot | sessao |
| context | responseNegadoUpsell | 1 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | responseNumOperadora | 1 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | responsePlanilhaZoho | 2 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | responseRetomada1 | 12 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | responseRetomada2 | 3 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | responseSafetyEmail | 1 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | responseSHA256 | 2 | 10 | escrito e lido no bot | sessao |
| context | responseTermo | 1 | 2 | escrito e lido no bot | sessao |
| context | responseTimeStamp | 3 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | responseWci | 2 | 2 | escrito e lido no bot | sessao |
| context | responseZapierAds | 3 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | respostaGPT | 3 | 1 | escrito e lido no bot | sessao (TTL vira adaptacao `ttl-session`) |
| context | result | 4 | 6 | escrito e lido no bot | sessao |
| context | resultadoFlows | 1 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | resumoBlocoAnterior | 1 | 2 | escrito e lido no bot | sessao |
| context | retomada | 15 | 9 | escrito e lido no bot | sessao |
| context | retornoApiSupaBase | 1 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | retornoMensagens | 1 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | retornoUpsell | 1 | 2 | escrito e lido no bot | sessao |
| context | routerNumero | 0 | 6 | so lido (vem de fora: entrada/campanha/router) | sessao |
| context | salvarErroDataTracking | 4 | 1 | escrito e lido no bot | sessao |
| context | semNumero | 4 | 6 | escrito e lido no bot | sessao |
| context | skill | 4 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | status | 1 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | statusAbandono1 | 12 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | statusAbandono2 | 3 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | statusAbandonoFinal | 2 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | statusAbandonoUpsell | 1 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | statusAguardandoVT | 2 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | statusAnalyticsParabens | 3 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | statusAnalyticsTransaction | 3 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | statusApiSupaBase | 1 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | statusComplementar | 1 | 1 | escrito e lido no bot | sessao |
| context | statusComplementarDados | 1 | 1 | escrito e lido no bot | sessao |
| context | statusConcluido | 4 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | statusCpf | 1 | 2 | escrito e lido no bot | sessao |
| context | statusDadosCompletos | 1 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | statusDadosPessoais | 1 | 1 | escrito e lido no bot | sessao |
| context | statusDataInstalacao | 7 | 5 | escrito e lido no bot | sessao |
| context | statusEnviaAudioApi | 1 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | statusFatura | 1 | 1 | escrito e lido no bot | sessao |
| context | statusFbPurchase | 1 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | statusLead | 1 | 1 | escrito e lido no bot | sessao |
| context | statusLeadTotal | 2 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | statusNegadoUpsell | 1 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | statusNumOperadora | 1 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | statusPlanilhaZoho | 2 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | statusRetomada1 | 12 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | statusRetomada2 | 3 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | statusSafetyEmail | 1 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | statusSHA256 | 2 | 2 | escrito e lido no bot | sessao |
| context | statusTermo | 1 | 1 | escrito e lido no bot | sessao |
| context | statusTimeStamp | 3 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | statusWci | 2 | 2 | escrito e lido no bot | sessao |
| context | statusZapierAds | 3 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | tagCarrinho | 3 | 3 | escrito e lido no bot | sessao (TTL vira adaptacao `ttl-session`) |
| context | telefone | 0 | 1 | so lido (vem de fora: entrada/campanha/router) | sessao |
| context | telefoneBlip | 1 | 1 | escrito e lido no bot | sessao |
| context | telefoneFormatado | 2 | 2 | escrito e lido no bot | sessao |
| context | termoCondicoes | 1 | 0 | so escrito (BI/consumo externo?) | sessao (TTL vira adaptacao `ttl-session`) |
| context | thread: string, skillResponse: string | 0 | 2 | so lido (vem de fora: entrada/campanha/router) | sessao |
| context | tipoFatura | 1 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | utmTermAjuste | 1 | 3 | escrito e lido no bot | sessao |
| context | variaveisBI | 16 | 67 | escrito e lido no bot | sessao |
| context | vencimento | 0 | 1 | so lido (vem de fora: entrada/campanha/router) | sessao |
| context | VivoFixa | 1 | 0 | so escrito (BI/consumo externo?) | sessao (TTL vira adaptacao `ttl-session`) |
| context | voltaPlano | 1 | 0 | so escrito (BI/consumo externo?) | sessao (TTL vira adaptacao `ttl-session`) |
| context | workSchedule | 2 | 2 | escrito e lido no bot | sessao |
| context | wwadditionalcontext | 2 | 2 | escrito e lido no bot | sessao |
| context | wwassistant | 2 | 6 | escrito e lido no bot | sessao |
| context | wwaux | 2 | 4 | escrito e lido no bot | sessao |
| context | wwBucketResponse | 2 | 2 | escrito e lido no bot | sessao |
| context | wwlastassistant | 2 | 2 | escrito e lido no bot | sessao |
| context | wwresponsebody | 0 | 2 | so lido (vem de fora: entrada/campanha/router) | sessao |
| context | wwResponseBody | 2 | 6 | escrito e lido no bot | sessao |
| context | wwResponseStatus | 4 | 2 | escrito e lido no bot | sessao |
| context | wwResponseText | 2 | 2 | escrito e lido no bot | sessao |
| context | wwsanitizedadditionalcontext | 2 | 2 | escrito e lido no bot | sessao |
| context | wwsanitizedinput | 0 | 4 | so lido (vem de fora: entrada/campanha/router) | sessao |
| context | wwsanitizedInput | 2 | 0 | so escrito (BI/consumo externo?) | sessao |
| context | wwthread | 2 | 2 | escrito e lido no bot | sessao |
| context | wwthreadsresponse | 2 | 2 | escrito e lido no bot | sessao |
| context | wwuser | 2 | 4 | escrito e lido no bot | sessao |
