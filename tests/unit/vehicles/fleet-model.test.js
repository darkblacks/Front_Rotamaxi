import test from 'node:test';
import assert from 'node:assert/strict';
import {
  lerFiltrosDaUrl, filtrosParaQuery, filtrosParaParams, normalizarPaginacao, seloFipe, mascarar,
  placasDuplicadasNoArquivo, mensagemDuplicadas, compararAtualComCsv, validarAvaliacaoManual, paraDecimal,
  mensagemFalhaFrota, queryCriarVeiculoDaConsulta, lerPrefillDaConsulta, valorFipeExibivel, ehCentralDeFrota,
  categoriaSemFipe, ehPatrimonio, aplicarMudanca, opcoesTipos, opcoesClassificacoes, seloDocumentacao, naoClassificado, textoPendencias, resumoDocumentacao, temFiltroAtivo,
  construirChips, removerChip, opcoesPropriedade, rotuloPropriedade, contarFiltrosSecundarios,
} from '../../../src/domain/vehicles/fleet-model.js';

test('filtros: URL descarta enums desconhecidos, classificação exige tipo, ida e volta', () => {
  const f = lerFiltrosDaUrl({ q: ' abc ', propriedade: 'agregado', status: 'xyz', documentacao: 'vencida', tipo: 'Caminhão', classificacao: 'Toco', proprietario: 'ACME', page: '3' });
  assert.deepEqual(f, { q: 'abc', propriedade: 'terceiro', status: 'ativo', tipo: 'Caminhão', classificacao: 'Toco', proprietario: 'ACME', documentacao: 'vencida', page: 3 });
  assert.deepEqual(filtrosParaQuery(f), { q: 'abc', propriedade: 'terceiro', documentacao: 'vencida', tipo: 'Caminhão', classificacao: 'Toco', proprietario: 'ACME', page: '3' });
  assert.deepEqual(lerFiltrosDaUrl(filtrosParaQuery(f)), f);
  assert.equal(lerFiltrosDaUrl({ classificacao: 'Toco' }).classificacao, '');
  assert.equal(lerFiltrosDaUrl({ page: '-2' }).page, 1);
  assert.equal(filtrosParaParams(f, 25).per_page, 25);
  assert.equal('cobertura' in f, false);
});
test('dependência tipo -> classificação e volta à página 1', () => {
  const atual = lerFiltrosDaUrl({ tipo: 'Caminhão', classificacao: 'Toco', page: '4' });
  const trocou = aplicarMudanca(atual, { tipo: 'Carreta' });
  assert.equal(trocou.classificacao, '');
  assert.equal(trocou.page, 1);
  assert.equal(aplicarMudanca(atual, { page: 5 }).classificacao, 'Toco');
  const opcoes = { tipos: [{ tipo: 'Caminhão', total: 5, classificacoes: [{ classificacao: 'Toco', total: 3 }] }] };
  assert.deepEqual(opcoesTipos(opcoes), [{ valor: 'Caminhão', total: 5 }]);
  assert.deepEqual(opcoesClassificacoes(opcoes, ''), []);
  assert.deepEqual(opcoesClassificacoes(opcoes, 'Caminhão'), [{ valor: 'Toco', total: 3 }]);
  assert.equal(temFiltroAtivo(lerFiltrosDaUrl({})), false);
  assert.equal(temFiltroAtivo(lerFiltrosDaUrl({ documentacao: 'sem_dados' })), true);
});
test('documentação: só GR; sem_dados nunca vira Regular', () => {
  assert.equal(seloDocumentacao({ documentacao: 'sem_dados' }).texto, 'Sem dados');
  assert.equal(seloDocumentacao({}).tom, 'neutro');
  assert.equal(seloDocumentacao({ documentacao: 'vencida', validade_gr: '2026-03-05' }).texto, 'GR vencida em 05/03/2026');
  assert.equal(seloDocumentacao({ documentacao: 'a_vencer', documentos: { gr: { dias: 1 } } }).texto, 'GR vence em 1 dia');
  assert.equal(seloDocumentacao({ documentacao: 'em_dia' }).texto, 'GR em dia');
  assert.match(seloDocumentacao({ documentacao: 'em_dia' }).dica, /GR/);
  assert.equal(naoClassificado({ classificacao_a_confirmar: true, classificacao: 'HR', tipo: 'Caminhonete' }), false);
  assert.equal(naoClassificado({ classificacao: 'Não classificado' }), true);
  assert.equal(textoPendencias({ pendencias: ['a', 'b'] }), '2 pendências');
  assert.equal(textoPendencias({ pendencias: [] }), '');
  assert.equal(resumoDocumentacao([{ documentacao: 'vencida' }, { documentacao: 'em_dia' }, { documentacao: 'a_vencer' }]), 2);
});
test('paginação vem do servidor (topo ou meta)', () => {
  assert.deepEqual(normalizarPaginacao({ current_page: 2, last_page: 5, total: 120 }), { pagina: 2, ultimaPagina: 5, total: 120 });
  assert.deepEqual(normalizarPaginacao({ meta: { current_page: 1, last_page: 0, total: 0 } }), { pagina: 1, ultimaPagina: 1, total: 0 });
});
test('selos FIPE nunca confundem provável com confirmada', () => {
  assert.equal(seloFipe('provavel').texto, 'FIPE provável - não confirmada');
  assert.equal(seloFipe('vinculado').texto, 'FIPE confirmada');
  assert.equal(seloFipe('sem_cobertura').texto, 'FIPE indisponível para esta categoria');
});
test('só Próprio é patrimônio; valor FIPE exige mês e > 0', () => {
  assert.equal(ehPatrimonio('proprio'), true);
  assert.equal(ehPatrimonio('agregado'), false);
  assert.equal(valorFipeExibivel({ valor: '1000', mes_referencia: 'maio de 2026' }), true);
  assert.equal(valorFipeExibivel({ valor: '1000' }), false);
  assert.equal(valorFipeExibivel({ valor: '0', mes_referencia: 'x' }), false);
});
test('máscara de identificadores', () => {
  assert.equal(mascarar('12345678901'), '•••••••8901');
  assert.equal(mascarar(''), '—');
});
test('duplicadas: todas as placas do arquivo inteiro, com linhas', () => {
  const d = placasDuplicadasNoArquivo([{ placa: 'abc-1d23' }, { placa: 'XYZ1A11' }, { placa: 'ABC1D23' }, { placa: 'xyz1a11' }, { placa: 'ABC1D23' }]);
  assert.deepEqual(d, [{ placa: 'ABC1D23', linhas: [2, 4, 6] }, { placa: 'XYZ1A11', linhas: [3, 5] }]);
  assert.match(mensagemDuplicadas(d), /2 placa\(s\) repetida\(s\)/);
  assert.deepEqual(placasDuplicadasNoArquivo([{ placa: 'AAA1A11' }]), []);
});
test('comparação atual x CSV marca só o que mudaria', () => {
  const r = compararAtualComCsv({ cor: 'Branca', chassi: '' }, { cor: 'Branca', chassi: '9BW', renavam: '1' }, [['cor', 'Cor'], ['chassi', 'Chassi'], ['renavam', 'Renavam']]);
  assert.deepEqual(r.map((x) => x.muda), [false, true, true]);
  assert.equal(compararAtualComCsv(null, { cor: 'x' }, [['cor', 'Cor']])[0].informado, false);
});
test('avaliação manual: valor, fonte e data obrigatórios', () => {
  assert.equal(validarAvaliacaoManual({ valor: '', fonte: '', data: '' }).ok, false);
  assert.equal(validarAvaliacaoManual({ valor: '12.345,60', fonte: 'Perito', data: '2026-01-10' }, new Date('2026-02-01')).ok, true);
  assert.ok(validarAvaliacaoManual({ valor: '1', fonte: 'x', data: '2030-01-01' }, new Date('2026-02-01')).erros.data);
  assert.equal(paraDecimal('12.345,60'), 12345.6);
  assert.equal(paraDecimal('100.5'), 100.5);
});
test('falhas 404/422/503 viram texto pt-BR claro', () => {
  assert.match(mensagemFalhaFrota({ status: 404 }, 'a frota'), /ainda não oferece a frota/);
  assert.match(mensagemFalhaFrota({ status: 503, mensagem: '' }, 'a frota'), /indisponível/);
  assert.equal(mensagemFalhaFrota({ status: 422, errors: { a: ['Erro A'] } }), 'Erro A');
});
test('prefill da consulta FIPE ida e volta, sem categoria inválida', () => {
  const q = queryCriarVeiculoDaConsulta({ tipo: 'trucks', marcaId: 3, modeloId: 9, anoCodigo: '2020-3', codigoFipe: '009123-4' });
  assert.deepEqual(lerPrefillDaConsulta(q), { fipe_tipo: 'trucks', marca_id: 3, modelo_id: 9, fipe_ano_codigo: '2020-3', ano_modelo: 2020, codigo_fipe: '009123-4' });
  assert.equal(lerPrefillDaConsulta({}), null);
  assert.equal(lerPrefillDaConsulta({ origem_fipe: '1', fipe_tipo: 'boats' }).fipe_tipo, '');
});
test('roteamento: central canônica para placas (com ou sem classe legada)', () => {
  assert.equal(ehCentralDeFrota('veiculos', {}), true);
  assert.equal(ehCentralDeFrota('veiculos', { aba: 'placas' }), true);
  assert.equal(ehCentralDeFrota('veiculos', { aba: 'marcas' }), false);
  assert.equal(ehCentralDeFrota('veiculos', { aba: 'placas', classe: 'reboques' }), true);
  assert.equal(ehCentralDeFrota('pessoas', {}), false);
  assert.equal(categoriaSemFipe({ categoria: 'reboque' }), true);
});

