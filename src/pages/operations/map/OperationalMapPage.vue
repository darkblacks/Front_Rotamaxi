<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BaseCard from '@/components/all/ui/BaseCard.vue';
import EmptyState from '@/components/all/ui/EmptyState.vue';
import StatusBadge from '@/components/all/ui/StatusBadge.vue';
import IndicadorTempoReal from '@/components/all/status/RealtimeIndicator.vue';
import OperationalMap from '@/components/operations/map/OperationalMap.vue';
import ManifestSelector from '@/components/operations/map/ManifestSelector.vue';
import StopList from '@/components/operations/map/StopList.vue';
import EtaAlertCard from '@/components/operations/map/EtaAlertCard.vue';
import OccurrencesPanel from '@/components/operations/map/OccurrencesPanel.vue';
import MapLegend from '@/components/operations/map/MapLegend.vue';
import PalletChain from '@/components/operations/pallets/PalletChain.vue';
import { useMapaStore, INTERVALO_FALLBACK_MS } from '@/stores/map.store.js';
import { useTempoRealStore } from '@/stores/realtime.store.js';
import { badgeDoManifesto, textoDaCarga } from '@/domain/planning/status.js';
import { formatarAtraso } from '@/domain/map/delay.js';
import { dataEHora } from '@/utils/format.js';

/**
 * Mapa Operacional (/painel/operacoes/mapa). Mapa dominante + painel do manifesto.
 * Realtime: canal privado `manifesto.{id}` (deltas). Sem polling curto: se o socket cair,
 * o painel refaz o GET ao reconectar e, enquanto indisponível, a cada 30s.
 */
const mapa = useMapaStore();
const tempoReal = useTempoRealStore();
const route = useRoute();
const router = useRouter();

const aba = ref('paradas');
const etapaDestacadaId = ref(null);
const refMapa = ref(null);
const agora = ref(Date.now());

let relogio = null;
let fallback = null;
let debounce = null;
let pararReconexao = null;

const selecionado = computed(() => mapa.manifestoSelecionado);
const atrasoDoManifesto = computed(() => mapa.etapaEmAtraso);
const pallets = computed(() => mapa.detalhe?.pallets ?? null);
const avisos = computed(() => mapa.detalhe?.avisos ?? []);
const semListaNemFalha = computed(() => !mapa.carregandoLista && !mapa.falhaLista && mapa.manifestos.length === 0);
const resumos = computed(() => (mapa.selecionadoId === null ? mapa.manifestos : []));

async function escolher(id) {
    etapaDestacadaId.value = null;
    await mapa.selecionar(id);
    router.replace({ query: id === null ? {} : { manifesto: String(id) } });
}

function aoFiltrar(parcial) {
    mapa.definirFiltros(parcial);
    clearTimeout(debounce);
    debounce = setTimeout(() => mapa.carregarLista(), 400);
}

function limpar() {
    mapa.limparFiltros();
    mapa.carregarLista();
}

function aoSelecionarEtapa(id) {
    etapaDestacadaId.value = id;
    refMapa.value?.focarEtapa(id);
}

function iniciarFallback() {
    // Fallback lento: só consulta se o socket estiver indisponível. Nunca < 30s.
    fallback = setInterval(() => {
        if (!tempoReal.conectado) mapa.recarregarTudo();
    }, INTERVALO_FALLBACK_MS);
}

onMounted(async () => {
    relogio = setInterval(() => { agora.value = Date.now(); }, 10000);
    iniciarFallback();

    // Reconexão: o evento é só delta, então volta a ler o estado completo e reassina.
    pararReconexao = tempoReal.aoReconectar(() => {
        mapa.reassinar();
        mapa.recarregarTudo();
    });

    mapa.carregarFiliais();

    const inicial = Number.parseInt(route.query.manifesto, 10);
    await mapa.carregarLista();
    if (Number.isInteger(inicial) && inicial > 0) {
        await mapa.selecionar(inicial);
    }
});

