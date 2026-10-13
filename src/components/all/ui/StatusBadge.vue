<script setup>
const props = defineProps({
    rotulo: { type: String, required: true },
    tom: { type: String, default: 'info' },
});

const TONS = {
    ok: { fundo: 'var(--ok-soft)', texto: 'var(--ok)' },
    warn: { fundo: 'var(--warn-soft)', texto: 'var(--warn)' },
    bad: { fundo: 'var(--bad-soft)', texto: 'var(--bad)' },
    info: { fundo: 'var(--info-soft)', texto: 'var(--info)' },
    accent: { fundo: 'var(--accent-soft)', texto: 'var(--accent)' },
    neutro: { fundo: 'var(--track)', texto: 'var(--muted)' },
};

const estilo = () => {
    const tom = TONS[props.tom] ?? TONS.info;

    return { background: tom.fundo, color: tom.texto };
};
</script>

<template>
    <span class="badge" :style="estilo()">{{ rotulo }}</span>
</template>

<style scoped src="@/styles/components/all/ui/status_badge.css"></style>
