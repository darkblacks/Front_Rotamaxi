import test from 'node:test';
import assert from 'node:assert/strict';
import {pontuacaoModeloEsl,recomendarModelosEsl,atualizarPreviaEsl} from '../../../../src/domain/vehicles/esl/smart-models.js';
const fiat=[
 {id:1,nome:'PALIO 1.4 FIRE'}, {id:2,nome:'UNO 1.4 FLEX'},
 {id:3,nome:'FIORINO 1.4'}, {id:4,nome:'DOBLO CARGO 1.4'}, {id:5,nome:'STRADA 1.4'}
];
test('FIORINO 1.4 fica primeira, pré-selecionada, sem mostrar todos os Fiat antes',()=>{
 const r=recomendarModelosEsl('FIORINO 1.4',fiat);
 assert.equal(r.principais[0].id,3);
 assert.equal(r.preSelecionado.id,3);
 assert.ok(r.principais.length < fiat.length);
});
test('modelo com nome parecido e motor é priorizado sem associar PALIO de motor igual',()=>{
 const r=recomendarModelosEsl('FIORINO 1.4',[{id:6,nome:'FIORINO 1.4 EVO FLEX'},...fiat]);
 assert.equal(r.principais[0].id,3);
 assert.equal(r.preSelecionado.id,3);
 assert.equal(pontuacaoModeloEsl('FIORINO 1.4','PALIO 1.4 FIRE'),0);
});
test('FIORINO ENDURACE encontra ENDURANCE via tolerância a erro de digitação',()=>{
 const r=recomendarModelosEsl('FIORINO ENDURACE',[{id:8,nome:'FIORINO ENDURANCE'},{id:9,nome:'FIORINO 1.4'}]);
 assert.equal(r.principais[0].id,8);
});
test('modelos quase idênticos não são pré-selecionados quando ambíguos',()=>{
 const r=recomendarModelosEsl('FIORINO 1.4',[{id:10,nome:'FIORINO 1.4 FLEX'},{id:11,nome:'FIORINO 1.4 DIESEL'}]);
 assert.equal(r.preSelecionado,null);
});
test('prévia mescla apenas linhas revalidadas, preservando as outras',()=>{
 const orig=[{linha:1,placa:'AAA0001',acao:'revisar'},{linha:2,placa:'BBB0002',acao:'invalida'},{linha:3,placa:'CCC0003',acao:'criar'}];
 const novo=atualizarPreviaEsl(orig,[{linha:1,acao:'criar',modelo_id:8}]);
 assert.equal(novo.length,3);assert.equal(novo[0].acao,'criar');assert.equal(novo[1],orig[1]);assert.equal(novo[2],orig[2]);
});
