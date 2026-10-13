import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG_CADASTRO, corpoCadastro, formularioVazio, valorDaColuna } from '../../../src/domain/registrations/fields.js';

test('cada recurso possui campos reais mapeados', () => {
  for (const recurso of ['filiais','marcas','modelos','tipos-veiculo','veiculos','clientes','unidades','prestadores-servico']) {
    assert.ok(CONFIG_CADASTRO[recurso]);
    assert.ok(CONFIG_CADASTRO[recurso].fields.length);
  }
});
test('veículo envia placa normalizada e referências numéricas', () => {
  const corpo = corpoCadastro('veiculos',{...formularioVazio('veiculos','reboque'),
    placa:' abc1d23 ',marca_id:'32',modelo_id:'52',tipo_id:'',is_active:false,capacidade_kg:'1234.5'});
  assert.equal(corpo.placa,'ABC1D23');
  assert.equal(corpo.categoria,'reboque');
  assert.equal(corpo.marca_id,32);
  assert.equal(corpo.modelo_id,52);
  assert.equal(corpo.tipo_id,null);
  assert.equal(corpo.capacidade_kg,1234.5);
  assert.equal(corpo.is_active,false);
});
test('cliente salva papel de coleta e entrega com pessoa local',()=>{
  const dto=corpoCadastro('clientes',{...formularioVazio('clientes'),pessoa_id:'99',permite_coleta:true,permite_entrega:false});
  assert.equal(dto.pessoa_id,99);
  assert.equal(dto.permite_coleta,true);
  assert.equal(dto.permite_entrega,false);
});
test('unidade distingue coleta, entrega e CD independentes',()=>{
  const dto=corpoCadastro('unidades',{...formularioVazio('unidades'),nome:' CD Interior ',local_coleta:true,local_entrega:true,centro_distribuicao:true,uf:'sp'});
  assert.equal(dto.nome,'CD Interior');
  assert.equal(dto.uf,'SP');
  assert.equal(dto.local_coleta,true);
  assert.equal(dto.local_entrega,true);
  assert.equal(dto.centro_distribuicao,true);
});
test('valores vêm apenas do registro recebido sem criar rascunhos',()=>{
  assert.equal(valorDaColuna({pessoa:{nome:'Transportadora A'}},'pessoa.nome'),'Transportadora A');
  assert.equal(valorDaColuna({marca_id:3},'marca_id',{marcas:[{id:3,nome:'Marca Real'}]}),'Marca Real');
  assert.equal(valorDaColuna({is_active:false},'is_active'),'Não');
});

test('prestadora salva somente nome no cadastro-base e fica ativa por padrão',()=>{
  const dto=corpoCadastro('prestadores-servico',{...formularioVazio('prestadores-servico'),nome:' ALX Logística '});
  assert.equal(dto.nome,'ALX Logística');
  assert.equal(dto.is_active,true);
});
