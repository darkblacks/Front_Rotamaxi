<script setup>
import { computed } from 'vue';
import { horaCurta } from '@/utils/format.js';
import { nivelDeAtraso, textoDeAtrasoPrevisto } from '@/domain/map/delay.js';

/** Destaque de alerta: ETA > fim da janela => "Atraso previsto: Xh Ymin". */
const props = defineProps({
    // { etapa, atraso } vindo da store, ou null quando não há atraso.
    alerta: { type: Object, default: null },
});

const nivel = computed(() => nivelDeAtraso(props.alerta?.atraso));
</script>

<template>
    <div
        v-if="alerta"
        class="alerta"
        :class="`alerta--${nivel?.nivel ?? 'leve'}`"
        role="alert"
        data-alerta="atraso"
    >
        <strong class="alerta__titulo">{{ textoDeAtrasoPrevisto(alerta.atraso) }}</strong>
        <span class="alerta__texto">
            {{ alerta.etapa.ordem }}. {{ alerta.etapa.nome }} · ETA {{ horaCurta(alerta.etapa.eta) }}
            · janela até {{ horaCurta(alerta.etapa.janela_fim) }}
        </span>
        <span v-if="nivel" class="alerta__nivel">{{ nivel.rotulo }}</span>
    </div>
    <div v-else class="alerta alerta--ok" data-alerta="ok">
        <strong class="alerta__titulo">Sem atraso previsto</strong>
        <span class="alerta__texto">ETA dentro das janelas das etapas em aberto.</span>
    </div>
</template>

<style scoped src="@/styles/components/operations/map/map_panels.css"></style>
