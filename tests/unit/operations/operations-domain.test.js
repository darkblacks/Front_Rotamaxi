import test from 'node:test';
import assert from 'node:assert/strict';
import { lerQuantidade, montarCorpoDaChegada, montarCorpoDaSaida, validarChegada } from '../../../src/domain/gate/arrival.js';
import { corpoDaConferencia, errosDeHorario, normalizarItemDaFila, pendenciasDoAceite } from '../../../src/domain/operations/conference.js';
import { corpoDoRecebimento, normalizarRecebimento, validarRecebimento } from '../../../src/domain/operations/receiving.js';
import { aplicarEventoDeOcorrencia, corpoDaTratativa, rotuloDoTipo } from '../../../src/domain/operations/occurrences.js';
import { atorDoAceiteNaEtapa, lerPresign, pendenciasDaConclusao, proximaEtapa, validarArquivoDoCanhoto } from '../../../src/domain/operations/driver.js';
import { deInputLocal, idDe, mesclarPorId, paraInputLocal, rotulo } from '../../../src/domain/operations/text.js';
import { canaisDesejados, chaveDosCanais, EVENTOS_OPERACIONAIS, LIMITE_DE_MANIFESTOS, ouvintesParaTodos } from '../../../src/services/realtime/operational.js';
import { permissoesDeAcao } from '../../../src/domain/access/actions.js';

// ---------- portaria ----------

const base = { hodometro: '120500', perguntarPallets: false, palletsInformados: '', ajustarHorario: false, chegadaEm: null, justificativa: '' };

test('portaria: hodômetro é obrigatório na chegada', () => {
    assert.ok(validarChegada({ ...base, hodometro: '' }).erros.hodometro);
    assert.ok(validarChegada({ ...base, hodometro: '-3' }).erros.hodometro);
    assert.deepEqual(validarChegada(base).erros, {});
});

test('portaria: pallets só é exigido quando perguntar_pallets, e 0 vale', () => {
    assert.deepEqual(validarChegada({ ...base, perguntarPallets: false, palletsInformados: '' }).erros, {});
    assert.ok(validarChegada({ ...base, perguntarPallets: true, palletsInformados: '' }).erros.pallets);
    assert.deepEqual(validarChegada({ ...base, perguntarPallets: true, palletsInformados: '0' }).erros, {});
    assert.ok(validarChegada({ ...base, perguntarPallets: true, palletsInformados: '1.5' }).erros.pallets);
    assert.equal(lerQuantidade('0'), 0);
    assert.equal(lerQuantidade(''), null);
});

test('portaria: ajuste do horário exige justificativa', () => {
    const ajuste = { ...base, ajustarHorario: true, chegadaEm: '2026-10-13T10:00:00.000Z' };
    assert.ok(validarChegada({ ...ajuste, justificativa: '  ' }).erros.justificativa);
    assert.deepEqual(validarChegada({ ...ajuste, justificativa: 'Sistema fora do ar' }).erros, {});
});

test('portaria: hodômetro menor que o último é aviso, não erro', () => {
    const r = validarChegada({ ...base, hodometro: '100', ultimoHodometro: 200 });
    assert.deepEqual(r.erros, {});
    assert.equal(r.avisos.length, 1);
});

test('portaria: corpo da chegada nunca leva aceite e só leva o que se aplica', () => {
    const simples = montarCorpoDaChegada({ manifestoId: 7, hodometro: '120500', perguntarPallets: false, palletsInformados: '9', ajustarHorario: false, chegadaEm: 'x', justificativa: 'y' });
    assert.deepEqual(simples, { manifesto_id: 7, hodometro_km: 120500 });

    const completo = montarCorpoDaChegada({ manifestoId: 7, hodometro: '10', perguntarPallets: true, palletsInformados: '0', ajustarHorario: true, chegadaEm: '2026-10-13T10:00:00.000Z', justificativa: ' ajuste ', observacao: ' ok ' });
    assert.deepEqual(completo, { manifesto_id: 7, hodometro_km: 10, pallets_informados: 0, chegada_em: '2026-10-13T10:00:00.000Z', justificativa: 'ajuste', observacao: 'ok' });
    assert.equal(Object.keys(completo).some((k) => k.includes('aceit') || k.includes('recebido')), false);
});

test('portaria: saída com hodômetro opcional', () => {
    assert.deepEqual(montarCorpoDaSaida({ manifestoId: 3, hodometro: '' }), { manifesto_id: 3 });
    assert.deepEqual(montarCorpoDaSaida({ manifestoId: 3, hodometro: '500' }), { manifesto_id: 3, hodometro_km: 500 });
});

// ---------- conferente ----------

