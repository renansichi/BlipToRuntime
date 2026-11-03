# Importação manual do piloto — vivofixadados

Gerado por `scripts/build-pilot-package.ts` (conversor 0.4.0). **Nada aqui foi importado, publicado ou testado num Kayros.** Estas etapas são suas (decisão Q11: sem instalador automático).

## 1. O que há na pasta

| Arquivo | Para quê |
| --- | --- |
| `flows/kayros-current-adapted/vivofixadados.json` | O bot completo (597 grupos, 1480 blocos). É o que iria para produção, **só depois do aceite** |
| `flows/kayros-current-adapted/vivofixadados.teste-cpf.json`<br>`flows/kayros-current-adapted/vivofixadados.teste-abandono-cpf.json`<br>`flows/kayros-current-adapted/vivofixadados.teste-flows-email-cpf-e-vencimento.json` | Variantes de **teste**: o mesmo bot, mas a conversa já **começa** no trecho (CPF, abandono, formulário), depois de gravar variáveis de teste. Evita atravessar o início do fluxo na homologação |
| `flows/kayros-current-adapted/vivofixadados.teste-cpf.enxuto.json` (834 KB, 539 grupos)<br>`flows/kayros-current-adapted/vivofixadados.teste-abandono-cpf.enxuto.json` (834 KB, 539 grupos)<br>`flows/kayros-current-adapted/vivofixadados.teste-flows-email-cpf-e-vencimento.enxuto.json` (834 KB, 539 grupos) | **Versões enxutas dos testes** (para importar primeiro). Mesmo comportamento a partir da entrada de teste, mas só com os grupos alcançáveis dela, sem gravações de variáveis que ninguém lê e com ids curtos (o importador regenera todos os ids). Texto e valores não mudam |
| `secrets-to-fill.json` | Recursos secretos a criar (sem valores) |
| `entry-parameters.json` | Campos que o bot lê e ninguém no pacote escreve (parâmetros de entrada) |
| `adaptations.json`, `mapping.json`, `diagnostics.json`, `coverage.json`, `passes.json` | Rastreabilidade e relatórios |
| `manual-import-map.json` | Matriz a preencher (ids gerados × importados) |
| `homologacao-resultados.md` | Modelo para registrar as evidências |

Os JSONs são **seguros para o importador do Kayros OS**: sem `to.blockId` nas arestas e sem bloco `Jump` (o importador descarta o primeiro e não remapeia o segundo).

## 2. Antes de importar

1. **Recursos** (Kayros OS): crie as chaves abaixo (os valores **não** estão no pacote; copie do Blip). Segredos como Recurso **secreto**.
2. **Credencial WhatsApp**: os blocos de envio saem sem `credentialsId` (o builder também não grava o campo vazio). Isso é o esperado: depois de importar, defina a credencial **no editor do Kayros**, em cada bloco de envio (ou pelo mecanismo de configuração da plataforma). O pacote não depende de nenhum id de credencial.
3. **Fila de atendimento**: sem fila configurada, o atendimento usa o aviso aceito e encerra (não afeta o recorte CPF).

### Recursos usados no bot

