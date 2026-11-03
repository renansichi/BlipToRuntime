# Evidência de confirmação dos cenários do piloto

Data: 02/11/2026 · Responsável (NEG): Renan · Meio: respostas em conversa com o desenvolvimento (papéis DEV, NEG e OPS exercidos pela mesma pessoa).

Fonte dos cenários: [cenarios-para-revisao.md](cenarios-para-revisao.md), derivados do grafo (decisão Q15). Respostas HTTP dos testes são fixtures fictícias, não registros reais.

| Grupo | Cenários | Resposta | Alcance da confirmação |
| --- | --- | --- | --- |
| CPF | P-01, P-02 | Correto | Resultado de negócio confirmado |
| Exceções e erro de API | P-03, P-04, P-05a, P-05b | Correto | Resultado de negócio confirmado |
| Abandono e pessoa jurídica | P-06, P-07a, P-07b, P-08 | Correto | Resultado de negócio confirmado, **incluindo os prazos de 25 min (CPF) e 60 min (abandono)** |
| Formulário e atendimento | F-01, F-02, F-03, D-01, D-02 | Correto, aviso aceito | Resultado confirmado; **aceite da adaptação `bkovivofixamsgativaah:desk-queue-pending`** (aviso “No momento não consigo transferir seu atendimento. Por favor, tente novamente em instantes.” + encerramento, enquanto a fila não estiver configurada) |

## O que esta confirmação NÃO cobre

- Não há registros reais de conversa: os resultados vêm do grafo e do seu entendimento do negócio.
- Confirmar o **resultado** não aceita o **mecanismo** que o produz. Seguem `proposed`, sem aceite: timeout por follow-up (`input-timeout-followup`), TTL na sessão (`ttl-session`), MergeContact na sessão (`merge-contact-session`), shim do envelope do Flow (`script-reads-message-envelope`), `flow-reply-detection` e demais adaptações listadas em `adaptations.json`.
- A homologação num Kayros em execução (F3-08/F3-09) continua pendente.
- O aceite do aviso vale para o bot `bkovivofixamsgativaah`; nos demais bots a mesma adaptação continua `proposed` até decisão.
