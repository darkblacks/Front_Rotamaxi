# Inventário técnico inicial — conferir repositório local antes de atuar

Informação histórica observada em artefatos de desenvolvimento anteriores:
- Frontend RotaMaxi: Vue 3 + Vite + Pinia + Vue Router + Axios, com telas de cadastro, Pessoas, Veículos, Prestadores, Catálogo e importação ESL.
- Backend RotaMaxi: Laravel/PHP, PostgreSQL, Redis/worker, Docker Compose em AWS EC2. Serviço de consulta FIPE, migrations para catálogos e sugestões.
- Observada estrutura de projeto AWS em conversas: `rotamax_ETAPA2_backend_AWS`, `app`, `infra/compose.prod.yml`, `infra/.env.production`. NÃO usar essas referências para conectar em produção; apenas contexto.
- Exportação CSV ESL pode conter erros graves. Catalogar marca/modelo FIPE sem confiar em placas importadas.

Primeira etapa OBRIGATÓRIA do PO/DEV antes de qualquer tarefa: verificar se está na raiz do frontend ou backend, ler package/composer, rotas e migrations, comparar com documentação, apontar duplicatas e declarar lacunas. Se ambos os repositórios estiverem separados, o PO pede localização/autorização para operar no segundo, sem adivinhar.
