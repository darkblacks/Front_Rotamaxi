# CONTRATO V2 — telas operacionais (rodada 2)
Complementa `mapa-operacional-contrato.md` (V1 + "Ajustes da implementação"). Cada ator opera pelo sistema; mesmo contrato servirá ao Android.
Roles (spatie/sanctum): `admin`, `roteirizador`(NOVA), `conferente`, `porteiro`, `equipe_ct`, `motorista`, `sac`(NOVA).
Escopo: filial do usuário (admin/roteirizador/sac = todas). NUNCA depender de usuário com vários papéis: cada endpoint checa o papel exigido. Admin pode tudo.

## Lookups (roteirizador/admin) — reuso de cadastros, sem duplicar
- `GET /mapa/lookups/veiculos?q=` → `[{id,placa,descricao,tipo,capacidade_kg,filial_id}]` (somente `is_active`, motorizados)
- `GET /mapa/lookups/motoristas?q=` → `[{id,nome,documento,user_id?}]` (motoristas reais; reuso de `/admin/motoristas`)
- `GET /mapa/lookups/pontos?q=&natureza=` → unidades + filiais/CT: `[{kind:'unidade|filial',id,nome,endereco,latitude,longitude,naturezas:['coleta','distribuicao','ct'],geocodificado:bool}]`. Pontos sem lat/lng vêm com `geocodificado=false`; `PATCH /mapa/lookups/pontos/{kind}/{id}/coordenadas` {latitude,longitude} grava no cadastro mestre (auditado).
- `GET /mapa/lookups/clientes?q=` → pessoas clientes (reuso `pessoas`).

## Serviços (DEMANDA → SERVIÇO → EMPENHO)
`manifesto_servicos` passa a aceitar `manifesto_id` NULL = não empenhado (status `DEMANDA`). Campos novos: `numero`, `solicitante_pessoa_id`, `ponto_origem` (snapshot jsonb), `ponto_destino` (snapshot jsonb), `pallets_previstos`, `janela_inicio/fim`, `observacoes`, `criado_por`.
- `GET /mapa/servicos?status=&tipo=&q=&manifesto_id=`
- `POST /mapa/servicos` {tipos[], cliente_pessoa_id?, ponto_origem{kind,id}|{latitude,longitude,nome}, ponto_destino{…}, pallets_previstos?, janela_*, observacoes} → `DEMANDA`. Coleta exige origem+destino; distribuição exige destino cliente; transferência exige destino CT/filial (422).
- `POST /mapa/servicos/{id}/empenhar` {manifesto_id} → vincula, cria/associa etapas faltantes no roteiro (origem/destino como etapas `parada`, papel pelo tipo; não duplica ponto já presente), registra `pallet_registros(esperado, roteirizador)` se `pallets_previstos`, status `EMPENHADO`. `POST /mapa/servicos/{id}/desempenhar`.

## Manifesto nativo RotaMaxi (montagem pela UI)
- `POST /mapa/manifestos` {veiculo_id, motorista_id, filial_id, ponto_inicial{kind,id|latitude,longitude}, ponto_final{…}, previsao_saida?, observacao?} → manifesto nativo (id_esl gerado em faixa reservada ≥ 900_000_000; `numero` `RM-AAAAMM-####`; snapshot de placa/motorista; status `disponivel`), cria etapas inicio+fim, devolve Resumo. Veículo/motorista com outro manifesto ativo → 422.
- `PUT /mapa/manifestos/{id}/etapas` (V1) edita a sequência. `POST /mapa/manifestos/{id}/rota/recalcular`.
- `POST /mapa/manifestos/{id}/liberar`: validação RN §20 (422 com lista) e `disponivel → aguardando_saida` pela `MaquinaDeEstadosDoManifesto` (respeitar transições existentes; sem atalho).
- `PATCH /mapa/manifestos/{id}`: troca veículo/motorista/pontos (auditado).
- Concluir etapa `fim` (V1) emite também `manifest.closed`.

## Conferente (Coleta)
- `GET /mapa/conferencia/fila?status=aguardando|em_andamento|concluida` → etapas de coleta do escopo com chegada: `[{etapa,manifesto:{id,numero},servico,cliente,veiculo:{placa},motorista,chegada_real,conferencia:{equipe,pallets,conferencia_inicio,conferencia_fim,carregamento_inicio,carregamento_fim,observacoes,aceite_em,aceite_por}}]`
- `POST /mapa/etapas/{id}/conferencia` (V1) ganha `observacoes`; `POST /mapa/etapas/{id}/conferencia/aceitar` {pallets} → `pallet_registros(aceito, conferente)`, carimba aceite, exige conferência+carregamento finalizados; emite `manifest.custody.changed`.
- Coleta que vira `CHEGOU` emite `manifest.conferencia.demanda` em `private-filial.{id}`.

