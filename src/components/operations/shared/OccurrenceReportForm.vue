<script setup>
import { computed, reactive } from 'vue';
import { SEVERIDADES, TIPOS_REPORTAVEIS } from '@/domain/operations/occurrences.js';

/**
 * Reportar ocorrência (POST /mapa/ocorrencias): tipo, severidade e descrição. Quem usa
 * decide o `manifesto_id` e a `etapa_id` ao tratar o evento `enviar`.
 */
defineProps({
    ocupado: { type: Boolean, default: false },
    etapas: { type: Array, default: () => [] },
});

const emit = defineEmits(['enviar']);

const form = reactive({ tipo: 'atraso', severidade: 'atencao', etapa_id: '', descricao: '' });
const valido = computed(() => form.descricao.trim().length >= 3);

function enviar() {
    if (!valido.value) return;
    const corpo = { tipo: form.tipo, severidade: form.severidade, descricao: form.descricao.trim() };
    if (form.etapa_id !== '') corpo.etapa_id = Number(form.etapa_id);
    emit('enviar', corpo, () => { form.descricao = ''; });
}
</script>

<template>
    <form class="form" @submit.prevent="enviar">
        <div class="form__grade">
            <div class="campo">
                <label class="campo__rotulo" for="oc-tipo">Tipo</label>
                <select id="oc-tipo" v-model="form.tipo" class="campo__entrada" :disabled="ocupado">
                    <option v-for="t in TIPOS_REPORTAVEIS" :key="t.chave" :value="t.chave">{{ t.rotulo }}</option>
                </select>
            </div>
            <div class="campo">
                <label class="campo__rotulo" for="oc-sev">Gravidade</label>
                <select id="oc-sev" v-model="form.severidade" class="campo__entrada" :disabled="ocupado">
                    <option v-for="s in SEVERIDADES" :key="s.chave" :value="s.chave">{{ s.rotulo }}</option>
                </select>
            </div>
            <div v-if="etapas.length" class="campo">
                <label class="campo__rotulo" for="oc-etapa">Etapa (opcional)</label>
                <select id="oc-etapa" v-model="form.etapa_id" class="campo__entrada" :disabled="ocupado">
                    <option value="">Manifesto todo</option>
                    <option v-for="e in etapas" :key="e.id" :value="e.id">{{ e.ordem }}. {{ e.nome }}</option>
                </select>
            </div>
        </div>
        <div class="campo">
            <label class="campo__rotulo" for="oc-desc">O que aconteceu</label>
            <textarea id="oc-desc" v-model="form.descricao" class="campo__entrada" :disabled="ocupado"></textarea>
        </div>
        <button type="submit" class="botao botao--grande" :disabled="ocupado || !valido">Reportar ocorrência</button>
    </form>
</template>

<style scoped src="@/styles/components/operations/shared/operation_form.css"></style>
