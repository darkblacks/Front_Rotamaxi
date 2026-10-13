// QA: contrato backend (FrotaVeiculosController::facetas, terceiro_unico) -> helpers do front. Fixture fiel ao PHP; sem rede.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fonteOpcoes, opcoesPropriedade, opcoesProprietarios, opcoesTipos, opcoesClassificacoes,
  lerFiltrosDaUrl, filtrosParaParams, aplicarMudanca, construirChips, removerChip, contarFiltrosSecundarios, rotuloPropriedade,
} from '../../../src/domain/vehicles/fleet-model.js';

const resposta = {
  data: [], current_page: 1, last_page: 1, per_page: 25, total: 0,
  meta: {
    totais: { frota: 479, proprio: 50, terceiro: 429, pendencias: 3, por_pendencia: {}, patrimonio_proprio: {} },
    opcoes: { tipos: [{ tipo: 'Caminhão', total: 10, classificacoes: [{ classificacao: 'Toco', total: 10 }] }], proprietarios: ['A LTDA', 'B LTDA'] },
    facetas: {
      propriedade: [{ valor: '', total: 479 }, { valor: 'proprio', total: 50 }, { valor: 'terceiro', total: 429 }],
      tipos: [
        { tipo: 'Caminhão', total: 300, classificacoes: [{ classificacao: '3/4', total: 120 }, { classificacao: 'Truck', total: 180 }] },
        { tipo: 'Utilitário/Van', total: 0, classificacoes: [] },
        { tipo: 'Não classificado', total: 5, classificacoes: [{ classificacao: 'Não classificado', total: 5 }] },
      ],
      proprietarios: [{ valor: 'TRANSPORTES EXEMPLO LTDA', total: 14 }, { valor: 'ZETA', total: 0 }],
    },
    atualizado_em: '2026-10-13T10:00:00-03:00',
  },
};

test('facetas.propriedade: "" / proprio / terceiro, soma = Todos, nenhum agregado', () => {
  const o = opcoesPropriedade(resposta.meta);
  assert.deepEqual(o.map((x) => x.valor), ['', 'proprio', 'terceiro']);
  assert.deepEqual(o.map((x) => x.total), [479, 50, 429]);
  assert.equal(o.some((x) => /agregado$/i.test(x.rotulo) && x.valor === 'agregado'), false);
  assert.equal(o[2].rotulo, 'Terceiro / Agregado');
});
test('tipos/classificacoes: nomes iguais ao backend; zero preservado; fonte = facetas', () => {
  const fonte = fonteOpcoes(resposta.meta);
  assert.equal(fonte, resposta.meta.facetas);
  assert.deepEqual(opcoesTipos(fonte).map((t) => [t.valor, t.total]), [['Caminhão', 300], ['Utilitário/Van', 0], ['Não classificado', 5]]);
  assert.deepEqual(opcoesClassificacoes(fonte, 'Caminhão').map((c) => c.valor), ['3/4', 'Truck']);
  assert.deepEqual(opcoesClassificacoes(fonte, ''), []);
  assert.deepEqual(opcoesClassificacoes(fonte, 'Inexistente'), []);
});
test('proprietarios: objetos {valor,total} (facetas) e strings (opcoes legado)', () => {
  assert.deepEqual(opcoesProprietarios(resposta.meta), [{ valor: 'TRANSPORTES EXEMPLO LTDA', total: 14 }, { valor: 'ZETA', total: 0 }]);
  assert.deepEqual(opcoesProprietarios({ opcoes: resposta.meta.opcoes }), [{ valor: 'A LTDA', total: null }, { valor: 'B LTDA', total: null }]);
});
test('fallback: so meta.totais (backend antigo, com agregado) soma agregado em terceiro', () => {
  const o = opcoesPropriedade({ totais: { proprio: 50, terceiro: 400, agregado: 29 } });
  assert.deepEqual(o.map((x) => x.total), [479, 50, 429]);
  assert.equal(opcoesPropriedade({}).every((x) => x.total === null), true);
});
test('deep link propriedade=agregado -> terceiro na API; proprio limpa proprietario; params nunca enviam agregado', () => {
  const f = lerFiltrosDaUrl({ propriedade: 'agregado', proprietario: 'X' });
  assert.equal(f.propriedade, 'terceiro');
  assert.equal(filtrosParaParams(f).propriedade, 'terceiro');
  const p = lerFiltrosDaUrl({ propriedade: 'proprio', proprietario: 'X' });
  assert.equal(p.proprietario, '');
  assert.equal('proprietario' in filtrosParaParams(p), false);
  assert.equal(aplicarMudanca(lerFiltrosDaUrl({ propriedade: 'terceiro', proprietario: 'X' }), { propriedade: 'proprio' }).proprietario, '');
});
test('status: padrao ativo explicito na API; todas omite; chips', () => {
  assert.equal(filtrosParaParams(lerFiltrosDaUrl({})).status, 'ativo');
  assert.equal('status' in filtrosParaParams(lerFiltrosDaUrl({ status: 'todas' })), false);
  const f = lerFiltrosDaUrl({ status: 'todas', tipo: 'Caminhão', classificacao: 'Toco', propriedade: 'terceiro' });
  assert.deepEqual(construirChips(f).map((c) => c.chave), ['propriedade', 'tipo', 'classificacao', 'status']);
  assert.equal(contarFiltrosSecundarios(f), 3);
  assert.equal(removerChip(f, 'tipo').classificacao, '');
  assert.equal(removerChip(f, 'status').status, 'ativo');
});
test('valor inexistente na URL nao quebra: tipo desconhecido vira chip; classificacao sem tipo descartada', () => {
  const f = lerFiltrosDaUrl({ tipo: 'Foo', classificacao: 'Bar' });
  assert.equal(opcoesClassificacoes(fonteOpcoes(resposta.meta), f.tipo).length, 0);
  assert.equal(construirChips(f).length, 2);
  assert.equal(lerFiltrosDaUrl({ classificacao: 'Bar' }).classificacao, '');
  assert.equal(rotuloPropriedade('agregado'), 'Terceiro / Agregado');
});
