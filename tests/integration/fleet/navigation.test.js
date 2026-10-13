import test from 'node:test';
import assert from 'node:assert/strict';
import { origemSegura, queryVoltar, destinoVoltar, classeParaFiltros, lerFiltrosDaUrl, ehCentralDeFrota } from '../../../src/domain/vehicles/fleet-model.js';

test('origemSegura aceita só caminhos /painel internos', () => {
  const ok = '/painel/cadastros/veiculos?aba=placas&tipo=Caminh%C3%A3o&page=2';
  assert.equal(origemSegura(ok), ok);
  for (const ruim of ['https://evil.com', '//evil.com/painel/x', '/outro/painel/', '/painelx', 'javascript:alert(1)', '/painel/..' + String.fromCharCode(92), '/painel/a' + String.fromCharCode(10), '/painel/x:y', '', null, undefined])
    assert.equal(origemSegura(ruim), '', String(ruim));
  assert.equal(origemSegura([ok, 'https://x']), ok);
});
test('q com :// ou barra invertida na busca não invalida a origem', () => {
  const o = '/painel/cadastros/veiculos?q=http://x%5Cy';
  assert.equal(origemSegura(o), o);
  assert.equal(origemSegura('/painel/cadastros/veiculos?q=a://b'), '/painel/cadastros/veiculos?q=a://b');
});
test('aba desconhecida cai na Central', () => {
  assert.equal(ehCentralDeFrota('veiculos', { aba: 'foo' }), true);
  assert.equal(ehCentralDeFrota('veiculos', { aba: 'tipos' }), true); // aba Tipos removida: links antigos caem na Central
  assert.equal(ehCentralDeFrota('veiculos', { aba: 'modelos' }), false);
});
test('queryVoltar e destinoVoltar com fallback', () => {
  assert.deepEqual(queryVoltar('/painel/cadastros/veiculos?q=a'), { voltar: '/painel/cadastros/veiculos?q=a' });
  assert.deepEqual(queryVoltar('https://x'), {});
  assert.equal(destinoVoltar({ voltar: '/painel/cadastros/veiculos/3' }, 'F'), '/painel/cadastros/veiculos/3');
  assert.equal(destinoVoltar({ voltar: 'http://x' }, 'F'), 'F');
  assert.equal(destinoVoltar({}, 'F'), 'F');
});
test('classe legada vira filtro; Central é canônica para placas', () => {
  assert.deepEqual(classeParaFiltros('reboques'), { tipo: 'Reboque/Carreta' });
  assert.deepEqual(classeParaFiltros('motorizados'), {});
  assert.equal(lerFiltrosDaUrl({ aba: 'placas', classe: 'reboques' }).tipo, 'Reboque/Carreta');
  assert.equal(lerFiltrosDaUrl({ classe: 'motorizados' }).tipo, '');
  assert.equal(lerFiltrosDaUrl({ classe: 'reboques', tipo: 'Caminhão' }).tipo, 'Caminhão');
  assert.equal(ehCentralDeFrota('veiculos', { aba: 'placas', classe: 'reboques', salvo: '1' }), true);
  assert.equal(ehCentralDeFrota('veiculos', { aba: 'marcas' }), false);
  assert.equal(ehCentralDeFrota('pessoas', {}), false);
});
