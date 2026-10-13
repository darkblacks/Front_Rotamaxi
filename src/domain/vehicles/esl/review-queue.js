/** Lógica pura da fila de revisão (modal) da importação ESL. Sem I/O, sem gravação. */

/** Quais campos ainda exigem decisão humana nesta placa. `item` = linha editável do CSV. */
export function camposPendentes(row, item = {}) {
  const r = row || {};
  const marcaOk = Boolean(item.marca_id || r.marca_id);
  const modeloOk = Boolean(item.modelo_id);
  const revisar = r.acao === 'revisar';
  const candidatos = Array.isArray(r.prestador_ambiguos) ? r.prestador_ambiguos : [];
  return {
    marca: revisar && !marcaOk,
    modelo: revisar && !modeloOk,
    // undefined = ninguém decidiu ainda; null = "Não vincular" decidido.
    prestador: r.prestador_classe === 'possivel_duplicado' && candidatos.length > 0 && item.prestador_servico_id === undefined,
  };
}

export function precisaRevisao(row, item = {}, ignorada = false) {
  if (ignorada) return false;
  const c = camposPendentes(row, item);
  return c.marca || c.modelo || c.prestador;
}

/** Números de linha (estáveis) das placas pendentes, na ordem da prévia. */
export function montarFila(preview, itemDe, ehIgnorada) {
  return (preview || []).filter(r => precisaRevisao(r, itemDe(r), ehIgnorada(r))).map(r => r.linha);
}

/**
 * Próxima posição da fila (snapshot) depois de `atual`, pulando as que já foram
 * resolvidas/ignoradas. Se nada resta à frente, procura antes. Retorna null se não há mais.
 */
export function proximoIndice(fila, atual, ehPendente) {
  for (let i = atual + 1; i < fila.length; i++) if (ehPendente(fila[i])) return i;
  for (let i = 0; i < atual && i < fila.length; i++) if (ehPendente(fila[i])) return i;
  return null;
}

/** Melhor candidato válido: o sugerido pela API se estiver na lista; senão o primeiro. */
export function melhorCandidatoPrestador(row) {
  const lista = Array.isArray(row?.prestador_ambiguos) ? row.prestador_ambiguos : [];
  if (!lista.length) return null;
  const sug = lista.find(p => Number(p.id) === Number(row.prestador_sugerido_id));
  return sug || lista[0];
}

export function rotuloProgresso(indice, total) {
  return `Placa ${indice + 1} de ${total}`;
}
