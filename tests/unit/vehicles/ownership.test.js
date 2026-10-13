import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizarVinculoVeiculo,validarPropriedadeVeiculo} from '../../../src/domain/vehicles/ownership.js';
const terceiros=[{id:12,nome:'Transporte A',tipo_prestador:'transporte',is_active:true},{id:13,tipo_prestador:'geral',is_active:true},{id:14,tipo_prestador:'transporte',is_active:false}];
const motoristas=[{id:8,nome:'João'}];
test('converte vínculos legados para dois tipos visuais',()=>{
  assert.equal(normalizarVinculoVeiculo('Próprio'),'proprio');
  assert.equal(normalizarVinculoVeiculo('agregado'),'terceiro');
  assert.equal(normalizarVinculoVeiculo('Terceiro'),'terceiro');
});
test('próprio sem terceiro e motorista é válido',()=>assert.equal(validarPropriedadeVeiculo({vinculo:'proprio'},terceiros,motoristas).ok,true));
test('terceiro precisa de prestadora de transporte ativa',()=>{
  assert.equal(validarPropriedadeVeiculo({vinculo:'terceiro'},terceiros,motoristas).ok,false);
  assert.equal(validarPropriedadeVeiculo({vinculo:'terceiro',prestador_servico_id:13},terceiros,motoristas).ok,false);
  assert.equal(validarPropriedadeVeiculo({vinculo:'terceiro',prestador_servico_id:14},terceiros,motoristas).ok,false);
  assert.equal(validarPropriedadeVeiculo({vinculo:'terceiro',prestador_servico_id:12},terceiros,motoristas).ok,true);
});
test('motorista é opcional mas ID informado deve ser válido',()=>{
  assert.equal(validarPropriedadeVeiculo({vinculo:'proprio',motorista_referencia_pessoa_id:8},terceiros,motoristas).ok,true);
  assert.equal(validarPropriedadeVeiculo({vinculo:'proprio',motorista_referencia_pessoa_id:99},terceiros,motoristas).ok,false);
});
test('sem vínculo não passa',()=>assert.equal(validarPropriedadeVeiculo({vinculo:''},terceiros,motoristas).ok,false));
