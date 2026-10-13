<script setup>
import { computed, reactive, watch } from 'vue';
import BaseCard from '@/components/all/ui/BaseCard.vue';
import EmptyState from '@/components/all/ui/EmptyState.vue';
import StatusBadge from '@/components/all/ui/StatusBadge.vue';
import PalletChain from '@/components/operations/pallets/PalletChain.vue';
import { quantidadeDe } from '@/domain/pallets/chain.js';
import { validarRecebimento } from '@/domain/operations/receiving.js';

/**
 * Detalhe do recebimento: cadeia de pallets e o formulário do CT (recebido, observação,
 * motivo de divergência). A divergência é destacada e exige motivo, mas nunca bloqueia o
 * aceite. O porteiro não aparece aqui: o informado dele é só registro na cadeia.
 */
const props = defineProps({
    item: { type: Object, required: true },
    cadeia: { type: Object, default: null },
    carregandoCadeia: { type: Boolean, default: false },
    falhaDaCadeia: { type: Object, default: null },
    salvando: { type: Boolean, default: false },
    erro: { type: Object, default: null },
    aviso: { type: String, default: null },
    podeOperar: { type: Boolean, default: true },
});

const emit = defineEmits(['aceitar']);

const form = reactive({ recebido: '', observacao: '', motivo: '' });

watch(() => props.item.manifestoId, () => {
    form.recebido = quantidadeDe(props.item.pallets.recebido_ct) ?? '';
    form.observacao = '';
    form.motivo = '';
}, { immediate: true });

const palletsExibidos = computed(() => props.cadeia ?? props.item.pallets);
const esperado = computed(() => quantidadeDe(palletsExibidos.value?.esperado) ?? quantidadeDe(palletsExibidos.value?.conferido));
const validacao = computed(() => validarRecebimento({ recebido: form.recebido, motivo: form.motivo, esperado: esperado.value }));
const jaAceito = computed(() => props.item.aceito);
const bloqueado = computed(() => jaAceito.value || !props.podeOperar || props.salvando);
const podeAceitar = computed(() => !bloqueado.value && Object.keys(validacao.value.erros).length === 0);
const mostrarErroDeMotivo = computed(() => validacao.value.divergente && validacao.value.erros.motivo);
</script>

<template>
    <BaseCard :titulo="`Manifesto ${item.manifesto} · ${item.placa}`">
        <template #acoes>
            <StatusBadge v-if="jaAceito" rotulo="Aceito" tom="ok" />
            <StatusBadge v-else-if="item.divergente" rotulo="Divergente" tom="bad" />
            <StatusBadge v-if="item.ocorrenciasAbertas > 0" :rotulo="`${item.ocorrenciasAbertas} ocorrência(s)`" tom="warn" />
        </template>

        <div class="bloco">
            <dl class="detalhe">
                <div><dt>Motorista</dt><dd>{{ item.motorista }}</dd></div>
                <div><dt>Serviços</dt><dd>{{ item.servicos }}</dd></div>
            </dl>

            <EmptyState v-if="carregandoCadeia && !cadeia" mensagem="Carregando a cadeia de pallets…" tracejado />
            <p v-else-if="falhaDaCadeia" class="aviso aviso--erro" role="alert">{{ falhaDaCadeia.mensagem }}</p>
            <PalletChain :pallets="palletsExibidos" />

            <form v-if="!jaAceito" class="form" @submit.prevent>
                <div class="campo">
                    <label class="campo__rotulo" for="rec-recebido">Pallets recebidos (conferido na descarga)</label>
                    <input
                        id="rec-recebido"
                        v-model="form.recebido"
                        class="campo__entrada"
                        :class="{ 'campo__entrada--erro': validacao.erros.recebido && form.recebido !== '' }"
                        type="number"
                        inputmode="numeric"
                        min="0"
                        step="1"
                        :disabled="bloqueado"
                    />
                    <span v-if="esperado !== null" class="campo__dica">Esperado: {{ esperado }}</span>
                </div>

                <p v-if="validacao.divergente" class="aviso aviso--erro" role="alert">
                    Divergência de {{ validacao.diferenca > 0 ? '+' : '' }}{{ validacao.diferenca }} em relação ao esperado.
                    O aceite não é bloqueado, mas a divergência vira ocorrência para o SAC.
                </p>

                <div v-if="validacao.divergente" class="campo">
                    <label class="campo__rotulo" for="rec-motivo">Motivo da divergência</label>
                    <textarea id="rec-motivo" v-model="form.motivo" class="campo__entrada" :class="{ 'campo__entrada--erro': mostrarErroDeMotivo }" :disabled="bloqueado"></textarea>
                    <span v-if="mostrarErroDeMotivo" class="campo__erro">{{ validacao.erros.motivo }}</span>
                </div>

                <div class="campo">
                    <label class="campo__rotulo" for="rec-obs">Observação</label>
                    <textarea id="rec-obs" v-model="form.observacao" class="campo__entrada" :disabled="bloqueado"></textarea>
                </div>

                <p v-if="erro" class="aviso aviso--erro" role="alert">{{ erro.mensagem }}</p>
                <p v-if="aviso" class="aviso aviso--ok" role="status">{{ aviso }}</p>
                <p v-if="!podeOperar" class="aviso aviso--info">Somente leitura: seu perfil não aceita recebimentos.</p>

                <button v-if="podeOperar" type="button" class="botao botao--ok botao--grande" :disabled="!podeAceitar" data-acao="aceitar" @click="emit('aceitar', { ...form })">
                    ACEITAR RECEBIMENTO
                </button>
            </form>
            <p v-else-if="aviso" class="aviso aviso--ok" role="status">{{ aviso }}</p>
        </div>
    </BaseCard>
</template>

<style scoped src="@/styles/components/operations/shared/operation_form.css"></style>
<style scoped src="@/styles/pages/operations/operation_page.css"></style>
