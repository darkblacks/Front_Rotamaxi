import test from 'node:test';
import assert from 'node:assert/strict';
import { apresentarVinculoMotorista, ehVinculoProprio } from '../../../src/domain/drivers/linking.js';

test('reconhece vínculo próprio com ou sem acento', () => {
  assert.equal(ehVinculoProprio('Próprio'), true);
  assert.equal(ehVinculoProprio('proprio'), true);
  assert.equal(ehVinculoProprio('Terceiro'), false);
});

test('motorista próprio usa identidade visual da empresa atual', () => {
  const v = apresentarVinculoMotorista({ vinculo:'Próprio' }, null, { nome:'Empresa Atual', logo:'logo.png' });
  assert.deepEqual(v, { tipo:'Próprio', nome:'Empresa Atual', logo:'logo.png', proprio:true });
});

test('motorista terceiro usa nome e logo da prestadora cadastrada', () => {
  const v = apresentarVinculoMotorista({ vinculo:'Terceiro', prestadorServicoId:9 }, { id:9, nome:'ALX', logo_url:'alx.png' }, { nome:'Empresa Atual', logo:'logo.png' });
  assert.equal(v.tipo,'Terceiro');
  assert.equal(v.nome,'ALX');
  assert.equal(v.logo,'alx.png');
  assert.equal(v.proprio,false);
});
