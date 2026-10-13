<script setup>
import { useUiStore } from '@/stores/ui.store.js';

const ui = useUiStore();
</script>

<template>
    <div class="painel-raiz" :data-theme="ui.tema">
        <RouterView />
    </div>
</template>

<style scoped src="@/styles/app/app.css"></style>
