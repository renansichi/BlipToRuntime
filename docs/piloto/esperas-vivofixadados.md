# Esperas sem envio — vivofixadados

Estados que aguardam entrada do usuario sem enviar mensagem (spec 3.3). Cada um gera a adaptacao `<bot>:wait-without-message:<id8>`.
Para **remover** a espera, aceite a adaptacao com `fallback.kind = "remove"`; para **trocar a pergunta padrao**, informe `fallback.promptText`. Sem decisao, o pacote usa a pergunta padrao e a adaptacao fica `proposed`.

| Estado | Id | Antecessores literais | Via destino calculado | Le o conteudo digitado | Redireciona/transfere | Expiracao | Indicacao (heuristica) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F_04_UltimoImput | `cd52b86a` | Agradecimento; Bloco vazio final; Agradecimento Recusa; Agradecimento Recusa ITV e IPTV; Agradecimento (Cross); Encerra conversa fora horario | — | nao | nao | — | a avaliar: nao le o conteudo da resposta |
| Redireciona_Bot BKO | `adfa7312` | MSG Ativa Reagendamento | — | nao | sim | — | provavel dispensavel: o estado redireciona/transfere; a espera so adia o redirecionamento |
| Bloco vazio final | `51550a60` | F_02_Confirmacao; F_02_Confirmacao e Envio WCI | — | nao | nao | — | a avaliar: nao le o conteudo da resposta |
| finalizar abandono | `5e7c8d2b` | API Abandono Final | — | sim | nao | — | necessaria: decide ou processa o texto digitado pelo cliente |
| MSG Ativa Reagendamento | `13af0f48` | — | — | sim | nao | — | necessaria: decide ou processa o texto digitado pelo cliente |
