import test from 'node:test';
import assert from 'node:assert/strict';
import { anoValido, identificarMarca, sugerirModelos, sugerirFabricacao, versoesValidadas, tiposFipeDisponiveis } from '../../../../src/domain/vehicles/esl/year-suggestions.js';

test('anos absurdos do ESL são recusados e não viram anos FIPE',()=>{
  for(const ano of [4506,45062,1923,20066,20212]) assert.equal(anoValido(ano),false);
  assert.equal(anoValido(2012),true);
  assert.equal(anoValido(2006),true);
});
test('fabricação 20066 é sugerida como 2006 somente quando coerente',()=>{
  assert.equal(sugerirFabricacao(20066,2006),'2006');
  assert.equal(sugerirFabricacao(20066,2012),'2006');
  assert.equal(sugerirFabricacao(20212,2012),'');
  assert.equal(sugerirFabricacao(45062,2012),'');
  assert.equal(sugerirFabricacao(1923,2012),'');
});
test('versões da FIPE são filtradas sem transformar 0km/anos inválidos',()=>{
  assert.deepEqual(versoesValidadas([{codigo:'2012-3',nome:'2012 diesel'},{codigo:'32000-1'}, {codigo:'1923-1'}, {codigo:'2006-1'}]).map(x=>x.codigo),['2012-3','2006-1']);
});
test('marca exata e modelos com nomes semelhantes são sugeridos sem adivinhar',()=>{
  const marcas=[{id:1,nome:'Mercedes-Benz'},{id:2,nome:'FIAT'}];
  assert.equal(identificarMarca('MB',marcas)?.id,1);
  assert.equal(identificarMarca('FIAT',marcas)?.id,2);
  const modelos=[{id:1,nome:'FIORINO ENDURANCE'},{id:2,nome:'DOBLO'},{id:3,nome:'FIORINO 1.4 FLEX'}];
  assert.equal(sugerirModelos('FIORINO ENDURACE',modelos)[0]?.id,1);
  assert.equal(sugerirModelos('FIORINO ENDURANCE',modelos)[0]?.pontuacao,100);
});
test('categoria FIPE deve existir tanto na marca quanto no modelo',()=>{
  assert.deepEqual(tiposFipeDisponiveis({fipe_codigos:{trucks:2,cars:1}},{fipe_codigos:{trucks:77}},'Caminhão'),['trucks']);
  assert.deepEqual(tiposFipeDisponiveis({fipe_codigos:{cars:1}},{fipe_codigos:{cars:42}},'Fiorino'),['cars']);
});
