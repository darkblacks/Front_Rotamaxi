import test from 'node:test';
import assert from 'node:assert/strict';
import {
  criarPessoa, salvarPessoa, procurarPessoa, carregarPessoas, listarPessoasPorAba,
  enderecoVazio, documentoVazio, PESSOAS_SESSAO_KEY,
} from '../../../src/domain/people/model.js';

function criarStorage() {
  const dados = new Map();
  return {
    getItem: k => dados.get(k) ?? null,
    setItem: (k, v) => dados.set(k, String(v)),
    removeItem: k => dados.delete(k),
    clear: () => dados.clear(),
  };
}

test('cria e salva uma pessoa inteiramente vazia (nenhum campo obrigatório)', () => {
  const st = criarStorage();
  const pessoa = criarPessoa();
  assert.equal(pessoa.nome, '');
  assert.equal(pessoa.motorista.habilitado, false);
  assert.equal(pessoa.acesso.habilitado, false);
  const salva = salvarPessoa(pessoa, st);
  assert.ok(salva.id);
  assert.equal(carregarPessoas(st).length, 1);
  assert.equal(procurarPessoa(salva.id, st).nome, '');
  assert.equal(listarPessoasPorAba(carregarPessoas(st), 'pessoas')[0].nome, 'Pessoa sem nome');
});

test('pessoa com dois documentos e vários endereços mantém listas e mesma identidade ao editar', () => {
  const st = criarStorage();
  const pessoa = criarPessoa();
  pessoa.nome = 'Teste de Pessoa';
  pessoa.documentos[0].numero = 'doc-teste';
  pessoa.documentos.push({ ...documentoVazio(), tipo:'RG', numero: 'rg-teste' });
  pessoa.enderecos.push({ ...enderecoVazio(), etiqueta:'Casa' }, { ...enderecoVazio(), etiqueta:'Trabalho' });
  const salva = salvarPessoa(pessoa, st);
  const editada = procurarPessoa(salva.id, st);
  editada.nome = 'Teste Atualizado';
  salvarPessoa(editada, st);
  const todas = carregarPessoas(st);
  assert.equal(todas.length, 1);
  assert.equal(todas[0].nome, 'Teste Atualizado');
  assert.equal(todas[0].enderecos.length, 2);
  assert.equal(todas[0].documentos.length, 2);
});

test('motorista cadastral e acesso solicitado são opcionais e aparecem em listas independentes', () => {
  const st = criarStorage();
  const p = criarPessoa({ origem: 'motoristas' });
  p.motorista.categoriaCnh = 'E';
  p.acesso.habilitado = true;
  p.acesso.papeis = ['Portaria','Motorista'];
  p.acesso.identificador = '';
  salvarPessoa(p, st);
  const todas = carregarPessoas(st);
  assert.equal(listarPessoasPorAba(todas, 'pessoas').length, 1);
  assert.equal(listarPessoasPorAba(todas, 'motoristas')[0].cnh, 'E');
  assert.equal(listarPessoasPorAba(todas, 'usuarios')[0].perfil, 'Portaria, Motorista');
  assert.equal(Object.hasOwn(todas[0].acesso, 'password'), false);
});

test('criação a partir de terceiros inclui vínculo opcional e visibilidade na aba', () => {
  const st = criarStorage();
  salvarPessoa(criarPessoa({origem: 'terceiros'}), st);
  assert.equal(listarPessoasPorAba(carregarPessoas(st), 'terceiros').length, 1);
});

test('storage inválido é tratado sem interromper listagens', () => {
  const st = criarStorage();
  st.setItem(PESSOAS_SESSAO_KEY, '{');
  assert.deepEqual(carregarPessoas(st), []);
});

