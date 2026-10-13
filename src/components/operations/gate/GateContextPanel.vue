<script setup>
import { computed, ref, watch } from 'vue';
import BaseCard from '@/components/all/ui/BaseCard.vue';
import EmptyState from '@/components/all/ui/EmptyState.vue';
import StatusBadge from '@/components/all/ui/StatusBadge.vue';
import GateArrivalForm from '@/components/operations/gate/GateArrivalForm.vue';
import { rotulo } from '@/domain/operations/text.js';
import { portariaContextoService } from '@/services/api/map.api.js';
import { dataEHora } from '@/utils/format.js';
import { localDoServico, rotuloDoTipo, tipoDoServico } from '@/domain/planning/services.js';

/**
 * Contexto da portaria de um veículo da fila (GET /portaria/contexto): CT, placa,
 * motorista, manifesto, ponto inicial/próxima etapa/ponto final (do MANIFESTO), serviços, motivo e horários. A
 * pergunta de pallets só aparece quando o servidor manda `perguntar_pallets`. O porteiro só
 * registra (chegada/saída) — este painel nunca tem aceite de pallets. Sem `podeRegistrar`
 * (monitoramento do admin sem papel de porteiro) o painel é somente leitura.
 */
const props = defineProps({
    manifestoId: { type: [Number, String], required: true },
    placa: { type: String, default: null },
    coluna: { type: String, default: 'aguardando_entrada' },
    podeRegistrar: { type: Boolean, default: false },
});

const emit = defineEmits(['fechar', 'registrado']);

const carregando = ref(false);
const falha = ref(null);
const contexto = ref(null);

const servicos = computed(() => {
    const lista = contexto.value?.servicos ?? [];
    return lista.map((s) => (typeof s === 'string' ? s : s.descricao ?? ([rotuloDoTipo(tipoDoServico(s)), localDoServico(s)?.nome].filter(Boolean).join(' · ') || 'serviço')));
});

const chegadaAutomatica = computed(() => {
    const c = contexto.value?.chegada_automatica;
    return typeof c === 'string' ? dataEHora(c) : 'no momento do registro';
});

const entrada = computed(() => {
    const e = contexto.value?.entrada_registrada;
    return typeof e === 'string' ? dataEHora(e) : e ? 'registrada' : '—';
});

const ct = computed(() => rotulo(contexto.value?.ct ?? contexto.value?.filial ?? contexto.value?.manifesto?.filial));
const saida = computed(() => props.coluna === 'aguardando_saida');

async function carregar() {
    carregando.value = true;
    falha.value = null;
    contexto.value = null;
    const { ok, dados, falha: erro } = await portariaContextoService.contexto({ manifesto_id: props.manifestoId });
    if (ok) {
        contexto.value = dados?.data ?? dados ?? null;
    } else {
        falha.value = erro;
    }
    carregando.value = false;
}

watch(() => props.manifestoId, carregar, { immediate: true });
</script>

<template>
    <BaseCard :titulo="`${saida ? 'Saída' : 'Chegada'} · ${placa ?? ''}`">
        <template #acoes>
            <button type="button" class="botao botao--pequeno" @click="emit('fechar')">Fechar</button>
        </template>

        <EmptyState v-if="carregando" mensagem="Carregando contexto…" tracejado />
        <div v-else-if="falha" class="aviso aviso--erro" role="alert">
            {{ falha.mensagem }}
            <button type="button" class="botao botao--pequeno" @click="carregar">Tentar de novo</button>
        </div>
        <EmptyState v-else-if="!contexto" mensagem="Sem contexto para este veículo." tracejado />
        <div v-else class="bloco-portaria">
            <dl class="contexto">
                <div><dt>CT</dt><dd>{{ ct }}</dd></div>
                <div><dt>Placa</dt><dd>{{ rotulo(contexto.placa ?? placa) }}</dd></div>
                <div><dt>Motorista</dt><dd>{{ rotulo(contexto.motorista) }}</dd></div>
                <div><dt>Manifesto</dt><dd>{{ rotulo(contexto.manifesto?.numero ?? contexto.manifesto) }}</dd></div>
                <div><dt>Ponto inicial do manifesto</dt><dd>{{ rotulo(contexto.ponto_inicial ?? contexto.origem) }}</dd></div>
                <div><dt>Próxima etapa</dt><dd>{{ rotulo(contexto.proxima_etapa ?? contexto.destino) }}</dd></div>
                <div><dt>Ponto final do manifesto</dt><dd>{{ rotulo(contexto.ponto_final) }}</dd></div>
                <div><dt>Motivo da viagem</dt><dd>{{ rotulo(contexto.motivo_viagem) }}</dd></div>
                <div class="contexto__largo"><dt>Serviços</dt><dd>{{ servicos.length ? servicos.join(', ') : '—' }}</dd></div>
                <div><dt>Horário previsto</dt><dd>{{ contexto.horario_previsto ? dataEHora(contexto.horario_previsto) : '—' }}</dd></div>
                <div v-if="!saida"><dt>Chegada</dt><dd>{{ chegadaAutomatica }}</dd></div>
                <div><dt>Entrada no CT</dt><dd>{{ entrada }}</dd></div>
            </dl>

            <p class="contexto__pallets">
                <StatusBadge v-if="contexto.perguntar_pallets" rotulo="Veículo com pallets" tom="warn" />
                <StatusBadge v-else rotulo="Sem pallets / retorno vazio" tom="neutro" />
            </p>

            <GateArrivalForm
                v-if="podeRegistrar"
                :contexto="contexto"
                :coluna="coluna"
                :manifesto-id="manifestoId"
                @registrado="(mensagem) => emit('registrado', mensagem)"
            />
            <p v-else class="aviso aviso--info">Somente leitura: o registro de chegada e saída é feito pelo porteiro.</p>
        </div>
    </BaseCard>
</template>

<style scoped src="@/styles/components/operations/shared/operation_form.css"></style>
<style scoped>
.bloco-portaria {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.contexto {
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px 16px;
}

.contexto dt {
    font-size: 0.6875rem;
    color: var(--muted);
}

.contexto dd {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    overflow-wrap: anywhere;
}

.contexto__largo {
    grid-column: 1 / -1;
}

.contexto__pallets {
    margin: 0;
}

@media (max-width: 520px) {
    .contexto {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}
</style>
