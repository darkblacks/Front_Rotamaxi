/**
 * Regras puras de atraso/ETA do Mapa Operacional.
 * Atraso = max(0, ETA - janela_fim). O servidor manda `atraso_minutos`; quando só
 * há eta + janela_fim, o cliente calcula o mesmo valor.
 */

export const NIVEIS_DE_ATRASO = [
    { minimo: 60, nivel: 'critico', tom: 'bad', rotulo: 'Crítico' },
    { minimo: 30, nivel: 'risco', tom: 'bad', rotulo: 'Risco' },
    { minimo: 15, nivel: 'atencao', tom: 'warn', rotulo: 'Atenção' },
];

/** Minutos de atraso a partir de ETA e fim da janela (ISO). Nulo se faltar dado. */
export function atrasoEmMinutos(eta, janelaFim) {
    if (!eta || !janelaFim) return null;
    const a = new Date(eta).getTime();
    const b = new Date(janelaFim).getTime();
    if (Number.isNaN(a) || Number.isNaN(b)) return null;
    return Math.max(0, Math.round((a - b) / 60000));
}

/** Prefere o valor do servidor; senão calcula. */
export function atrasoDaEtapa(etapa) {
    if (!etapa) return 0;
    if (typeof etapa.atraso_minutos === 'number') return Math.max(0, etapa.atraso_minutos);
    return atrasoEmMinutos(etapa.eta, etapa.janela_fim) ?? 0;
}

/** "1h 20min", "45min", "2h". */
export function formatarAtraso(minutos) {
    if (typeof minutos !== 'number' || Number.isNaN(minutos) || minutos <= 0) return '0min';
    const m = Math.round(minutos);
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (h === 0) return `${r}min`;
    return r === 0 ? `${h}h` : `${h}h ${r}min`;
}

export function textoDeAtrasoPrevisto(minutos) {
    return `Atraso previsto: ${formatarAtraso(minutos)}`;
}

/** Nível (atenção/risco/crítico) ou null abaixo de 15 min. */
export function nivelDeAtraso(minutos) {
    if (typeof minutos !== 'number') return null;
    return NIVEIS_DE_ATRASO.find((n) => minutos >= n.minimo) ?? null;
}