test('conferente: normaliza item da fila (etapa/manifesto como objeto ou id)', () => {
    const item = normalizarItemDaFila({
        etapa: { id: 11 }, manifesto: { id: 5, numero: 'RM-1' }, servico: { descricao: 'Coleta Catupiry' },
        cliente: 'Catupiry', veiculo: { placa: 'ABC1D23' }, motorista: { nome: 'Zé' }, chegada_real: '2026-10-13T10:00:00Z',
        conferencia: { equipe: 'A', pallets: 18 },
    });
    assert.equal(item.etapaId, 11);
    assert.equal(item.manifestoId, 5);
    assert.equal(item.manifesto, 'RM-1');
    assert.equal(item.placa, 'ABC1D23');
    assert.equal(item.motorista, 'Zé');
    assert.equal(item.conferencia.pallets, 18);
    assert.equal(normalizarItemDaFila({ etapa: 4, manifesto: 2 }).etapaId, 4);
});

test('conferente: aceite exige conferência, carregamento e pallets', () => {
    const completo = { pallets: 18, conferencia_inicio: 'a', conferencia_fim: 'b', carregamento_inicio: 'c', carregamento_fim: 'd' };
    assert.deepEqual(pendenciasDoAceite(completo), []);
    assert.equal(pendenciasDoAceite({ ...completo, pallets: '' }).length, 1);
    assert.deepEqual(pendenciasDoAceite({ ...completo, pallets: 0 }), []);
    assert.equal(pendenciasDoAceite({ ...completo, carregamento_fim: null }).length, 1);
    assert.equal(pendenciasDoAceite({}).length, 3);
    assert.deepEqual(pendenciasDoAceite({ ...completo, aceite_em: 'x' }), ['Carga já aceita.']);
});

test('conferente: fim antes do início é erro de horário', () => {
    assert.equal(errosDeHorario({ conferencia_inicio: '2026-10-13T10:00:00Z', conferencia_fim: '2026-10-13T09:00:00Z' }).length, 1);
    assert.equal(errosDeHorario({ conferencia_inicio: '2026-10-13T10:00:00Z', conferencia_fim: '2026-10-13T11:00:00Z' }).length, 0);
});

test('conferente: corpo parcial só leva campos preenchidos', () => {
    assert.deepEqual(corpoDaConferencia({ equipe: 'A', pallets: '12', observacoes: '', conferencia_inicio: null }), { equipe: 'A', pallets: 12 });
});

// ---------- recebimento CT ----------

test('CT: divergência exige motivo mas não bloqueia a quantidade', () => {
    const sem = validarRecebimento({ recebido: '17', esperado: 18, motivo: '' });
    assert.equal(sem.divergente, true);
    assert.equal(sem.diferenca, -1);
    assert.ok(sem.erros.motivo);
    assert.equal(sem.erros.recebido, undefined);

    const com = validarRecebimento({ recebido: '17', esperado: 18, motivo: 'Pallet quebrado' });
    assert.deepEqual(com.erros, {});

    const igual = validarRecebimento({ recebido: '18', esperado: 18, motivo: '' });
    assert.equal(igual.divergente, false);
    assert.deepEqual(igual.erros, {});
});

test('CT: recebido inválido ou vazio é erro; zero é válido', () => {
    assert.ok(validarRecebimento({ recebido: '', esperado: 1, motivo: 'x' }).erros.recebido);
    assert.ok(validarRecebimento({ recebido: '-1', esperado: 1, motivo: 'x' }).erros.recebido);
    assert.equal(validarRecebimento({ recebido: '0', esperado: 0, motivo: '' }).erros.recebido, undefined);
});

test('CT: normaliza recebimento e corpo', () => {
    const r = normalizarRecebimento({ manifesto: { id: 9, numero: 'RM-9' }, veiculo: { placa: 'XYZ' }, pallets: { esperado: 18, recebido_ct: 17 }, ocorrencias_abertas: 1 });
    assert.equal(r.manifestoId, 9);
    assert.equal(r.divergente, true);
    assert.equal(r.divergencia, -1);
    assert.equal(r.aceito, false);
    assert.equal(normalizarRecebimento({ manifesto: 1, pallets: { esperado: 1, aceito_ct: 1 } }).aceito, true);
    assert.deepEqual(corpoDoRecebimento({ recebido: '17', observacao: ' ', motivo: ' quebra ' }), { recebido: 17, motivo_divergencia: 'quebra' });
});

// ---------- ocorrências / SAC ----------

test('SAC: tratativa valida texto e destino por ação', () => {
    assert.deepEqual(corpoDaTratativa('assumir', '', '').corpo, { acao: 'assumir' });
    assert.ok(corpoDaTratativa('comentar', '', '').erro);
    assert.ok(corpoDaTratativa('encaminhar', 'ver', '').erro);
    assert.deepEqual(corpoDaTratativa('encaminhar', 'ver', 'CT SP').corpo, { acao: 'encaminhar', texto: 'ver', destino: 'CT SP' });
    assert.ok(corpoDaTratativa('resolver', '', '').erro);
    assert.ok(corpoDaTratativa('apagar', 'x', '').erro);
});