| Chave do Recurso | Tipo | Usos | De onde vem o valor |
| --- | --- | ---: | --- |
| `blip.link.bko_vivo_msg_ativa_ah` | link entre bots (id do bot de destino) | 1 | Id do bot de destino no Kayros (ver `docs/f5/aliases-para-preencher.md`) |
| `blip.link.vivo_abandono_msg_ativa_ah` | link entre bots (id do bot de destino) | 1 | Id do bot de destino no Kayros (ver `docs/f5/aliases-para-preencher.md`) |
| `blip.link.vivo_fixa_hibrido_inicio` | link entre bots (id do bot de destino) | 1 | Id do bot de destino no Kayros (ver `docs/f5/aliases-para-preencher.md`) |
| `blip.link.vivo_fixa_planos_wpp_prod` | link entre bots (id do bot de destino) | 1 | Id do bot de destino no Kayros (ver `docs/f5/aliases-para-preencher.md`) |
| `blip.link.vivo_iptv_e_itv_cross_planos` | link entre bots (id do bot de destino) | 1 | Id do bot de destino no Kayros (ver `docs/f5/aliases-para-preencher.md`) |
| `blip.link.vivo_iptv_e_itv_planos` | link entre bots (id do bot de destino) | 1 | Id do bot de destino no Kayros (ver `docs/f5/aliases-para-preencher.md`) |
| `blip.link.vivo_itv_planos` | link entre bots (id do bot de destino) | 1 | Id do bot de destino no Kayros (ver `docs/f5/aliases-para-preencher.md`) |
| `blip.link.vivo_pesquisa_de_satisfacao` | link entre bots (id do bot de destino) | 1 | Id do bot de destino no Kayros (ver `docs/f5/aliases-para-preencher.md`) |
| `blip.link.vivo_seguro_celular` | link entre bots (id do bot de destino) | 1 | Id do bot de destino no Kayros (ver `docs/f5/aliases-para-preencher.md`) |
| `blip.link.vivo_seguros` | link entre bots (id do bot de destino) | 1 | Id do bot de destino no Kayros (ver `docs/f5/aliases-para-preencher.md`) |
| `blip.link.vivo_total_planos_wpp_novo` | link entre bots (id do bot de destino) | 1 | Id do bot de destino no Kayros (ver `docs/f5/aliases-para-preencher.md`) |
| `blip.vivofixadados.access_token` | SECRETO (literal removido do fluxo) | 55 | Valor literal escrito no corpo/cabecalho de um ProcessHttp do fluxo original (veja `secrets-to-fill.json`) |
| `blip.vivofixadados.apiHub` | comum | 1 | bots/vivofixadados-213cf7299e99/fluxo-vivofixadados-213cf7299e99.json → chave `apiHub` |
| `blip.vivofixadados.apiurl` | comum | 56 | bots/vivofixadados-213cf7299e99/fluxo-vivofixadados-213cf7299e99.json → chave `apiurl` |
| `blip.vivofixadados.client_secret` | SECRETO (literal removido do fluxo) | 1 | Valor literal escrito no corpo/cabecalho de um ProcessHttp do fluxo original (veja `secrets-to-fill.json`) |
| `blip.vivofixadados.dateTimeOffset` | comum | 2 | bots/vivofixadados-213cf7299e99/fluxo-vivofixadados-213cf7299e99.json → chave `dateTimeOffset` |
| `blip.vivofixadados.pageId` | comum | 1 | bots/vivofixadados-213cf7299e99/fluxo-vivofixadados-213cf7299e99.json → chave `pageId` |
| `blip.vivofixadados.refresh_token_2` | SECRETO (literal removido do fluxo) | 1 | Valor literal escrito no corpo/cabecalho de um ProcessHttp do fluxo original (veja `secrets-to-fill.json`) |
| `blip.vivofixadados.tokenHub` | SECRETO (nome indica segredo) | 2 | bots/vivofixadados-213cf7299e99/fluxo-vivofixadados-213cf7299e99.json → chave `tokenHub` |
| `blip.vivofixadados.x_api_key` | SECRETO (literal removido do fluxo) | 2 | Valor literal escrito no corpo/cabecalho de um ProcessHttp do fluxo original (veja `secrets-to-fill.json`) |
| `blip.vivofixadados.x_api_token` | SECRETO (literal removido do fluxo) | 4 | Valor literal escrito no corpo/cabecalho de um ProcessHttp do fluxo original (veja `secrets-to-fill.json`) |

## 3. Importar (um arquivo por vez)

1. No Kayros OS, **Fluxos → Importar** e escolha o JSON. O fluxo entra como rascunho com o nome “… (importado)”.
2. Importe primeiro a **versão enxuta** do teste (ex.: `.teste-cpf.enxuto`). Se ela se comportar, importe as demais e, por último, o completo. Se o Kayros recusar o arquivo por tamanho ou ids, a recusa vem da importação, não do conteúdo: avise com a mensagem.
3. **Exporte o rascunho importado** e confira:

```bash
npm run verify -- <exportado.json> --against piloto-import/flows/kayros-current-adapted/vivofixadados.teste-cpf.enxuto.json
```

   O comando valida a estrutura e compara, grupo a grupo, tipos de bloco, conteúdo (sem ids) e destinos. Variáveis extras de sessão que o importador injeta são esperadas.
4. **Typebot link**: o id de destino sai como `{{resource.blip.link.<alias>}}` (ou o id da configuração). Crie esses Recursos com o **id interno** do bot de destino (não o publicId) — veja `docs/f5/aliases-para-preencher.md`. Para o roteiro abaixo, os links só importam no abandono e no fim do fluxo.
5. Registre ids gerados × importados × publicId em `manual-import-map.json`.

## 4. Homologação (F3-09)

Publique **somente a variante de teste** em um número/canal de teste e execute o roteiro. Para cada linha, registre o resultado em `homologacao-resultados.md` e guarde a evidência (print/log) em `evidencias/`.

