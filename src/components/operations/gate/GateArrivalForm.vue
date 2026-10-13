<script setup>
import { computed, reactive, ref } from 'vue';
import { montarCorpoDaChegada, montarCorpoDaSaida, validarChegada } from '@/domain/gate/arrival.js';
import { deInputLocal, paraInputLocal } from '@/domain/operations/text.js';
import { portariaRegistroService } from '@/services/api/operations.api.js';

/**
 * Registro do porteiro: hodômetro, pallets informados (só se `perguntar_pallets`) e a
 * chegada/saída. O porteiro apenas REGISTRA: este formulário não tem aceite de pallets nem
 * ação de custódia. Chegada é automática; ajustar o horário exige justificativa.
 */
const props = defineProps({
    contexto: { type: Object, required: true },
    // 'aguardando_entrada' registra chegada; 'aguardando_saida' registra saída.
    coluna: { type: String, default: 'aguardando_entrada' },
    manifestoId: { type: [Number, String], required: true },
});

const emit = defineEmits(['registrado']);

const form = reactive({ hodometro: '', palletsInformados: '', observacao: '', justificativa: '' });
const ajustarHorario = ref(false);
const chegadaLocal = ref(paraInputLocal(new Date()));
const enviando = ref(false);
const tentou = ref(false);
const falha = ref(null);

const saida = computed(() => props.coluna === 'aguardando_saida');
const perguntarPallets = computed(() => Boolean(props.contexto.perguntar_pallets) && !saida.value);
const ultimo = computed(() => props.contexto.hodometro_ultimo?.km ?? null);
const entradaJaRegistrada = computed(() => Boolean(props.contexto.entrada_registrada) && !saida.value);

const validacao = computed(() => validarChegada({
    hodometro: form.hodometro,
    perguntarPallets: perguntarPallets.value,
    palletsInformados: form.palletsInformados,
    ajustarHorario: ajustarHorario.value,
    chegadaEm: deInputLocal(chegadaLocal.value),
    justificativa: form.justificativa,
    ultimoHodometro: ultimo.value,
}));

// Na saída o hodômetro é opcional; na chegada é obrigatório.
const erros = computed(() => (saida.value ? {} : validacao.value.erros));
const podeEnviar = computed(() => !enviando.value && Object.keys(erros.value).length === 0);

async function enviar() {
    tentou.value = true;
    if (!podeEnviar.value) return;
    enviando.value = true;
    falha.value = null;

    const resultado = saida.value
        ? await portariaRegistroService.saida(montarCorpoDaSaida({ manifestoId: props.manifestoId, hodometro: form.hodometro }))
        : await portariaRegistroService.chegada(montarCorpoDaChegada({
            manifestoId: props.manifestoId,
            hodometro: form.hodometro,
            perguntarPallets: perguntarPallets.value,
            palletsInformados: form.palletsInformados,
            ajustarHorario: ajustarHorario.value,
            chegadaEm: deInputLocal(chegadaLocal.value),
            justificativa: form.justificativa,
            observacao: form.observacao,
        }));

    enviando.value = false;
    if (resultado.ok) {
        emit('registrado', saida.value ? 'Saída registrada.' : 'Chegada registrada. A equipe do CT já pode receber.');
    } else {
        falha.value = resultado.falha;
    }
}
</script>

<template>
    <form class="form" novalidate @submit.prevent="enviar">
        <p v-if="entradaJaRegistrada" class="aviso aviso--info">Entrada já registrada para este manifesto. Registrar de novo cria um novo registro de passagem.</p>

        <div class="campo">
            <label class="campo__rotulo" for="gate-km">Hodômetro (km){{ saida ? ' · opcional' : '' }}</label>
            <input
                id="gate-km"
                v-model="form.hodometro"
                class="campo__entrada"
                :class="{ 'campo__entrada--erro': tentou && erros.hodometro }"
                type="number"
                inputmode="numeric"
                min="0"
                step="1"
                autocomplete="off"
                :disabled="enviando"
            />
            <span v-if="ultimo !== null" class="campo__dica">Último registrado: {{ ultimo }} km</span>
            <span v-if="tentou && erros.hodometro" class="campo__erro">{{ erros.hodometro }}</span>
            <span v-for="a in validacao.avisos" v-show="!saida" :key="a" class="campo__dica">{{ a }}</span>
        </div>

        <div v-if="perguntarPallets" class="campo" data-bloco="pallets">
            <label class="campo__rotulo" for="gate-pallets">Pallets informados pelo motorista</label>
            <p v-if="contexto.pallets_esperados != null" class="campo__dica">Esperado pelo manifesto: <strong>{{ contexto.pallets_esperados }}</strong></p>
            <div class="campo__linha">
                <input
                    id="gate-pallets"
                    v-model="form.palletsInformados"
                    class="campo__entrada"
                    :class="{ 'campo__entrada--erro': tentou && erros.pallets }"
                    type="number"
                    inputmode="numeric"
                    min="0"
                    step="1"
                    :disabled="enviando"
                />
                <button type="button" class="botao botao--pequeno" :disabled="enviando" @click="form.palletsInformados = '0'">Nenhum (0)</button>
            </div>
            <span class="campo__dica">Apenas registro do que foi informado: o aceite é da equipe do CT.</span>
            <span v-if="tentou && erros.pallets" class="campo__erro">{{ erros.pallets }}</span>
        </div>

        <template v-if="!saida">
            <label class="check">
                <input v-model="ajustarHorario" type="checkbox" :disabled="enviando" />
                <span>Ajustar horário de chegada (exige justificativa)</span>
            </label>
            <template v-if="ajustarHorario">
                <div class="campo">
                    <label class="campo__rotulo" for="gate-chegada">Horário de chegada</label>
                    <input id="gate-chegada" v-model="chegadaLocal" class="campo__entrada" type="datetime-local" :disabled="enviando" />
                    <span v-if="tentou && erros.chegada" class="campo__erro">{{ erros.chegada }}</span>
                </div>
                <div class="campo">
                    <label class="campo__rotulo" for="gate-just">Justificativa do ajuste</label>
                    <textarea id="gate-just" v-model="form.justificativa" class="campo__entrada" :class="{ 'campo__entrada--erro': tentou && erros.justificativa }" :disabled="enviando"></textarea>
                    <span v-if="tentou && erros.justificativa" class="campo__erro">{{ erros.justificativa }}</span>
                </div>
            </template>

            <div class="campo">
                <label class="campo__rotulo" for="gate-obs">Observação (opcional)</label>
                <textarea id="gate-obs" v-model="form.observacao" class="campo__entrada" :disabled="enviando"></textarea>
            </div>
        </template>

        <p v-if="falha" class="aviso aviso--erro" role="alert">{{ falha.mensagem }}</p>

        <button type="submit" class="botao botao--primario botao--grande" :disabled="enviando" data-acao="registrar">
            {{ enviando ? 'Registrando…' : saida ? 'Registrar saída' : 'Registrar chegada e entrada' }}
        </button>
    </form>
</template>

<style scoped src="@/styles/components/operations/shared/operation_form.css"></style>
<style scoped>
.check {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    font-size: 0.875rem;
}

.check input {
    width: 22px;
    height: 22px;
}
</style>
