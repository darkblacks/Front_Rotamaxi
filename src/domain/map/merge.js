import { mesclarPosicao, acrescentarAoTrajeto } from './positions.js';

/** Eventos realtime do canal manifesto.{id} (nomes literais; o Echo os recebe com prefixo '.'). */
export const EVENTOS_DO_MANIFESTO = [
    'tracking.position.updated',
    'manifest.route.updated',
    'manifest.stop.status_changed',
    'manifest.eta.updated',
    'manifest.delay.detected',
    'manifest.occurrence.created',
];

/** Eventos que o cliente não aplica sozinho (geometria nova etc.): exigem refazer o GET. */
export const EVENTOS_QUE_RELEEM = ['manifest.route.updated'];

function mapearEtapa(etapas, id, fn) {
    return (etapas ?? []).map((e) => (e.id === id ? fn(e) : e));
}

/**
 * Aplica um delta ao detalhe completo (`data` do GET /mapa/manifestos/{id}).
 * Retorna novo objeto; nunca muta. Evento desconhecido devolve o mesmo detalhe.
 */
export function aplicarDelta(detalhe, nome, p) {
    if (!detalhe || !p) return detalhe;
    switch (nome) {
        case 'tracking.position.updated': {
            const posicoes = mesclarPosicao(detalhe.posicoes, p);
            if (posicoes === detalhe.posicoes) return detalhe;
            const tipo = p.object_type;
            const trajeto = { vehicle: null, phone: null, ...(detalhe.trajeto ?? {}) };
            trajeto[tipo] = acrescentarAoTrajeto(trajeto[tipo], p);
            return { ...detalhe, posicoes, trajeto };
        }
        case 'manifest.stop.status_changed': {
            const campos = {};
            ['status', 'eta', 'atraso_minutos', 'chegada_real', 'saida_real', 'motivo'].forEach((k) => {
                if (p[k] !== undefined) campos[k] = p[k];
            });
            return { ...detalhe, etapas: mapearEtapa(detalhe.etapas, p.etapa_id, (e) => ({ ...e, ...campos })) };
        }
        case 'manifest.eta.updated':
        case 'manifest.delay.detected':
            return {
                ...detalhe,
                etapas: mapearEtapa(detalhe.etapas, p.etapa_id, (e) => ({
                    ...e,
                    eta: p.eta ?? e.eta,
                    janela_fim: p.janela_fim ?? e.janela_fim,
                    atraso_minutos: p.atraso_minutos ?? e.atraso_minutos,
                })),
            };
        case 'manifest.occurrence.created': {
            const ocorrencia = p.ocorrencia ?? p;
            if (ocorrencia?.id === undefined) return detalhe;
            const lista = (detalhe.ocorrencias ?? []).filter((o) => o.id !== ocorrencia.id);
            return { ...detalhe, ocorrencias: [ocorrencia, ...lista] };
        }
        default:
            return detalhe;
    }
}
