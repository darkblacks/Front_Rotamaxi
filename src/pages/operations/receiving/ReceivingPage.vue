<script setup>
import { computed, onMounted } from 'vue';
import EstadoVazio from '@/components/all/ui/EmptyState.vue';
import IndicadorTempoReal from '@/components/all/status/RealtimeIndicator.vue';
import StatusBadge from '@/components/all/ui/StatusBadge.vue';
import ReceivingPanel from '@/components/operations/receiving/ReceivingPanel.vue';
import { useOperationalRealtime } from '@/composables/useOperationalRealtime.js';
import { permissoesDeAcao } from '@/domain/access/actions.js';
import { STATUS_DE_RECEBIMENTO } from '@/domain/operations/receiving.js';
import { quantidadeDe } from '@/domain/pallets/chain.js';
import { useAuthStore } from '@/stores/auth.store.js';
import { useRecebimentosStore } from '@/stores/receiving.store.js';

/**
 * Recebimentos do CT (/painel/operacoes/recebimentos): a Portaria só registra presença; é
 * aqui que a equipe do CT registra o recebido e dá o aceite real, fechando a custódia.
 */
const recebimentos = useRecebimentosStore();
const auth = useAuthStore();
const permissoes = computed(() => permissoesDeAcao(auth.papeis));

useOperationalRealtime({
    alvo: () => ({ filialIds: [auth.filialDoUsuario], manifestoIds: recebimentos.manifestoIds }),
    recarregar: () => recebimentos.carregar(),
});

function trocarStatus(chave) {
    if (recebimentos.definirStatus(chave)) recebimentos.carregar();
}

const resumo = (item) => `esperado ${quantidadeDe(item.pallets.esperado) ?? '—'} · recebido ${quantidadeDe(item.pallets.recebido_ct) ?? '—'}`;

onMounted(() => recebimentos.carregar());
</script>

<template>
    <section class="pagina">
        <div class="pagina__cabecalho">
            <h1 class="pagina__titulo">Recebimentos CT</h1>
            <span class="pagina__recorte">atualiza em tempo real <IndicadorTempoReal /></span>
        </div>

        <div class="abas" role="group" aria-label="Situação do recebimento">
            <button
                v-for="aba in STATUS_DE_RECEBIMENTO"
                :key="aba.chave"
                type="button"
                class="abas__aba"
                :class="{ 'abas__aba--ativa': recebimentos.status === aba.chave }"
                :aria-pressed="recebimentos.status === aba.chave"
                @click="trocarStatus(aba.chave)"
            >
                {{ aba.rotulo }}
            </button>
        </div>

        <div v-if="recebimentos.falha" class="pagina__falha" role="alert">
            <span>{{ recebimentos.falha.mensagem }}</span>
            <button type="button" class="botao botao--pequeno" @click="recebimentos.carregar()">Tentar de novo</button>
        </div>

        <EstadoVazio v-else-if="recebimentos.carregando" mensagem="Carregando os recebimentos…" tracejado />
        <EstadoVazio v-else-if="recebimentos.itens.length === 0" mensagem="Nenhum recebimento nesta situação." tracejado />

        <div v-else class="trabalho">
            <div class="trabalho__lista">
                <button
                    v-for="item in recebimentos.itens"
                    :key="item.manifestoId"
                    type="button"
                    class="item"
                    :class="{ 'item--ativo': item.manifestoId === recebimentos.selecionadoId, 'item--alerta': item.divergente }"
                    :data-manifesto="item.manifestoId"
                    @click="recebimentos.selecionar(item.manifestoId)"
                >
                    <span class="item__topo">
                        <span class="item__titulo">{{ item.placa }} · MAN {{ item.manifesto }}</span>
                        <StatusBadge v-if="item.aceito" rotulo="Aceito" tom="ok" />
                        <StatusBadge v-else-if="item.divergente" rotulo="Divergente" tom="bad" />
                    </span>
                    <span class="item__meta">{{ item.motorista }} · {{ item.servicos }}</span>
                    <span class="item__meta">{{ resumo(item) }}</span>
                </button>
            </div>

            <ReceivingPanel
                v-if="recebimentos.selecionado"
                :key="recebimentos.selecionado.manifestoId"
                :item="recebimentos.selecionado"
                :cadeia="recebimentos.cadeia"
                :carregando-cadeia="recebimentos.carregandoCadeia"
                :falha-da-cadeia="recebimentos.falhaDaCadeia"
                :salvando="recebimentos.salvando"
                :erro="recebimentos.erroDaAcao"
                :aviso="recebimentos.aviso"
                :pode-operar="permissoes.operarRecebimento"
                @aceitar="(f) => recebimentos.aceitar(recebimentos.selecionado.manifestoId, f)"
            />
            <EstadoVazio v-else mensagem="Selecione um recebimento para ver a cadeia de pallets." tracejado />
        </div>
    </section>
</template>

<style scoped src="@/styles/pages/operations/operation_page.css"></style>
<style scoped src="@/styles/components/operations/shared/operation_form.css"></style>