onUnmounted(() => {
    clearInterval(relogio);
    clearInterval(fallback);
    clearTimeout(debounce);
    pararReconexao?.();
    mapa.cancelarAssinaturas();
});

// O socket pode subir depois da montagem; assinar sem Echo é no-op, então reassina ao conectar.
watch(() => tempoReal.conectado, (conectado) => {
    if (conectado) mapa.reassinar();
});

watch(() => mapa.somenteAtivos, () => mapa.carregarLista());
</script>

<template>
    <section class="mapa-pagina">
        <div class="mapa-pagina__cabecalho">
            <h1 class="mapa-pagina__titulo">Mapa operacional</h1>
            <span class="mapa-pagina__recorte">
                <template v-if="mapa.ultimaAtualizacao">Atualizado {{ dataEHora(mapa.ultimaAtualizacao) }}</template>
                <IndicadorTempoReal />
                <label class="mapa-pagina__ativos">
                    <input v-model="mapa.somenteAtivos" type="checkbox" /> Somente ativos
                </label>
                <button type="button" class="mapa-pagina__botao" @click="mapa.recarregarTudo()">Atualizar</button>
            </span>
        </div>

        <p v-if="!tempoReal.conectado" class="mapa-pagina__aviso" role="status">
            Tempo real indisponível. Os dados são relidos a cada 30 segundos e quando a conexão voltar.
        </p>

        <BaseCard>
            <ManifestSelector
                :filtros="mapa.filtros"
                :manifestos="mapa.manifestos"
                :filiais="mapa.filiais"
                :selecionado-id="mapa.selecionadoId"
                :mostrar="mapa.mostrar"
                :carregando="mapa.carregandoLista"
                @filtros="aoFiltrar"
                @selecionar="escolher"
                @mostrar="(v) => (mapa.mostrar = v)"
                @limpar="limpar"
            />
        </BaseCard>

        <div v-if="mapa.falhaLista" class="mapa-pagina__falha" role="alert">
            <span>{{ mapa.falhaLista.mensagem }}</span>
            <button type="button" class="mapa-pagina__botao" @click="mapa.recarregarTudo()">Tentar de novo</button>
        </div>

        <div class="mapa-pagina__grade">
            <div class="mapa-pagina__mapa">
                <OperationalMap
                    ref="refMapa"
                    :etapas="mapa.etapas"
                    :rota="mapa.detalhe?.rota ?? null"
                    :trajeto="mapa.detalhe?.trajeto ?? null"
                    :posicoes="mapa.detalhe?.posicoes ?? null"
                    :resumos="resumos"
                    :manifesto-id="mapa.selecionadoId"
                    :mostrar="mapa.mostrar"
                    :etapa-destacada-id="etapaDestacadaId"
                    :agora="agora"
                    @selecionar-etapa="aoSelecionarEtapa"
                    @selecionar-manifesto="escolher"
                >
                    <div v-if="mapa.carregandoLista || mapa.carregandoDetalhe" class="mapa-pagina__sobre">Carregando…</div>
                    <div v-else-if="semListaNemFalha" class="mapa-pagina__sobre">Nenhum manifesto encontrado para estes filtros.</div>
                </OperationalMap>
            </div>

            <aside class="mapa-pagina__painel" aria-label="Painel do manifesto">
                <template v-if="mapa.selecionadoId === null">
                    <BaseCard titulo="Manifestos no mapa">
                        <EmptyState v-if="mapa.manifestos.length === 0" :mensagem="mapa.carregandoLista ? 'Carregando manifestos…' : 'Nenhum manifesto para exibir.'" tracejado />
                        <ul v-else class="mapa-pagina__lista">
                            <li v-for="m in mapa.manifestos" :key="m.id">
                                <button type="button" class="mapa-pagina__item" @click="escolher(m.id)">
                                    <span class="mapa-pagina__item-titulo">MAN {{ m.numero ?? m.id }} · {{ m.placa ?? 'sem placa' }}</span>
                                    <span class="mapa-pagina__item-meta">
                                        {{ m.motorista_nome ?? 'sem motorista' }} · {{ m.etapas_concluidas ?? 0 }}/{{ m.etapas_total ?? 0 }} etapas
                                    </span>
                                    <span v-if="m.atraso_minutos > 0" class="mapa-pagina__item-atraso">atraso {{ formatarAtraso(m.atraso_minutos) }}</span>
                                </button>
                            </li>
                        </ul>
                    </BaseCard>
                </template>

                <template v-else>
                    <div v-if="mapa.falhaDetalhe" class="mapa-pagina__falha" role="alert">
                        <span>{{ mapa.falhaDetalhe.mensagem }}</span>
                        <button type="button" class="mapa-pagina__botao" @click="mapa.carregarDetalhe()">Tentar de novo</button>
                    </div>
                    <EmptyState v-else-if="mapa.carregandoDetalhe && !mapa.detalhe" mensagem="Carregando manifesto…" tracejado />

                    <template v-else-if="mapa.detalhe">
                        <BaseCard>
                            <div class="mapa-pagina__resumo">
                                <strong>MAN {{ selecionado?.numero ?? selecionado?.id }} · {{ selecionado?.placa ?? 'sem placa' }}</strong>
                                <StatusBadge v-if="selecionado?.status" :rotulo="`Manifesto: ${badgeDoManifesto(selecionado).rotulo}`" tom="info" />
                            </div>
                            <span class="mapa-pagina__meta">
                                {{ selecionado?.motorista_nome ?? 'sem motorista' }}
                                <template v-if="selecionado?.filial"> · {{ selecionado.filial.nome }}</template>
                                · {{ selecionado?.etapas_concluidas ?? 0 }}/{{ selecionado?.etapas_total ?? 0 }} etapas
                            </span>
                            <span class="mapa-pagina__meta" data-bloco="carga">{{ textoDaCarga(mapa.detalhe) }}</span>
                            <EtaAlertCard :alerta="atrasoDoManifesto" />
                            <ul v-if="avisos.length" class="mapa-pagina__avisos">
                                <li v-for="(a, i) in avisos" :key="i">{{ a }}</li>
                            </ul>
                            <PalletChain v-if="pallets" :pallets="pallets" compacto />
                        </BaseCard>

                        <BaseCard>
                            <div class="mapa-pagina__abas" role="tablist">
                                <button type="button" role="tab" :aria-selected="aba === 'paradas'" :class="{ 'mapa-pagina__aba--ativa': aba === 'paradas' }" class="mapa-pagina__aba" @click="aba = 'paradas'">
                                    Etapas ({{ mapa.etapas.length }})
                                </button>
                                <button type="button" role="tab" :aria-selected="aba === 'ocorrencias'" :class="{ 'mapa-pagina__aba--ativa': aba === 'ocorrencias' }" class="mapa-pagina__aba" @click="aba = 'ocorrencias'">
                                    Ocorrências ({{ mapa.ocorrenciasAbertas.length }})
                                </button>
                            </div>
                            <template v-if="aba === 'paradas'">
                                <EmptyState v-if="mapa.etapas.length === 0" mensagem="Este manifesto ainda não tem etapas definidas." tracejado />
                                <StopList v-else :etapas="mapa.etapas" :servicos="mapa.detalhe.servicos ?? []" :selecionada-id="etapaDestacadaId" @selecionar="aoSelecionarEtapa" />
                            </template>
                            <OccurrencesPanel v-else :ocorrencias="mapa.detalhe.ocorrencias ?? []" />
                        </BaseCard>

                        <BaseCard titulo="Legenda">
                            <MapLegend :posicoes="mapa.detalhe.posicoes" :agora="agora" />
                        </BaseCard>
                    </template>
                </template>
            </aside>
        </div>
    </section>
</template>

<style scoped src="@/styles/pages/operations/map/operational_map_page.css"></style>
