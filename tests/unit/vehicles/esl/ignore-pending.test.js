import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  placasPendentesParaIgnorar,
  adicionarPlacasIgnoradas,
  desfazerIgnoradasEmLote,
} from '../../../../src/domain/vehicles/esl/ignore-pending.js';

const previsualizacao = [
  { linha: 1, placa: 'AAA0001', acao: 'criar' },
  { linha: 2, placa: 'BBB0002', acao: 'revisar' },
  { linha: 3, placa: 'CCC0003', acao: 'invalida' },
  { linha: 4, placa: 'DDD0004', acao: 'criar', fipe_tipo: 'cars', ano_modelo: 2018 },
  { linha: 5, placa: 'EEE0005', acao: 'criar', fipe_tipo: 'cars', ano_modelo: 2015 },
  { linha: 6, placa: 'FFF0006', acao: 'completar' },
  { linha: 7, placa: 'GGG0007', acao: 'conflito' },
  { linha: 8, placa: 'HHH0008', acao: 'duplicada' },
  { linha: 9, placa: 'III0009', acao: 'sem_cadastro' },
];
const linhas = previsualizacao.map((r) => ({
  placa: r.placa,
  fipe_ano_codigo: r.linha === 5 ? '2015-1' : null,
}));

test('inclui todas as pendências, até fora da primeira página, e não afeta aptos', () => {
  const placas = placasPendentesParaIgnorar(previsualizacao, linhas, [], true);
  assert.deepEqual(placas, ['BBB0002', 'CCC0003', 'DDD0004', 'GGG0007', 'HHH0008', 'III0009']);
  assert.ok(!placas.includes('AAA0001'));
  assert.ok(!placas.includes('EEE0005'));
  assert.ok(!placas.includes('FFF0006'));
});

test('ignora só as pendências FIPE quando exigidas', () => {
  const placas = placasPendentesParaIgnorar(previsualizacao, linhas, [], false);
  assert.ok(!placas.includes('DDD0004'));
  assert.ok(placas.includes('BBB0002'));
});

test('não inclui novamente placas já ignoradas', () => {
  const placas = placasPendentesParaIgnorar(previsualizacao, linhas, ['BBB0002', 'CCC0003'], true);
  assert.ok(!placas.includes('BBB0002'));
  assert.ok(!placas.includes('CCC0003'));
});

test('não duplica nomes/placas na aplicação em lote', () => {
  const r = adicionarPlacasIgnoradas(['BBB0002'], ['BBB0002', 'CCC0003', 'CCC0003']);
  assert.deepEqual(r, ['BBB0002', 'CCC0003']);
});

test('desfazer devolve só placas ignoradas pelo lote e mantém ignoradas antes', () => {
  const atual = adicionarPlacasIgnoradas(['BBB0002'], ['CCC0003', 'DDD0004']);
  assert.deepEqual(desfazerIgnoradasEmLote(atual, ['CCC0003', 'DDD0004']), ['BBB0002']);
});

test('a tela contém confirmação e faz importação somente do conjunto exportável', () => {
  const fonte = readFileSync(new URL('../../../../src/pages/registrations/vehicles/VehicleImportPage.vue', import.meta.url), 'utf8');
  assert.match(fonte, /if\(!confirm\(`Ignorar \$\{placas\.length\} placa/);
  assert.match(fonte, /const aptos=exportaveis\.value\.map\(itemLinha\)/);
  assert.match(fonte, /const exportaveis=computed\(\(\)=>preview\.value\.filter\(r=>!ignorada\(r\)/);
  assert.match(fonte, /Ignorar todas as placas pendentes/);
  assert.match(fonte, /Desfazer ignorar em lote/);
});
