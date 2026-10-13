<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { listaDe } from '@/services/api/planning.api.js';

/**
 * Seleção por busca em cadastro real (lookup). `buscar(q)` devolve o resultado de
 * `requisitar` ({ ok, dados, falha }). Mostra loading, vazio e erro; nada hardcoded.
 */
const props = defineProps({
    modelValue: { type: Object, default: null },
    buscar: { type: Function, required: true },
    rotulo: { type: Function, default: (i) => i?.nome ?? String(i?.id ?? '') },
    detalhe: { type: Function, default: () => '' },
    titulo: { type: String, required: true },
    placeholder: { type: String, default: 'Digite para buscar' },
    erro: { type: String, default: '' },
    desabilitado: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);

const aberto = ref(false);
const termo = ref('');
const itens = ref([]);
const carregando = ref(false);
const falha = ref('');
let timer = null;
let senha = 0;

async function consultar() {
    const minha = ++senha;
    carregando.value = true;
    falha.value = '';
    const { ok, dados, falha: erroApi } = await props.buscar(termo.value);
    if (minha !== senha) return;
    carregando.value = false;
    if (ok) {
        itens.value = listaDe(dados);
    } else {
        itens.value = [];
        falha.value = erroApi?.mensagem ?? 'Falha ao buscar.';
    }
}

function abrir() {
    if (props.desabilitado) return;
    aberto.value = true;
    consultar();
}

watch(termo, () => {
    clearTimeout(timer);
    timer = setTimeout(consultar, 300);
});

function escolher(item) {
    emit('update:modelValue', item);
    aberto.value = false;
    termo.value = '';
}

function limpar() {
    emit('update:modelValue', null);
}

onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
    <div class="lookup" :class="{ 'lookup--erro': erro }">
        <span class="lookup__titulo">{{ titulo }}</span>
        <div v-if="modelValue && !aberto" class="lookup__atual">
            <span class="lookup__valor">{{ rotulo(modelValue) }}</span>
            <button v-if="!desabilitado" type="button" class="lookup__trocar" @click="abrir">Trocar</button>
            <button v-if="!desabilitado" type="button" class="lookup__trocar" aria-label="Limpar" @click="limpar">×</button>
        </div>
        <template v-else>
            <input
                v-model="termo"
                class="lookup__entrada"
                type="search"
                :placeholder="placeholder"
                :disabled="desabilitado"
                autocomplete="off"
                @focus="abrir"
            />
            <ul v-if="aberto" class="lookup__lista" role="listbox">
                <li v-if="carregando" class="lookup__estado">Buscando…</li>
                <li v-else-if="falha" class="lookup__estado lookup__estado--erro">{{ falha }}</li>
                <li v-else-if="itens.length === 0" class="lookup__estado">Nenhum resultado.</li>
                <template v-else>
                    <li v-for="item in itens" :key="`${item.kind ?? ''}${item.id}`" role="option">
                        <button type="button" class="lookup__item" @click="escolher(item)">
                            <span>{{ rotulo(item) }}</span>
                            <small>{{ detalhe(item) }}</small>
                        </button>
                    </li>
                </template>
                <li class="lookup__fechar"><button type="button" class="lookup__trocar" @click="aberto = false">Fechar</button></li>
            </ul>
        </template>
        <small v-if="erro" class="lookup__mensagem">{{ erro }}</small>
    </div>
</template>

<style scoped src="@/styles/components/operations/planning/planning.css"></style>
