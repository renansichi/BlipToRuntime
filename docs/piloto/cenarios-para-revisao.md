# Cenarios do piloto — confirmados (NEG)

Derivados do grafo pelo desenvolvimento (decisao Q15). **Confirmados pelo responsavel em 02/11/2026** (evidencia: [aceite-cenarios-2026-11-02.md](aceite-cenarios-2026-11-02.md)); sem registros reais de conversa. Para alterar um resultado, mude o cenario em `scenarios/` e reexecute `npx tsx scripts/build-pilot-config.ts`.

As respostas HTTP dos testes sao fixtures ficticias e explicitas; sem fixture a chamada falha (nunca ha sucesso generico).

| Id | Bot | Descricao | Parte de | Entradas do cliente | Trilha esperada | Mensagens esperadas | Chamadas HTTP | Fim |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P-01 | vivofixadados | CPF valido: valida, consulta e segue para a continuacao | CPF | "529.982.247-25" | CPF → Valida CPF → API Busca CPF → API Dados Pessoais → Vencimento WPP | “Informe, por gentileza, seu *CPF* completo” | GET /CPF/52998224725; POST api.exemplo.test | stopAt |
| P-02 | vivofixadados | CPF invalido: pede de novo; depois valido segue para a consulta | CPF | "123" ; "52998224725" | CPF → Valida CPF → DI CPF → Valida CPF → API Busca CPF → API Dados Pessoais → Vencimento WPP | “O CPF foi digitado errado, ou está inválido” | GET /CPF/52998224725; POST api.exemplo.test | stopAt |
| P-03 | vivofixadados | Sem digitos: segue para o estado de excecao e depois para o agente | CPF | "nao sei" | CPF → Valida CPF → Exceções → GPT - salva input | — | nenhuma | stopAt |
| P-04 | vivofixadados | API de dados pessoais responde 500: caminho de erro | CPF | "52998224725" | CPF → Valida CPF → API Busca CPF → API Dados Pessoais → Erro API Dados Pessoais → Email | “aconteceu algum erro ao validar seus dados” | nenhuma | stopAt |
| P-05a | vivofixadados | API responde 200 com isValid=false: caminho de erro | CPF | "52998224725" | API Dados Pessoais → Erro API Dados Pessoais → Email | — | nenhuma | stopAt |
| P-05b | vivofixadados | API responde 200 com data=null: caminho de erro | CPF | "52998224725" | API Dados Pessoais → Erro API Dados Pessoais → Email | — | nenhuma | stopAt |
| P-06 | vivofixadados | Sem resposta no prazo (timeout do CPF): destino de abandono | CPF | (sem resposta no prazo) | CPF → Roteador de timeout → Destino {{idAbandono}} → Direciona_Abandono | — | nenhuma | stopAt |
| P-07a | vivofixadados | Abandono com retorno do cliente (tunnel.owner definido): volta a validar o CPF | Abandono CPF | "52998224725" | Abandono CPF → Valida CPF | “falta pouco para finalizar a sua contratação” | POST api.exemplo.test; POST api.exemplo.test | stopAt |
| P-07b | vivofixadados | Abandono sem resposta no prazo: so o lembrete e a chamada de abandono; segue ao destino calculado (abandono2D) | Abandono CPF | (sem resposta no prazo) | Abandono CPF → Roteador de timeout → Destino {{abandono2D}} → Abandono Geral 2D | — | POST api.exemplo.test | stopAt |
| P-08 | vivofixadados | Pessoa juridica (EMPRESA em maiusculas): grava a etapa do CPF porque a comparacao ignora caixa | CPF | "52998224725" | CPF → Valida CPF → API Busca CPF | — | nenhuma | stopAt |
| F-01 | vivofixadados | Formulario enviado como Flow e cliente escolhe 'continuar' (coleta alternativa por texto) | Flows Email, CPF e Vencimento | "continuar" | Flows Email, CPF e Vencimento → Email | “111222333” | nenhuma | stopAt |
| F-02 | vivofixadados | Retorno estruturado do Flow (flow_response): o script do envelope le o retorno e a jornada segue para a consulta de CPF | Flows Email, CPF e Vencimento | (retorno do formulario) | Flows Email, CPF e Vencimento → API Busca CPF | — | nenhuma | stopAt |
| F-03 | vivofixadados | Sem retorno do Flow no prazo: segue o destino de abandono | Flows Email, CPF e Vencimento | (sem resposta no prazo) | Flows Email, CPF e Vencimento → Roteador de timeout → Direciona_Abandono | — | nenhuma | stopAt |
| D-01 | bkovivofixamsgativaah | Atendimento humano sem fila configurada: aviso e encerramento explicito, sem UUID de fila inventado | 4.0 - Atendimento humano | — | 4.0 - Atendimento humano | “não consigo transferir” | nenhuma | ended (fila_nao_configurada) |
| D-02 | bkovivofixamsgativaah | Atendimento humano com a fila informada na configuracao: transfere para a fila | 4.0 - Atendimento humano | — | 4.0 - Atendimento humano | — | nenhuma | queue (a7144fc1-908a-418c-bc25-775d2a75163e) |

Executar: `npm test -- pilot`.
