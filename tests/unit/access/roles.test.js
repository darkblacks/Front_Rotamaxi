import test from 'node:test';
import assert from 'node:assert/strict';
import { podeAcessar, menuVisivel, primeiraRotaPermitida, temPapelDoPainel } from '../../../src/domain/access/roles.js';

test('admin acessa tudo; sem exigência só admin', () => {
    assert.equal(podeAcessar(['admin'], ['porteiro']), true);
    assert.equal(podeAcessar(['roteirizador'], undefined), false);
    assert.equal(podeAcessar(['admin'], undefined), true);
});

test('menu por papel', () => {
    const ids = (p) => menuVisivel([p]).map((i) => i.id);
    assert.ok(ids('roteirizador').includes('planejamento'));
    assert.ok(!ids('roteirizador').includes('fila-portaria'));
    assert.deepEqual(ids('motorista'), ['meu-manifesto']);
    assert.ok(ids('porteiro').includes('fila-portaria'));
    assert.ok(ids('equipe_ct').includes('recebimentos'));
    assert.ok(ids('conferente').includes('conferencia'));
    assert.ok(ids('sac').includes('ocorrencias'));
    assert.equal(menuVisivel(['admin']).length, menuVisivel(['admin']).filter(Boolean).length);
});

test('primeira rota e papel do painel', () => {
    assert.equal(primeiraRotaPermitida(['motorista']), 'meu-manifesto');
    assert.equal(primeiraRotaPermitida(['x']), null);
    assert.equal(temPapelDoPainel(['sac']), true);
    assert.equal(temPapelDoPainel(['cliente']), false);
});