test('filial origem, vínculo permanente e empréstimo temporário não se confundem', async () => {
  const { normalizarLotacao, solicitarEmprestimo, simularDecisao, podeAlocarDuranteEmprestimo, podeGerenciarMotorista } = await import('../../../src/domain/branches/model.js');
  const st = criarStorage();
  let p = criarPessoa({ origem: 'motoristas' });
  p.nome = 'Motorista de teste';
  p.lotacao = { responsavel: 'SP01', vinculadas: ['RJ01'] };
  p = salvarPessoa(p, st);
  assert.deepEqual(normalizarLotacao(p), { responsavel: 'SP01', vinculadas: ['RJ01'] });
  assert.equal(podeGerenciarMotorista(p, 'RJ01', 'gestor_origem'), false);
  assert.equal(podeGerenciarMotorista(p, 'SP01', 'gestor_origem'), true);
  assert.equal(podeAlocarDuranteEmprestimo(p, 'RJ01', '2026-11-03'), false);
  const requisicao = solicitarEmprestimo(p, { destino: 'RJ01', inicio:'2026-11-01', fim:'2026-11-05', justificativa:'Reforço' });
  assert.equal(requisicao.erro, '');
  p = requisicao.pessoa;
  assert.equal(p.emprestimos[0].status, 'solicitado');
  assert.equal(p.lotacao.responsavel, 'SP01');
  assert.equal(podeAlocarDuranteEmprestimo(p, 'RJ01', '2026-11-03'), false);
  assert.match(simularDecisao(p, requisicao.emprestimo.id, 'aprovar', {filial:'RJ01',papel:'gestor_origem'}).erro, /origem/);
  assert.match(simularDecisao(p, requisicao.emprestimo.id, 'aprovar', {filial:'SP01',papel:'solicitante'}).erro, /origem/);
  p = simularDecisao(p, requisicao.emprestimo.id, 'aprovar', {filial:'SP01',papel:'gestor_origem'}).pessoa;
  assert.equal(p.emprestimos[0].status, 'aprovado');
  assert.equal(podeAlocarDuranteEmprestimo(p, 'RJ01', '2026-11-03'), true);
  assert.equal(podeAlocarDuranteEmprestimo(p, 'RJ01', '2026-11-06'), false);
  p = simularDecisao(p, requisicao.emprestimo.id, 'encerrar', {filial:'SP01',papel:'gestor_origem'}).pessoa;
  assert.equal(p.emprestimos[0].status, 'encerrado');
  assert.equal(podeAlocarDuranteEmprestimo(p, 'RJ01', '2026-11-03'), false);
  assert.equal(p.lotacao.responsavel, 'SP01');
});

test('rejeita empréstimos sobrepostos, iguais à origem ou sem motorista', async () => {
  const { solicitarEmprestimo } = await import('../../../src/domain/branches/model.js');
  const p = criarPessoa(); p.lotacao.responsavel = 'SP01';
  assert.match(solicitarEmprestimo(p,{destino:'RJ01',inicio:'2026-11-01',fim:'2026-11-02'}).erro,/motorista/);
  p.motorista.habilitado = true;
  assert.match(solicitarEmprestimo(p,{destino:'SP01',inicio:'2026-11-01',fim:'2026-11-02'}).erro,/diferente/);
  assert.match(solicitarEmprestimo(p,{destino:'RJ01',inicio:'2026-11-03',fim:'2026-11-02'}).erro,/período/);
  const r=solicitarEmprestimo(p,{destino:'RJ01',inicio:'2026-11-01',fim:'2026-11-05'});
  assert.equal(r.erro,'');
  assert.match(solicitarEmprestimo(r.pessoa,{destino:'SP02',inicio:'2026-11-04',fim:'2026-11-09'}).erro,/sobreposto/);
});

test('carrega um rascunho V4 sem lotação e mantém o modelo de pessoa V5', () => {
  const st = criarStorage();
  const antigo = criarPessoa({ origem:'motoristas' });
  antigo.id='v4-001'; antigo.motorista.filial='SP01'; delete antigo.lotacao; delete antigo.emprestimos;
  st.setItem(PESSOAS_SESSAO_KEY, JSON.stringify([antigo]));
  const pessoa = carregarPessoas(st)[0];
  assert.equal(pessoa.lotacao.responsavel,'SP01');
  assert.deepEqual(pessoa.emprestimos,[]);
  assert.deepEqual(listarPessoasPorAba([pessoa],'pessoas')[0].filial,'SP01');
});

