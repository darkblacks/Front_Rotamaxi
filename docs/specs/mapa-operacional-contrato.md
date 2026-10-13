# Mapa Operacional — contrato Web + Mobile (V1)

Fonte de verdade: backend Laravel (`/home/ubuntu/rotamax_ETAPA2_backend_AWS/app`). Web e Android consomem
os mesmos endpoints, eventos e payloads. Prefixo `/api/v1`, auth Sanctum (mesmo token do app/painel),
erros no envelope existente (`message` + `errors`). Datas ISO-8601 com offset. Coordenadas em graus decimais.

## Reuso (NÃO duplicar)
`manifestos`, `paradas` (ESL/sync, intocada), `unidades` (naturezas local_coleta/local_entrega/centro_distribuicao + lat/lng),
`filiais`, `veiculos`, `pessoas`/motoristas, `conferencias_portaria` (hodômetro/pallets da portaria), `movimentos_pallet`,
`anexos`/`canhotos`, `ocorrencias_nota`, `divergencias`, `posicoes_motorista` (GPS legado do app, continua valendo).
Realtime: Laravel Broadcasting driver `reverb` → Soketi (Pusher protocol). Front: `src/services/realtime/echo.js`.

## Tabelas novas (migrations aditivas)
- `manifesto_etapas`: id, manifesto_id, parada_id? (FK paradas, vínculo opcional), ordem, tipo_etapa (`inicio|parada|fim`),
  papel (`coleta|ct|distribuicao|base|estacionamento|outro`), servicos jsonb (ids/tipos), unidade_id?, filial_id?,
  snapshot_nome, snapshot_endereco, latitude, longitude, janela_inicio?, janela_fim?, tempo_servico_min?, geofence_raio_m,
  status (`PENDENTE|EM_ROTA|CHEGOU|EM_ATENDIMENTO|CONCLUIDA|PULADA|CANCELADA`), eta?, atraso_minutos?, chegada_real?, saida_real?,
  motivo?, timestamps. Snapshot nunca é reescrito quando a unidade muda.
- `manifesto_servicos` (DEMANDA→SERVIÇO→EMPENHO): id, manifesto_id, tipos jsonb (`coleta|transferencia|distribuicao`, pode ter >1),
  descricao, cliente_pessoa_id?, etapa_origem_id?, etapa_destino_id, status (`EMPENHADO|EM_EXECUCAO|CONCLUIDO|CANCELADO`),
  descarga_concluida_em?, canhoto_anexo_id?, concluido_em?.
- `manifesto_rotas`: id, manifesto_id, versao, ativa, geometria jsonb (GeoJSON LineString), distancia_m, duracao_s, motor, motivo, criado_por.
- `rastreio_posicoes` (append-only): id, manifesto_id, object_type (`vehicle|phone`), object_id, latitude, longitude, speed?, heading?, accuracy?,
  battery?, source?, provider?, driver_id?, vehicle_id?, idempotency_key? (unique), recorded_at, received_at.
- `manifesto_eventos` (auditoria): id, manifesto_id, tipo, payload jsonb, actor_id?, created_at.
- `ocorrencias_manifesto` (SAQ, por manifesto/etapa — `ocorrencias_nota` exige nota fiscal): id, manifesto_id, etapa_id?, tipo
  (`atraso|desvio_rota|avaria|pallet_divergente|recusa_cliente|problema_coleta|problema_ct|problema_gps|janela_perdida|canhoto|carga|veiculo|outro`),
  severidade (`atencao|risco|critico`), descricao, origem (`auto|manual`), eta?, janela_fim?, atraso_minutos?, status (`aberta|resolvida`), criado_por?, timestamps.
- `pallet_registros` (esperado/informado/aceito/recebido NUNCA sobrescritos; append-only): id, manifesto_id, etapa_id?, tipo
  (`esperado|informado|aceito|recebido`), ator (`roteirizador|porteiro|conferente|motorista|equipe_ct|motorista_transferencia|motorista_distribuicao`),
  quantidade, user_id, observacao?, registrado_em. Regra: `ator=porteiro` só pode `tipo=informado` (422 caso contrário).
  Divergência (aceito/recebido ≠ esperado) é calculada, aparece no resumo, gera `ocorrencias_manifesto(pallet_divergente)`, nunca bloqueia.
