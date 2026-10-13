import test from 'node:test';
import assert from 'node:assert/strict';
import {
    validarServico, montarPayloadServico, formularioVazio, paraInputLocal, deInputLocal,
    rotuloDoTipo, tipoDoServico, localDoServico,
} from '../../../src/domain/planning/services.js';
import {
    etapaVazia, aplicarPonto, adicionarParada, moverParada, moverParaPosicao, removerParada,
    renumerar, validarSequencia, etapasParaPayload, mensagensDeValidacao, paradaManual,
} from '../../../src/domain/planning/sequence.js';
import { moverServico, moverServicoPara, ordemMudou, ordenarServicos, payloadDaOrdem } from '../../../src/domain/planning/order.js';

const ponto = (nome, extra = {}) => ({ kind: 'unidade', id: 1, nome, latitude: -1, longitude: -2, naturezas: ['coleta'], ...extra });

test('serviço = tipo + local: não exige nem aceita origem/destino', () => {
    const f = formularioVazio();
    assert.ok(validarServico(f).tipo);
    assert.ok(validarServico(f).local);
    f.tipo = 'coleta';
    f.cliente = { id: 1 };
    f.local = ponto('Cliente A');
    assert.deepEqual(validarServico(f), {});
    const p = montarPayloadServico(f);
    assert.deepEqual(p, { tipo: 'coleta', local: { kind: 'unidade', id: 1 }, cliente_pessoa_id: 1 });
    assert.equal('ponto_origem' in p || 'ponto_destino' in p || 'tipos' in p, false);
});

test('serviço: regras por tipo', () => {
    const f = { ...formularioVazio(), tipo: 'transferencia', local: ponto('Galpão') };
    assert.ok(validarServico(f).local); // unidade comum não é CT
    f.local = ponto('CT', { kind: 'filial', naturezas: ['ct'] });
    assert.deepEqual(validarServico(f), {});
    const d = { ...formularioVazio(), tipo: 'distribuicao', local: ponto('Loja') };
    assert.ok(validarServico(d).cliente);
    d.cliente = { id: 7 };
    assert.deepEqual(validarServico(d), {});
    assert.equal(montarPayloadServico(d).cliente_pessoa_id, 7);
    assert.ok(validarServico({ ...d, local: ponto('X', { latitude: null }) }).local); // sem coordenadas
});

test('serviço: local avulso por coordenada, pallets e janela', () => {
    const f = { ...formularioVazio(), tipo: 'coleta', cliente: { id: 1 }, pallets_previstos: '12', local: { latitude: '-23.5', longitude: '-46.6', nome: 'Galpão X' } };
    assert.deepEqual(validarServico(f), {});
    const p = montarPayloadServico(f);
    assert.deepEqual(p.local, { latitude: -23.5, longitude: -46.6, nome: 'Galpão X' });
    assert.equal(p.pallets_previstos, 12);
    assert.ok(validarServico({ ...f, pallets_previstos: '-1' }).pallets_previstos);
    assert.ok(validarServico({ ...f, janela_inicio: '2026-01-02T10:00', janela_fim: '2026-01-02T09:00' }).janela);
});

test('helpers de tipo e local (aceitam legado)', () => {
    assert.equal(tipoDoServico({ tipo: 'coleta' }), 'coleta');
    assert.equal(tipoDoServico({ tipos: ['distribuicao'] }), 'distribuicao');
    assert.equal(rotuloDoTipo('transferencia'), 'Transferência');
    assert.equal(localDoServico({ local_snapshot: { nome: 'X' } }).nome, 'X');
});

test('datetime-local ida e volta', () => {
    assert.equal(paraInputLocal(deInputLocal('2026-03-04T10:30')), '2026-03-04T10:30');
    assert.equal(deInputLocal(''), null);
});

test('ordem dos serviços: setas, arrastar e payload', () => {
    const servicos = [{ id: 3, ordem: 2 }, { id: 1, ordem: 1 }, { id: 9 }];
    const ids = ordenarServicos(servicos).map((s) => s.id);
    assert.deepEqual(ids, [1, 3, 9]);
    assert.deepEqual(moverServico(ids, 3, -1), [3, 1, 9]);
    assert.equal(moverServico(ids, 1, -1), ids);
    assert.deepEqual(moverServicoPara(ids, 9, 1), [9, 1, 3]);
    assert.equal(ordemMudou(ids, [1, 3, 9]), false);
    assert.equal(ordemMudou(ids, [3, 1, 9]), true);
    assert.deepEqual(payloadDaOrdem([3, 1]), { servico_ids: [3, 1] });
});

function base() {
    const ini = aplicarPonto(etapaVazia('inicio', 'base'), ponto('Base'));
    const fim = aplicarPonto(etapaVazia('fim', 'ct'), ponto('CT', { id: 2 }));
    return renumerar([ini, fim]);
}

test('paradas manuais: mover/remover; etapas de serviço ficam fixas', () => {
    let l = base();
    const a = aplicarPonto(etapaVazia('parada', 'estacionamento'), ponto('A', { id: 10 }));
    const b = aplicarPonto(etapaVazia('parada', 'outro'), ponto('B', { id: 11 }));
    const viaServico = { ...aplicarPonto(etapaVazia('parada', 'coleta'), ponto('S', { id: 12 })), servicos: [5] };
    l = adicionarParada(adicionarParada(adicionarParada(l, a), viaServico), b);
    assert.deepEqual(l.map((e) => e.ordem), [1, 2, 3, 4, 5]);
    assert.equal(paradaManual(viaServico), false);
    assert.equal(moverParada(l, viaServico.chave, -1), l);
    assert.equal(removerParada(l, viaServico.chave).length, l.length);
    l = moverParada(l, b.chave, -1); // passa por cima da etapa de serviço sem reordená-la
    assert.deepEqual(l.map((e) => e.nome), ['Base', 'A', 'B', 'S', 'CT']);
    l = moverParaPosicao(l, b.chave, a.chave);
    assert.equal(l[1].nome, 'B');
    assert.equal(removerParada(l, a.chave).length, 4);
    assert.equal(removerParada(l, l[0].chave).length, l.length); // início não remove
});

