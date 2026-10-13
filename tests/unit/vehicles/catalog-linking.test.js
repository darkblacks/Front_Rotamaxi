import test from 'node:test';
import assert from 'node:assert/strict';
import { resolverTipoFipeCatalogado, dadosCatalogadosValidos } from '../../../src/domain/vehicles/catalog-linking.js';
const marca = {id:1, nome:'Mercedes-Benz', fipe_codigos:{trucks:109,cars:39}};
const modelo = {id:10, marca_id:1, nome:'Accelo', fipe_codigos:{trucks:345}};
test('detecta caminhão do código de modelo mesmo com macro leve',()=>{
  assert.equal(resolverTipoFipeCatalogado(marca,modelo,'leve'),'trucks');
});
test('motocicleta usa tipo de FIPE sem categoria manual',()=>{
  assert.equal(resolverTipoFipeCatalogado({fipe_codigos:{motorcycles:12}},{fipe_codigos:{motorcycles:34}},'motocicleta'),'motorcycles');
});
test('preserva a categoria FIPE anterior em edição quando válida',()=>{
  const mb={fipe_codigos:{trucks:109,cars:39}};
  const ml={fipe_codigos:{trucks:345,cars:333}};
  assert.equal(resolverTipoFipeCatalogado(mb,ml,'leve','trucks'),'trucks');
  assert.equal(resolverTipoFipeCatalogado(mb,ml,'leve',''),'cars');
});
test('modelo manual sem código não inventa cotação',()=>{
  assert.equal(resolverTipoFipeCatalogado(marca,{fipe_codigos:{}},'pesado'),'');
});
test('marca é obrigatória e deve existir no catálogo',()=>{
  assert.equal(dadosCatalogadosValidos({marca_id:null,modelo_id:10},marca,modelo).ok,false);
  assert.equal(dadosCatalogadosValidos({marca_id:1,modelo_id:10},null,modelo).ok,false);
});
test('modelo precisa estar cadastrado e pertencer à marca',()=>{
  assert.equal(dadosCatalogadosValidos({marca_id:1,modelo_id:null},marca,modelo).ok,false);
  assert.equal(dadosCatalogadosValidos({marca_id:1,modelo_id:10},marca,{...modelo,marca_id:2}).ok,false);
  assert.equal(dadosCatalogadosValidos({marca_id:1,modelo_id:10},marca,modelo).ok,true);
});
