<script setup>
import EstadoVazio from '@/components/all/ui/EmptyState.vue';
import { horaCurta } from '@/utils/format.js';

defineProps({
    // Acontecimentos já em ordem cronológica inversa, vindos da store do tempo real.
    acontecimentos: { type: Array, default: () => [] },
    carregando: { type: Boolean, default: false },
});

const TONS = {
    ok: 'var(--ok)',
    warn: 'var(--warn)',
    bad: 'var(--bad)',
    info: 'var(--info)',
    accent: 'var(--accent)',
};

function cor(tom) {
    return TONS[tom] ?? TONS.info;
}
</script>

<template>
    <div class="aovivo">
        <div v-if="carregando" class="aovivo__esqueleto" aria-hidden="true">
            <span v-for="linha in 5" :key="linha" class="aovivo__linha-esqueleto"></span>
        </div>

        <!-- Estado vazio próprio: sem acontecimento no período não há falha nenhuma a relatar. -->
        <EstadoVazio
            v-else-if="acontecimentos.length === 0"
            mensagem="Nenhum acontecimento no período."
            tracejado
        />

        <div v-else class="aovivo__lista" aria-live="polite">
            <div
                v-for="acontecimento in acontecimentos"
                :key="acontecimento.chave"
                class="aovivo__linha"
            >
                <span class="aovivo__hora">{{ horaCurta(acontecimento.quando) }}</span>
                <i class="aovivo__ponto" :style="{ background: cor(acontecimento.tom) }"></i>
                <span class="aovivo__texto">{{ acontecimento.texto }}</span>
            </div>
        </div>
    </div>
</template>

<style scoped src="@/styles/components/overview/live_panel.css"></style>
