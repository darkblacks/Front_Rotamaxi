<script setup>
import EstadoVazio from '@/components/all/ui/EmptyState.vue';

defineProps({
    // Linhas de `serieDeOcorrencias` da store da visão geral.
    linhas: { type: Array, default: () => [] },
    carregando: { type: Boolean, default: false },
});
</script>

<template>
    <div class="ocorrencias">
        <div v-if="carregando" class="ocorrencias__esqueleto" aria-hidden="true">
            <span v-for="linha in 5" :key="linha" class="ocorrencias__linha-esqueleto"></span>
        </div>

        <EstadoVazio
            v-else-if="linhas.length === 0"
            mensagem="Nenhuma ocorrência nos últimos 7 dias."
            tracejado
        />

        <div
            v-for="linha in linhas"
            v-else
            :key="linha.codigo"
            class="ocorrencias__linha"
            :data-ocorrencia="linha.codigo"
        >
            <div class="ocorrencias__rotulo">
                <span><b>{{ linha.codigo }}</b> {{ linha.descricao }}</span>
                <span class="ocorrencias__total">{{ linha.total }}</span>
            </div>
            <div class="ocorrencias__trilho">
                <div class="ocorrencias__fatia" :style="{ width: linha.largura }"></div>
            </div>
        </div>
    </div>
</template>

<style scoped src="@/styles/components/overview/incident_series.css"></style>
