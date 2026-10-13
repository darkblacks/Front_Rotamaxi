# Dívida conhecida, exemplos e riscos (não confundir com estado atual verificado)

- Importação ESL anterior teve casos de anos inválidos (1923, 4506, 20066, 20212), correspondência de modelos incorreta, filtros/pesquisa ruins e registros importados sem qualidade. Não usar esses registros como padrão de catálogo.
- Em momento anterior, testes Laravel com `RefreshDatabase` foram executados indevidamente com ligação a banco produtivo. **PROIBIDO repetir**. Exigir ambiente isolado e cópia sintética ou anonimizada.
- O usuário relatou importação ESL sem identificar terceiro, vínculo agregado indevido, FIPE ausente em muitas placas. Não afirmar que bugs continuam presentes sem inspecionar código vivo.
- Em 12/out/2026, log de AWS do usuário indicou 222 marcas, 11.512 modelos de catálogo, 119 placas com chassi, 1 placa com versão FIPE completa, 9 sugestões prováveis e 14 pendentes em lote de 23 pesquisados. **Fotografia histórica do ambiente, NÃO dados vivos atuais.**
- O serviço de FIPE provável de V7.12 foi orientado por placas e não pelo catálogo de modelos, divergindo do objetivo de Victor. A proposta futura é catalogar modelos/versões FIPE antes de enriquecer veículos importados.
- Proteções fundamentais: backup, staging, migrações aditivas, rollback, atualização idempotente, registro de procedência, revisão antes de liberar produção.

Distinguir `bug confirmado em repositório atual`, `relato do usuário`, `risco hipotético` e `resolvido/testado`. Não inventar status.
