<script setup>
import { computed } from 'vue';

const props = defineProps({
    valor: { type: Number, required: true },
    total: { type: Number, required: true },
    tom: { type: String, default: 'accent' },
    altura: { type: Number, default: 6 },
});

const TONS = {
    accent: 'var(--accent)',
    ok: 'var(--ok)',
    warn: 'var(--warn)',
    bad: 'var(--bad)',
    info: 'var(--info)',
    neutro: 'var(--ink)',
};

// Total zero ou negativo é operação sem serviço previsto: barra vazia, nunca divisão por zero.
const percentual = computed(() => {
    if (props.total <= 0) {
        return 0;
    }

    return Math.min(100, Math.max(0, (props.valor / props.total) * 100));
});

const cor = computed(() => TONS[props.tom] ?? TONS.accent);
</script>

<template>
    <div
        class="progresso"
        role="progressbar"
        :style="{ height: `${altura}px` }"
        :aria-valuenow="valor"
        :aria-valuemin="0"
        :aria-valuemax="total"
    >
        <div class="progresso__preenchido" :style="{ width: `${percentual}%`, background: cor }"></div>
    </div>
</template>

<style scoped src="@/styles/components/all/ui/progress_bar.css"></style>
