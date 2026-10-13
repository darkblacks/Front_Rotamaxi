import test from 'node:test';
import assert from 'node:assert/strict';
import { anoDoCodigoFipe, versoesDoAno, resolverAnoDigitado } from '../../../../src/domain/vehicles/fipe/single-year.js';
const opcoes=[
  { codigo:'1999-1',nome:'1999 Gasolina' },
  { codigo:'1999-3',nome:'1999 Diesel' },
  { codigo:'2012-3',nome:'2012 Diesel' },
  { codigo:'32000-1',nome:'Zero KM' },
];
test('ano já conhecido com uma única versão é reaproveitado',()=>{
  assert.deepEqual(resolverAnoDigitado('2012',opcoes).codigo,'2012-3');
  assert.equal(resolverAnoDigitado('2012',opcoes).tipo,'existente');
});
test('ano existente com combustíveis distintos exige escolha explícita',()=>{
  const resposta=resolverAnoDigitado('1999',opcoes);
  assert.equal(resposta.tipo,'ambiguo');assert.equal(resposta.versoes.length,2);
});
test('ano fora da FIPE pode ser informado sem código ou preço FIPE',()=>{
  const resposta=resolverAnoDigitado('2001',opcoes);
  assert.equal(resposta.tipo,'personalizado');assert.equal(resposta.ano,2001);
  assert.ok(!('codigo' in resposta));
});
test('entrada inválida não pode criar ano',()=>{
  for(const ano of ['19xx','1899','2101','2012.5','','0000']) assert.equal(resolverAnoDigitado(ano,opcoes).tipo,'invalido');
});
test('zero km não vira ano 32000 e resultados mantêm código exato',()=>{
  assert.equal(anoDoCodigoFipe('32000-1'),null);
  assert.equal(anoDoCodigoFipe('1999-3'),1999);
  assert.equal(versoesDoAno(opcoes,1999).length,2);
});
