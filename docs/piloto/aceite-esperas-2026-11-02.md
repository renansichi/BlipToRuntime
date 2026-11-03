# Decisões sobre as esperas sem envio do piloto

Data: 02/11/2026 · Responsável (NEG): Renan · Meio: respostas em conversa com o desenvolvimento.

Base de evidência: [esperas-vivofixadados.md](esperas-vivofixadados.md). Cada decisão é a adaptação `vivofixadados:wait-without-message:<id8>` e está registrada como **aceita** em `config/piloto.config.json` (exceto `Redireciona_Bot BKO`, que não gera adaptação: veja as observações).

| Estado | Id | Decisão | Efeito no pacote |
| --- | --- | --- | --- |
| Bloco vazio final | `51550a60` | **Remover a espera** | Passagem vazia: o fluxo segue direto para F_04_UltimoImput |
| F_04_UltimoImput | `cd52b86a` | Manter, pergunta padrão | Envia “Pode me confirmar para continuarmos?” e aguarda (texto aceito como está) |
| Redireciona_Bot BKO | `adfa7312` | **Remover a espera** | Nenhuma adaptação de espera é gerada (o Redirect vem antes da espera); o estado só executa o Redirect para o bot BKO |
| finalizar abandono | `5e7c8d2b` | Manter, pergunta padrão | Idem; a espera lê o texto digitado |
| MSG Ativa Reagendamento | `13af0f48` | Manter, pergunta padrão | Idem; entrada por fora, decide pela resposta do cliente |

## Observações

- Em `Redireciona_Bot BKO` o Redirect está nas ações de **entrada**, que a Blip executa antes de aguardar. Na prática a espera nunca ocorria; a decisão só formaliza isso (a indicação “espera adia o redirecionamento” do relatório era imprecisa neste caso).
- Para as três esperas mantidas, o aceite cobre a **pergunta padrão**. Se o negócio preferir um texto específico, altere `fallback.promptText` da adaptação correspondente e regenere o pacote.
- Esta decisão trata só das esperas do `vivofixadados`. As demais esperas (196 no lote) seguem com a pergunta padrão proposta e **sem aceite**.
