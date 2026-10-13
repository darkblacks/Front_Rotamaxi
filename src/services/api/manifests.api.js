import { requisitar } from '@/services/api/http.js';

/**
 * Endpoints das telas de manifesto do painel (US-9.3, US-8.4, US-7.5).
 *
 * A lista é paginada pelo servidor: a tela pede uma página por vez e nunca recorta a
 * operação inteira no cliente. O detalhe chega por dois endpoints de propósitos diferentes
 * — o que reúne paradas, conferências e divergências, e o que reconstrói a linha do tempo
 * com o trajeto — e a tela os pede em paralelo.
 */
export const manifestoService = {
    /**
     * Página de manifestos do recorte.
     *
     * @param {{ status?: string|null, filial_id?: number|null, de?: string|null, ate?: string|null, page?: number, per_page?: number }} filtros
     */
    lista(filtros = {}) {
        return requisitar((http) => http.get('/manifestos', { params: filtros }));
    },

    /**
     * Manifesto inteiro: paradas com carimbos, conferências da portaria, divergências e
     * retorno à filial.
     *
     * @param {number|string} id
     */
    detalhe(id) {
        return requisitar((http) => http.get(`/admin/manifestos/${id}`));
    },

    /**
     * Linha do tempo do manifesto — eventos, conferências, divergências e anexos em ordem
     * de `ocorrido_em` — mais a série de posições do trajeto.
     *
     * @param {number|string} id
     */
    linhaDoTempo(id) {
        return requisitar((http) => http.get(`/admin/manifestos/${id}/linha-do-tempo`));
    },

    /**
     * Motoristas ativos que podem assumir um manifesto — o seletor da reatribuição
     * (US-8.7).
     */
    motoristas() {
        return requisitar((http) => http.get('/admin/motoristas'));
    },

    /**
     * Troca o motorista do manifesto. A justificativa é obrigatória: reatribuir é ato
     * administrativo e fica registrado com autor, data/hora e motivo.
     *
     * Manifesto `fechado` responde 403 pela policy, antes de qualquer validação.
     *
     * @param {number|string} id
     * @param {{ motorista_id: number, justificativa: string }} payload
     */
    reatribuir(id, payload) {
        return requisitar((http) => http.post(`/admin/manifestos/${id}/reatribuicao`, payload));
    },

    /**
     * URL assinada de leitura de um anexo, pedida **sob demanda**: a validade é curta, e
     * assinar tudo na abertura da tela entregaria URL vencida para a miniatura que ninguém
     * abriu.
     *
     * @param {number|string} id
     */
    urlDeAnexo(id) {
        return requisitar((http) => http.get(`/anexos/${id}/url`));
    },
};