test('validação RN §20 v2.1', () => {
    const l = base();
    assert.equal(validarSequencia(l, { veiculo: { id: 1 }, motorista: { id: 1 } }).filter((m) => m.nivel === 'erro').length, 0);
    const semGeo = renumerar([{ ...l[0], latitude: null }, l[1]]);
    const m = validarSequencia(semGeo, { veiculo: null });
    assert.ok(m.some((x) => x.texto.includes('inicial sem coordenadas')));
    assert.ok(m.some((x) => x.texto.includes('Veículo')));
    const ok = { id: 1, tipo: 'coleta', cliente_pessoa_id: 1, local: { latitude: 1, longitude: 2 } };
    const erros = (servicos) => validarSequencia(l, { veiculo: {}, motorista: {}, servicos }).filter((x) => x.nivel === 'erro').map((x) => x.texto);
    assert.deepEqual(erros([ok]), []);
    assert.ok(erros([{ id: 2, tipo: 'coleta' }]).some((t) => t.includes('local sem coordenadas')));
    assert.ok(erros([{ id: 3, tipo: 'distribuicao', local: { latitude: 1, longitude: 2 } }]).some((t) => t.includes('cliente')));
    assert.ok(erros([{ ...ok, janela_inicio: '2026-01-02T10:00:00Z', janela_fim: '2026-01-02T09:00:00Z' }]).some((t) => t.includes('janela')));
    // coleta sem destino/handoff não é mais erro: o handoff é o roteiro do manifesto
    assert.equal(erros([ok]).some((t) => /destino|handoff/.test(t)), false);
});

test('payload do PUT etapas e mensagens 422', () => {
    const l = adicionarParada(base(), aplicarPonto(etapaVazia('parada', 'coleta'), ponto('A', { kind: 'filial', id: 5 })));
    const p = etapasParaPayload(l, '');
    assert.equal(p.etapas.length, 3);
    assert.equal(p.etapas[0].unidade_id, 1);
    assert.equal(p.etapas[1].filial_id, 5);
    assert.ok(p.motivo);
    assert.deepEqual(mensagensDeValidacao({ errors: { a: ['x', 'y'], b: 'z' } }), ['x', 'y', 'z']);
    assert.deepEqual(mensagensDeValidacao({ errors: {}, mensagem: 'falhou' }), ['falhou']);
});

import { exigeCliente } from '../../../src/domain/planning/services.js';
import { etapasParaPreview } from '../../../src/domain/planning/sequence.js';
import { badgeDoServico, cargaABordo, textoDaCarga, servicosDaEtapa } from '../../../src/domain/planning/status.js';

test('cliente: obrigatório em coleta e distribuição, opcional em transferência', () => {
    assert.equal(exigeCliente('coleta'), true);
    assert.equal(exigeCliente('distribuicao'), true);
    assert.equal(exigeCliente('transferencia'), false);
    const ct = { kind: 'filial', id: 3, nome: 'CT RJ', latitude: -22, longitude: -43, naturezas: ['ct'] };
    assert.ok(validarServico({ ...formularioVazio(), tipo: 'coleta', local: ponto('A') }).cliente);
    assert.deepEqual(validarServico({ ...formularioVazio(), tipo: 'transferencia', local: ct }), {});
});

test('preview: serviço no local do ponto final não duplica a parada', () => {
    const ini = aplicarPonto(etapaVazia('inicio', 'ct'), ponto('CT SP', { id: 1, kind: 'filial' }));
    const fim = aplicarPonto(etapaVazia('fim', 'ct'), ponto('CT RJ', { id: 2, kind: 'filial', latitude: -22, longitude: -43 }));
    const dup = { ...aplicarPonto(etapaVazia('parada', 'ct'), ponto('CT RJ', { id: 2, kind: 'filial', latitude: -22, longitude: -43 })), servicos: [9] };
    const outra = aplicarPonto(etapaVazia('parada', 'coleta'), ponto('Cliente', { id: 7 }));
    const l = renumerar([ini, outra, dup, fim]);
    assert.deepEqual(etapasParaPreview(l).map((e) => e.nome), ['CT SP', 'Cliente', 'CT RJ']);
});

test('status independentes: serviço, manifesto e carga a bordo', () => {
    assert.equal(badgeDoServico({ tipo: 'coleta', status: 'CONCLUIDO' }).rotulo, 'Concluído');
    assert.equal(badgeDoServico({ status: 'EM_EXECUCAO' }).rotulo, 'Em execução');
    assert.equal(cargaABordo({ carga: { a_bordo: 12 } }), 12);
    assert.equal(cargaABordo({ pallets_a_bordo: '4' }), 4);
    assert.equal(cargaABordo({ manifesto: { id: 1 } }), null);
    assert.equal(textoDaCarga({}), 'Carga a bordo: —');
    assert.equal(textoDaCarga({ carga: { a_bordo: 1 } }), 'Carga a bordo: 1 pallet');
    const servicos = [{ id: 1, etapa_id: 5, status: 'CONCLUIDO' }, { id: 2, etapa_id: 6 }];
    assert.deepEqual(servicosDaEtapa(servicos, 5).map((s) => s.id), [1]);
});
