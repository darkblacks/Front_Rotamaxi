# Decisões do produto aprovadas em conversa (contexto histórico)

- Produto: RotaMaxi é um TMS integrado, com módulos e cadastros interoperáveis, dados rastreáveis e foco no MVP operacional.
- Escopo: somente microentregas autorizadas por Victor; PO alta autonomia só no COMO. Ideias fora do escopo viram backlog.
- Processo: PO coordena especialista regras, UX, DEV e QA. UX produz quatro propostas por página nova autorizada; PO aprova rotina, Victor aprova grandes reformulações/identidade.
- 100 regras mínimas DISTINTAS por página, incluindo o que não deve acontecer, exceções, testes e conflitos, não 100 funcionalidades. BPMN 2.0, indicadores e metas SMART pertinentes.
- Custo: priorizar APIs gratuitas e open source, sem novo custo recorrente sem aprovação; custos da infraestrutura atual não são zero automaticamente.
- Veículos: vínculo operacional `Próprio` ou `Terceiro` (ESL `Agregado` é dado de origem que mapeia para Terceiro). Não criar novo tipo operacional sem aprovação.
- Terceiro sem transportadora identificada: registrar `Não identificado` como pendência, sem inventar prestadora nem bloquear só por isso.
- Veículos próprios: CRLV/licenciamento associados à placa, documentos/imagens de forma semelhante à seção Pessoas, pendências documentais visíveis. Falta de anexo no sistema não equivale necessariamente a inaptidão legal; não ignorar restrição legal real.
- Dados incompletos: chassi, FIPE, combustível e outros dados complementares incompletos geram pendências claras, sem bloqueio operacional automático; validações essenciais de integridade podem bloquear operações específicas.
- FIPE: modelo operacional e catálogo de marca/modelos já existente devem receber versões FIPE de acordo com ano, combustível e motor. Valor `FIPE mais provável` é estimativa explicitamente não confirmada; FIPE confirmada requer validação. Nunca inventar cotação.
- Catálogo primeiro: não treinar a correspondência FIPE usando placas geradas por importação ESL problemática; basear nos MODELOS cadastrados. Serviços de enriquecimento sem obrigatoriedade de ficha perfeita.
- Importações: origem ESL deve adaptar-se às regras RotaMaxi; registrar pendências, deduplicar, permitir importação parcial, revisão persistente e reversão segura mediante autorização com prévia. Nunca deletar registros reais silenciosamente.
- QA nunca roda testes destrutivos em produção.

**Importante:** prioridades históricas acima orientam decisões se a microentrega abordar esse domínio; NÃO permitem adicionar funções em outras páginas sem autorização de Victor.

## Decisões de Victor — 12/10/2026 (foco do MVP de Veículos)
- **Objetivo do MVP:** frota confiável + patrimônio da frota PRÓPRIA. Sistema de depreciação robusto: valor FIPE atual x valor de compra, para veículos Próprios. Saber frota própria x agregada.
- **Agregado/Terceiro:** NÃO depreciar e NÃO tratar FIPE como interesse (não entram no patrimônio nem na depreciação). Basta ter os dados cadastrais completos. Consulta FIPE avulsa continua disponível (ex.: avaliar compra de uma Fiorino), mas sem cálculo patrimonial para agregado/terceiro.
- **Compra de veículo novo (ex.: Fiorino):** garantir que o cadastro capture os dados de compra e identificação para alimentar depreciação desde o primeiro dia.
- **Terceiros de Transporte:** CNPJ/CPF é necessário no cadastro, mas NÃO obrigatório por enquanto (ESL ainda não fornece). Coluna nova de documento = migração aditiva, executada somente com backup e confirmação final do pacote de migração.
- **Aparelho de refrigeração, GPS e demais componentes** (próprios ou pagos por fora): FUTURO. Virão em aba separada "Componentes do veículo" dentro de Frota. Fora do MVP; não implementar agora. Linhas "APARELHO REFRIGERAÇÃO" do CSV ESL ficam fora do cadastro de veículos.
- **Ordem de trabalho:** primeiro concluir análise e correção dos dados (reconciliação, padronização, importação segura); novas instruções de Victor virão depois.
