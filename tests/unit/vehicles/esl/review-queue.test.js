import test from 'node:test';
import assert from 'node:assert/strict';
import { camposPendentes, precisaRevisao, montarFila, proximoIndice, melhorCandidatoPrestador, rotuloProgresso } from '../../../../src/domain/vehicles/esl/review-queue.js';

const amb = [{ id: 3, nome: 'A' }, { id: 5, nome: 'B' }];

test('detecta campos pendentes', () => {
  assert.deepEqual(camposPendentes({ acao: 'revisar', marca_id: 1 }, {}), { marca: false, modelo: true, prestador: false });
  assert.equal(camposPendentes({ acao: 'revisar' }, {}).marca, true);
  assert.equal(camposPendentes({ acao: 'criar', prestador_classe: 'possivel_duplicado', prestador_ambiguos: amb }, {}).prestador, true);
  assert.equal(camposPendentes({ acao: 'criar', prestador_classe: 'possivel_duplicado', prestador_ambiguos: amb }, { prestador_servico_id: null }).prestador, false);
  assert.equal(camposPendentes({ acao: 'criar', prestador_classe: 'novo_empresa' }, {}).prestador, false);
});

test('ignorada ou resolvida não é pendente', () => {
  assert.equal(precisaRevisao({ acao: 'revisar', marca_id: 1 }, {}, true), false);
  assert.equal(precisaRevisao({ acao: 'revisar', marca_id: 1 }, { modelo_id: 9 }), false);
});

test('monta fila na ordem da prévia', () => {
  const prev = [{ linha: 1, acao: 'criar' }, { linha: 2, acao: 'revisar', marca_id: 1 }, { linha: 3, acao: 'revisar', marca_id: 1 }];
  assert.deepEqual(montarFila(prev, () => ({}), r => r.linha === 3), [2]);
});

test('avança pulando resolvidas, volta ao início e termina em null', () => {
  const pend = new Set([1, 4]);
  assert.equal(proximoIndice([1, 2, 3, 4], 0, l => pend.has(l)), 3);
  assert.equal(proximoIndice([1, 2, 3, 4], 3, l => pend.has(l)), 0);
  assert.equal(proximoIndice([1, 2], 1, () => false), null);
  assert.equal(proximoIndice([], 0, () => true), null);
});

test('melhor candidato e progresso', () => {
  assert.equal(melhorCandidatoPrestador({ prestador_ambiguos: amb }).id, 3);
  assert.equal(melhorCandidatoPrestador({ prestador_ambiguos: amb, prestador_sugerido_id: 5 }).id, 5);
  assert.equal(melhorCandidatoPrestador({}), null);
  assert.equal(rotuloProgresso(2, 17), 'Placa 3 de 17');
});
