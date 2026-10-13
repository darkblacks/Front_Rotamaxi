# Constituição de custos, integridade e segurança

## Custos
- Objetivo: zero custo NOVO incremental do MVP, quando viável. Preferir tecnologias gratuitas/open source, limites gratuitos de APIs, caching, rate limiting e fallback. Não criar assinaturas, inserir cartões, habilitar serviços cobrados ou carregar recursos caros sem aprovação.
- `Claude Code`/modelos e a AWS podem ter custos. Não prometer literalmente zero gastos, nem prometer APIs FIPE sem limites de consulta.

## Dados e operação
- Proibir deploy, ssh/scp/rsync para produção, `git push`, exclusão real, migrations produtivas, `DROP/TRUNCATE`, testes com banco AWS sem autorização específica e confirmação de backup.
- Hooks são guardas complementares, não garantem isolamento contra comandos ocultos em scripts nem contra IDEs externas. Não compartilhar credenciais com agentes. Use projeto/branch de desenvolvimento e containers de teste separados, segredos inacessíveis.
- Não rodar `php artisan test` no contêiner conectado ao PostgreSQL produtivo. Arquivos `.env`, tokens, senhas não devem ser lidos/copíados/expostos.

## Processo e qualidade
- Decisões críticas com Victor: gasto novo, mudança de negócio/fiscal, segurança, dados reais, escopo, deploy e identidade visual ampla.
- Registros pendentes têm visibilidade e responsabilidade; dado cadastral incompleto não autoriza ocultar irregularidade legal.
