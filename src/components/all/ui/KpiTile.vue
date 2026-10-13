<script setup>
import { computed } from 'vue';

const props = defineProps({
    rotulo: { type: String, required: true },
    valor: { type: [String, Number], default: null },
    complemento: { type: String, default: '' },
    tom: { type: String, default: 'neutro' },
    // O tile do design é clicável na visão geral e estático na tela de pallets.
    comoBotao: { type: Boolean, default: false },
    // Enquanto o número não chegou, o tile mostra esqueleto. Zero é resultado legítimo
    // da operação: exibi-lo antes da resposta contaria uma mentira sobre o período.
    carregando: { type: Boolean, default: false },
});

const TONS = {
    neutro: 'var(--ink)',
    ok: 'var(--ok)',
    warn: 'var(--warn)',
    bad: 'var(--bad)',
    info: 'var(--info)',
    accent: 'var(--accent)',
};

const corDoValor = computed(() => TONS[props.tom] ?? TONS.neutro);
const elemento = computed(() => (props.comoBotao ? 'button' : 'div'));
</script>

<template>
    <component
        :is="elemento"
        :type="comoBotao ? 'button' : undefined"
        class="tile"
        :class="{ 'tile--botao': comoBotao }"
        :aria-busy="carregando ? 'true' : 'false'"
    >
        <span class="tile__rotulo">{{ rotulo }}</span>
        <span v-if="carregando" class="tile__esqueleto tile__esqueleto--valor" aria-hidden="true"></span>
        <span v-else class="tile__valor" :style="{ color: corDoValor }">{{ valor }}</span>
        <span v-if="carregando" class="tile__esqueleto tile__esqueleto--complemento" aria-hidden="true"></span>
        <span v-else-if="complemento" class="tile__complemento">{{ complemento }}</span>
    </component>
</template>

<style scoped src="@/styles/components/all/ui/kpi_tile.css"></style>
