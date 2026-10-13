import test from 'node:test';
import assert from 'node:assert/strict';
import { listarTodasMarcas, filtrarMarcas, paginarMarcas, normalizarPesquisaMarca } from '../../../../src/domain/vehicles/brands/local-pagination.js';

const marcas = Array.from({length:222}, (_,i)=>({id:i+1,nome:`Marca ${i+1}`,is_active:i%2===0}));
marcas[3].nome='ADLY';
marcas[32].nome='WUYANG';
marcas[150].nome='IVECO';
marcas[201].nome='SÃO CRISTÓVÃO';

const apiFake=async(recurso, {pagina,por_pagina})=>{
  assert.equal(recurso,'marcas');
  assert.equal(por_pagina,100);
  return {data:marcas.slice((pagina-1)*por_pagina,pagina*por_pagina),last_page:3,total:222};
};

test('carrega todas as 222 marcas da API paginada e não só a primeira página',async()=>{
  const todas=await listarTodasMarcas(apiFake);
  assert.equal(todas.length,222);
  assert.deepEqual([todas[0].id,todas.at(-1).id],[222,1]);
});
test('página 2 e última página avançam sobre o catálogo completo',()=>{
  const p1=paginarMarcas(marcas,1);
  const p2=paginarMarcas(marcas,2);
  const p12=paginarMarcas(marcas,12);
  assert.equal(p1.registros.length,20);
  assert.equal(p2.registros[0].id,21);
  assert.equal(p2.ultimaPagina,12);
  assert.equal(p12.registros.length,2);
});
test('busca encontra marca que estaria em outra página e ignora caixa e acentos',()=>{
  assert.equal(filtrarMarcas(marcas,{busca:'wuyang'})[0].nome,'WUYANG');
  assert.equal(filtrarMarcas(marcas,{busca:'sao cristovao'})[0].nome,'SÃO CRISTÓVÃO');
  assert.equal(normalizarPesquisaMarca('  TRÏÜMPH  '),'triumph');
});
test('filtro de situação e busca se combinam e retornam à página correta',()=>{
  const encontrados=filtrarMarcas(marcas,{status:'inativo',busca:'marca'});
  assert.ok(encontrados.every(m=>!m.is_active));
  const paginacao=paginarMarcas(filtrarMarcas(marcas,{busca:'IVECO'}),8);
  assert.equal(paginacao.pagina,1);
  assert.equal(paginacao.total,1);
});
test('não inventa páginas e preserva a primeira para resultado vazio',()=>{
  const resultado=paginarMarcas([],20);
  assert.deepEqual([resultado.total,resultado.pagina,resultado.ultimaPagina],[0,1,1]);
});
test('falha em API que interrompe paginação antes do fim',async()=>{
  await assert.rejects(()=>listarTodasMarcas(async(_r,{pagina})=>({data:pagina===1?[{id:1}]:[],last_page:4})),/página vazia/);
});
