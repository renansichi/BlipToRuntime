# Situação por bot — F5 (expansão)

Gerado por `scripts/f5-status.ts` com a configuração do piloto (`config/piloto.config.json`). Conversor sobre a origem 2026-11-02T04-26-43-071Z-e44c3a22.

> **Nenhum bot está “aceito para importação manual”.** Todos estão estruturalmente válidos e com cobertura total da origem, mas as adaptações que mudam regra de negócio ainda aguardam aceite por jornada, os dados externos estão pendentes e não houve homologação.

## Situação e pendências

Situações (spec 9.5): `structurally_valid` → `awaiting_journey_acceptance` (há adaptação funcional sem aceite) → `accepted_for_manual_import`.

| Bot | Situação | Cobertura da origem | Adaptações | Diagnósticos: parâmetro / adaptação / ambos | Cenários confirmados | Teto/passada (msgs / chamadas) |
| --- | --- | ---: | --- | --- | ---: | ---: |
| vivofixawhatsapp | awaiting_journey_acceptance | 2.506/2.506 | 41 (34 sem aceite; 0 aceitas) | 86 / 224 / 262 | 0 | 7/7 |
| vivofixadados | awaiting_journey_acceptance | 1.541/1.541 | 20 (6 sem aceite; 7 aceitas) | 83 / 106 / 145 | 14 | 6/11 |
| bkovivofixamsgativaah | awaiting_journey_acceptance | 679/679 | 42 (36 sem aceite; 1 aceitas) | 10 / 58 / 56 | 2 | 3/1 |
| vivofixaabandonomsgatah | awaiting_journey_acceptance | 182/182 | 19 (16 sem aceite; 0 aceitas) | 4 / 17 / 17 | 0 | 1/0 |
| vivoitvplanos | awaiting_journey_acceptance | 899/899 | 21 (14 sem aceite; 0 aceitas) | 20 / 31 / 99 | 0 | 7/8 |
| vivoitvah | awaiting_journey_acceptance | 159/159 | 15 (13 sem aceite; 0 aceitas) | 2 / 12 / 9 | 0 | 2/0 |
| vivoiptvwpp | awaiting_journey_acceptance | 3.038/3.038 | 27 (18 sem aceite; 0 aceitas) | 22 / 172 / 545 | 0 | 7/10 |
| vivoiptveitvplanos | awaiting_journey_acceptance | 517/517 | 16 (9 sem aceite; 0 aceitas) | 11 / 16 / 63 | 0 | 7/7 |
| vivototalplanoswppnovo | awaiting_journey_acceptance | 1.799/1.799 | 35 (27 sem aceite; 0 aceitas) | 65 / 140 / 329 | 0 | 12/15 |
| vivototaldados | awaiting_journey_acceptance | 1.214/1.214 | 20 (12 sem aceite; 0 aceitas) | 59 / 67 / 202 | 0 | 7/12 |
| fibrasubida17 | awaiting_journey_acceptance | 2.521/2.521 | 41 (34 sem aceite; 0 aceitas) | 86 / 225 / 262 | 0 | 8/7 |
| vivosegurocelular | awaiting_journey_acceptance | 996/996 | 16 (9 sem aceite; 0 aceitas) | 24 / 20 / 104 | 0 | 7/10 |
| vivoseguros | awaiting_journey_acceptance | 851/851 | 15 (9 sem aceite; 0 aceitas) | 25 / 17 / 97 | 0 | 6/6 |

## Dependências a preencher por bot

| Bot | Aliases de Redirect | Ids de Flow | Pontos de agente IA | HTTP | Pontos de atendimento | Segredos a preencher | Parâmetros de entrada (externos / da cadeia) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| vivofixawhatsapp | 7 | 1 | 4 | 82 | 0 | 5 | 36 / 7 |
| vivofixadados | 11 | 3 | 4 | 85 | 0 | 5 | 30 / 23 |
| bkovivofixamsgativaah | 4 | 0 | 0 | 5 | 2 | 1 | 20 / 5 |
| vivofixaabandonomsgatah | 2 | 0 | 0 | 5 | 2 | 0 | 6 / 2 |
| vivoitvplanos | 15 | 0 | 2 | 15 | 0 | 2 | 25 / 11 |
| vivoitvah | 2 | 0 | 0 | 1 | 2 | 0 | 4 / 0 |
| vivoiptvwpp | 5 | 3 | 6 | 72 | 0 | 3 | 53 / 10 |
| vivoiptveitvplanos | 7 | 0 | 2 | 13 | 0 | 2 | 11 / 11 |
| vivototalplanoswppnovo | 6 | 1 | 2 | 64 | 0 | 4 | 38 / 19 |
| vivototaldados | 9 | 2 | 2 | 50 | 0 | 5 | 26 / 26 |
| fibrasubida17 | 7 | 1 | 4 | 82 | 0 | 5 | 36 / 7 |
| vivosegurocelular | 5 | 2 | 10 | 51 | 0 | 2 | 31 / 5 |
| vivoseguros | 6 | 3 | 2 | 49 | 0 | 2 | 26 / 4 |

Tetos do motor por passada: 15 mensagens e 30 chamadas externas; nenhum bot excede (ver `passes.json` no pacote).

## Ordem de trabalho sugerida

A ordem “pelo grafo de dependências” (F5-01) **não pode ser calculada**: os endereços de Redirect são nomes de aplicações da Blip (ex.: “Vivo Fixa Planos [WPP][PROD]”) e nenhum está confirmado como um dos 13 bots; vários apontam para bots fora do lote. Ver [aliases-para-preencher.md](aliases-para-preencher.md). Enquanto isso, sugere-se validar do menor para o maior (menos risco primeiro), mantendo o piloto como referência de padrão:

1. `vivoitvah` (23 estados)
2. `vivofixaabandonomsgatah` (25 estados)
3. `vivoiptveitvplanos` (59 estados)
4. `bkovivofixamsgativaah` (89 estados)
5. `vivoseguros` (100 estados)
6. `vivoitvplanos` (105 estados)
7. `vivototaldados` (111 estados)
8. `vivosegurocelular` (114 estados)
9. `vivofixadados` (129 estados)
10. `vivototalplanoswppnovo` (140 estados)
11. `vivofixawhatsapp` (200 estados)
12. `fibrasubida17` (201 estados)
13. `vivoiptvwpp` (333 estados)
