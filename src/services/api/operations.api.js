import { requisitar } from '@/services/api/http.js';

/**
 * Telas dos executores (contrato V2, docs/specs/mapa-operacional-contrato-v2.md).
 * Cada grupo corresponde a um papel; o backend checa o papel em cada endpoint.
 */

/** Conferente (Coleta). */
export const conferenciaService = {
    /** @param {{ status?: 'aguardando'|'em_andamento'|'concluida' }} params */
    fila(params = {}) {
        return requisitar((http) => http.get('/mapa/conferencia/fila', { params }));
    },
    /** Campos parciais: equipe, pallets, tempos, observacoes. */
    registrar(etapaId, corpo) {
        return requisitar((http) => http.post(`/mapa/etapas/${etapaId}/conferencia`, corpo));
    },
    aceitar(etapaId, pallets) {
        return requisitar((http) => http.post(`/mapa/etapas/${etapaId}/conferencia/aceitar`, { pallets }));
    },
};

/** Cadeia de pallets (qualquer papel com acesso ao manifesto). */
export const palletsService = {
    cadeia(manifestoId) {
        return requisitar((http) => http.get(`/mapa/manifestos/${manifestoId}/pallets`));
    },
};

/** Motorista. */
export const motoristaService = {
    meuManifesto() {
        return requisitar((http) => http.get('/mapa/motorista/meu-manifesto'));
    },
    /** @param {{ ator: 'motorista'|'motorista_transferencia'|'motorista_distribuicao', quantidade: number }} p */
    aceitarPallets(etapaId, { ator, quantidade }) {
        return requisitar((http) => http.post(`/mapa/etapas/${etapaId}/pallets`, { tipo: 'aceito', ator, quantidade }));
    },
    statusDaEtapa(etapaId, corpo) {
        return requisitar((http) => http.post(`/mapa/etapas/${etapaId}/status`, corpo));
    },
    presignCanhoto(servicoId, corpo) {
        return requisitar((http) => http.post(`/mapa/servicos/${servicoId}/canhoto/presign`, corpo));
    },
    confirmarCanhoto(servicoId, anexoId) {
        return requisitar((http) => http.post(`/mapa/servicos/${servicoId}/canhoto/confirmar`, { anexo_id: anexoId }));
    },
    concluirServico(servicoId, corpo) {
        return requisitar((http) => http.post(`/mapa/servicos/${servicoId}/concluir`, corpo));
    },
};

/** Portaria: só registra (chegada/saída). Nunca aceite. */
export const portariaRegistroService = {
    chegada(corpo) {
        return requisitar((http) => http.post('/mapa/portaria/chegada', corpo));
    },
    saida(corpo) {
        return requisitar((http) => http.post('/mapa/portaria/saida', corpo));
    },
};

/** Equipe CT. */
export const recebimentoService = {
    /** @param {{ status?: 'aguardando'|'aceito'|'divergente' }} params */
    lista(params = {}) {
        return requisitar((http) => http.get('/mapa/recebimentos', { params }));
    },
    receber(manifestoId, corpo) {
        return requisitar((http) => http.post(`/mapa/manifestos/${manifestoId}/recebimento`, corpo));
    },
    aceitar(manifestoId, quantidade) {
        return requisitar((http) => http.post(`/mapa/manifestos/${manifestoId}/recebimento/aceitar`, { quantidade }));
    },
};

/** SAC / ocorrências do mapa. */
export const ocorrenciasMapaService = {
    lista(params = {}) {
        return requisitar((http) => http.get('/mapa/ocorrencias', { params }));
    },
    detalhe(id) {
        return requisitar((http) => http.get(`/mapa/ocorrencias/${id}`));
    },
    tratar(id, corpo) {
        return requisitar((http) => http.post(`/mapa/ocorrencias/${id}/tratar`, corpo));
    },
    criar(corpo) {
        return requisitar((http) => http.post('/mapa/ocorrencias', corpo));
    },
};

/**
 * PUT direto no storage assinado (sem Bearer, sem interceptores do painel), como o upload
 * de foto de pessoa. Devolve `{ ok, mensagem }`.
 */
export async function enviarParaUrlAssinada({ url, metodo = 'PUT', headers = {} }, arquivo) {
    try {
        const resposta = await fetch(url, { method: metodo, headers: { 'Content-Type': arquivo.type, ...headers }, body: arquivo });
        return resposta.ok
            ? { ok: true, mensagem: null }
            : { ok: false, mensagem: `O armazenamento recusou o arquivo (HTTP ${resposta.status}).` };
    } catch {
        return { ok: false, mensagem: 'Sem conexão com o armazenamento. Tente de novo.' };
    }
}