test('a autorização de uso é específica por tipo de serviço', async () => {
  const { solicitarEmprestimo, simularDecisao, podeAlocarDuranteEmprestimo } = await import('../../../src/domain/branches/model.js');
  let p=criarPessoa({ origem:'motoristas' });
  p.lotacao.responsavel='SP01';
  const resultado = solicitarEmprestimo(p,{destino:'RJ01',inicio:'2026-11-01',fim:'2026-11-05',escopo:'coleta'});
  p=simularDecisao(resultado.pessoa,resultado.emprestimo.id,'aprovar',{filial:'SP01',papel:'gestor_origem'}).pessoa;
  assert.equal(podeAlocarDuranteEmprestimo(p,'RJ01','2026-11-02','coleta'),true);
  assert.equal(podeAlocarDuranteEmprestimo(p,'RJ01','2026-11-02','distribuicao'),false);
  assert.equal(podeAlocarDuranteEmprestimo(p,'SP02','2026-11-02','coleta'),false);
});

test('V6: somente o documento CNH preserva validade e órgão emissor não é gravado', () => {
  const st = criarStorage();
  const p = criarPessoa();
  p.documentos = [
    { ...documentoVazio(), tipo: 'CPF', numero: 'cpf-teste', validade: '2030-01-01', emissor: 'oculto' },
    { ...documentoVazio(), tipo: 'RG', numero: 'rg-teste', validade: '2031-01-01', emissor: 'oculto' },
    { ...documentoVazio(), tipo: 'CNH', numero: 'cnh-teste', validade: '2032-01-01', emissor: 'oculto' },
  ];
  const salvo = salvarPessoa(p,st);
  assert.deepEqual(salvo.documentos.map(d => d.validade), ['', '', '2032-01-01']);
  assert.ok(salvo.documentos.every(d => !Object.hasOwn(d,'emissor')));
  assert.equal(salvo.motorista.numeroCnh,'cnh-teste');
  assert.equal(salvo.motorista.validadeCnh,'2032-01-01');
});

test('V6: migra CNH antiga de Motorista para Documentos sem criar duplicatas', () => {
  const st=criarStorage();
  const p=criarPessoa({origem:'motoristas'});
  p.motorista.numeroCnh='12345678';
  p.motorista.validadeCnh='2027-08-01';
  const primeiro=salvarPessoa(p,st);
  const antigo=procurarPessoa(primeiro.id,st);
  const doc=antigo.documentos.filter(d=>d.tipo==='CNH');
  assert.equal(doc.length,1);
  assert.equal(doc[0].numero,'12345678');
  assert.equal(doc[0].validade,'2027-08-01');
  const segundo=salvarPessoa(antigo,st);
  assert.equal(segundo.documentos.filter(d=>d.tipo==='CNH').length,1);
});

test('V6: matriz é única e filiais visíveis não concedem autorização operacional', async () => {
  const { podeAlocarDuranteEmprestimo, podeGerenciarMotorista } = await import('../../../src/domain/branches/model.js');
  const p=criarPessoa({origem:'motoristas'});
  p.lotacao.responsavel='SP01';
  p.acesso.filiais=['RJ01'];
  const salvo=salvarPessoa(p,criarStorage());
  assert.equal(salvo.lotacao.responsavel,'SP01');
  assert.deepEqual(salvo.acesso.filiais,['RJ01']);
  assert.equal(podeGerenciarMotorista(salvo,'RJ01','gestor_origem'),false);
  assert.equal(podeAlocarDuranteEmprestimo(salvo,'RJ01','2026-11-01'),false);
});

test('V6: excluir a CNH não recria documento antigo no próximo salvamento', () => {
  const st=criarStorage();
  const p=criarPessoa({origem:'motoristas'});
  p.motorista.numeroCnh='legado';
  p.motorista.validadeCnh='2027-12-31';
  let salvo=salvarPessoa(p,st);
  assert.equal(salvo.documentos.filter(d=>d.tipo==='CNH').length,1);
  salvo.documentos=salvo.documentos.filter(d=>d.tipo!=='CNH');
  salvo=salvarPessoa(salvo,st);
  assert.equal(salvo.documentos.filter(d=>d.tipo==='CNH').length,0);
  assert.equal(salvo.motorista.numeroCnh,'');
});
