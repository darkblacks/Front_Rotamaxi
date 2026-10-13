import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lerExportacaoEsl } from '../../../../src/domain/vehicles/esl/vehicle-csv.js';
import { problemaLocalEsl, simularEslTolerante } from '../../../../src/domain/vehicles/esl/tolerant-simulation.js';
const erro422 = data => Object.assign(new Error('Rejeitado'), { response: { status: 422, data } });
const placa = (p, anoModelo=2020, anoFabricacao=2019) => ({ placa: p, ano_modelo: anoModelo, ano_fabricacao: anoFabricacao });
test('marca ano absurdo como inválido sem sanitizar ou inventar ano', () => {
 const v=problemaLocalEsl(placa('QCF4D92',4506,45062),10);
 assert.equal(v.acao,'invalida'); assert.equal(v.linha,11);
 assert.match(v.motivo,/45062/); assert.match(v.motivo,/4506/);
});
test('anos vazios seguem como ausentes, não são transformados em 0', () => {
 assert.equal(problemaLocalEsl({ placa:'ABC1D23', ano_fabricacao:null, ano_modelo:'' },0),null);
});
test('preserva índice original quando uma linha inválida é retirada do bloco', async () => {
 const linhas=[placa('AAA1111'),placa('BBB2222',1923,1923),placa('CCC3333')];
 let chamadas=0;
 const resultado=await simularEslTolerante(linhas,async batch=>{
  chamadas++;
  assert.deepEqual(batch.map(x=>x.placa),['AAA1111','CCC3333']);
  return batch.map(x=>({placa:x.placa,acao:'criar'}));
 });
 assert.equal(chamadas,1);assert.deepEqual(resultado.map(r=>r.linha),[1,2,3]);
 assert.deepEqual(resultado.map(r=>r.acao),['criar','invalida','criar']);
});
test('se backend antigo ainda responde 422, isola apenas a placa defeituosa', async () => {
 const linhas=[placa('AAA1111'),placa('BBB2222'),placa('CCC3333')];
 let consultas=0;
 const resultado=await simularEslTolerante(linhas,async itens=>{
  consultas++;
  if(itens.some(i=>i.placa==='BBB2222'))throw erro422({errors:{'itens.1.cor':['Cor inválida']}});
  return itens.map(i=>({placa:i.placa,acao:'criar'}));
 });
 assert.ok(consultas>1);
 assert.deepEqual(resultado.map(x=>x.acao),['criar','invalida','criar']);
 assert.match(resultado[1].motivo,/Cor inválida/);
});
test('erros 401, 403, 500 não são engolidos como placas inválidas', async () => {
 for(const status of [401,403,500]) {
  await assert.rejects(simularEslTolerante([placa('AAA1111')], async()=>{throw {response:{status}}}),e=>e.response.status===status);
 }
});
test('CSV real ESL: simula todas as linhas e mantém as quatro placas inválidas na revisão', async () => {
 const texto=readFileSync('/mnt/data/veiculos_11-10-2026_13-44.csv').toString('latin1');
 const linhas=lerExportacaoEsl(texto);
 assert.equal(linhas.length,687);
 let remotos=0;
 const resultado=await simularEslTolerante(linhas,async batch=>{
  remotos+=batch.length;
  assert.ok(batch.length<=100);
  return batch.map(x=>({placa:x.placa,acao:'revisar'}));
 });
 assert.equal(resultado.length,687);
 assert.equal(remotos,683);
 const invalidos=resultado.filter(x=>x.acao==='invalida');
 assert.deepEqual(new Set(invalidos.map(x=>x.placa)),new Set(['QCF4D92','EKR4D19','CPI5236','HLD7I46']));
});
