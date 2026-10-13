<script setup>
import { computed, reactive, watch } from 'vue';
import BaseCard from '@/components/all/ui/BaseCard.vue';
import StatusBadge from '@/components/all/ui/StatusBadge.vue';
import TimestampField from '@/components/operations/shared/TimestampField.vue';
import { CAMPOS_DE_TEMPO, errosDeHorario, pendenciasDoAceite } from '@/domain/operations/conference.js';
import { dataEHora } from '@/utils/format.js';

/**
 * Painel do Conferente para uma etapa de coleta: equipe, pallets, carimbos de início/fim
 * da conferência e do carregamento, observações e o aceite explícito da carga conferida.
 */
const props = defineProps({
    item: { type: Object, required: true },
    salvando: { type: Boolean, default: false },
    erro: { type: Object, default: null },
    aviso: { type: String, default: null },
    // Falso para quem não é conferente/admin: mostra os dados mas bloqueia as ações.
    podeOperar: { type: Boolean, default: true },
});

const emit = defineEmits(['salvar', 'aceitar']);

const form = reactive({ equipe: '', pallets: '', observacoes: '', conferencia_inicio: null, conferencia_fim: null, carregamento_inicio: null, carregamento_fim: null });

function carregarForm() {
    const c = props.item.conferencia;
    form.equipe = c.equipe ?? '';
    form.pallets = c.pallets ?? '';
    form.observacoes = c.observacoes ?? '';
    CAMPOS_DE_TEMPO.forEach(({ chave }) => { form[chave] = c[chave] ?? null; });
}

// Reinicia ao trocar de etapa ou quando o aceite muda; não apaga o que o conferente digita
// quando a lista só é atualizada pelo tempo real.
watch(() => [props.item.etapaId, props.item.conferencia.aceite_em], carregarForm, { immediate: true });

const aceito = computed(() => Boolean(props.item.conferencia.aceite_em));
const bloqueado = computed(() => aceito.value || !props.podeOperar || props.salvando);
const pendencias = computed(() => pendenciasDoAceite(form));
const errosHorario = computed(() => errosDeHorario(form));
const podeAceitar = computed(() => !bloqueado.value && pendencias.value.length === 0 && errosHorario.value.length === 0);
</script>

<template>
    <BaseCard :titulo="`Manifesto ${item.manifesto} · ${item.placa}`">
        <template #acoes>
            <StatusBadge v-if="aceito" rotulo="Carga aceita" tom="ok" />
        </template>

        <div class="bloco">
            <dl class="detalhe">
                <div><dt>Serviço</dt><dd>{{ item.servico }}</dd></div>
                <div><dt>Cliente</dt><dd>{{ item.cliente }}</dd></div>
                <div><dt>Motorista</dt><dd>{{ item.motorista }}</dd></div>
                <div><dt>Chegada</dt><dd>{{ item.chegadaReal ? dataEHora(item.chegadaReal) : '—' }}</dd></div>
            </dl>

            <p v-if="aceito" class="aviso aviso--ok">
                Aceito em {{ dataEHora(item.conferencia.aceite_em) }}<template v-if="item.conferencia.aceite_por"> por {{ item.conferencia.aceite_por.nome ?? item.conferencia.aceite_por }}</template>.
                Os registros não podem mais ser alterados.
            </p>
            <p v-else-if="!podeOperar" class="aviso aviso--info">Somente leitura: seu perfil não opera a conferência.</p>

            <form class="form" @submit.prevent="emit('salvar', { ...form })">
                <div class="form__grade">
                    <div class="campo">
                        <label class="campo__rotulo" for="conf-equipe">Equipe</label>
                        <input id="conf-equipe" v-model="form.equipe" class="campo__entrada" type="text" autocomplete="off" :disabled="bloqueado" placeholder="Nomes ou nº da equipe" />
                    </div>
                    <div class="campo">
                        <label class="campo__rotulo" for="conf-pallets">Quantidade de pallets</label>
                        <input id="conf-pallets" v-model="form.pallets" class="campo__entrada" type="number" inputmode="numeric" min="0" step="1" :disabled="bloqueado" />
                    </div>
                </div>

                <div class="form__grade">
                    <TimestampField v-model="form.conferencia_inicio" rotulo="Início da conferência" :desabilitado="bloqueado" />
                    <TimestampField v-model="form.conferencia_fim" rotulo="Fim da conferência" :desabilitado="bloqueado" />
                    <TimestampField v-model="form.carregamento_inicio" rotulo="Início do carregamento" :desabilitado="bloqueado" />
                    <TimestampField v-model="form.carregamento_fim" rotulo="Fim do carregamento" :desabilitado="bloqueado" />
                </div>

                <div class="campo">
                    <label class="campo__rotulo" for="conf-obs">Observações</label>
                    <textarea id="conf-obs" v-model="form.observacoes" class="campo__entrada" :disabled="bloqueado"></textarea>
                </div>

                <p v-for="e in errosHorario" :key="e" class="aviso aviso--erro">{{ e }}</p>
                <p v-if="erro" class="aviso aviso--erro" role="alert">{{ erro.mensagem }}</p>
                <p v-if="aviso" class="aviso aviso--ok" role="status">{{ aviso }}</p>

                <div v-if="!aceito && podeOperar" class="form__acoes">
                    <button type="submit" class="botao" :disabled="bloqueado">Salvar</button>
                </div>

                <template v-if="!aceito && podeOperar">
                    <ul v-if="pendencias.length" class="lista-simples">
                        <li v-for="p in pendencias" :key="p">{{ p }}</li>
                    </ul>
                    <button type="button" class="botao botao--ok botao--grande" :disabled="!podeAceitar" data-acao="aceitar" @click="emit('aceitar', { ...form })">
                        ACEITAR CARGA / PALLETS CONFERIDOS
                    </button>
                </template>
            </form>
        </div>
    </BaseCard>
</template>

<style scoped src="@/styles/components/operations/shared/operation_form.css"></style>
<style scoped src="@/styles/pages/operations/operation_page.css"></style>
