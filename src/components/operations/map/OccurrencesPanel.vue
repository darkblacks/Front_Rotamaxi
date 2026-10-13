<script setup>
import StatusBadge from '@/components/all/ui/StatusBadge.vue';
import EmptyState from '@/components/all/ui/EmptyState.vue';
import { dataEHora } from '@/utils/format.js';
import { formatarAtraso } from '@/domain/map/delay.js';

/** Ocorrências SAQ do manifesto (automáticas e manuais). */
defineProps({
    ocorrencias: { type: Array, default: () => [] },
});

const TOM = { atencao: 'warn', risco: 'bad', critico: 'bad' };
const ROTULO = { atencao: 'Atenção', risco: 'Risco', critico: 'Crítico' };

function titulo(tipo) {
    return String(tipo ?? 'ocorrência').replaceAll('_', ' ');
}
</script>

<template>
    <EmptyState v-if="ocorrencias.length === 0" mensagem="Nenhuma ocorrência neste manifesto." tracejado />
    <ul v-else class="ocorrencias">
        <li v-for="o in ocorrencias" :key="o.id" class="ocorrencia" :data-ocorrencia="o.id">
            <div class="ocorrencia__topo">
                <strong class="ocorrencia__tipo">{{ titulo(o.tipo) }}</strong>
                <StatusBadge :rotulo="ROTULO[o.severidade] ?? o.severidade ?? '—'" :tom="TOM[o.severidade] ?? 'neutro'" />
            </div>
            <p v-if="o.descricao" class="ocorrencia__texto">{{ o.descricao }}</p>
            <span class="ocorrencia__meta">
                {{ o.origem === 'auto' ? 'automática' : 'manual' }} · {{ o.status ?? 'aberta' }}
                <template v-if="o.atraso_minutos"> · atraso {{ formatarAtraso(o.atraso_minutos) }}</template>
                <template v-if="o.created_at"> · {{ dataEHora(o.created_at) }}</template>
            </span>
        </li>
    </ul>
</template>

<style scoped src="@/styles/components/operations/map/map_panels.css"></style>
