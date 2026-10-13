import test from 'node:test';
import assert from 'node:assert/strict';
import {
    divergenciaDaCadeia,
    montarCadeia,
    quantidadeDe,
    saldoDisponivel,
    temDivergencia,
    textoDaDiferenca,
} from '../../../src/domain/pallets/chain.js';

const EXEMPLO_DA_REGRA = {
    esperado: 18,
    conferido: { quantidade: 18, ator: 'conferente' },
    aceito_motorista: 18,
    informado_portaria: 17,
    recebido_ct: 17,
    aceito_ct: 17,
};

test('quantidadeDe aceita número, objeto e vazio', () => {
    assert.equal(quantidadeDe(5), 5);
    assert.equal(quantidadeDe('7'), 7);
    assert.equal(quantidadeDe({ quantidade: 3 }), 3);
    assert.equal(quantidadeDe({ quantidade: 0 }), 0);
    assert.equal(quantidadeDe(null), null);
    assert.equal(quantidadeDe(undefined), null);
    assert.equal(quantidadeDe(''), null);
    assert.equal(quantidadeDe({}), null);
});

test('cadeia tem os seis elos na ordem do contrato', () => {
    const chaves = montarCadeia(EXEMPLO_DA_REGRA).map((e) => e.chave);
    assert.deepEqual(chaves, ['esperado', 'conferido', 'aceito_motorista', 'informado_portaria', 'recebido_ct', 'aceito_ct']);
});

test('exemplo da regra 25.2: 18/18/18/17/17/17 evidencia -1 sem apagar valores', () => {
    const elos = montarCadeia(EXEMPLO_DA_REGRA);
    const por = Object.fromEntries(elos.map((e) => [e.chave, e]));
    assert.equal(por.esperado.quantidade, 18);
    assert.equal(por.aceito_motorista.divergente, false);
    assert.equal(por.informado_portaria.divergente, true);
    assert.equal(por.informado_portaria.diferenca, -1);
    assert.equal(por.recebido_ct.divergente, true);
    assert.equal(por.aceito_ct.quantidade, 17);
    assert.equal(divergenciaDaCadeia(EXEMPLO_DA_REGRA), -1);
    assert.equal(temDivergencia(EXEMPLO_DA_REGRA), true);
});

test('elos ausentes ficam pendentes e não geram divergência', () => {
    const elos = montarCadeia({ esperado: 10, conferido: 10 });
    assert.equal(elos.filter((e) => e.pendente).length, 4);
    assert.equal(elos.some((e) => e.divergente), false);
    assert.equal(divergenciaDaCadeia({ esperado: 10, conferido: 10 }), null);
    assert.equal(temDivergencia({ esperado: 10, conferido: 10 }), false);
});

test('valor de divergência do servidor prevalece sobre o cálculo local', () => {
    assert.equal(divergenciaDaCadeia({ esperado: 10, recebido_ct: 10, divergencia: 3 }), 3);
    assert.equal(divergenciaDaCadeia({ esperado: 10, recebido_ct: 8 }), -2);
    assert.equal(divergenciaDaCadeia({ esperado: 10, aceito_ct: 12 }), 2);
});

test('sem esperado, o conferido é a referência', () => {
    const por = Object.fromEntries(montarCadeia({ conferido: 20, aceito_motorista: 19 }).map((e) => [e.chave, e]));
    assert.equal(por.aceito_motorista.diferenca, -1);
});

test('saldo para o próximo manifesto é somente o aceito pelo CT, nunca o informado da portaria', () => {
    assert.equal(saldoDisponivel({ esperado: 18, informado_portaria: 17, recebido_ct: 17 }), null);
    assert.equal(saldoDisponivel({ esperado: 18, informado_portaria: 17, aceito_ct: 16 }), 16);
});

test('aceita o formato V1 do detalhe do mapa (informado/aceito/recebido)', () => {
    const por = Object.fromEntries(montarCadeia({ esperado: 5, informado: 5, aceito: 5, recebido: 4 }).map((e) => [e.chave, e]));
    assert.equal(por.informado_portaria.quantidade, 5);
    assert.equal(por.aceito_motorista.quantidade, 5);
    assert.equal(por.recebido_ct.quantidade, 4);
    assert.equal(por.recebido_ct.divergente, true);
});

test('zero é quantidade válida (nenhum pallet), não ausência', () => {
    const por = Object.fromEntries(montarCadeia({ esperado: 0, informado_portaria: 0 }).map((e) => [e.chave, e]));
    assert.equal(por.informado_portaria.preenchido, true);
    assert.equal(por.informado_portaria.divergente, false);
});

test('texto da diferença', () => {
    assert.equal(textoDaDiferenca(2), '+2');
    assert.equal(textoDaDiferenca(-1), '-1');
    assert.equal(textoDaDiferenca(0), '0');
    assert.equal(textoDaDiferenca(null), '');
});

test('o elo do porteiro é marcado como somente registro', () => {
    const portaria = montarCadeia({}).find((e) => e.chave === 'informado_portaria');
    assert.equal(portaria.semAceite, true);
});
