<script setup>
import { computed } from 'vue';
import { STATUS_DO_MANIFESTO } from '@/stores/manifests.store.js';

/**
 * Seleção e filtros do Mapa Operacional: Manifesto, Filial/CT, Motorista, Placa, Status e
 * os toggles de camada (veículos, celulares, pontos). Não guarda estado: emite alterações.
 */
const props = defineProps({
    filtros: { type: Object, required: true },
    manifestos: { type: Array, default: () => [] },
    filiais: { type: Array, default: () => [] },
    selecionadoId: { type: [Number, String], default: null },
    mostrar: { type: Object, required: true },
    carregando: { type: Boolean, default: false },
});

const emit = defineEmits(['filtros', 'selecionar', 'mostrar', 'limpar']);

const valorSelecionado = computed(() => (props.selecionadoId === null ? '' : String(props.selecionadoId)));

function rotuloDoManifesto(m) {
    return [`MAN ${m.numero ?? m.id}`, m.placa, m.motorista_nome].filter(Boolean).join(' · ');
}

function aoSelecionar(ev) {
    const v = ev.target.value;
    emit('selecionar', v === '' ? null : Number.parseInt(v, 10));
}

function aoFilial(ev) {
    const v = ev.target.value;
    emit('filtros', { filialId: v === '' ? null : Number.parseInt(v, 10) });
}

function alternar(chave, ev) {
    emit('mostrar', { ...props.mostrar, [chave]: ev.target.checked });
}
</script>

<template>
    <form class="seletor" @submit.prevent>
        <label class="seletor__campo seletor__campo--largo">
            <span class="seletor__rotulo">Manifesto</span>
            <select class="seletor__controle" data-filtro="manifesto" :value="valorSelecionado" @change="aoSelecionar">
                <option value="">{{ carregando ? 'Carregando…' : `Todos os manifestos (${manifestos.length})` }}</option>
                <option v-for="m in manifestos" :key="m.id" :value="String(m.id)">{{ rotuloDoManifesto(m) }}</option>
            </select>
        </label>

        <label class="seletor__campo">
            <span class="seletor__rotulo">Filial / CT</span>
            <select class="seletor__controle" data-filtro="filial_id" :value="filtros.filialId === null ? '' : String(filtros.filialId)" @change="aoFilial">
                <option value="">Todas</option>
                <option v-for="f in filiais" :key="f.id" :value="String(f.id)">{{ f.codigo }} · {{ f.nome }}</option>
            </select>
        </label>

        <label class="seletor__campo">
            <span class="seletor__rotulo">Motorista</span>
            <input class="seletor__controle" type="search" placeholder="Nome" :value="filtros.motorista" @input="emit('filtros', { motorista: $event.target.value })" />
        </label>

        <label class="seletor__campo">
            <span class="seletor__rotulo">Placa</span>
            <input class="seletor__controle" type="search" placeholder="ABC1D23" :value="filtros.placa" @input="emit('filtros', { placa: $event.target.value.toUpperCase() })" />
        </label>

        <label class="seletor__campo">
            <span class="seletor__rotulo">Status</span>
            <select class="seletor__controle" data-filtro="status" :value="filtros.status" @change="emit('filtros', { status: $event.target.value })">
                <option value="">Todos</option>
                <option v-for="s in STATUS_DO_MANIFESTO" :key="s.slug" :value="s.slug">{{ s.rotulo }}</option>
            </select>
        </label>

        <div class="seletor__camadas" role="group" aria-label="Camadas do mapa">
            <label class="seletor__toggle"><input type="checkbox" :checked="mostrar.veiculos" @change="alternar('veiculos', $event)" /> Veículos</label>
            <label class="seletor__toggle"><input type="checkbox" :checked="mostrar.celulares" @change="alternar('celulares', $event)" /> Celulares</label>
            <label class="seletor__toggle"><input type="checkbox" :checked="mostrar.pontos" @change="alternar('pontos', $event)" /> Pontos</label>
            <button type="button" class="seletor__limpar" @click="emit('limpar')">Limpar filtros</button>
        </div>
    </form>
</template>

<style scoped src="@/styles/components/operations/map/manifest_selector.css"></style>
