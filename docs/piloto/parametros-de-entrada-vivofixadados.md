# Parâmetros de entrada — vivofixadados

Decisão de 02/11/2026: campos **lidos e nunca escritos** pelo bot são **parâmetros de entrada**. Gerado de `entry-parameters.json` (ver `convert`).

## Externos: nenhum bot do pacote os escreve

A campanha, o router ou a entrada precisam preenchê-los (ou o bot deve aceitar que cheguem vazios). Sem fonte confirmada eles ficam como variáveis declaradas e vazias.

| Namespace | Nome | Lido por |
| --- | --- | --- |
| contact.extras | cid | vivofixadados |
| contact.extras | comboSku | vivofixadados |
| contact.extras | gclid | vivofixadados |
| contact.extras | numResidencia | vivofixadados, vivototaldados, vivototalplanoswppnovo |
| contact.extras | tecnologia | vivofixadados |
| contact.extras | type | vivofixadados |
| contact.extras | url | vivofixadados |
| contact.extras | utmCampaign | vivofixadados, vivoiptveitvplanos, vivoiptvwpp, vivoitvplanos |
| contact.extras | utmCampaign2 | vivofixadados |
| contact.extras | utmMedium | vivofixadados, vivoitvplanos, vivosegurocelular |
| contact.extras | utmSource | vivofixadados, vivoiptveitvplanos, vivoiptvwpp, vivoitvplanos, vivosegurocelular |
| contact | city | bkovivofixamsgativaah, fibrasubida17, vivofixadados, vivofixawhatsapp, vivoiptvwpp, vivosegurocelular, vivoseguros, vivototaldados, vivototalplanoswppnovo |
| contact | email | fibrasubida17, vivofixadados, vivofixawhatsapp, vivoiptveitvplanos, vivoiptvwpp, vivosegurocelular, vivoseguros, vivototaldados, vivototalplanoswppnovo |
| contact | identity | bkovivofixamsgativaah, fibrasubida17, vivofixaabandonomsgatah, vivofixadados, vivofixawhatsapp, vivoiptveitvplanos, vivoiptvwpp, vivoitvah, vivoitvplanos, vivosegurocelular, vivoseguros, vivototaldados, vivototalplanoswppnovo |
| contact | name | fibrasubida17, vivofixaabandonomsgatah, vivofixadados, vivofixawhatsapp, vivoiptvwpp, vivoitvah, vivosegurocelular, vivoseguros, vivototaldados, vivototalplanoswppnovo |
| contact | phoneNumber | fibrasubida17, vivofixadados, vivofixawhatsapp, vivoiptveitvplanos, vivoiptvwpp, vivoitvplanos, vivosegurocelular, vivoseguros, vivototaldados, vivototalplanoswppnovo |
| contact | source | fibrasubida17, vivofixaabandonomsgatah, vivofixadados, vivofixawhatsapp, vivoiptveitvplanos, vivoiptvwpp, vivoitvplanos, vivosegurocelular, vivoseguros, vivototaldados, vivototalplanoswppnovo |
| contact | whatsAppBsuid | fibrasubida17, vivofixadados, vivofixawhatsapp, vivoiptvwpp, vivosegurocelular, vivoseguros, vivototaldados, vivototalplanoswppnovo |
| contact | whatsAppWaId | fibrasubida17, vivofixadados, vivofixawhatsapp, vivoiptvwpp, vivosegurocelular, vivoseguros, vivototaldados, vivototalplanoswppnovo |
| context | alteraNome | vivofixadados |
| context | chatgptResponse | fibrasubida17, vivofixadados, vivofixawhatsapp, vivoiptveitvplanos, vivoiptvwpp, vivoitvplanos, vivosegurocelular, vivoseguros, vivototaldados, vivototalplanoswppnovo |
| context | destiny | fibrasubida17, vivofixadados, vivofixawhatsapp, vivoiptvwpp, vivoitvplanos, vivototaldados, vivototalplanoswppnovo |
| context | empresaAthena | vivofixadados, vivoiptvwpp, vivototaldados |
| context | optin | vivofixadados, vivototaldados |
| context | pontoReferencia | vivofixadados, vivototaldados |
| context | random.guid | bkovivofixamsgativaah, fibrasubida17, vivofixaabandonomsgatah, vivofixadados, vivofixawhatsapp, vivoitvah, vivototalplanoswppnovo |
| context | thread: string, skillResponse: string | fibrasubida17, vivofixadados, vivofixawhatsapp, vivoiptveitvplanos, vivoiptvwpp, vivoitvplanos, vivosegurocelular, vivoseguros, vivototaldados, vivototalplanoswppnovo |
| context | vencimento | vivofixadados, vivototaldados |
| context | wwresponsebody | fibrasubida17, vivofixadados, vivofixawhatsapp, vivoiptveitvplanos, vivoiptvwpp, vivoitvplanos, vivototaldados, vivototalplanoswppnovo |
| context | wwsanitizedinput | fibrasubida17, vivofixadados, vivofixawhatsapp, vivoiptveitvplanos, vivoiptvwpp, vivoitvplanos, vivosegurocelular, vivoseguros, vivototaldados, vivototalplanoswppnovo |

