import { requisitar } from '@/services/api/http.js';

/** Planejamento (contrato V2): lookups reais, serviços (demanda/empenho) e montagem de manifesto. */

/** Lookups podem vir como `[..]` ou `{data:[..]}`. */
export function listaDe(dados) {
    if (Array.isArray(dados)) return dados;
    return Array.isArray(dados?.data) ? dados.data : [];
}

export const lookupService = {
    veiculos(q = '') {
        return requisitar((http) => http.get('/mapa/lookups/veiculos', { params: { q } }));
    },
    motoristas(q = '') {
        return requisitar((http) => http.get('/mapa/lookups/motoristas', { params: { q } }));
    },
    pontos(q = '', natureza = null) {
        return requisitar((http) => http.get('/mapa/lookups/pontos', { params: { q, ...(natureza ? { natureza } : {}) } }));
    },
    clientes(q = '') {
        return requisitar((http) => http.get('/mapa/lookups/clientes', { params: { q } }));
    },
    /** Grava lat/lng no cadastro mestre do ponto (auditado). */
    coordenadas(kind, id, { latitude, longitude }) {
        return requisitar((http) => http.patch(`/mapa/lookups/pontos/${kind}/${id}/coordenadas`, { latitude, longitude }));
    },
};

export const servicosService = {
    listar(filtros = {}) {
        return requisitar((http) => http.get('/mapa/servicos', { params: filtros }));
    },
    criar(payload) {
        return requisitar((http) => http.post('/mapa/servicos', payload));
    },
    empenhar(id, manifestoId, ordem = null) {
        return requisitar((http) => http.post(`/mapa/servicos/${id}/empenhar`, { manifesto_id: manifestoId, ...(ordem ? { ordem } : {}) }));
    },
    desempenhar(id) {
        return requisitar((http) => http.post(`/mapa/servicos/${id}/desempenhar`));
    },
};

export const montagemService = {
    criar(payload) {
        return requisitar((http) => http.post('/mapa/manifestos', payload));
    },
    atualizar(id, payload) {
        return requisitar((http) => http.patch(`/mapa/manifestos/${id}`, payload));
    },
    salvarEtapas(id, payload) {
        return requisitar((http) => http.put(`/mapa/manifestos/${id}/etapas`, payload));
    },
    /** Reordena os serviços empenhados (e, por derivação, as etapas e a rota). */
    ordenarServicos(id, servicoIds) {
        return requisitar((http) => http.put(`/mapa/manifestos/${id}/servicos/ordem`, { servico_ids: servicoIds }));
    },
    recalcularRota(id) {
        return requisitar((http) => http.post(`/mapa/manifestos/${id}/rota/recalcular`));
    },
    liberar(id) {
        return requisitar((http) => http.post(`/mapa/manifestos/${id}/liberar`));
    },
};
