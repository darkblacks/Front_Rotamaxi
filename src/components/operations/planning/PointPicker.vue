<script setup>
import { computed, ref } from 'vue';
import LookupSelect from './LookupSelect.vue';
import { lookupService } from '@/services/api/planning.api.js';
import { coordenadaValida } from '@/domain/planning/services.js';

/**
 * Ponto real (unidade/filial/CT) por lookup. Ponto sem coordenada: informar lat/lng e gravar
 * no cadastro mestre (PATCH). Alternativa: ponto avulso só por coordenada (sem geocodificação).
 */
const props = defineProps({
    modelValue: { type: Object, default: null },
    titulo: { type: String, required: true },
    natureza: { type: String, default: null },
    erro: { type: String, default: '' },
    desabilitado: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);

const manual = ref(false);
const nomeManual = ref('');
const lat = ref('');
const lng = ref('');
const gravando = ref(false);
const falhaCoordenada = ref('');

const semCoordenada = computed(() => props.modelValue?.kind && !coordenadaValida(props.modelValue.latitude, props.modelValue.longitude));
const manualValido = computed(() => nomeManual.value.trim() !== '' && coordenadaValida(lat.value, lng.value));

const buscar = (q) => lookupService.pontos(q, props.natureza);

function usarManual() {
    if (!manualValido.value) return;
    emit('update:modelValue', { nome: nomeManual.value.trim(), latitude: Number(lat.value), longitude: Number(lng.value) });
    manual.value = false;
}

async function gravarNoCadastro() {
    if (!coordenadaValida(lat.value, lng.value)) {
        falhaCoordenada.value = 'Informe latitude e longitude válidas.';
        return;
    }
    gravando.value = true;
    falhaCoordenada.value = '';
    const p = props.modelValue;
    const { ok, falha } = await lookupService.coordenadas(p.kind, p.id, { latitude: Number(lat.value), longitude: Number(lng.value) });
    gravando.value = false;
    if (!ok) {
        falhaCoordenada.value = falha?.mensagem ?? 'Não foi possível gravar as coordenadas.';
        return;
    }
    emit('update:modelValue', { ...p, latitude: Number(lat.value), longitude: Number(lng.value), geocodificado: true });
}
</script>

<template>
    <div class="ponto">
        <LookupSelect
            v-if="!manual"
            :model-value="modelValue"
            :titulo="titulo"
            :buscar="buscar"
            :rotulo="(p) => p.nome ?? 'Ponto'"
            :detalhe="(p) => [p.kind, p.endereco, p.geocodificado === false ? 'sem coordenadas' : ''].filter(Boolean).join(' · ')"
            :erro="erro"
            :desabilitado="desabilitado"
            placeholder="Buscar unidade, filial ou CT"
            @update:model-value="emit('update:modelValue', $event)"
        />
        <div v-else class="ponto__manual">
            <span class="lookup__titulo">{{ titulo }} (por coordenada)</span>
            <input v-model="nomeManual" class="lookup__entrada" placeholder="Nome do ponto" />
            <div class="ponto__coords">
                <input v-model="lat" class="lookup__entrada" inputmode="decimal" placeholder="Latitude" />
                <input v-model="lng" class="lookup__entrada" inputmode="decimal" placeholder="Longitude" />
            </div>
            <button type="button" class="botao" :disabled="!manualValido" @click="usarManual">Usar este ponto</button>
        </div>

        <div v-if="semCoordenada" class="ponto__alerta" role="alert">
            Este ponto não tem coordenadas. Informe para georreferenciar:
            <div class="ponto__coords">
                <input v-model="lat" class="lookup__entrada" inputmode="decimal" placeholder="Latitude" />
                <input v-model="lng" class="lookup__entrada" inputmode="decimal" placeholder="Longitude" />
            </div>
            <button type="button" class="botao" :disabled="gravando" @click="gravarNoCadastro">
                {{ gravando ? 'Gravando…' : 'Gravar no cadastro' }}
            </button>
            <small v-if="falhaCoordenada" class="lookup__mensagem">{{ falhaCoordenada }}</small>
        </div>

        <button v-if="!desabilitado" type="button" class="ponto__alternar" @click="manual = !manual">
            {{ manual ? 'Voltar à busca no cadastro' : 'Informar por coordenada (sem cadastro)' }}
        </button>
    </div>
</template>

<style scoped src="@/styles/components/operations/planning/planning.css"></style>
