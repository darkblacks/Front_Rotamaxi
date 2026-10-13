/**
 * Assinaturas das telas dos executores (contrato V2): canais `filial.{id}`,
 * `manifesto.{id}` e `ocorrencias`, com os eventos operacionais. Não toca o fluxo do mapa:
 * só usa as mesmas funções `assinar*` da store de tempo real.
 */

export const EVENTOS_OPERACIONAIS = [
    'manifest.custody.changed',
    'manifest.conferencia.demanda',
    'manifest.portaria.registered',
    'manifest.reception.accepted',
    'manifest.occurrence.created',
    'manifest.occurrence.updated',
    'manifest.service.updated',
    'manifest.stop.status_changed',
    'manifest.closed',
];

/** Quantos canais de manifesto uma lista assina (a lista inteira não vira 200 sockets). */
export const LIMITE_DE_MANIFESTOS = 15;

/**
 * Canais desejados, sem repetição e com id válido.
 * @param {{ filialIds?: any[], manifestoIds?: any[], ocorrencias?: boolean }} alvo
 * @returns {{ tipo: 'filial'|'manifesto'|'ocorrencias', id: any }[]}
 */
export function canaisDesejados(alvo = {}) {
    const unico = (lista) => [...new Set((lista ?? []).filter((id) => id !== null && id !== undefined && id !== ''))];
    return [
        ...unico(alvo.filialIds).map((id) => ({ tipo: 'filial', id })),
        ...unico(alvo.manifestoIds).slice(0, LIMITE_DE_MANIFESTOS).map((id) => ({ tipo: 'manifesto', id })),
        ...(alvo.ocorrencias ? [{ tipo: 'ocorrencias', id: null }] : []),
    ];
}

/** Chave estável do conjunto de canais, para só reassinar quando o conjunto muda. */
export function chaveDosCanais(alvo) {
    return canaisDesejados(alvo).map((c) => `${c.tipo}:${c.id ?? ''}`).sort().join('|');
}

/** Mapa evento -> ouvinte que repassa `(nome, payload)` ao tratador da tela. */
export function ouvintesParaTodos(eventos, tratador) {
    const ouvintes = {};
    eventos.forEach((nome) => {
        ouvintes[nome] = (payload) => tratador(nome, payload ?? {});
    });
    return ouvintes;
}

/**
 * Assina todos os canais do alvo e devolve o cancelamento único.
 * @param {object} tempoReal  store `useTempoRealStore()`
 */
export function assinarOperacao(tempoReal, alvo, tratador, eventos = EVENTOS_OPERACIONAIS) {
    const cancelamentos = canaisDesejados(alvo).map(({ tipo, id }) => {
        const ouvintes = ouvintesParaTodos(eventos, tratador);
        if (tipo === 'filial') return tempoReal.assinarFilial(id, ouvintes);
        if (tipo === 'manifesto') return tempoReal.assinarManifesto(id, ouvintes);
        return tempoReal.assinarOcorrencias(ouvintes);
    });
    return () => cancelamentos.forEach((cancelar) => cancelar());
}
