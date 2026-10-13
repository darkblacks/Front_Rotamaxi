<script setup>
import { computed } from 'vue';
import { deInputLocal, paraInputLocal } from '@/domain/operations/text.js';

/**
 * Campo de data/hora com botão "Agora" (carimba a hora atual) e ajuste manual pelo seletor
 * nativo. O valor do `v-model` é ISO-8601 (UTC) ou `null`.
 */
const props = defineProps({
    modelValue: { type: String, default: null },
    rotulo: { type: String, required: true },
    desabilitado: { type: Boolean, default: false },
    erro: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue']);

const valorLocal = computed(() => (props.modelValue ? paraInputLocal(props.modelValue) : ''));

function carimbar() {
    emit('update:modelValue', new Date().toISOString());
}

function ajustar(evento) {
    emit('update:modelValue', deInputLocal(evento.target.value));
}
</script>

<template>
    <div class="campo">
        <label class="campo__rotulo">{{ rotulo }}</label>
        <div class="campo__linha">
            <input
                class="campo__entrada"
                :class="{ 'campo__entrada--erro': erro }"
                type="datetime-local"
                :value="valorLocal"
                :disabled="desabilitado"
                :aria-label="rotulo"
                @change="ajustar"
            />
            <button type="button" class="botao botao--pequeno" :disabled="desabilitado" @click="carimbar">Agora</button>
        </div>
        <span v-if="erro" class="campo__erro">{{ erro }}</span>
    </div>
</template>

<style scoped src="@/styles/components/operations/shared/operation_form.css"></style>
