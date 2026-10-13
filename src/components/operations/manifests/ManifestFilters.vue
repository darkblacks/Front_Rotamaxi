<script setup>
import { computed } from 'vue';
import { STATUS_DO_MANIFESTO } from '@/stores/manifests.store.js';

/**
 * Status, filial e período da lista de manifestos. O componente não guarda estado: ele emite
 * o recorte pedido e quem manda é a URL — é o que faz a lista filtrada ser compartilhável
 * por link.
 *
 * Trocar qualquer filtro volta para a primeira página: a página 3 do recorte anterior não
 * existe no recorte novo.
 */
const props = defineProps({
    filtros: { type: Object, required: true },
    filiais: { type: Array, default: () => [] },
});

const emit = defineEmits(['aplicar']);

const statusSelecionado = computed(() => props.filtros.status ?? 'todos');

const filialSelecionada = computed(() => (props.filtros.filialId === null ? 'todas' : String(props.filtros.filialId)));

function aplicar(mudanca) {
    emit('aplicar', { ...props.filtros, ...mudanca, pagina: 1 });
}

function mudarStatus(evento) {
    const valor = evento.target.value;

    aplicar({ status: valor === 'todos' ? null : valor });
}

function mudarFilial(evento) {
    const valor = evento.target.value;

    aplicar({ filialId: valor === 'todas' ? null : Number.parseInt(valor, 10) });
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
    emit('aplicar', { status: null, filialId: null, de: null, ate: null, pagina: 1 });
}
</script>

<template>
    <div class="filtros">
        <label class="filtros__campo">
            <span class="filtros__rotulo">Status</span>
            <select
                class="filtros__controle"
                data-filtro="status"
                :value="statusSelecionado"
                @change="mudarStatus"
            >
                <option value="todos">Todos os status</option>
                <option v-for="status in STATUS_DO_MANIFESTO" :key="status.slug" :value="status.slug">
                    {{ status.rotulo }}
                </option>
            </select>
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

<style scoped src="@/styles/components/operations/manifests/manifest_filters.css"></style>
