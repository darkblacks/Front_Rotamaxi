# Handoffs obrigatórios

## PO -> UX
Microentrega fechada, regras de negócio IDs aprovadas, fluxo BPMN, componentes existentes, design system atual, lista de páginas autorizadas, critérios de aceitação. UX devolve 4 propostas visuais em arquivos PNG por página, protótipos HTML/CSS e explicações de tradeoffs. Alteração visual ampla => Victor.

## PO -> DEV
Escopo literal e exclusões, regras IDs aprovadas, fluxos, UX selecionado, contratos backend/frontend, custos permitidos, módulos/arquivos autorizados, rollback e testes esperados. DEV encaminha dúvidas ao PO; não pode gerar feature extra.

## DEV -> QA
Diff/arquivos, endpoints, cenários, comandos de testes isolados, ambiente sandbox, observações e conhecidos. Resultado de build/teste em log; dizer explicitamente se não executados.

## QA -> DEV/PO
Tabela `ID_regra | cenário | evidência | passou | bug_id`. Bugs com severidade, passos exatos, esperado/obtido, logs, prints e status do reteste. Bloqueadores devolvem DEV. QA não escreve código de produção.

## PO -> Victor
Entregas, não entregas, conformidade com scope, alternativas de UX aprovadas, status QA, custos, riscos, documentação e backlog externo.
