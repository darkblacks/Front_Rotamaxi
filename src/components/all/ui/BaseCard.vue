<script setup>
defineProps({
    titulo: { type: String, default: '' },
});
</script>

<template>
    <section class="cartao">
        <div v-if="titulo || $slots.acoes" class="cartao__cabecalho">
            <h2 v-if="titulo" class="cartao__titulo">{{ titulo }}</h2>
            <div v-if="$slots.acoes" class="cartao__acoes">
                <slot name="acoes" />
            </div>
        </div>
        <slot />
    </section>
</template>

<style scoped src="@/styles/components/all/ui/base_card.css"></style>
