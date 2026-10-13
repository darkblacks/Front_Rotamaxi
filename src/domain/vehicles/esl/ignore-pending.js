/** Ações de revisão do ESL que precisam ser resolvidas ou ignoradas antes da gravação. */
const ACOES_PENDENTES = new Set(['revisar', 'conflito', 'invalida', 'duplicada', 'sem_cadastro']);
const placaNormalizada = valor => String(valor ?? '').trim();

/**
 * Reúne todas as placas com pendência aberta em TODAS as páginas da prévia.
 * Inclui ausência de versão FIPE apenas quando ela está sendo exigida.
 * Nunca inclui placas previamente ignoradas nem veículos já aptos a importar.
 */
export function placasPendentesParaIgnorar(preview = [], linhas = [], ignoradas = [], exigirFipe = true) {
  const jaIgnoradas = new Set(ignoradas.map(placaNormalizada));
  const encontradas = new Set();
  for (const registro of preview) {
    const placa = placaNormalizada(registro.placa);
    if (!placa || jaIgnoradas.has(placa)) continue;
    const linha = linhas[Number(registro.linha) - 1] || {};
    const fipePendente = exigirFipe && registro.acao === 'criar' && !!registro.fipe_tipo &&
      !!registro.ano_modelo && !linha.fipe_ano_codigo;
    if (ACOES_PENDENTES.has(registro.acao) || fipePendente) encontradas.add(placa);
  }
  return [...encontradas];
}

/** Preserva todas as placas já ignoradas e adiciona as novas sem duplicá-las. */
export function adicionarPlacasIgnoradas(ignoradas = [], placas = []) {
  return [...new Set([...ignoradas, ...placas].map(placaNormalizada).filter(Boolean))];
}

/** Desfaz somente o último lote; ignoradas individualmente antes dele são mantidas. */
export function desfazerIgnoradasEmLote(ignoradas = [], adicionadasNoLote = []) {
  const desfazer = new Set(adicionadasNoLote.map(placaNormalizada));
  return ignoradas.filter(placa => !desfazer.has(placaNormalizada(placa)));
}
