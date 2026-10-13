<script setup>
import { computed } from 'vue';

/**
 * Seletor de filial das telas que só recortam por filial — a fila da portaria e o saldo de
 * pallets. Ele não guarda estado: emite a filial pedida e quem manda é a URL, do mesmo
 * jeito que nos filtros das outras telas.
 */
const props = defineProps({
    filialId: { type: Number, default: null },
    filiais: { type: Array, default: () => [] },
    rotulo: { type: String, default: 'Filial' },
});

const emit = defineEmits(['aplicar']);

const selecionada = computed(() => (props.filialId === null ? 'todas' : String(props.filialId)));

function mudar(evento) {
    const valor = evento.target.value;

    emit('aplicar', valor === 'todas' ? null : Number.parseInt(valor, 10));
}
</script>

<template>
    <label class="filtro">
        <span class="filtro__rotulo">{{ rotulo }}</span>
        <select
            class="filtro__controle"
            data-filtro="filial_id"
            :value="selecionada"
            @change="mudar"
        >
            <option value="todas">Todas as filiais</option>
            <option v-for="filial in filiais" :key="filial.id" :value="String(filial.id)">
                {{ filial.codigo }} · {{ filial.nome }}
            </option>
        </select>
    </label>
</template>

<style scoped src="@/styles/components/all/filters/branch_filter.css"></style>
