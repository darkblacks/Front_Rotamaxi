# Especificação de negócio — por página

## 1. Escopo
Microentrega ID, página, objetivo, atores, dados e módulos relacionados. Não listar funcionalidades fora de escopo como obrigatórias.

## 2. Matriz de 100+ regras reais
Campos para CADA regra:
`ID | origem/proveniência | status | prioridade | ator | condição/trigger | DEVE | NÃO DEVE | exceção | estados | integração | Given/When/Then | risco | KPI/referência`
- Mínimo >=100 únicas POR PÁGINA, não por projeto nem por módulo.
- Verificar duplicidades, conflitos, circularidade, condições impossíveis, condições faltantes, regras implícitas e exceções não tratadas.
- Se >=100 não forem fundamentáveis sem inventar, comunicar ao PO e aprofundar pesquisa; jamais completar por repetição.

## 3. BPMN 2.0
Evento início/fim, pools, lanes, tarefas, gateways exclusivos/paralelos, mensagens, timers e eventos de erro/compensação conforme necessário. Nomear responsáveis. Indicar como modelar em BPMN 2.0 genuíno; Mermaid é apenas ilustração, não substituto automático.

## 4. DMN e decisão
Tabelas condição => resultado, prioridade, exceção e estado. Validação de conflitos.

## 5. KPIs e metas SMART
Indicador, definição, fórmula, origem, granularidade, responsável, periodicidade, baseline e meta SMART proposta/aprovada. Não inventar meta numérica.

## 6. Relatório
Contagem de regras distintas, por dimensão, conflitos identificados/resolvidos, questões críticas ao PO, evidência de conformidade, rastreabilidade para QA.