test('SAC: evento realtime atualiza a mesma ocorrência em vez de duplicar', () => {
    let lista = aplicarEventoDeOcorrencia([], { ocorrencia: { id: 1, tipo: 'atraso', severidade: 'atencao', status: 'aberta' } });
    assert.equal(lista.length, 1);
    lista = aplicarEventoDeOcorrencia(lista, { id: 2, tipo: 'avaria' });
    assert.equal(lista.length, 2);
    assert.equal(lista[0].id, 2);
    lista = aplicarEventoDeOcorrencia(lista, { id: 1, tipo: 'atraso', status: 'resolvida' });
    assert.equal(lista.length, 2);
    assert.equal(lista.find((o) => o.id === 1).status, 'resolvida');
    assert.equal(aplicarEventoDeOcorrencia(lista, { sem: 'id' }), lista);
});

test('SAC: rótulos dos tipos pedidos', () => {
    ['atraso', 'pallet_divergente', 'cliente_recusou', 'avaria', 'problema_coleta', 'problema_ct', 'problema_gps', 'desvio_rota', 'canhoto', 'janela_perdida']
        .forEach((t) => assert.notEqual(rotuloDoTipo(t), t));
    assert.equal(rotuloDoTipo('recusa_cliente'), 'Cliente recusou');
});

// ---------- motorista ----------

test('motorista: próxima etapa ignora início e etapas terminais', () => {
    const etapas = [
        { id: 1, ordem: 1, tipo_etapa: 'inicio', status: 'CONCLUIDA' },
        { id: 3, ordem: 3, tipo_etapa: 'parada', status: 'PENDENTE' },
        { id: 2, ordem: 2, tipo_etapa: 'parada', status: 'CONCLUIDA' },
        { id: 4, ordem: 4, tipo_etapa: 'fim', status: 'PENDENTE' },
    ];
    assert.equal(proximaEtapa(etapas).id, 3);
    assert.equal(proximaEtapa([]), null);
});

test('motorista: só distribuição exige descarga e canhoto; coleta e transferência não', () => {
    const dist = { tipos: ['distribuicao'] };
    assert.equal(pendenciasDaConclusao(dist, { descarga: false, canhotoAnexoId: null }).length, 2);
    assert.equal(pendenciasDaConclusao(dist, { descarga: true, canhotoAnexoId: null }).length, 1);
    assert.equal(pendenciasDaConclusao(dist, { descarga: true, canhotoAnexoId: 5 }).length, 0);
    assert.equal(pendenciasDaConclusao({ tipos: ['distribuicao'], canhoto_anexo_id: 9 }, { descarga: true, canhotoAnexoId: null }).length, 0);
    assert.equal(pendenciasDaConclusao({ tipos: ['coleta'] }, { descarga: true, canhotoAnexoId: null }).length, 0);
    assert.equal(pendenciasDaConclusao({ tipo: 'coleta' }, { descarga: false, canhotoAnexoId: null }).length, 0);
    assert.equal(pendenciasDaConclusao({ tipo: 'transferencia' }, { descarga: false, canhotoAnexoId: null }).length, 0);
});

test('motorista: valida arquivo do canhoto', () => {
    assert.ok(validarArquivoDoCanhoto(null));
    assert.ok(validarArquivoDoCanhoto({ type: 'text/plain', size: 10 }));
    assert.ok(validarArquivoDoCanhoto({ type: 'image/png', size: 20 * 1024 * 1024 }));
    assert.equal(validarArquivoDoCanhoto({ type: 'image/jpeg', size: 1024 }), null);
    assert.equal(validarArquivoDoCanhoto({ type: 'application/pdf', size: 1024 }), null);
});

test('motorista: ator do aceite por etapa e tipo de serviço', () => {
    assert.equal(atorDoAceiteNaEtapa({ id: 1, papel: 'coleta' }, [{ tipos: ['distribuicao'], status: 'EMPENHADO' }]), 'motorista');
    assert.equal(atorDoAceiteNaEtapa({ id: 2, papel: 'ct' }, [{ tipo: 'distribuicao', status: 'EMPENHADO' }]), 'motorista_distribuicao');
    assert.equal(atorDoAceiteNaEtapa({ id: 2, papel: 'ct' }, [{ tipos: ['transferencia'], status: 'EMPENHADO' }]), 'motorista_transferencia');
    assert.equal(atorDoAceiteNaEtapa({ id: 2, papel: 'ct' }, [{ tipos: ['distribuicao'], status: 'CONCLUIDO' }]), 'motorista');
});

