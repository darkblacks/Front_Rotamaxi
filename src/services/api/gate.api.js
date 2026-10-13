import { requisitar } from '@/services/api/http.js';

/**
 * Endpoint da tela 03 Fila da portaria (US-9.3, US-4.1).
 *
 * A fila é a mesma que o porteiro enxerga no portão: o painel do admin a lê inteira, de
 * todas as filiais, e **só lê** — não existe endpoint de conferência aqui de propósito,
 * porque conferir é ato de quem está no portão.
 */
export const portariaService = {
    /**
     * Manifestos parados no portão, nos dois status da portaria.
     *
     * @param {{ filial_id?: number|null, busca?: string|null }} filtros
     */
    fila(filtros = {}) {
        return requisitar((http) => http.get('/portaria/fila', { params: filtros }));
    },
};
