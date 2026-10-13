import test from 'node:test';
import assert from 'node:assert/strict';
import { formatarAtraso, atrasoEmMinutos, nivelDeAtraso, textoDeAtrasoPrevisto } from '../../../src/domain/map/delay.js';
import { mesclarPosicao, estadoDoSinal, formatarIdade, acrescentarAoTrajeto } from '../../../src/domain/map/positions.js';
import { nomeDaCor, corHexDaEtapa } from '../../../src/domain/map/stages.js';
import { aplicarDelta } from '../../../src/domain/map/merge.js';

test('formata atraso', () => {
    assert.equal(formatarAtraso(45), '45min');
    assert.equal(formatarAtraso(80), '1h 20min');
    assert.equal(formatarAtraso(120), '2h');
    assert.equal(textoDeAtrasoPrevisto(80), 'Atraso previsto: 1h 20min');
});

test('atraso = max(0, eta - janela_fim) e níveis', () => {
    assert.equal(atrasoEmMinutos('2026-01-01T12:30:00Z', '2026-01-01T12:00:00Z'), 30);
    assert.equal(atrasoEmMinutos('2026-01-01T11:00:00Z', '2026-01-01T12:00:00Z'), 0);
    assert.equal(nivelDeAtraso(10), null);
    assert.equal(nivelDeAtraso(15).nivel, 'atencao');
    assert.equal(nivelDeAtraso(30).nivel, 'risco');
    assert.equal(nivelDeAtraso(60).nivel, 'critico');
});

test('merge de posição mantém vehicle e phone independentes e ignora antigas', () => {
    const base = { vehicle: { object_type: 'vehicle', latitude: 1, longitude: 2, recorded_at: '2026-01-01T10:00:00Z' }, phone: null };
    const a = mesclarPosicao(base, { object_type: 'phone', latitude: 3, longitude: 4, recorded_at: '2026-01-01T10:00:05Z' });
    assert.equal(a.vehicle.latitude, 1);
    assert.equal(a.phone.latitude, 3);
    const b = mesclarPosicao(a, { object_type: 'vehicle', latitude: 9, longitude: 9, recorded_at: '2026-01-01T09:00:00Z' });
    assert.equal(b, a);
});

test('offline é diferente de parado', () => {
    const agora = Date.parse('2026-01-01T10:10:00Z');
    assert.equal(estadoDoSinal({ latitude: 1, longitude: 1, speed: 0, recorded_at: '2026-01-01T10:09:50Z' }, agora), 'parado');
    assert.equal(estadoDoSinal({ latitude: 1, longitude: 1, speed: 0, recorded_at: '2026-01-01T10:00:00Z' }, agora), 'offline');
    assert.equal(estadoDoSinal(null, agora), 'sem_sinal');
    assert.equal(formatarIdade(125), 'há 2min');
});

test('trajeto acrescenta ponto sem duplicar', () => {
    const l = acrescentarAoTrajeto(null, { latitude: 1, longitude: 2 });
    assert.deepEqual(l.coordinates, [[2, 1]]);
    assert.equal(acrescentarAoTrajeto(l, { latitude: 1, longitude: 2 }), l);
});

test('cor vem da etapa', () => {
    assert.equal(nomeDaCor({ cor: 'azul', papel: 'coleta' }), 'azul');
    assert.equal(nomeDaCor({ papel: 'distribuicao' }), 'verde');
    assert.equal(nomeDaCor({ papel: 'base' }), 'neutro');
    assert.ok(corHexDaEtapa({ cor: 'vermelho' }).startsWith('#'));
});

test('aplicarDelta de eta, status e ocorrência', () => {
    const d = { etapas: [{ id: 1, status: 'PENDENTE', eta: null }], ocorrencias: [] };
    const e = aplicarDelta(d, 'manifest.eta.updated', { etapa_id: 1, eta: 'x', janela_fim: 'y', atraso_minutos: 20 });
    assert.equal(e.etapas[0].atraso_minutos, 20);
    const s = aplicarDelta(e, 'manifest.stop.status_changed', { etapa_id: 1, status: 'CHEGOU' });
    assert.equal(s.etapas[0].status, 'CHEGOU');
    assert.equal(s.etapas[0].atraso_minutos, 20);
    const o = aplicarDelta(s, 'manifest.occurrence.created', { manifest_id: 1, ocorrencia: { id: 5, tipo: 'atraso' } });
    assert.equal(o.ocorrencias.length, 1);
});
