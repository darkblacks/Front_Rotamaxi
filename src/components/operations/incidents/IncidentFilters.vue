<script setup>
import FiltroDeFilial from '@/components/all/filters/BranchFilter.vue';
import { PERIODOS_DE_OCORRENCIA } from '@/stores/incidents.store.js';

/**
 * Período e filial da tela 05, como o design os oferece: três botões de janela — hoje, 7
 * dias e 30 dias — e o seletor de filial.
 *
 * O componente não guarda estado: emite o recorte pedido e quem manda é a URL.
 */
const props = defineProps({
    filtros: { type: Object, required: true },
    filiais: { type: Array, default: () => [] },
});

const emit = defineEmits(['aplicar']);

const periodos = PERIODOS_DE_OCORRENCIA;

function aplicar(mudanca) {
    emit('aplicar', { ...props.filtros, ...mudanca });
}
</script>

<template>
    <div class="filtros">
        <div class="filtros__periodos" role="group" aria-label="Período">
            <button
                v-for="periodo in periodos"
                :key="periodo.chave"
                type="button"
                class="filtros__periodo"
                :class="{ 'filtros__periodo--ativo': filtros.periodo === periodo.chave }"
                :data-periodo="periodo.chave"
                :aria-pressed="filtros.periodo === periodo.chave ? 'true' : 'false'"
                @click="aplicar({ periodo: periodo.chave })"
            >
                {{ periodo.rotulo }}
            </button>
        </div>

        <FiltroDeFilial
            :filial-id="filtros.filialId"
            :filiais="filiais"
            @aplicar="(filialId) => aplicar({ filialId })"
        />
    </div>
</template>

<style scoped src="@/styles/components/operations/incidents/incident_filters.css"></style>
