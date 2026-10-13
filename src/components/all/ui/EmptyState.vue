<script setup>
defineProps({
    mensagem: { type: String, required: true },
    tracejado: { type: Boolean, default: false },
});
</script>

<template>
    <div class="vazio" :class="{ 'vazio--tracejado': tracejado }">
        <span>{{ mensagem }}</span>
        <slot />
    </div>
</template>

<style scoped src="@/styles/components/all/ui/empty_state.css"></style>
