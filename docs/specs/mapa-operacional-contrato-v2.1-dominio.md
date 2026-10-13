# CORREÇÃO DE DOMÍNIO V2.1 — SERVIÇO = TIPO + LOCAL (prevalece sobre V1/V2 onde divergir)

**Serviço NÃO tem origem, destino, rota, ponto inicial nem ponto final.** Quem tem início/fim/veículo/motorista/sequência/rota/execução é o **Manifesto**.

## Serviço
- `tipo`: único, `coleta | transferencia | distribuicao`.
- `local`: o ponto onde a atividade acontece — `{kind:'unidade|filial', id}` (cadastro mestre) ou `{latitude,longitude,nome}` avulso; guardado também como snapshot (`local_snapshot`: nome, endereço, lat, lng).
  - coleta: onde coleta · distribuicao: onde entrega (cliente) · transferencia: o CT/ponto onde a transferência é executada/culmina.
- Dados próprios: `cliente_pessoa_id?`, `pallets_previstos?`, `janela_inicio/fim?`, `observacoes`, `numero`, `status` (`DEMANDA|EMPENHADO|EM_EXECUCAO|CONCLUIDO|CANCELADO`), `manifesto_id?`, `etapa_id?` (a etapa do manifesto que o executa), `ordem` (= ordem da etapa no manifesto, derivada), execução (`descarga_concluida_em`, `canhoto_anexo_id`, `concluido_em`).
- Remover: `ponto_origem`, `ponto_destino`, `etapa_origem_id`, `etapa_destino_id` e `tipos[]` (substituído por `tipo`). Migration aditiva-compatível: criar `tipo`, `local_*`, `etapa_id`; backfill a partir dos dados existentes (tipo = primeiro de `tipos`; local = ponto_destino para distribuição/transferência, ponto_origem para coleta; etapa_id = etapa_destino_id/origem conforme tipo); só então dropar as colunas antigas (ou deixá-las deprecadas e não lidas — preserve dados, nenhuma perda). Cobrir dados já existentes e os do QA.
- API: `POST /mapa/servicos` {tipo, local, cliente_pessoa_id?, pallets_previstos?, janela_*?, observacoes?} — **nenhuma exigência de origem/destino**. Validações só de tipo+local: coleta → local de natureza coleta ou qualquer local geocodificado; distribuição → local com cliente; transferência → local CT/filial. `GET /mapa/servicos` devolve `{tipo, local:{kind,id,nome,endereco,latitude,longitude}, ordem, manifesto, etapa_id, status,...}`.
- Combinação "Coleta + Transferência" no mesmo trecho (PDF §3.2): deixa de ser atributo do Serviço; é classificação derivada do TRECHO do manifesto (etapa de coleta seguida de etapa de transferência/CT diferente do início). Mantenha apenas se já existir como derivação em `Etapa.servicos`/rótulo; não ofereça multi-tipo no formulário de Serviço.

## Empenho e rota do Manifesto
- Manifesto: `ponto_inicial`, `ponto_final`, veículo, motorista.
- `POST /mapa/servicos/{id}/empenhar` {manifesto_id, ordem?} → cria (ou reaproveita, se o mesmo local já está no roteiro com papel compatível) a **etapa** do local do serviço, entre as etapas existentes, na posição `ordem` (padrão: antes da etapa `fim`), papel da etapa pela tipo (coleta→`coleta`, distribuicao→`distribuicao`, transferencia→`ct`). Liga `servico.etapa_id`. Registra `pallet_registros(esperado, roteirizador)` quando `pallets_previstos`.
- `PUT /mapa/manifestos/{id}/servicos/ordem` {servico_ids:[…]} reordena os serviços empenhados → reordena as etapas correspondentes → recalcula rota (nova versão). `desempenhar` remove a etapa se ficou órfã.
- **Rota** = `ponto_inicial` + locais dos serviços empenhados em ordem + `ponto_final` (etapas `inicio`, `parada`…, `fim`). `PUT /mapa/manifestos/{id}/etapas` continua existindo para paradas operacionais manuais (ex.: estacionamento), mas a UI de planejamento monta o roteiro pelos serviços.
- Validações de liberação (RN §20): inicio e fim georreferenciados; veículo/motorista; sequência sem lacunas; cada serviço com tipo+local geocodificado; janela válida; rota calculável. Remover as validações "coleta com destino/handoff definido", "distribuição com cliente de descarga" nos termos de origem/destino: o handoff da coleta é o próprio roteiro do manifesto (próxima etapa/fim) — validar apenas que existe etapa posterior (o `fim`) e, para distribuição, que o local tem cliente/ponto de entrega.
- Eventos/fila do conferente/portaria/recebimento: "origem/destino/ponto final" exibidos em Portaria/contexto são do **Manifesto** (ponto inicial / próximo / ponto final), nunca do Serviço.

## UI
Formulário de Serviço pede só: tipo + local (+ cliente, pallets previstos, janela, observações). Montagem do Manifesto: início, fim, veículo, motorista, lista ordenada de serviços empenhados (arrastar/setas reordena), mapa/rota resultante.
