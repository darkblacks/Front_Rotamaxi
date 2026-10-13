<script setup>
import EstadoVazio from '@/components/all/ui/EmptyState.vue';

/**
 * Cartão "Por filial" da tela 05: quantas ocorrências cada filial produziu no recorte e que
 * fatia do total elas são.
 *
 * A porcentagem é a que o servidor calculou; a barra é a comparação entre filiais, medida
 * pela maior delas.
 */
defineProps({
    // Linhas de `porFilial` da store de ocorrências.
    linhas: { type: Array, default: () => [] },
    carregando: { type: Boolean, default: false },
});
</script>

<template>
    <div class="filiais">
        <div v-if="carregando" class="filiais__esqueleto" aria-hidden="true">
            <span v-for="linha in 4" :key="linha" class="filiais__linha-esqueleto"></span>
        </div>

        <EstadoVazio
            v-else-if="linhas.length === 0"
            mensagem="Nenhuma ocorrência no período."
            tracejado
        />

        <div
            v-for="linha in linhas"
            v-else
            :key="linha.filialId"
            class="filiais__linha"
            :data-filial="linha.codigo"
            :title="linha.nome"
        >
            <span class="filiais__codigo">{{ linha.codigo }}</span>
            <div class="filiais__trilho">
                <div class="filiais__fatia" :style="{ width: linha.largura }"></div>
            </div>
            <span class="filiais__taxa">{{ linha.percentual }}</span>
        </div>
    </div>
</template>

<style scoped src="@/styles/components/overview/incidents_by_branch.css"></style>
