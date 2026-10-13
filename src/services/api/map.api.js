import { requisitar } from '@/services/api/http.js';

/**
 * Mapa Operacional (contrato docs/specs/mapa-operacional-contrato.md).
 * Leitura apenas: o painel não escreve etapas/posições por aqui.
 */
export const mapaService = {
    /**
     * @param {{ filial_id?: number, status?: string, motorista?: string, placa?: string, q?: string, somente_ativos?: number }} filtros
     */
    manifestos(filtros = {}) {
        return requisitar((http) => http.get('/mapa/manifestos', { params: filtros }));
    },

    /** Estado completo do manifesto: etapas, rota, trajeto, posições, ocorrências, pallets. */
    manifesto(id) {
        return requisitar((http) => http.get(`/mapa/manifestos/${id}`));
    },
};

/** Contexto da portaria para um veículo/manifesto (Fila da portaria). */
export const portariaContextoService = {
    /** @param {{ placa?: string, manifesto_id?: number }} params */
    contexto(params) {
        return requisitar((http) => http.get('/portaria/contexto', { params }));
    },
};
