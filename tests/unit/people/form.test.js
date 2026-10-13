import test from 'node:test';
import assert from 'node:assert/strict';
import { criarPessoa, normalizarPessoa, documentoVazio } from '../../../src/domain/people/model.js';

test('pessoa em branco pronta para persistir na API',()=>{
  const pessoa=criarPessoa();
  assert.equal(pessoa.nome,'');assert.equal(pessoa.acesso.habilitado,false);
  assert.equal(pessoa.lotacao.responsavel,'');
});
test('motorista tem dados cadastrais mas não cria login',()=>{
  const pessoa=criarPessoa({origem:'motoristas'});
  assert.equal(pessoa.motorista.habilitado,true);
  assert.equal(pessoa.acesso.habilitado,false);
});
test('mapeia resposta real com CNH e matriz numérica',()=>{
  const pessoa=normalizarPessoa({id:44,nome:'Pessoa real',documentos:[{id:1,tipo:'CNH',numero:'999',validade:'2028-01-01'}],lotacao:{responsavel:10},acesso:{papeis:['motorista']}});
  assert.equal(pessoa.documentos[0].validade,'2028-01-01');
  assert.equal(pessoa.lotacao.responsavel,10);
  assert.deepEqual(pessoa.acesso.papeis,['motorista']);
});
test('campo CNH não é duplicado após normalização',()=>{
  const pessoa=normalizarPessoa({documentos:[{...documentoVazio(),tipo:'CNH',numero:'123'}],motorista:{numeroCnh:'123',validadeCnh:'2029-01-01'}});
  assert.equal(pessoa.documentos.filter(d=>d.tipo==='CNH').length,1);
});

test('novo cliente pode começar pelo cadastro de pessoa com CNPJ',()=>{
  assert.equal(criarPessoa({origem:'clientes'}).documentos[0].tipo,'CNPJ');
});
