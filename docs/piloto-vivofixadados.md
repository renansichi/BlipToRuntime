# Piloto `vivofixadados` — recorte CPF (F0-07)

Delimitação feita por leitura do contrato `fluxo-vivofixadados-213cf7299e99.json` (129 estados). Os resultados esperados **não** foram inventados: onde o texto diz "a confirmar" é o NEG quem decide (F3-07). Nada foi executado.

## Estados do recorte (id Blip → título)
| Estado | Papel | Observações lidas no fluxo |
| --- | --- | --- |
| `6edb0c7c-d6e1-42b3-ab10-6ad3992286b1` CPF | Pergunta o CPF | 1 texto + input (`expiration` `0:25`); 16 ações de entrada/saída (SetVariable, TrackEvent, MergeContact, 2 ExecuteScript); saídas: `input notExists → ?{{idAbandono}}` (destino dinâmico), `input:cpf exists → Valida CPF`, default → Exceções |
| `274bf638-…` Valida CPF | Validação | Sem input; 3 ExecuteScript + MergeContact + TrackEvent; saídas por `context:semNumero`, `context:cpf equals false` → DI CPF, `notEquals false` → API Busca CPF |
| `32c3d55c-…` DI CPF | Reapresenta pedido (CPF inválido) | Texto + input (`expiration` `0:15`); `input:semNumero exists → Valida CPF` |
| `ff462f6e-…` API Busca CPF | Consulta | `ProcessHttp {{config.apiHub}}/CPF/{{cpf}}`, MergeContact, 3 TrackEvent; sem input (bypass) |
| `8f190714-…` API Dados Pessoais | Consulta/continuação | `ProcessHttp {{config.apiurl}}`; saídas por status 3/4/5xx, `isValid=false`, `data=null` → Erro API Dados Pessoais; sucesso segue para Valida Vencimento / API Fatura / Vencimento WPP conforme variáveis de contexto |
| `69eb4580-…` Erro API Dados Pessoais | Erro | A detalhar na F3-01 |
| `99e09c5e-…` Abandono CPF / `846b5065-…` Abandono CPF F | Abandono | MergeContact ×3, ExecuteScript, **ProcessHttp `{{config.apiurl}}` ×2**, SetVariable `retomada`; input com `expiration` `1:0` e `0:5`; saída `tunnel.owner exists → Valida CPF` (retomada) |
| `Exceções` (fallback) | Destino de erro/saída padrão | A detalhar na F3-01 |

Entradas que chegam em API Busca CPF: Confirma Dados, Altera Dados, Valida CPF, Flows Email/CPF/Vencimento, Confirma Dados Carrinho.

## Itens que o piloto exercita (por padrão de atenção)
- Destino dinâmico (`?{{idAbandono}}`, `?{{abandono2D}}`, `?{{abandono2F}}`) — F1-06.
- Timeouts de input (`0:25`, `0:15`, `1:0`, `0:5`; formato `expiration` a confirmar) — F3-05.
- MergeContact/persistência — F3-03; TrackEvent → `journeyEvent` — F2-07.
- `ProcessHttp` com `config.apiHub` e `config.apiurl` (Recursos) — F2-07, F0-06.
- Scripts (`ExecuteScript`, função `run`) — F2-06.

## Matriz inicial de casos (entradas e resultados a confirmar pelo NEG)
| Caso | Entrada | Caminho esperado (derivado do grafo) | Resultado de negócio |
| --- | --- | --- | --- |
| P-01 | CPF válido | CPF → Valida CPF → API Busca CPF → API Dados Pessoais → continuação | a confirmar |
| P-02 | CPF inválido (`cpf=false`) | CPF → Valida CPF → DI CPF → (nova entrada) Valida CPF | a confirmar |
| P-03 | Sem número (`semNumero`) | Valida CPF → Exceções | a confirmar |
| P-04 | API com status 3xx/4xx/5xx | API Dados Pessoais → Erro API Dados Pessoais | a confirmar |
| P-05 | API com `isValid=false` ou `data=null` | idem P-04 | a confirmar |
| P-06 | Sem resposta no input CPF (timeout) | CPF → `?{{idAbandono}}` → Abandono CPF | a confirmar |
| P-07 | Retomada após abandono (`tunnel.owner`) | Abandono CPF → Valida CPF | a confirmar |
| P-08 | Entrada inesperada | CPF → default → Exceções | a confirmar |

Registros reais de conversa: **não fornecidos**. Serão vinculados quando o NEG/OPS os entregarem (Q15).

## Dados necessários antes de F3
Contrato da API CPF (`config.apiHub`/`config.apiurl`: método, auth, erros), valores dos Recursos, destino de `idAbandono`, fila/horário do atendimento do recorte, persistência para MergeContact. Ver `pendencias-e-responsaveis.md`.
