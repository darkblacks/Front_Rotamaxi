<script setup>
import FiltroDeFilial from '@/components/all/filters/BranchFilter.vue';

/**
 * Período e filial da tela de saldo de pallets. O componente não guarda estado: emite o
 * recorte pedido e quem manda é a URL.
 *
 * Diferente da visão geral, o período aqui pode estar **vazio**: saldo de pallet é passivo
 * acumulado, e quem não escolheu janela recebe a do servidor. Limpar o campo é uma escolha
 * legítima, e não um valor inválido a ser ignorado.
 */
const props = defineProps({
    filtros: { type: Object, required: true },
    filiais: { type: Array, default: () => [] },
});

const emit = defineEmits(['aplicar']);

function aplicar(mudanca) {
    emit('aplicar', { ...props.filtros, ...mudanca });
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

function mudarFilial(filialId) {
    aplicar({ filialId });
}

function limpar() {
    aplicar({ de: null, ate: null, filialId: null });
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

        <FiltroDeFilial :filial-id="filtros.filialId" :filiais="filiais" @aplicar="mudarFilial" />

        <button type="button" class="filtros__limpar" @click="limpar">Limpar filtros</button>
    </div>
</template>

<style scoped src="@/styles/components/operations/pallets/pallet_filters.css"></style>
