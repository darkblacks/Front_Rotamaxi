<script setup>
import { computed, ref } from 'vue';
import { TIPOS_DE_DIVERGENCIA } from '@/stores/divergences.store.js';

/**
 * Modal "Nova divergência" do design.
 *
 * Ele serve **apenas** ao registro manual pelo admin: a divergência da conferência nasce
 * sozinha, no portão (US-8.1), e nunca é digitada aqui. É o caminho da diferença que
 * apareceu fora do portão e que sem este registro não existiria no painel.
 *
 * A diferença não é digitada: ela é a conta entre o par informado, e quem a calcula e grava
 * é o servidor. O modal mostra a prévia só para quem digita conferir o sinal.
 */
const props = defineProps({
    manifestos: { type: Array, default: () => [] },
    enviando: { type: Boolean, default: false },
    falha: { type: Object, default: null },
});

const emit = defineEmits(['registrar', 'fechar']);

const tipos = TIPOS_DE_DIVERGENCIA;

const manifestoId = ref(null);
const tipo = ref(tipos[0].slug);
const esperado = ref('');
const declarado = ref('');
const conferido = ref('');
const justificativa = ref('');

const erros = computed(() => props.falha?.errors ?? {});

function numeroOuNulo(valor) {
    return valor === '' || valor === null ? null : Number.parseInt(valor, 10);
}

/**
 * O par que forma a diferença, na mesma regra do servidor: conferido menos declarado
 * quando os dois existem, senão declarado menos esperado.
 */
const previaDaDiferenca = computed(() => {
    const numeros = {
        esperado: numeroOuNulo(esperado.value),
        declarado: numeroOuNulo(declarado.value),
        conferido: numeroOuNulo(conferido.value),
    };

    if (numeros.declarado !== null && numeros.conferido !== null) {
        return numeros.conferido - numeros.declarado;
    }

    if (numeros.esperado !== null && numeros.declarado !== null) {
        return numeros.declarado - numeros.esperado;
    }

    return null;
});

const podeRegistrar = computed(() => manifestoId.value !== null
    && justificativa.value.trim() !== ''
    && previaDaDiferenca.value !== null);

function registrar() {
    if (! podeRegistrar.value) {
        return;
    }

    emit('registrar', {
        manifesto_id: Number(manifestoId.value),
        tipo: tipo.value,
        valor_esperado: numeroOuNulo(esperado.value),
        valor_declarado: numeroOuNulo(declarado.value),
        valor_conferido: numeroOuNulo(conferido.value),
        justificativa: justificativa.value.trim(),
    });
}
</script>

<template>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-nova-divergencia">
        <div class="modal__caixa">
            <div class="modal__cabecalho">
                <h2 id="titulo-nova-divergencia" class="modal__titulo">Nova divergência</h2>
                <button type="button" class="modal__fechar" @click="emit('fechar')">Fechar</button>
            </div>

            <p class="modal__nota">
                Registro manual: a divergência da conferência da portaria já nasce sozinha.
            </p>

            <div v-if="falha" class="modal__falha" role="alert">{{ falha.mensagem }}</div>

            <label class="modal__campo">
                <span class="modal__rotulo">Manifesto</span>
                <select v-model="manifestoId" class="modal__controle" data-campo="manifesto_id">
                    <option :value="null" disabled>Escolha o manifesto</option>
                    <option v-for="opcao in manifestos" :key="opcao.id" :value="opcao.id">
                        {{ opcao.rotulo }}
                    </option>
                </select>
                <small v-if="erros.manifesto_id" class="modal__erro">{{ erros.manifesto_id[0] }}</small>
            </label>

            <label class="modal__campo">
                <span class="modal__rotulo">Tipo</span>
                <select v-model="tipo" class="modal__controle" data-campo="tipo">
                    <option v-for="opcao in tipos" :key="opcao.slug" :value="opcao.slug">{{ opcao.rotulo }}</option>
                </select>
                <small v-if="erros.tipo" class="modal__erro">{{ erros.tipo[0] }}</small>
            </label>

            <div class="modal__numeros">
                <label class="modal__campo">
                    <span class="modal__rotulo">Esperado</span>
                    <input v-model="esperado" type="number" min="0" class="modal__controle" data-campo="valor_esperado">
                </label>
                <label class="modal__campo">
                    <span class="modal__rotulo">Declarado</span>
                    <input v-model="declarado" type="number" min="0" class="modal__controle" data-campo="valor_declarado">
                </label>
                <label class="modal__campo">
                    <span class="modal__rotulo">Conferido</span>
                    <input v-model="conferido" type="number" min="0" class="modal__controle" data-campo="valor_conferido">
                </label>
            </div>

            <p class="modal__diferenca">
                Diferença:
                <strong>{{ previaDaDiferenca === null ? '—' : previaDaDiferenca }}</strong>
                <small>informe o par: esperado e declarado, ou declarado e conferido</small>
            </p>
            <small v-if="erros.valor_declarado" class="modal__erro">{{ erros.valor_declarado[0] }}</small>

            <label class="modal__campo">
                <span class="modal__rotulo">Justificativa</span>
                <textarea
                    v-model="justificativa"
                    class="modal__controle modal__controle--texto"
                    rows="3"
                    data-campo="justificativa"
                    placeholder="De onde veio a diferença"
                ></textarea>
                <small v-if="erros.justificativa" class="modal__erro">{{ erros.justificativa[0] }}</small>
            </label>

            <div class="modal__acoes">
                <button type="button" class="modal__botao" @click="emit('fechar')">Cancelar</button>
                <button
                    type="button"
                    class="modal__botao modal__botao--primario"
                    data-acao="registrar"
                    :disabled="! podeRegistrar || enviando"
                    @click="registrar"
                >
                    {{ enviando ? 'Registrando…' : 'Registrar divergência' }}
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped src="@/styles/components/operations/divergences/new_divergence_modal.css"></style>
