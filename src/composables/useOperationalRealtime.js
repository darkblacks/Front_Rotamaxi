import { onMounted, onUnmounted, watch } from 'vue';
import { agrupar } from '@/services/realtime/realtime.service.js';
import { EVENTOS_OPERACIONAIS, assinarOperacao, chaveDosCanais } from '@/services/realtime/operational.js';
import { useTempoRealStore } from '@/stores/realtime.store.js';

/** Fallback quando o socket está fora: nunca menor que 30s (mesma regra do mapa). */
export const INTERVALO_FALLBACK_MS = 30000;

/**
 * Liga uma tela de lista ao tempo real operacional.
 *
 * - assina `alvo()` (filiais/manifestos/ocorrências) e reassina quando o conjunto muda ou a
 *   conexão sobe depois da montagem;
 * - qualquer evento chama `aoEvento(nome, payload)` e depois `recarregar()` agrupado (800ms);
 * - reconexão recarrega; com o socket fora, recarrega a cada 30s.
 *
 * @param {{ alvo: () => object, recarregar: () => any, aoEvento?: (nome: string, payload: object) => (void|false), eventos?: string[] }} opcoes
 */
export function useOperationalRealtime({ alvo, recarregar, aoEvento, eventos = EVENTOS_OPERACIONAIS }) {
    const tempoReal = useTempoRealStore();
    const recarregarAgrupado = agrupar(() => recarregar(), 800);

    let cancelar = null;
    let chaveAtual = null;
    let pararReconexao = null;
    let fallback = null;

    function tratar(nome, payload) {
        // `aoEvento` devolvendo false trata o delta sozinho e dispensa a releitura.
        if (aoEvento?.(nome, payload) === false) return;
        recarregarAgrupado();
    }

    function sincronizar(forcar = false) {
        const atual = alvo();
        const chave = chaveDosCanais(atual);
        if (!forcar && chave === chaveAtual) return;
        cancelar?.();
        cancelar = assinarOperacao(tempoReal, atual, tratar, eventos);
        chaveAtual = chave;
    }

    onMounted(() => {
        sincronizar(true);
        pararReconexao = tempoReal.aoReconectar(() => recarregar());
        fallback = setInterval(() => {
            if (!tempoReal.conectado) recarregar();
        }, INTERVALO_FALLBACK_MS);
    });

    onUnmounted(() => {
        cancelar?.();
        pararReconexao?.();
        if (fallback !== null) clearInterval(fallback);
    });

    watch(() => chaveDosCanais(alvo()), () => sincronizar());
    // A conexão pode subir depois da montagem: assinar sem Echo é no-op, então refaz.
    watch(() => tempoReal.conectado, (conectado) => {
        if (conectado) sincronizar(true);
    });
}