test('filtro default: status ativo enviado à API quando ausente na URL; Todas é selecionável', () => {
  const f = lerFiltrosDaUrl({});
  assert.equal(f.status, 'ativo');
  assert.equal(filtrosParaParams(f).status, 'ativo');
  assert.equal('status' in filtrosParaQuery(f), false);
  const todas = lerFiltrosDaUrl({ status: 'todas' });
  assert.equal(todas.status, 'todas');
  assert.equal(filtrosParaQuery(todas).status, 'todas');
  assert.equal('status' in filtrosParaParams(todas), false);
  assert.equal(lerFiltrosDaUrl({ status: 'inativo' }).status, 'inativo');
});
test('Próprio limpa e oculta Proprietário (estado e URL)', () => {
  const atual = lerFiltrosDaUrl({ propriedade: 'terceiro', proprietario: 'ACME' });
  assert.equal(atual.proprietario, 'ACME');
  const p = aplicarMudanca(atual, { propriedade: 'proprio' });
  assert.equal(p.proprietario, '');
  assert.equal('proprietario' in filtrosParaQuery(p), false);
  assert.equal(lerFiltrosDaUrl({ propriedade: 'proprio', proprietario: 'ACME' }).proprietario, '');
});
test('trocar Tipo reseta Classificação; remover Tipo também', () => {
  const atual = lerFiltrosDaUrl({ tipo: 'Caminhão', classificacao: 'Toco' });
  assert.equal(aplicarMudanca(atual, { tipo: 'Carreta' }).classificacao, '');
  assert.equal(removerChip(atual, 'tipo').classificacao, '');
});
test('chips: construção, Situação ativo sem chip, remoção volta ao padrão', () => {
  assert.deepEqual(construirChips(lerFiltrosDaUrl({})), []);
  const f = lerFiltrosDaUrl({ propriedade: 'proprio', q: 'abc', tipo: 'Cavalo', classificacao: 'Trucado', documentacao: 'vencida', status: 'inativo' });
  assert.deepEqual(construirChips(f).map((c) => c.rotulo), ['Propriedade: Próprio', 'Busca: abc', 'Tipo: Cavalo', 'Classificação: Trucado', 'Documentação: Vencida', 'Situação: Inativo / baixado']);
  assert.equal(contarFiltrosSecundarios(f), 4);
  assert.equal(removerChip(f, 'status').status, 'ativo');
  assert.equal(removerChip(f, 'propriedade').propriedade, '');
  assert.equal(construirChips(lerFiltrosDaUrl({ status: 'todas' }))[0].rotulo, 'Situação: Todas');
  assert.equal(removerChip(f, 'tipo').page, 1);
});
test('legado agregado vira terceiro; opções sem Agregado; facetas com fallback para totais', () => {
  assert.equal(lerFiltrosDaUrl({ propriedade: 'agregado' }).propriedade, 'terceiro');
  assert.equal(rotuloPropriedade('agregado'), 'Terceiro / Agregado');
  const viaFacetas = opcoesPropriedade({ facetas: { propriedade: [{ valor: 'proprio', total: 50 }, { valor: 'terceiro', total: 429 }] } });
  assert.deepEqual(viaFacetas.map((o) => [o.valor, o.total]), [['', 479], ['proprio', 50], ['terceiro', 429]]);
  const viaTotais = opcoesPropriedade({ totais: { proprio: 50, terceiro: 400, agregado: 29 } });
  assert.equal(viaTotais[2].total, 429);
  assert.equal(viaTotais.some((o) => /agregado$/i.test(o.rotulo) && o.valor === 'agregado'), false);
  assert.equal(opcoesPropriedade({})[0].total, null);
});