- `etapa_conferencias` (Conferente na Coleta): etapa_id, manifesto_id, equipe, pallets, conferencia_inicio/fim, carregamento_inicio/fim, aceite_em, aceite_por.
- Roles novas (spatie, guard sanctum): `conferente`, `equipe_ct`.

## Endpoints
Leitura (admin: tudo; porteiro: só filial dele; motorista: só os seus):
- `GET /mapa/manifestos?filial_id&status&motorista&placa&q&somente_ativos=1` → `{data:[Resumo]}`
  Resumo: `{id,numero,status,placa,motorista_nome,filial:{id,nome},ponto_inicial:{nome,lat,lng},ponto_final:{nome,lat,lng},
  etapas_total,etapas_concluidas,proxima_etapa:{id,ordem,nome,papel,eta,janela_fim,atraso_minutos},atraso_minutos,ocorrencias_abertas,
  ultima_posicao:{vehicle:Pos|null,phone:Pos|null}}`
- `GET /mapa/manifestos/{id}` → `{data:{manifesto:Resumo+, etapas:[Etapa], servicos:[Servico], rota:{versao,geometry,distancia_m,duracao_s}|null,
  trajeto:{vehicle:GeoJSON LineString|null, phone:GeoJSON LineString|null}, posicoes:{vehicle:Pos|null,phone:Pos|null},
  ocorrencias:[Ocorrencia], pallets:{esperado,informado,aceito,recebido,divergencia}, avisos:[string]}}`
- `Pos`: `{object_type,object_id,latitude,longitude,speed,heading,accuracy,battery,source,provider,recorded_at,received_at,idade_s}`
- `Etapa`: `{id,ordem,tipo_etapa,papel,cor:'vermelho|azul|verde|neutro',servicos:[..],nome,endereco,latitude,longitude,janela_inicio,janela_fim,
  status,eta,atraso_minutos,chegada_real,saida_real,motivo}`

Escrita:
- `PUT /mapa/manifestos/{id}/etapas` (admin) body `{etapas:[{tipo_etapa,papel,unidade_id?|filial_id?|latitude,longitude,nome,janela_inicio?,janela_fim?,servicos?:[]}], motivo}`
  → substitui sequência (snapshot a partir de Unidade/Filial), versiona rota (`manifesto_rotas`, motor OSRM configurável com fallback em linha reta), audita, emite `manifest.route.updated`. Responde com validação RN §20 em `avisos`.
- `POST /mapa/manifestos/{id}/servicos` (admin) `{tipos:[..],descricao,cliente_pessoa_id?,etapa_origem_id?,etapa_destino_id}`
- `POST /mapa/servicos/{id}/concluir` `{descarga_concluida:true, canhoto_anexo_id}` (distribuição exige ambos)
- `POST /mapa/etapas/{id}/status` `{status,motivo?}` → emite `manifest.stop.status_changed`; etapa final CONCLUIDA exige geofence ou `override` + `motivo`.
- `POST /rastreio/posicoes` (motorista/admin) e `POST /import/rastreio/posicoes` (token máquina/provedor GPS): corpo único ou `{posicoes:[...]}`.
  Mínimo `{manifest_id,object_type,object_id,latitude,longitude,recorded_at}`; opcionais `speed,heading,accuracy,source,provider,battery,driver_id,vehicle_id,idempotency_key`.
  Grava, aplica geofence (chegada), recalcula ETA/atraso (com throttle), emite eventos. Idempotente por `idempotency_key`.