## Motorista (aceite)
- `GET /mapa/motorista/meu-manifesto` → manifesto ativo do motorista autenticado (formato do detalhe V1) + `a_aceitar:[{etapa_id,tipo:'pallets',quantidade_esperada,quantidade_conferida}]`.
- `POST /mapa/etapas/{id}/pallets` {tipo:'aceito',ator:'motorista|motorista_transferencia|motorista_distribuicao',quantidade}. Na coleta só após `aceito` do conferente; transferência/distribuição após `aceito` do CT de origem ou esperado. Divergência nunca bloqueia (gera ocorrência).

## Portaria (completar)
- `POST /mapa/portaria/chegada` {manifesto_id, hodometro_km, chegada_em? (default now; se enviada exige `justificativa`), pallets_informados? (só se `perguntar_pallets`), observacao?} → grava na estrutura existente (`conferencias_portaria` entrada + `km_conferido`), `pallet_registros(informado, porteiro)`, `entrada_autorizada_em`, usuário responsável. `POST /mapa/portaria/saida` {manifesto_id, hodometro_km?}.
- `GET /portaria/contexto` ganha `horario_previsto`, `motivo_viagem`, `entrada_registrada`, `chegada_automatica`. Porteiro enviando aceito/recebido → 422.

## Recebimento CT (Equipe CT)
- `GET /mapa/recebimentos?status=aguardando|aceito|divergente` → `{manifesto, veiculo, motorista, servicos, pallets:{esperado,conferido,aceito_motorista,informado_portaria,recebido_ct,aceito_ct,divergencia}, ocorrencias_abertas}`
- `POST /mapa/manifestos/{id}/recebimento` {recebido, observacao?, motivo_divergencia?} → `pallet_registros(recebido, equipe_ct)`; `POST /mapa/manifestos/{id}/recebimento/aceitar` {quantidade} → `pallet_registros(aceito, equipe_ct)`; fecha custódia, emite `manifest.custody.changed` + `manifest.reception.accepted`; divergência gera `ocorrencias_manifesto(pallet_divergente)` sem bloquear. Saldo para próximo manifesto = só `aceito_ct`.
- `GET /mapa/manifestos/{id}/pallets` devolve a **cadeia**: esperado → conferido → aceito_motorista → informado_portaria → recebido_ct → aceito_ct, cada item `{quantidade,user,ator,registrado_em}` + `divergencia`. Nada sobrescrito.

## SAC / Ocorrências (reuso da página Ocorrências do front)
- `GET /mapa/ocorrencias?status=&tipo=&severidade=&manifesto_id=&filial_id=&de=&ate=` → com vínculos `{manifesto,servico,etapa,veiculo,motorista,criada_em,eta,janela_fim,atraso_minutos}`; `GET /mapa/ocorrencias/{id}`; `POST /mapa/ocorrencias/{id}/tratar` {acao:'assumir|encaminhar|resolver|comentar',texto,destino?} (tabela `ocorrencia_tratativas`); `POST /mapa/ocorrencias` (V1; tipos incluem `cliente_recusou`).
- Eventos `manifest.occurrence.created|updated` também em `private-ocorrencias` (sac/admin/roteirizador) e `private-filial.{id}`.

## Distribuição + canhoto
- `POST /mapa/servicos/{id}/canhoto/presign` {content_type,tamanho} (reuso do fluxo de anexos) → `POST /mapa/servicos/{id}/canhoto/confirmar` {anexo_id} → vincula `canhoto_anexo_id`; depois `POST /mapa/servicos/{id}/concluir` (V1). Se S3 não estiver configurado em produção, fallback documentado (upload multipart ao storage do container) — reporte.

## Realtime adicional
Canais: `private-manifesto.{id}` (V1), `private-filial.{id}` (estender `CanalDaFilial`: admin, roteirizador, sac, porteiro/conferente/equipe_ct da filial), `private-ocorrencias`. Eventos novos: `manifest.custody.changed`, `manifest.conferencia.demanda`, `manifest.service.updated`, `manifest.portaria.registered`, `manifest.reception.accepted`, `manifest.closed`.

