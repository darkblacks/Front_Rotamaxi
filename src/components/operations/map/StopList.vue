<script setup>
import StatusBadge from '@/components/all/ui/StatusBadge.vue';
import { badgeDoServico, servicosDaEtapa } from '@/domain/planning/status.js';
import { localDoServico, rotuloDoTipo, tipoDoServico } from '@/domain/planning/services.js';
import { horaCurta } from '@/utils/format.js';
import { atrasoDaEtapa, formatarAtraso, nivelDeAtraso } from '@/domain/map/delay.js';
import { corHexDaEtapa, ROTULO_DO_PAPEL, ROTULO_DO_STATUS, TOM_DO_STATUS } from '@/domain/map/stages.js';

/** Lista ordenada das etapas: ordem, papel, status, janela, ETA e atraso. */
defineProps({
    etapas: { type: Array, default: () => [] },
    selecionadaId: { type: [Number, String], default: null },
    // Serviços do manifesto: cada um mostra o PRÓPRIO status (coleta pode estar concluída com o manifesto em execução).
    servicos: { type: Array, default: () => [] },
});

const emit = defineEmits(['selecionar']);

function janela(e) {
    if (!e.janela_inicio && !e.janela_fim) return 'sem janela';
    return `${horaCurta(e.janela_inicio)} – ${horaCurta(e.janela_fim)}`;
}

function atraso(e) {
    const minutos = atrasoDaEtapa(e);
    return minutos > 0 && !['CONCLUIDA', 'PULADA', 'CANCELADA'].includes(e.status) ? minutos : 0;
}
</script>

<template>
    <ol class="paradas">
        <li v-for="e in etapas" :key="e.id">
            <button
                type="button"
                class="parada"
                :class="{ 'parada--ativa': e.id === selecionadaId }"
                :data-etapa="e.id"
                @click="emit('selecionar', e.id)"
            >
                <span class="parada__ordem" :style="{ background: corHexDaEtapa(e) }">{{ e.ordem }}</span>
                <span class="parada__corpo">
                    <span class="parada__nome">{{ e.nome ?? 'Etapa' }}</span>
                    <span class="parada__meta">
                        {{ ROTULO_DO_PAPEL[e.papel] ?? e.papel }} · janela {{ janela(e) }}
                    </span>
                    <span class="parada__meta">
                        ETA {{ e.eta ? horaCurta(e.eta) : '—' }}
                        <strong
                            v-if="atraso(e) > 0"
                            class="parada__atraso"
                            :class="`parada__atraso--${nivelDeAtraso(atraso(e))?.nivel ?? 'leve'}`"
                        >atraso {{ formatarAtraso(atraso(e)) }}</strong>
                    </span>
                    <span v-for="sv in servicosDaEtapa(servicos, e.id)" :key="sv.id" class="parada__servico" :data-servico="sv.id">
                        {{ rotuloDoTipo(tipoDoServico(sv)) }}<template v-if="localDoServico(sv)?.nome"> · {{ localDoServico(sv).nome }}</template>
                        <StatusBadge :rotulo="`Serviço: ${badgeDoServico(sv).rotulo}`" :tom="badgeDoServico(sv).tom" />
                    </span>
                </span>
                <StatusBadge :rotulo="ROTULO_DO_STATUS[e.status] ?? e.status" :tom="TOM_DO_STATUS[e.status] ?? 'neutro'" />
            </button>
        </li>
    </ol>
</template>

<style scoped src="@/styles/components/operations/map/map_panels.css"></style>
