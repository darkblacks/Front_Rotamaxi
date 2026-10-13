/**
 * Três estados independentes: Serviço (DEMANDA/EMPENHADO/EM_EXECUCAO/CONCLUIDO), Manifesto
 * (status do manifesto) e Carga a bordo (pallets no veículo). Um não deriva do outro: uma
 * COLETA pode estar CONCLUÍDA com o manifesto ainda em execução.
 */
import { STATUS_DO_SERVICO } from './services.js';

export function badgeDoServico(servico) {
    const info = STATUS_DO_SERVICO[servico?.status];
    return { rotulo: info?.rotulo ?? (servico?.status ? String(servico.status) : '—'), tom: info?.tom ?? 'neutro' };
}

export function badgeDoManifesto(manifesto) {
    const status = manifesto?.status;
    return { rotulo: status ? String(status).replaceAll('_', ' ') : '—', tom: 'info' };
}

/**
 * Pallets a bordo do detalhe do manifesto (campo novo do backend; tolera ausência).
 * @returns {number|null} null quando o backend não informou
 */
export function cargaABordo(detalhe) {
    const candidatos = [
        detalhe?.carga?.a_bordo,
        detalhe?.pallets_a_bordo,
        detalhe?.manifesto?.carga?.a_bordo,
        detalhe?.manifesto?.pallets_a_bordo,
    ];
    const valor = candidatos.find((v) => v !== undefined && v !== null && v !== '');
    const n = Number(valor);
    return valor === undefined || !Number.isFinite(n) ? null : n;
}

export function textoDaCarga(detalhe) {
    const n = cargaABordo(detalhe);
    return n === null ? 'Carga a bordo: —' : `Carga a bordo: ${n} pallet${n === 1 ? '' : 's'}`;
}

/** Serviços ligados a uma etapa (`etapa_id`), cada um com o status próprio. */
export function servicosDaEtapa(servicos, etapaId) {
    return (servicos ?? []).filter((s) => s.etapa_id === etapaId);
}
