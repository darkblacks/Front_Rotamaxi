<script setup>
import { computed } from 'vue';

/**
 * Período e filial da tela. O componente não guarda estado: ele emite o recorte pedido e
 * quem manda é a URL — é o que faz a tela filtrada ser compartilhável por link.
 */
const props = defineProps({
    filtros: { type: Object, required: true },
    filiais: { type: Array, default: () => [] },
});

const emit = defineEmits(['aplicar']);

const filialSelecionada = computed(() => (props.filtros.filialId === null ? 'todas' : String(props.filtros.filialId)));

function mudarInicio(evento) {
    const de = evento.target.value;

    if (de === '') {
        return;
    }

    // Início depois do fim responderia 422: o fim acompanha o início.
    emit('aplicar', {
        ...props.filtros,
        de,
        ate: props.filtros.ate < de ? de : props.filtros.ate,
    });
}

function mudarFim(evento) {
    const ate = evento.target.value;

    if (ate === '') {
        return;
    }

    emit('aplicar', {
        ...props.filtros,
        de: ate < props.filtros.de ? ate : props.filtros.de,
        ate,
    });
}

function mudarFilial(evento) {
    const valor = evento.target.value;

    emit('aplicar', {
        ...props.filtros,
        filialId: valor === 'todas' ? null : Number.parseInt(valor, 10),
    });
}
</script>

<template>
    <div class="filtros">
        <label class="filtros__campo">
            <span class="filtros__rotulo">De</span>
            <input
                type="date"
                class="filtros__controle"
                data-filtro="de"
                :value="filtros.de"
                @change="mudarInicio"
            >
        </label>
        <label class="filtros__campo">
            <span class="filtros__rotulo">Até</span>
            <input
                type="date"
                class="filtros__controle"
                data-filtro="ate"
                :value="filtros.ate"
                @change="mudarFim"
            >
        </label>
        <label class="filtros__campo">
            <span class="filtros__rotulo">Filial</span>
            <select
                class="filtros__controle"
                data-filtro="filial_id"
                :value="filialSelecionada"
                @change="mudarFilial"
            >
                <option value="todas">Todas as filiais</option>
                <option v-for="filial in filiais" :key="filial.id" :value="String(filial.id)">
                    {{ filial.codigo }} · {{ filial.nome }}
                </option>
            </select>
        </label>
    </div>
</template>

<style scoped src="@/styles/components/overview/dashboard_filters.css"></style>