## Papéis × telas
roteirizador: planejamento/serviços/manifestos; conferente: fila de conferência; porteiro: fila da portaria; equipe_ct: recebimentos; motorista: meu manifesto/aceite/canhoto; sac: ocorrências; admin: tudo.

## Ajustes V2 (implementação backend, 2026-10-13)
Migrations aditivas `2026_10_14_150000_mapa_operacional_v2` e `2026_10_14_160000_pallet_registros_servico_id`; serviços em `app/Services/Mapa`. Tudo abaixo foi exercitado por curl com **um usuário por papel** (`mapa:qa-usuarios`) e por PHPUnit.

**Papéis e escopo** — `roteirizador` e `sac` criadas (guard sanctum). `admin`, `roteirizador` e `sac` veem todas as filiais; `porteiro`/`conferente`/`equipe_ct` só a própria filial (a `equipe_ct` também alcança manifestos cujo ponto final é um CT da sua filial); `motorista` só os seus. Cada endpoint checa o papel exigido (403 fora dele); admin passa em tudo. Fora do escopo ou inexistente = 403.

**Lookups** (`roteirizador|admin`) — `GET /mapa/lookups/{veiculos,motoristas,pontos,clientes}?q=`; veículos = `categoria=motorizado` e `is_active` (+ `em_manifesto_ativo`); motoristas = usuários ativos com papel `motorista` (+ `em_manifesto_ativo`); pontos = unidades + filiais (`geocodificado`, `naturezas`, `cliente_pessoa_id`); clientes = pessoas que não são usuários nem motoristas. `PATCH /mapa/lookups/pontos/{kind}/{id}/coordenadas` grava no cadastro mestre e audita em `ponto_coordenadas_auditoria`.

**Serviços** — `manifesto_servicos.manifesto_id` agora é nulo (status `DEMANDA`); `numero` `SV-AAAAMM-####`. `GET/POST /mapa/servicos`, `POST /mapa/servicos/{id}/empenhar {manifesto_id}` e `/desempenhar`. Regras 422: coleta exige origem+destino; distribuição exige cliente (do corpo ou da unidade de destino); transferência exige destino CT/filial; ponto sem lat/lng é recusado (geocodifique antes). Empenhar insere as paradas que faltam antes do ponto final (o destino reaproveita o ponto final quando é o mesmo local; ponto já presente não duplica; papel pelo tipo/natureza), replaneja a rota e registra `pallet_registros(esperado, roteirizador)` na etapa de origem (ou no início, quando o serviço não tem origem), identificado por `servico_id` — vários serviços na mesma etapa somam. Desempenhar só vale em `EMPENHADO` e remove a parada criada se ninguém mais a usa.

**Manifesto nativo** — `POST /mapa/manifestos` (`id_esl` ≥ 900.000.000, `numero` `RM-AAAAMM-####`, status `disponivel`, etapas início+fim, rota). 422 se veículo ou motorista estão em outro manifesto ativo. `PATCH /mapa/manifestos/{id}`, `POST …/liberar` (422 com `errors.avisos` = lista RN §20; só "rota em linha reta" não bloqueia; depois `disponivel → aguardando_saida` pela `MaquinaDeEstadosDoManifesto`), `POST …/rota/recalcular`. Colunas novas em `manifestos`: `qa_temp` e `observacao`; manifestos criados por usuário `qa-mapa-*` nascem com `qa_temp=true`.

**Conferente** — `GET /mapa/conferencia/fila?status=aguardando|em_andamento|concluida` (coletas com chegada); `POST /mapa/etapas/{id}/conferencia` ganha `observacoes`; `POST /mapa/etapas/{id}/conferencia/aceitar {pallets}` exige conferência e carregamento finalizados, grava `aceito/conferente` e emite `manifest.custody.changed`. Coleta que vira `CHEGOU` emite `manifest.conferencia.demanda` em `private-filial.{id}` (e só nele).

**Motorista** — `GET /mapa/motorista/meu-manifesto` (`data` nulo sem manifesto ativo; detalhe + `a_aceitar`). `POST /mapa/etapas/{id}/pallets {tipo:aceito, ator:motorista*}`: na coleta só depois do aceite do conferente; nos demais trechos só se houver esperado/aceite na etapa (422 caso contrário). Divergência nunca bloqueia.