- `POST /mapa/ocorrencias` `{manifesto_id,etapa_id?,tipo,severidade,descricao}`
- `POST /mapa/etapas/{id}/pallets` `{tipo,ator,quantidade,observacao?}`; `GET /mapa/manifestos/{id}/pallets` (resumo + divergência)
- `POST /mapa/etapas/{id}/conferencia` (conferente/admin) campos parciais da tabela `etapa_conferencias`
- `GET /portaria/contexto?placa=|manifesto_id=` → manifesto ativo, motorista, placa, origem, destino, ponto final, serviços, `perguntar_pallets` (derivado de pallets esperados/serviços — falso se vazio), `pallets_esperados`, `hodometro_ultimo`.
  O registro continua em `POST /manifestos/{m}/conferencias` (existente); o valor do porteiro vira `pallet_registros(informado)`.

## Realtime
Canal privado `private-manifesto.{id}` (rota em `routes/channels.php`, classe `CanalDoManifesto`: admin tudo; porteiro filial; motorista dono; conferente/equipe_ct da filial).
Auth: `/broadcasting/auth` (sanctum), igual ao `private-admin`/`private-filial.*`. Eventos (`broadcastAs`, usar o ponto no nome; no Echo: `.tracking.position.updated`):
`tracking.position.updated`, `manifest.route.updated`, `manifest.stop.status_changed`, `manifest.eta.updated`, `manifest.delay.detected`, `manifest.occurrence.created`.
Payload sempre `{manifest_id, ..., at}`; posição = `Pos` + `manifest_id`; eta = `{manifest_id,etapa_id,eta,janela_fim,atraso_minutos}`.
Cliente reconecta → refaz `GET /mapa/manifestos/{id}` (estado completo; evento é só delta).

## Regras
Atraso = max(0, ETA − janela_fim). ETA V1 = distância restante pela rota ÷ velocidade (observada, mín. 25 km/h, padrão 45) — sem trânsito, pronto para plugar provedor.
Ocorrência automática de atraso: atraso ≥ `config('mapa.atraso_minimo_ocorrencia_min')` (padrão 15) — 1 aberta por etapa, atualizada (não duplicada).
Níveis: ≥15 atenção, ≥30 risco, ≥60 crítico. Geofence padrão: base/CT 300 m, cliente 150 m. Porteiro nunca aceita pallets.

## Ajustes da implementação backend (V1, 2026-10-13)
Implementado em `rotamax_ETAPA2_backend_AWS/app` (migration `2026_10_14_090000_mapa_operacional`, serviços em `app/Services/Mapa`, config em `config/mapa.php`). O que a implementação fixou/acrescentou ao contrato acima:

