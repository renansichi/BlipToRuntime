# Decisões sobre dados do piloto (vivofixadados)

Data: 02/11/2026 · Responsável (NEG/OPS): Renan · Meio: respostas em conversa com o desenvolvimento.

Base de evidência: [dados-vivofixadados.md](dados-vivofixadados.md). Registradas como adaptações **aceitas** em `config/piloto.config.json`.

| Tema | Decisão | Adaptação aceita | Efeito no pacote |
| --- | --- | --- | --- |
| Campos escritos **e** lidos no bot (23 campos de contato; 113 variáveis de contexto) | **Só na sessão** | `vivofixadados:merge-contact-session` | Variáveis de sessão `contact_extras_*`; nada é gravado fora do Kayros. CPF, nome da mãe e data de nascimento não ficam guardados após a sessão |
| Campos **só escritos** (marcadores como “Etapa Cpf”, “44. Carrrinho abandonado wpp”) | **Descartar** | `vivofixadados:merge-contact-write-only-discard` | 59 campos não são mais emitidos (lista em [campos-descartados-vivofixadados.md](campos-descartados-vivofixadados.md)); 15 são mantidos: 12 porque **outro bot os lê** e 3 por decisão (abaixo) |
| Campos **só lidos** (UTM, cep, endereço, sku, protocolo, perfil) | **Parâmetros de entrada** | — (lista) | [parametros-de-entrada-vivofixadados.md](parametros-de-entrada-vivofixadados.md) e `entry-parameters.json` no pacote: 30 externos e 23 herdados da cadeia |
| Expiração de variáveis (`SetVariable` com TTL) | **Aceitar sem expiração** | `vivofixadados:ttl-session` | O valor dura até a sessão terminar |

## Salvaguardas aplicadas ao “Descartar”

- Os bots do lote compartilham o mesmo contato. Por isso um campo só é descartado se **nenhum dos 13 bots** o lê; os 74 campos “só escritos” do relatório (por bot) caíram para 62 e, depois da decisão abaixo, para 59 (ex.: `primeiraMensagem` é lido por 6 bots e foi mantido).
- Chaves dinâmicas (`dataAgendamento{{contadorDeAgendamento}}`) nunca são descartadas.
- O descarte só vale para o `vivofixadados` e só porque a adaptação consta como **aceita**; sem o aceite, os campos continuam sendo emitidos.

## Pontos para você conferir

1. **Três campos de nome operacional foram MANTIDOS** (decisão de 02/11/2026, após o alerta): `filaAH`, `prioridade` e `encerramentoAbandonoFormulario`. Ficam como variáveis de sessão `contact_extras_*`, listados em `dataPolicy.keepContactExtras` de `config/piloto.config.json`. Atenção: na sessão eles **não** chegam ao Blip Desk nem a campanhas; se algo fora dos bots os lê, isso precisa de integração própria (a persistência durável continua dependendo de API/base existente confirmada).
2. **Cenário P-08 mudou de alcance.** Ele verificava que “EMPRESA” em maiúsculas grava a etapa do CPF. Com o descarte aceito, o marcador `Etapa Cpf` não é mais gravado no pacote entregue. O P-08 continua provando que a comparação ignora a caixa, mas **sem** o descarte; o novo **P-08b** prova que o pacote entregue **não** grava o marcador. O P-08b decorre desta decisão e está registrado como confirmado por ela; como o responsável respondeu apenas sobre os três campos e não pediu reversão, o P-08b permanece.
3. Nada disso foi testado num Kayros em execução.