**Portaria** — `POST /mapa/portaria/chegada` (hodômetro obrigatório; `chegada_em` automático — ajustar exige `justificativa`; `pallets_informados` só se `perguntar_pallets`) grava a conferência de **entrada** existente com `km_conferido`, `chegada_em`, `entrada_autorizada_em`, `justificativa` e o responsável; se o manifesto ainda está `em_viagem` ele passa a `aguardando_entrada` pela máquina e a entrada o **fecha** (fluxo que já existia). `POST /mapa/portaria/saida` exige `aguardando_saida` e passa a `em_viagem`. Porteiro nunca aceita (422 se `aceito/recebido`; 403 se tenta agir por outro ator). `GET /portaria/contexto` ganhou `horario_previsto`, `motivo_viagem`, `entrada_registrada`, `chegada_automatica` e `cadeia_pallets`. Emite `manifest.portaria.registered`.

**Recebimento CT** — `GET /mapa/recebimentos?status=aguardando|aceito|divergente` (manifestos que já passaram pela portaria); `POST /mapa/manifestos/{id}/recebimento {recebido,observacao?,motivo_divergencia?}` e `…/recebimento/aceitar {quantidade}` (exige recebido antes). Emite `manifest.custody.changed` e `manifest.reception.accepted`.

**Cadeia de pallets** — `GET /mapa/manifestos/{id}/pallets` e o detalhe trazem `cadeia`: `esperado → conferido → aceito_motorista → informado_portaria → recebido_ct → aceito_ct`, cada elo `{quantidade,user,ator,registrado_em}`; `divergencia` = (`aceito_ct` ou `recebido_ct`) − `esperado`; `diverge` = dois elos preenchidos discordam. A ocorrência `pallet_divergente` é por manifesto (etapa nula), atualizada e resolvida sozinha. Saldo para o próximo manifesto = só `aceito_ct`.

**SAC** — `GET /mapa/ocorrencias` (filtros do contrato) com `manifesto, servico, etapa, veiculo, motorista, criada_em, eta, janela_fim, atraso_minutos`; `GET /mapa/ocorrencias/{id}` (+`tratativas`); `POST …/tratar {acao:assumir|encaminhar|resolver|comentar,texto?,destino?}` (só `sac|roteirizador|admin`; `encaminhar` exige destino; `resolver`/`comentar` exigem texto; resolvida só aceita comentário). Status `aberta|assumida|resolvida`; "em aberto" = aberta+assumida (o índice único de ocorrência automática cobre as duas). Tipo `cliente_recusou` incluído.

**Canhoto** — `POST /mapa/servicos/{id}/canhoto/presign {content_type,tamanho}` → `{anexo_id, upload:{url,headers,expira_em}}` (R2/S3 já configurado em produção: disco `r2`, bucket `rotamaxtms`; sem fallback multipart); upload direto com PUT; `POST …/canhoto/confirmar {anexo_id}` (o objeto precisa existir no bucket) vincula `canhoto_anexo_id`; `GET …/canhoto/url` devolve leitura assinada. `POST …/concluir` da distribuição passa a aceitar o canhoto já vinculado. Quem: motorista dono, roteirizador ou admin.

**Realtime** — `private-filial.{id}` (admin, roteirizador, sac e porteiro/conferente/equipe_ct da filial), `private-ocorrencias` (admin, roteirizador, sac), `private-manifesto.{id}` (escopo de leitura). Novos eventos: `manifest.custody.changed`, `manifest.conferencia.demanda`, `manifest.service.updated`, `manifest.portaria.registered`, `manifest.reception.accepted`, `manifest.closed`, `manifest.occurrence.updated`; `manifest.occurrence.created|updated` também vão a `private-filial.{id}` e `private-ocorrencias`. Evento de serviço sem manifesto (demanda) vai só à filial do criador (`manifest_id: 0`).

**Geofence** — ao sair do ponto inicial a mesma posição já é avaliada contra a etapa seguinte (pontos colados).

**QA** — `php artisan mapa:qa-usuarios criar|tokens|limpar` (usuários `qa-mapa-<papel>`, um papel cada; tokens de 3 h; `limpar` remove dados de QA, tokens, papéis e usuários); `php artisan mapa:demo --cenario=catupiry` cria só os pontos/clientes `[QA]` (CT SP, Catupiry, CT RJ, 4 clientes RJ); `php artisan mapa:demo --limpar` remove tudo que o QA criou (manifestos `qa_temp`/`RM-QA-*`/`MAPA-DEMO-*`, serviços, etapas, rotas, posições, pallets, ocorrências, conferências, anexos e objetos no bucket, unidades e pessoas `[DEMO-MAPA]`/`[QA]`).
