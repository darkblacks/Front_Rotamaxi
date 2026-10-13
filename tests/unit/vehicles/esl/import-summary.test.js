import test from 'node:test';
import assert from 'node:assert/strict';
import { somarContagens, contarLinhas, celulaCsvSegura, gerarCsvRelatorio } from '../../../../src/domain/vehicles/esl/import-summary.js';

test('somarContagens soma lotes e trata ausentes', () => {
  const t = somarContagens([{ criar: 2, prestadores_novos_candidatos: 1, prestadores_criados: 1 }, { criar: 3, atualizar: 4, prestadores_criados: 2 }, null, {}]);
  assert.equal(t.criar, 5); assert.equal(t.atualizar, 4); assert.equal(t.prestadores_criados, 3);
  assert.equal(t.prestadores_novos_candidatos, 1);
});
test('somarContagens: prestadores_criados null quando nenhum lote informa', () => {
  assert.equal(somarContagens([{ criar: 1, prestadores_criados: null }]).prestadores_criados, null);
  assert.equal(somarContagens([]).criar, 0);
});
test('contarLinhas deriva das linhas', () => {
  const c = contarLinhas([{ acao: 'criar', prestador_classe: 'novo_empresa' }, { acao: 'completar', prestador_classe: 'exato_existente' },
    { acao: 'existente' }, { acao: 'revisar', prestador_classe: 'possivel_duplicado', prestador_acao: 'revisar' }]);
  assert.deepEqual([c.criar, c.atualizar, c.inalterados, c.revisar, c.prestadores_existentes, c.prestadores_novos_candidatos, c.prestadores_ambiguos, c.prestadores_revisar], [1, 1, 1, 1, 1, 1, 1, 1]);
});
test('celulaCsvSegura bloqueia fórmulas e escapa separador/aspas', () => {
  assert.equal(celulaCsvSegura('=1+1'), "'=1+1");
  assert.equal(celulaCsvSegura('+55'), "'+55");
  assert.equal(celulaCsvSegura('-x'), "'-x");
  assert.equal(celulaCsvSegura('@SUM'), "'@SUM");
  assert.equal(celulaCsvSegura('a;b'), '"a;b"');
  assert.equal(celulaCsvSegura('diz "oi"'), '"diz ""oi"""');
  assert.equal(celulaCsvSegura(null), '');
  assert.equal(celulaCsvSegura(0), '0');
});
test('gerarCsvRelatorio tem BOM, ; e neutraliza nome de prestador', () => {
  const csv = gerarCsvRelatorio([{ linha: 1, placa: 'ABC1D23', acao: 'criado', motivo: '', prestador_nome_origem: '=cmd', prestador_classe: 'novo_empresa', prestador_acao: 'criado', prestador_criado_id: 12 }]);
  assert.ok(csv.startsWith('﻿'));
  assert.ok(csv.includes("1;ABC1D23;criado;;'=cmd;Empresa nova;Cadastrado;12"));
});