| Id | Cenário confirmado | Variante | Ações do cliente | Como provocar | Esperado | Observado | Evidência |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P-01 | CPF valido: valida, consulta e segue para a continuacao | `teste-cpf` | enviar “529.982.247-25” | CPF válido de teste | CPF → Valida CPF → API Busca CPF → API Dados Pessoais → Vencimento WPP · mensagem: “Informe, por gentileza, seu *CPF* completo” |  |  |
| P-02 | CPF invalido: pede de novo; depois valido segue para a consulta | `teste-cpf` | enviar “123” → enviar “52998224725” | CPF inválido, depois CPF válido | CPF → Valida CPF → DI CPF → Valida CPF → API Busca CPF → API Dados Pessoais → Vencimento WPP · mensagem: “O CPF foi digitado errado, ou está inválido” |  |  |
| P-03 | Sem digitos: segue para o estado de excecao e depois para o agente | `teste-cpf` | enviar “nao sei” | Responder um texto sem dígitos | CPF → Valida CPF → Exceções → GPT - salva input |  |  |
| P-04 | API de dados pessoais responde 500: caminho de erro | `teste-cpf` | enviar “52998224725” | Forçar status 500 na API de dados pessoais (ambiente de teste/mock) | CPF → Valida CPF → API Busca CPF → API Dados Pessoais → Erro API Dados Pessoais → Email · mensagem: “aconteceu algum erro ao validar seus dados” |  |  |
| P-05a | API responde 200 com isValid=false: caminho de erro | `teste-cpf` | enviar “52998224725” | Forçar resposta 200 com isValid=false / data=null (mock) | API Dados Pessoais → Erro API Dados Pessoais → Email |  |  |
| P-05b | API responde 200 com data=null: caminho de erro | `teste-cpf` | enviar “52998224725” | Forçar resposta 200 com isValid=false / data=null (mock) | API Dados Pessoais → Erro API Dados Pessoais → Email |  |  |
| P-06 | Sem resposta no prazo (timeout do CPF): destino de abandono | `teste-cpf` | não responder até o prazo | CPF válido de teste | CPF → Roteador de timeout → Destino {{idAbandono}} → Direciona_Abandono |  |  |
| P-07a | Abandono com retorno do cliente (tunnel.owner definido): volta a validar o CPF | `teste-abandono-cpf` | enviar “52998224725” | CPF válido de teste | Abandono CPF → Valida CPF · mensagem: “falta pouco para finalizar a sua contratação” |  |  |
| P-07b | Abandono sem resposta no prazo: so o lembrete e a chamada de abandono; segue ao destino calculado (abandono2D) | `teste-abandono-cpf` | não responder até o prazo | CPF válido de teste | Abandono CPF → Roteador de timeout → Destino {{abandono2D}} → Abandono Geral 2D |  |  |
| P-08 | Pessoa juridica (EMPRESA em maiusculas): a comparacao ignora a caixa e a etapa do CPF e gravada (verificacao SEM a decisao de descartar marcadores) | `teste-cpf` | enviar “52998224725” | Variável tipoPessoa = EMPRESA (já no preset do teste: alterar o preset) | CPF → Valida CPF → API Busca CPF |  |  |
| P-08b | Pessoa juridica no pacote entregue (descarte de marcadores aceito em 02/11/2026): a etapa do CPF NAO e gravada | `teste-cpf` | enviar “52998224725” | Variável tipoPessoa = EMPRESA (já no preset do teste: alterar o preset) | CPF → Valida CPF → API Busca CPF |  |  |
| F-01 | Formulario enviado como Flow e cliente escolhe 'continuar' (coleta alternativa por texto) | `teste-flows-email-cpf-e-vencimento` | enviar “continuar” | CPF válido de teste | Flows Email, CPF e Vencimento → Email · mensagem: “111222333” |  |  |
| F-02 | Retorno estruturado do Flow (flow_response): o script do envelope le o retorno e a jornada segue para a consulta de CPF | `teste-flows-email-cpf-e-vencimento` | concluir o formulário (Flow) | CPF válido de teste | Flows Email, CPF e Vencimento → API Busca CPF |  |  |
| F-03 | Sem retorno do Flow no prazo: segue o destino de abandono | `teste-flows-email-cpf-e-vencimento` | não responder até o prazo | CPF válido de teste | Flows Email, CPF e Vencimento → Roteador de timeout → Direciona_Abandono |  |  |

**O que o roteiro não prova**: P-04/P-05 exigem forçar respostas da API (mock ou ambiente de teste); sem isso ficam como “simulado nos testes isolados”. Os prazos (25 min/60 min) levam esse tempo real — para acelerar, use o ambiente de teste com prazo reduzido (e registre que foi reduzido).

Pontos para observar na homologação (premissas ainda **não verificadas** num Kayros real):
- o clique em botão/lista segue para o próximo bloco do grupo e o texto capturado é o **título**;
- o follow-up por inatividade dispara o evento `followUp` depois do prazo (roteador por `timeout_state`);
- `{{resource.…}}` funciona dentro de blocos `Code` e em `typebotId`;
- `flow_response` chega preenchido no retorno do Flow.

## 5. Se algo não confere

Rode `npm run verify -- <exportado.json> --against <gerado>` e envie a saída. Reimportar gera ids novos (não é idempotente): refaça o remapeamento da matriz.
