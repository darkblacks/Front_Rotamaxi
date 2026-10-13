<script setup>
import { computed } from 'vue';
import { useTempoRealStore } from '@/stores/realtime.store.js';

/**
 * Indicador de conexão do tempo real (US-9.4).
 *
 * Fica visível ao lado do que ele governa: enquanto ele não disser "Ao vivo", a tela é uma
 * fotografia da última leitura, e o operador precisa saber disso sem abrir console.
 */
const tempoReal = useTempoRealStore();

const TONS = {
    ok: 'var(--ok)',
    warn: 'var(--warn)',
    bad: 'var(--bad)',
};

const cor = computed(() => TONS[tempoReal.tomDaConexao] ?? TONS.bad);
</script>

<template>
    <span
        class="conexao"
        :data-conexao="tempoReal.estado"
        :title="`Tempo real: ${tempoReal.rotuloDaConexao}`"
    >
        <i class="conexao__ponto" :class="{ 'conexao__ponto--pulsando': tempoReal.conectado }" :style="{ background: cor }"></i>
        <span class="conexao__rotulo">{{ tempoReal.rotuloDaConexao }}</span>
    </span>
</template>

<style scoped src="@/styles/components/all/status/realtime_indicator.css"></style>