- **Datas**: todas em UTC com offset (`+00:00`) na saída; entrada aceita qualquer offset (`-03:00`). `speed` em **km/h**. Colunas novas: `manifesto_rotas.meta` (jsonb com `trechos[{de_etapa_id,para_etapa_id,inicio_idx,fim_idx,distancia_m,duracao_s,motor}]`), usado para ETA pela rota.
- **Rota**: `rota` = `{versao,geometry,distancia_m,duracao_s,motor}` (`motor` = `osrm|linha_reta|misto`). Um trecho OSRM por par de etapas; falha do OSRM cai em linha reta só naquele trecho (e gera aviso "rota em linha reta").
- **`PUT /mapa/manifestos/{id}/etapas`** substitui a sequência inteira (janelas ausentes = nulas). Enviar `id` de etapa existente a **preserva** (status, carimbos, snapshot); reenviar a mesma `unidade_id` não reescreve o snapshot (só trocar o local gera snapshot novo). A sequência exige 1º = `inicio` e último = `fim` (422). Etapas retiradas: apagadas se sem história; `CANCELADA` (com `motivo`) se já executadas/vinculadas. Resposta: `{data:{etapas,rota,avisos}}`.
- **`POST /mapa/manifestos/{id}/servicos`** → 201 `{data:Servico, avisos}`; `etapa_origem_id`/`etapa_destino_id` precisam ser etapas do manifesto (422).
- **`POST /mapa/servicos/{id}/concluir`**: todo serviço exige `descarga_concluida=true`; `distribuicao` exige também `canhoto_anexo_id` (422). Quem: admin, motorista dono, conferente/equipe_ct da filial.
- **`POST /mapa/etapas/{id}/status`** `{status,motivo?,override?}`: quem: admin ou motorista dono. `PULADA`/`CANCELADA` exigem `motivo` (cancelar só admin). Etapa terminal não volta (422). Concluir etapa `fim` fora da geofence: 422, salvo `override=true` + `motivo` (auditado como origem `override`). Concluir/pular promove a próxima `PENDENTE` a `EM_ROTA` e força recálculo de ETA.
- **Geofence automático** (posição de referência = veículo se recente <5 min, senão celular): início dentro do raio → `CHEGOU`; saiu do raio → `CONCLUIDA` (+ próxima `EM_ROTA`); demais etapas: fora → `EM_ROTA`, dentro → `CHEGOU`. Concluir parada continua manual.
- **`POST /rastreio/posicoes` e `POST /import/rastreio/posicoes`**: resposta `{data:{recebidas,gravadas,duplicadas,rejeitadas:[{indice,motivo}]}}` (201 se gravou algo, senão 200). Idempotência por `idempotency_key`; **sem chave** deriva-se uma do conteúdo (manifesto, fonte, objeto, instante, coordenadas). Posição mais antiga que a última da mesma fonte é gravada (trajeto) mas não transmite nem dispara geofence/ETA. `recorded_at` > 5 min no futuro é rejeitado. Motorista só envia para o próprio manifesto (403); token de máquina não tem restrição de papel e não acessa rotas de usuário.
- **ETA/atraso**: `atraso_minutos` = minutos inteiros de `max(0, ETA − janela_fim)`; ETA acumula tempo de serviço e espera a abertura da janela. Throttle `mapa.eta.throttle_s` (10 s) por manifesto, ignorado quando uma etapa muda de status ou a rota é replanejada.
- **Ocorrências automáticas**: `atraso` (≥ `atraso_minimo_ocorrencia_min`), `pallet_divergente` e `desvio_rota` (só em trecho OSRM, tolerância 500 m). 1 aberta por etapa+tipo (índice único parcial), atualizada em vez de duplicada; **resolvida automaticamente** quando a condição some (novo atraso abre outra). A previsão da criação fica em `manifesto_eventos` (`ocorrencia.criada`).
- **Resumo**: `proxima_etapa` ignora a etapa `inicio`; `atraso_minutos` do manifesto = maior atraso entre as etapas abertas; lista aceita `com_etapas=1`; limite 200.
- **Pallets**: `divergencia` = (`recebido`, senão `aceito`) − `esperado`, `null` sem os dois lados; cada (etapa, ator, tipo) vale pelo último registro, nada é sobrescrito. Papel × ator: `porteiro`→porteiro, `conferente`→conferente, `equipe_ct`→equipe_ct, `motorista*`→motorista, `roteirizador`→admin (admin vale por qualquer ator; 403 fora disso). `ator=porteiro` com `tipo≠informado` → 422. `POST /manifestos/{m}/conferencias` grava `pallet_registros(informado, ator porteiro, etapa null)`; falha nesse espelho nunca derruba a conferência.
- **`GET /portaria/contexto`** → `{data:{manifesto,motorista,placa,origem,destino,ponto_final,servicos,perguntar_pallets,pallets_esperados,hodometro_ultimo:{km,conferido_em,manifesto_id}|null}}`; placa normalizada; sem manifesto ativo no escopo → 404.
- **Escopo**: admin tudo; `porteiro`/`conferente`/`equipe_ct` = manifestos da própria filial em **qualquer status** (não só os da fila da portaria); `motorista` = os seus. Fora do escopo ou inexistente → 403. Canal `private-manifesto.{id}` usa o mesmo escopo.
- **Auditoria** (`manifesto_eventos.tipo`): `roteiro.substituido`, `ponto_final.alterado`, `rota.versionada`, `servico.empenhado`, `servico.concluido`, `etapa.status`, `etapa.conferencia`, `pallets.registrado`, `ocorrencia.criada|atualizada|resolvida`.
- **QA**: `php artisan mapa:demo` cria o manifesto temporário `MAPA-DEMO-*` (unidades `[DEMO-MAPA] *`, veículo e motorista reais); `php artisan mapa:demo --limpar` remove só isso.
