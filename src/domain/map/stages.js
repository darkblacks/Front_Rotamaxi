/** Cor e rótulos das etapas. A cor vem da ETAPA (`cor`/`papel`), nunca do cadastro. */

export const COR_POR_NOME = {
    vermelho: '#d32f2f',
    azul: '#1a73e8',
    verde: '#1e8e3e',
    neutro: '#6b7685',
};

const COR_POR_PAPEL = { coleta: 'vermelho', ct: 'azul', distribuicao: 'verde' };

export const ROTULO_DO_PAPEL = {
    coleta: 'Coleta',
    ct: 'CT',
    distribuicao: 'Distribuição',
    base: 'Base',
    estacionamento: 'Estacionamento',
    outro: 'Outro',
};

export const ROTULO_DO_STATUS = {
    PENDENTE: 'Pendente',
    EM_ROTA: 'Em rota',
    CHEGOU: 'Chegou',
    EM_ATENDIMENTO: 'Em atendimento',
    CONCLUIDA: 'Concluída',
    PULADA: 'Pulada',
    CANCELADA: 'Cancelada',
};

export const TOM_DO_STATUS = {
    PENDENTE: 'neutro',
    EM_ROTA: 'info',
    CHEGOU: 'info',
    EM_ATENDIMENTO: 'warn',
    CONCLUIDA: 'ok',
    PULADA: 'neutro',
    CANCELADA: 'neutro',
};

export function nomeDaCor(etapa) {
    const cor = etapa?.cor;
    if (cor && COR_POR_NOME[cor]) return cor;
    return COR_POR_PAPEL[etapa?.papel] ?? 'neutro';
}

export function corHexDaEtapa(etapa) {
    return COR_POR_NOME[nomeDaCor(etapa)];
}

export function ordenarEtapas(etapas) {
    return [...(etapas ?? [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}

/** GeoJSON FeatureCollection dos pontos das etapas com coordenada válida. */
export function etapasParaGeoJSON(etapas) {
    const features = ordenarEtapas(etapas)
        .filter((e) => e.latitude != null && e.longitude != null
            && Number.isFinite(Number(e.latitude)) && Number.isFinite(Number(e.longitude)))
        .map((e) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [Number(e.longitude), Number(e.latitude)] },
            properties: { id: e.id, ordem: e.ordem, nome: e.nome, cor: corHexDaEtapa(e), status: e.status },
        }));
    return { type: 'FeatureCollection', features };
}