## Herdados de outro bot da cadeia

Outro bot do pacote os escreve; chegam por `variablesToPass` do Typebot link **se o bot anterior da cadeia estiver convertido e ligado**. Se o cliente entrar direto neste bot, chegam vazios.

| Namespace | Nome | Escrito por |
| --- | --- | --- |
| contact.extras | autoSku | fibrasubida17, vivofixawhatsapp, vivoiptveitvplanos, vivosegurocelular, vivoseguros, vivototaldados, vivototalplanoswppnovo |
| contact.extras | bairro | bkovivofixamsgativaah, fibrasubida17, vivofixawhatsapp, vivoiptvwpp, vivosegurocelular, vivoseguros, vivototalplanoswppnovo |
| contact.extras | cep | bkovivofixamsgativaah, fibrasubida17, vivofixawhatsapp, vivoiptvwpp, vivosegurocelular, vivoseguros, vivototalplanoswppnovo |
| contact.extras | complemento | bkovivofixamsgativaah, fibrasubida17, vivofixawhatsapp, vivoiptvwpp, vivosegurocelular, vivoseguros, vivototalplanoswppnovo |
| contact.extras | dataAgendamento1 | vivoiptvwpp |
| contact.extras | dataAgendamento2 | vivoiptvwpp |
| contact.extras | logradouro | bkovivofixamsgativaah, fibrasubida17, vivofixawhatsapp, vivoiptvwpp, vivosegurocelular, vivoseguros, vivototalplanoswppnovo |
| contact.extras | numEndereco | bkovivofixamsgativaah, fibrasubida17, vivofixawhatsapp, vivoiptvwpp, vivototalplanoswppnovo |
| contact.extras | planName | fibrasubida17, vivofixawhatsapp, vivoiptveitvplanos, vivosegurocelular, vivoseguros, vivototaldados, vivototalplanoswppnovo |
| contact.extras | planoDescription | fibrasubida17, vivofixawhatsapp, vivototaldados, vivototalplanoswppnovo |
| contact.extras | protocoloWci | fibrasubida17, vivofixawhatsapp, vivoiptvwpp, vivosegurocelular, vivoseguros, vivototalplanoswppnovo |
| contact.extras | uf | bkovivofixamsgativaah, fibrasubida17, vivofixawhatsapp, vivoiptvwpp, vivosegurocelular, vivoseguros, vivototalplanoswppnovo |
| contact.extras | UtmCampaign2 | fibrasubida17, vivofixaabandonomsgatah, vivofixawhatsapp, vivototalplanoswppnovo |
| contact.extras | UtmMedium | fibrasubida17, vivofixawhatsapp, vivototalplanoswppnovo |
| contact.extras | UtmSource | fibrasubida17, vivofixawhatsapp, vivototalplanoswppnovo |
| context | canal | fibrasubida17, vivofixawhatsapp |
| context | complemento | fibrasubida17, vivofixawhatsapp, vivototalplanoswppnovo |
| context | idPedidoEndereco | fibrasubida17, vivofixawhatsapp |
| context | metaclientphone | fibrasubida17, vivofixawhatsapp, vivoiptvwpp, vivoitvah, vivoitvplanos, vivosegurocelular, vivoseguros, vivototalplanoswppnovo |
| context | metadata | fibrasubida17, vivofixawhatsapp, vivosegurocelular, vivoseguros, vivototalplanoswppnovo |
| context | regiao | fibrasubida17, vivofixawhatsapp, vivoiptvwpp, vivoitvplanos, vivototalplanoswppnovo |
| context | routerNumero | fibrasubida17, vivofixawhatsapp, vivoiptveitvplanos, vivoiptvwpp, vivototalplanoswppnovo |
| context | telefone | fibrasubida17, vivofixawhatsapp, vivototalplanoswppnovo |
