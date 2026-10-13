<script setup>
import FiltroDeFilial from '@/components/all/filters/BranchFilter.vue';
import { STATUS_DA_DIVERGENCIA, TIPOS_DE_DIVERGENCIA } from '@/stores/divergences.store.js';

/**
 * Os quatro filtros que a API de divergências aceita: status, tipo, filial e período.
 *
 * O componente não guarda estado: emite o recorte pedido e quem manda é a URL.
 */
const props = defineProps({
    filtros: { type: Object, required: true },
    filiais: { type: Array, default: () => [] },
});

const emit = defineEmits(['aplicar']);

const status = STATUS_DA_DIVERGENCIA;
const tipos = TIPOS_DE_DIVERGENCIA;

function aplicar(mudanca) {
    emit('aplicar', { ...props.filtros, ...mudanca });
}

function mudarStatus(evento) {
    const valor = evento.target.value;

    aplicar({ status: valor === 'todos' ? null : valor });
}

function mudarTipo(evento) {
    const valor = evento.target.value;

    aplicar({ tipo: valor === 'todos' ? null : valor });
}

function mudarInicio(evento) {
    const de = evento.target.value;

    // Início depois do fim responderia 422: o fim acompanha o início.
    aplicar({
        de: de === '' ? null : de,
        ate: de !== '' && props.filtros.ate !== null && props.filtros.ate < de ? de : props.filtros.ate,
    });
}

function mudarFim(evento) {
    const ate = evento.target.value;

    aplicar({
        de: ate !== '' && props.filtros.de !== null && ate < props.filtros.de ? ate : props.filtros.de,
        ate: ate === '' ? null : ate,
    });
}

function limpar() {
    aplicar({ status: null, tipo: null, filialId: null, de: null, ate: null });
}
</script>

<template>
    <div class="filtros">
        <label class="filtros__campo">
            <span class="filtros__rotulo">Status</span>
            <select
                class="filtros__controle"
                data-filtro="status"
                :value="filtros.status ?? 'todos'"
                @change="mudarStatus"
            >
                <option value="todos">Todos os status</option>
                <option v-for="opcao in status" :key="opcao.slug" :value="opcao.slug">{{ opcao.rotulo }}</option>
            </select>
        </label>

        <label class="filtros__campo">
            <span class="filtros__rotulo">Tipo</span>
            <select
                class="filtros__controle"
                data-filtro="tipo"
                :value="filtros.tipo ?? 'todos'"
                @change="mudarTipo"
            >
                <option value="todos">Todos os tipos</option>
                <option v-for="opcao in tipos" :key="opcao.slug" :value="opcao.slug">{{ opcao.rotulo }}</option>
            </select>
        </label>

        <FiltroDeFilial
            :filial-id="filtros.filialId"
            :filiais="filiais"
            @aplicar="(filialId) => aplicar({ filialId })"
        />

        <label class="filtros__campo">
            <span class="filtros__rotulo">De</span>
            <input
                type="date"
                class="filtros__controle"
                data-filtro="de"
                :value="filtros.de ?? ''"
                @change="mudarInicio"
            >
        </label>

        <label class="filtros__campo">
            <span class="filtros__rotulo">Até</span>
            <input
                type="date"
                class="filtros__controle"
                data-filtro="ate"
                :value="filtros.ate ?? ''"
                @change="mudarFim"
            >
        </label>

        <button type="button" class="filtros__limpar" @click="limpar">Limpar filtros</button>
    </div>
</template>

<style scoped src="@/styles/components/operations/divergences/divergence_filters.css"></style>
