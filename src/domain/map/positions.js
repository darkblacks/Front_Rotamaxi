/** Posições de veículo e celular: entidades independentes, merge de deltas e idade do sinal. */

/** Acima disso o sinal é considerado offline (não "parado"). */
export const LIMITE_OFFLINE_S = 300;
/** Velocidade (km/h) abaixo da qual, com sinal vivo, está parado. */
export const LIMITE_PARADO_KMH = 2;

export function posicaoValida(p) {
    return !!p && p.latitude != null && p.longitude != null
        && Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude));
}

/** Idade em segundos, a partir de recorded_at (relógio local) ou `idade_s` do servidor. */
export function idadeDoSinal(pos, agora = Date.now()) {
    if (!pos) return null;
    const ref = pos.recorded_at ?? pos.received_at;
    if (ref) {
        const t = new Date(ref).getTime();
        if (!Number.isNaN(t)) return Math.max(0, Math.round((agora - t) / 1000));
    }
    return typeof pos.idade_s === 'number' ? pos.idade_s : null;
}

export function formatarIdade(segundos) {
    if (segundos === null || segundos === undefined) return 'sem sinal';
    if (segundos < 60) return `há ${segundos}s`;
    const m = Math.floor(segundos / 60);
    if (m < 60) return `há ${m}min`;
    const h = Math.floor(m / 60);
    return `há ${h}h${String(m % 60).padStart(2, '0')}`;
}

/** 'sem_sinal' | 'offline' | 'parado' | 'em_movimento'. Offline ≠ parado. */
export function estadoDoSinal(pos, agora = Date.now()) {
    if (!posicaoValida(pos)) return 'sem_sinal';
    const idade = idadeDoSinal(pos, agora);
    if (idade === null || idade > LIMITE_OFFLINE_S) return 'offline';
    return Number(pos.speed ?? 0) < LIMITE_PARADO_KMH ? 'parado' : 'em_movimento';
}

export const ROTULO_DO_SINAL = {
    sem_sinal: 'Sem sinal',
    offline: 'Offline',
    parado: 'Parado',
    em_movimento: 'Em movimento',
};

/**
 * Aplica uma posição em `{vehicle, phone}` sem misturar os dois tipos e sem regredir:
 * evento com recorded_at mais antigo que o atual é descartado.
 */
export function mesclarPosicao(posicoes, evento) {
    const atual = posicoes ?? { vehicle: null, phone: null };
    const tipo = evento?.object_type;
    if ((tipo !== 'vehicle' && tipo !== 'phone') || !posicaoValida(evento)) return atual;
    const anterior = atual[tipo];
    if (anterior?.recorded_at && evento.recorded_at
        && new Date(evento.recorded_at) < new Date(anterior.recorded_at)) {
        return atual;
    }
    return { ...atual, [tipo]: evento };
}

/** Acrescenta o ponto ao trajeto realizado (LineString), evitando duplicar o último. */
export function acrescentarAoTrajeto(linha, pos) {
    if (!posicaoValida(pos)) return linha ?? null;
    const ponto = [Number(pos.longitude), Number(pos.latitude)];
    const coords = linha?.coordinates ? [...linha.coordinates] : [];
    const ultimo = coords[coords.length - 1];
    if (ultimo && ultimo[0] === ponto[0] && ultimo[1] === ponto[1]) return linha;
    coords.push(ponto);
    return { type: 'LineString', coordinates: coords };
}
