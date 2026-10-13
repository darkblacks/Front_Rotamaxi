import test from 'node:test';
import assert from 'node:assert/strict';
import { classificacoesDoTipo, tipoDaClassificacao, TIPOS_FROTA } from '../../../src/domain/vehicles/fleet-model.js';

test('classificações dependem do tipo', () => {
  assert.deepEqual(classificacoesDoTipo('Utilitário/Van').includes('Fiorino'), true);
  assert.deepEqual(classificacoesDoTipo('Inexistente'), []);
  assert.equal(TIPOS_FROTA.length, 5);
});
test('tipo derivado da classificação, sem inventar para valor desconhecido', () => {
  assert.equal(tipoDaClassificacao('fiorino'), 'Utilitário/Van');
  assert.equal(tipoDaClassificacao('Toco'), 'Caminhão');
  assert.equal(tipoDaClassificacao('Accelo'), '');
  assert.equal(tipoDaClassificacao(null), '');
});
