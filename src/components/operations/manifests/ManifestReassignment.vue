<script setup>
import { computed, onMounted, ref } from 'vue';
import { manifestoService } from '@/services/api/manifests.api.js';

/**
 * Reatribuição do manifesto pela tela (US-9.3, US-8.7).
 *
 * Trocar o dono da viagem é ato administrativo: exige escolher o novo motorista, escrever a
 * **justificativa** e confirmar explicitamente antes de aplicar. A confirmação é um segundo
 * passo com nome e motivo à vista, e não um `confirm()` genérico — quem reatribui precisa
 * ver para quem está mandando a viagem.
 *
 * Manifesto `fechado` não é reatribuível: o botão fica desabilitado e o motivo aparece na
 * tela. A regra é do servidor — a `ManifestoPolicy` responde 403 —, e a tela apenas a
 * antecipa para não oferecer uma ação que seria negada.
 */
const props = defineProps({
    manifesto: { type: Object, required: true },
});

const emit = defineEmits(['reatribuido']);

const STATUS_QUE_IMPEDE = 'fechado';

const motoristas = ref([]);
const motoristaId = ref(null);
const justificativa = ref('');
const confirmando = ref(false);
const enviando = ref(false);
const falha = ref(null);
const concluida = ref(null);

const fechado = computed(() => props.manifesto.status === STATUS_QUE_IMPEDE);

const erros = computed(() => falha.value?.errors ?? {});

const motoristaEscolhido = computed(
    () => motoristas.value.find((motorista) => motorista.id === Number(motoristaId.value)) ?? null,
);

/**
 * Sem novo motorista ou sem motivo não há o que confirmar. O servidor valida os dois; a
 * tela só evita a ida inútil.
 */
const podeConfirmar = computed(() => ! fechado.value
    && motoristaEscolhido.value !== null
    && justificativa.value.trim() !== '');

async function carregarMotoristas() {
    const { ok, dados } = await manifestoService.motoristas();

    motoristas.value = ok ? (dados.data ?? []) : [];
}

function pedirConfirmacao() {
    if (! podeConfirmar.value) {
        return;
    }

    confirmando.value = true;
}

async function aplicar() {
    enviando.value = true;

    const { ok, dados, falha: erro } = await manifestoService.reatribuir(props.manifesto.id, {
        motorista_id: Number(motoristaId.value),
        justificativa: justificativa.value.trim(),
    });

    if (ok) {
        falha.value = null;
        concluida.value = {
            nome: motoristaEscolhido.value?.nome ?? '—',
            em: dados.data?.reatribuido_em ?? null,
        };
        justificativa.value = '';
        motoristaId.value = null;
        emit('reatribuido', dados.data);
    } else {
        falha.value = erro;
    }

    confirmando.value = false;
    enviando.value = false;
}

onMounted(() => {
    if (! fechado.value) {
        carregarMotoristas();
    }
});
</script>

<template>
    <div class="reatribuicao">
        <p v-if="fechado" class="reatribuicao__impedimento" data-motivo="fechado">
            Manifesto fechado não pode ser reatribuído: a viagem já foi encerrada na portaria.
        </p>

        <div v-if="falha" class="reatribuicao__falha" role="alert">{{ falha.mensagem }}</div>

        <p v-if="concluida" class="reatribuicao__concluida" role="status">
            Manifesto reatribuído para {{ concluida.nome }}.
        </p>

        <div class="reatribuicao__campos">
            <label class="reatribuicao__campo">
                <span class="reatribuicao__rotulo">Novo motorista</span>
                <select
                    v-model="motoristaId"
                    class="reatribuicao__controle"
                    data-campo="motorista_id"
                    :disabled="fechado"
                >
                    <option :value="null" disabled>Escolha o motorista</option>
                    <option v-for="motorista in motoristas" :key="motorista.id" :value="motorista.id">
                        {{ motorista.nome }}
                    </option>
                </select>
                <small v-if="erros.motorista_id" class="reatribuicao__erro">{{ erros.motorista_id[0] }}</small>
            </label>

            <label class="reatribuicao__campo reatribuicao__campo--largo">
                <span class="reatribuicao__rotulo">Justificativa (obrigatória)</span>
                <textarea
                    v-model="justificativa"
                    class="reatribuicao__controle reatribuicao__controle--texto"
                    rows="2"
                    data-campo="justificativa"
                    :disabled="fechado"
                    placeholder="Por que a viagem está trocando de motorista"
                ></textarea>
                <small v-if="erros.justificativa" class="reatribuicao__erro">{{ erros.justificativa[0] }}</small>
            </label>
        </div>

        <div v-if="! confirmando" class="reatribuicao__acoes">
            <span class="reatribuicao__nota">
                Nada do que o motorista anterior registrou muda de dono: paradas, ocorrências e pallets
                continuam com ele.
            </span>
            <button
                type="button"
                class="reatribuicao__botao reatribuicao__botao--primario"
                data-acao="reatribuir"
                :disabled="! podeConfirmar"
                @click="pedirConfirmacao"
            >
                Reatribuir
            </button>
        </div>

        <div v-else class="reatribuicao__confirmacao" data-confirmacao>
            <p class="reatribuicao__pergunta">
                Reatribuir o manifesto {{ manifesto.numero }} de
                <strong>{{ manifesto.motorista_nome ?? 'sem motorista' }}</strong>
                para <strong>{{ motoristaEscolhido?.nome }}</strong>?
            </p>
            <div class="reatribuicao__acoes">
                <button type="button" class="reatribuicao__botao" @click="confirmando = false">
                    Cancelar
                </button>
                <button
                    type="button"
                    class="reatribuicao__botao reatribuicao__botao--primario"
                    data-acao="confirmar-reatribuicao"
                    :disabled="enviando"
                    @click="aplicar"
                >
                    {{ enviando ? 'Aplicando…' : 'Confirmar reatribuição' }}
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped src="@/styles/components/operations/manifests/manifest_reassignment.css"></style>
