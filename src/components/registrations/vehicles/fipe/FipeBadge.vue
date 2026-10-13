<script setup>
import { computed } from 'vue';
import { CircleCheck, CircleHelp, Clock, Ban, Minus } from 'lucide-vue-next';
import { seloFipe } from '@/domain/vehicles/fleet-model.js';

const props = defineProps({ estado: { type: String, default: '' } });

const selo = computed(() => seloFipe(props.estado));
const icone = computed(() => ({ ok: CircleCheck, warn: props.estado === 'desatualizado' ? Clock : CircleHelp, info: Ban, neutro: Minus })[selo.value.tom] ?? Minus);
</script>

<template>
    <span class="selo" :class="`selo--${selo.tom}`" data-selo-fipe>
        <component :is="icone" :size="13" aria-hidden="true" />{{ selo.texto }}
    </span>
</template>

<style scoped src="@/styles/components/registrations/vehicles/fipe/fipe_badge.css"></style>
