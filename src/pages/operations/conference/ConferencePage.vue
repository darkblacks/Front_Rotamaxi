<script setup>
import { computed, onMounted } from 'vue';
import EstadoVazio from '@/components/all/ui/EmptyState.vue';
import IndicadorTempoReal from '@/components/all/status/RealtimeIndicator.vue';
import StatusBadge from '@/components/all/ui/StatusBadge.vue';
import ConferencePanel from '@/components/operations/conference/ConferencePanel.vue';
import { useOperationalRealtime } from '@/composables/useOperationalRealtime.js';
import { permissoesDeAcao } from '@/domain/access/actions.js';
import { STATUS_DA_FILA } from '@/domain/operations/conference.js';
import { useAuthStore } from '@/stores/auth.store.js';
import { useConferenciaStore } from '@/stores/conference.store.js';
import { horaCurta } from '@/utils/format.js';

/**
 * Fila de demandas de coleta do Conferente (/painel/operacoes/conferencia). A demanda sobe
 * quando a coleta vira CHEGOU (`manifest.conferencia.demanda`); aqui o conferente registra
 * equipe, pallets e tempos e dá o aceite explícito da carga conferida.
 */
const conferencia = useConferenciaStore();
const auth = useAuthStore();
const permissoes = computed(() => permissoesDeAcao(auth.papeis));

useOperationalRealtime({
    alvo: () => ({ filialIds: [auth.filialDoUsuario], manifestoIds: conferencia.manifestoIds }),
    recarregar: () => conferencia.carregar(),
});

function trocarStatus(chave) {
    if (conferencia.definirStatus(chave)) conferencia.carregar();
}

onMounted(() => conferencia.carregar());
</script>

<template>
    <section class="pagina">
        <div class="pagina__cabecalho">
            <h1 class="pagina__titulo">Conferência / Coletas</h1>
            <span class="pagina__recorte">atualiza em tempo real <IndicadorTempoReal /></span>
        </div>

        <div class="abas" role="group" aria-label="Situação da conferência">
            <button
                v-for="aba in STATUS_DA_FILA"
                :key="aba.chave"
                type="button"
                class="abas__aba"
                :class="{ 'abas__aba--ativa': conferencia.status === aba.chave }"
                :aria-pressed="conferencia.status === aba.chave"
                @click="trocarStatus(aba.chave)"
            >
                {{ aba.rotulo }}
            </button>
        </div>

        <div v-if="conferencia.falha" class="pagina__falha" role="alert">
            <span>{{ conferencia.falha.mensagem }}</span>
            <button type="button" class="botao botao--pequeno" @click="conferencia.carregar()">Tentar de novo</button>
        </div>

        <EstadoVazio v-else-if="conferencia.carregando" mensagem="Carregando a fila de coletas…" tracejado />
        <EstadoVazio v-else-if="conferencia.itens.length === 0" mensagem="Nenhuma coleta nesta situação." tracejado />

        <div v-else class="trabalho">
            <div class="trabalho__lista">
                <button
                    v-for="item in conferencia.itens"
                    :key="item.etapaId"
                    type="button"
                    class="item"
                    :class="{ 'item--ativo': item.etapaId === conferencia.selecionadaId }"
                    :data-etapa="item.etapaId"
                    @click="conferencia.selecionar(item.etapaId)"
                >
                    <span class="item__topo">
                        <span class="item__titulo">{{ item.placa }} · MAN {{ item.manifesto }}</span>
                        <StatusBadge v-if="item.conferencia.aceite_em" rotulo="Aceita" tom="ok" />
                        <span v-else class="item__meta">{{ item.chegadaReal ? `chegou ${horaCurta(item.chegadaReal)}` : 'a caminho' }}</span>
                    </span>
                    <span class="item__meta">{{ item.cliente }} · {{ item.servico }}</span>
                    <span class="item__meta">Motorista: {{ item.motorista }}</span>
                </button>
            </div>

            <ConferencePanel
                v-if="conferencia.selecionada"
                :key="conferencia.selecionada.etapaId"
                :item="conferencia.selecionada"
                :salvando="conferencia.salvando"
                :erro="conferencia.erroDaAcao"
                :aviso="conferencia.aviso"
                :pode-operar="permissoes.operarConferencia"
                @salvar="(f) => conferencia.salvar(conferencia.selecionada.etapaId, f)"
                @aceitar="(f) => conferencia.aceitar(conferencia.selecionada.etapaId, f)"
            />
            <EstadoVazio v-else mensagem="Selecione uma coleta para registrar a conferência." tracejado />
        </div>
    </section>
</template>

<style scoped src="@/styles/pages/operations/operation_page.css"></style>
<style scoped src="@/styles/components/operations/shared/operation_form.css"></style>
