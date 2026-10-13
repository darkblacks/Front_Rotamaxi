/**
 * Lista pequena de fabricantes: indexamos o catálogo de marcas no navegador para que
 * pesquisa/paginação usem todos os resultados, e não só 20 registros da página atual.
 * O backend permanece a fonte de dados (GET /admin/cadastros/marcas) e suporta 100/página.
 */
export const MARCAS_POR_PAGINA = 20;
export const MARCAS_POR_REQUISICAO = 100;

export function normalizarPesquisaMarca(valor) {
  return String(valor ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR').trim();
}

export async function listarTodasMarcas(listar, { limitePaginas = 50 } = {}) {
  const marcas = new Map();
  let pagina = 1;
  let ultimaPagina = 1;
  do {
    const resposta = await listar('marcas', { pagina, por_pagina: MARCAS_POR_REQUISICAO });
    if (!Array.isArray(resposta?.data)) throw new Error('A API não retornou a lista de marcas.');
    for (const marca of resposta.data) {
      if (marca?.id !== undefined && marca?.id !== null) marcas.set(String(marca.id), marca);
    }
    const paginasRetornadas = Number(resposta?.last_page ?? 1);
    ultimaPagina = Number.isFinite(paginasRetornadas) ? Math.max(1, Math.floor(paginasRetornadas)) : 1;
    if (pagina >= ultimaPagina) break;
    if (!resposta.data.length) throw new Error('A API retornou uma página vazia antes do fim das marcas.');
    pagina += 1;
    if (pagina > limitePaginas) throw new Error('A lista de marcas ultrapassou o limite seguro de páginas.');
  } while (pagina <= ultimaPagina);
  return [...marcas.values()].sort((a, b) => Number(b.id) - Number(a.id));
}

export function filtrarMarcas(marcas, { busca = '', status = 'todos' } = {}) {
  const termo = normalizarPesquisaMarca(busca);
  return (marcas || []).filter((marca) => {
    const ativo = marca.is_active ?? marca.ativo;
    if (status === 'ativo' && !(ativo === true || ativo === 1 || ativo === '1')) return false;
    if (status === 'inativo' && !(ativo === false || ativo === 0 || ativo === '0')) return false;
    return !termo || normalizarPesquisaMarca(marca.nome).includes(termo);
  });
}

export function paginarMarcas(marcasFiltradas, paginaSolicitada, porPagina = MARCAS_POR_PAGINA) {
  const total = marcasFiltradas.length;
  const ultimaPagina = Math.max(1, Math.ceil(total / porPagina));
  const paginaNumerica = Number(paginaSolicitada);
  const pagina = Math.max(1, Math.min(Number.isFinite(paginaNumerica) ? Math.floor(paginaNumerica) : 1, ultimaPagina));
  const inicio = (pagina - 1) * porPagina;
  return { registros: marcasFiltradas.slice(inicio, inicio + porPagina), total, pagina, ultimaPagina };
}
