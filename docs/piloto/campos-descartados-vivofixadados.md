# Campos de contato descartados — vivofixadados

Decisão de 02/11/2026 (“Descartar” os campos só escritos). Regra aplicada: o campo é descartado **somente se nenhum dos 13 bots do pacote o lê** (os bots compartilham o contato na Blip) e a chave não é dinâmica.

## Descartados (59)

- 19. Vencimento
- 19.1 Vencimento erro
- 2. Confirma dados
- 2.1 Altera dados wpp
- 24.1 Data de agendamento 1 erro
- 24.2 Data de agendamento 1 invalida
- 24.2.1 Data de agendamento 1 invalida erro
- 25.1 Data de agendamento 2 erro
- 25.2 Data de agendamento 2 invalida
- 25.2.1 Data de agendamento 2 invalida erro
- 26. API 04 Data instalacao
- 27.1 Opt-in erro
- 28. Finalizacao
- 29. Confirmacao
- 33. Ultimo input
- 38. Nome
- 39. Nome mae
- 40. Data Nascimento
- 42. Erro padrao wpp
- 44. Carrrinho abandonado wpp
- 49. Agradecimento
- 52. Encerra conversa
- 53. Mensagem AH
- 7. Email
- 7. Exibe planos
- 7.1 Email erro
- 7.1 Exibe planos erro
- 8. Cpf
- 8.1 Cpf erro
- banco
- bankNumber
- blocoAnterior
- bodySHA256
- bodywCI
- Etapa Agradecimento final
- Etapa Carrinho abandonado
- Etapa Cpf
- Etapa Email
- Etapa Erro padrao
- Etapa Termo recusa
- Etapa Termos
- Etapa Vencimento
- fibra_cross_iptv_itv_inicio
- fibra_cross_iptv_itv_sem_interesse
- fibra_cross_pergunta_itv
- flow_dados_pessoais
- flowsEmailCpfVencimento
- formulario_data_agendamento1
- formulario_data_agendamento2
- mensagemITV
- modalidadeUpsell
- numAgencia
- numConta
- Primeira Mensagem
- responseSHA256
- responseWci
- statusSHA256
- statusWci
- total_cross_iptv_inicio

## Mantidos (15): lidos por outro bot, de chave dinâmica ou mantidos por decisão

- dataAgendamento{{contadorDeAgendamento}} (chave dinâmica)
- encerramentoAbandonoFormulario (mantido por decisão do responsável: nome operacional)
- filaAH (mantido por decisão do responsável: nome operacional)
- filaNova (lido por bkovivofixamsgativaah)
- finalDescription (lido por vivoitvplanos)
- initialDescription (lido por vivoitvplanos)
- operadora (lido por vivototalplanoswppnovo, vivototaldados)
- pedidoFinalizadoFixa (lido por vivofixawhatsapp, bkovivofixamsgativaah, fibrasubida17)
- pedidoFinalizadoFixaHora (lido por bkovivofixamsgativaah)
- planoIptv (lido por vivoiptvwpp, vivoiptveitvplanos)
- planoTV (lido por vivoiptvwpp, vivoiptveitvplanos)
- primeiraMensagem (lido por vivofixawhatsapp, vivoitvplanos, vivoiptvwpp, vivototalplanoswppnovo, vivototaldados, fibrasubida17)
- prioridade (mantido por decisão do responsável: nome operacional)
- skuTV (lido por vivoiptvwpp, vivoiptveitvplanos, vivototalplanoswppnovo)
- tipoCompra (lido por vivototalplanoswppnovo, vivototaldados)
