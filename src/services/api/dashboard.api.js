import { requisitar } from '@/services/api/http.js';

/**
 * Endpoints que a tela de visão geral consome (US-9.3, US-8.3, US-8.6).
 *
 * Os números vêm sempre do servidor: o painel não soma linha de detalhe para chegar a um
 * total, porque o recorte de período e filial já foi aplicado na consulta que gerou o
 * agregado — repetir a conta no cliente daria dois significados para o mesmo número.
 */
export const dashboardService = {
    /**
     * Agregados do recorte: manifestos, entregas, ocorrências, canhotos, pallets e
     * divergências do período e da filial pedidos.
     *
     * @param {{ de?: string|null, ate?: string|null, filial_id?: number|null }} filtros
     */
    agregados(filtros = {}) {
        return requisitar((http) => http.get('/admin/dashboard/agregados', { params: filtros }));
    },

    /**
     * As duas listas nominais de canhoto pendente: imagem que não subiu e papel que não
     * voltou à filial. O servidor as devolve separadas, e a tela as mantém separadas.
     *
     * @param {{ de?: string|null, ate?: string|null, filial_id?: number|null }} filtros
     */
    canhotosPendentes(filtros = {}) {
        return requisitar((http) => http.get('/admin/dashboard/canhotos-pendentes', { params: filtros }));
    },

    /**
     * Extrato de pallets de um cliente, movimento a movimento, com o acumulado linha a
     * linha (US-8.5).
     *
     * O período recorta as **linhas**, nunca o saldo: o que aconteceu antes de `de` volta
     * como `saldo_anterior`, e é dele que o acumulado da primeira linha continua.
     *
     * @param {number|string} pessoaId
     * @param {{ de?: string|null, ate?: string|null }} filtros
     */
    extratoDePallets(pessoaId, filtros = {}) {
        return requisitar((http) => http.get(`/admin/dashboard/clientes/${pessoaId}/pallets`, { params: filtros }));
    },

    /**
     * Notas que receberam um código de ocorrência, no mesmo recorte da tabela por código
     * (US-8.3). É o destino do clique na linha da tela 05.
     *
     * @param {{ codigo: string, de?: string|null, ate?: string|null, filial_id?: number|null, page?: number, per_page?: number }} filtros
     */
    ocorrenciasPorCodigo(filtros = {}) {
        return requisitar((http) => http.get('/admin/dashboard/ocorrencias', { params: filtros }));
    },

    /**
     * Divergências do recorte, da mais recente para a mais antiga.
     *
     * @param {{ status?: string, de?: string|null, ate?: string|null, filial_id?: number|null, per_page?: number }} filtros
     */
    divergencias(filtros = {}) {
        return requisitar((http) => http.get('/divergencias', { params: filtros }));
    },

    /**
     * Registro **manual** de divergência pelo admin: a diferença que não passou pelo portão
     * (US-8.2). A divergência da conferência continua nascendo sozinha.
     *
     * @param {{ manifesto_id: number, tipo: string, valor_esperado?: number|null, valor_declarado?: number|null, valor_conferido?: number|null, justificativa: string }} payload
     */
    registrarDivergencia(payload) {
        return requisitar((http) => http.post('/divergencias', payload));
    },

    /**
     * Justifica ou resolve uma divergência. A justificativa é obrigatória em qualquer
     * decisão, inclusive na reabertura.
     *
     * @param {number|string} id
     * @param {{ status: string, justificativa: string }} decisao
     */
    decidirDivergencia(id, decisao) {
        return requisitar((http) => http.put(`/divergencias/${id}`, decisao));
    },

    /**
     * Uma divergência com os três números e a trilha de decisões — o destino do link do
     * cartão "Divergências abertas".
     *
     * @param {number|string} id
     */
    divergencia(id) {
        return requisitar((http) => http.get(`/divergencias/${id}`));
    },
};