test('motorista: lê o presign com ou sem envelope data', () => {
    assert.deepEqual(lerPresign({ data: { anexo_id: 4, url: 'https://s3/x', headers: { a: 'b' } } }), { anexoId: 4, url: 'https://s3/x', metodo: 'PUT', headers: { a: 'b' } });
    assert.equal(lerPresign({ id: 8, upload_url: 'u' }).anexoId, 8);
    assert.equal(lerPresign(null).url, null);
});

// ---------- texto / datas / listas ----------

test('texto: rotulo e idDe tolerantes ao formato', () => {
    assert.equal(rotulo(null), '—');
    assert.equal(rotulo({ nome: 'X' }), 'X');
    assert.equal(rotulo({ placa: 'ABC' }), 'ABC');
    assert.equal(rotulo(['a', { nome: 'b' }]), 'a, b');
    assert.equal(rotulo({ tipo: 'coleta' }), 'coleta');
    assert.equal(idDe({ id: 3 }), 3);
    assert.equal(idDe(4), 4);
    assert.equal(idDe(null), null);
});

test('texto: input local <-> ISO faz ida e volta no minuto', () => {
    const iso = '2026-10-13T13:45:00.000Z';
    assert.equal(deInputLocal(paraInputLocal(iso)), iso);
    assert.equal(deInputLocal(''), null);
    assert.equal(paraInputLocal('lixo'), '');
});

test('texto: mesclarPorId atualiza ou insere no topo', () => {
    assert.deepEqual(mesclarPorId([{ id: 1, a: 1 }], { id: 1, b: 2 }), [{ id: 1, a: 1, b: 2 }]);
    assert.equal(mesclarPorId([{ id: 1 }], { id: 2 })[0].id, 2);
});

// ---------- realtime operacional ----------

test('realtime: canais sem repetição, sem ids vazios, manifestos limitados', () => {
    const canais = canaisDesejados({ filialIds: [1, 1, null, 2], manifestoIds: Array.from({ length: 40 }, (_, i) => i + 1), ocorrencias: true });
    assert.equal(canais.filter((c) => c.tipo === 'filial').length, 2);
    assert.equal(canais.filter((c) => c.tipo === 'manifesto').length, LIMITE_DE_MANIFESTOS);
    assert.equal(canais.filter((c) => c.tipo === 'ocorrencias').length, 1);
    assert.deepEqual(canaisDesejados({}), []);
});

test('realtime: chave estável independe da ordem', () => {
    assert.equal(chaveDosCanais({ filialIds: [2, 1], manifestoIds: [5, 4] }), chaveDosCanais({ filialIds: [1, 2], manifestoIds: [4, 5] }));
    assert.notEqual(chaveDosCanais({ filialIds: [1] }), chaveDosCanais({ filialIds: [1], ocorrencias: true }));
});

test('realtime: contém todos os eventos do contrato V2', () => {
    ['manifest.custody.changed', 'manifest.conferencia.demanda', 'manifest.portaria.registered', 'manifest.reception.accepted',
        'manifest.occurrence.created', 'manifest.occurrence.updated', 'manifest.service.updated']
        .forEach((e) => assert.ok(EVENTOS_OPERACIONAIS.includes(e), e));
});

test('realtime: ouvintes repassam nome e payload (payload ausente vira objeto)', () => {
    const vistos = [];
    const ouvintes = ouvintesParaTodos(['a', 'b'], (nome, payload) => vistos.push([nome, payload]));
    ouvintes.a({ x: 1 });
    ouvintes.b();
    assert.deepEqual(vistos, [['a', { x: 1 }], ['b', {}]]);
});

// ---------- permissões de ação ----------

test('permissões: porteiro registra mas não opera conferência/recebimento/aceite', () => {
    const p = permissoesDeAcao(['porteiro']);
    assert.equal(p.registrarPortaria, true);
    assert.equal(p.operarConferencia, false);
    assert.equal(p.operarRecebimento, false);
    assert.equal(p.aceitarComoMotorista, false);
    assert.equal(p.tratarOcorrencia, false);
});

test('permissões: cada papel opera só a sua tela; admin opera tudo', () => {
    assert.equal(permissoesDeAcao(['conferente']).operarConferencia, true);
    assert.equal(permissoesDeAcao(['equipe_ct']).operarRecebimento, true);
    assert.equal(permissoesDeAcao(['motorista']).aceitarComoMotorista, true);
    assert.equal(permissoesDeAcao(['sac']).tratarOcorrencia, true);
    assert.equal(permissoesDeAcao(['conferente']).registrarPortaria, false);
    assert.equal(permissoesDeAcao([]).reportarOcorrencia, false);
    Object.values(permissoesDeAcao(['admin'])).forEach((v) => assert.equal(v, true));
});
