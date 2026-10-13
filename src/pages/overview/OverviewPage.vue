<script setup>
import { onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CanhotosPendentes from '@/components/operations/manifests/PendingReceipts.vue';
import DivergenciasAbertas from '@/components/operations/divergences/OpenDivergences.vue';
import EntregasPorFilial from '@/components/overview/DeliveriesByBranch.vue';
import FiltrosDoDashboard from '@/components/overview/DashboardFilters.vue';
import IndicadorTempoReal from '@/components/all/status/RealtimeIndicator.vue';
import PainelAoVivo from '@/components/overview/LivePanel.vue';
import PainelCard from '@/components/all/ui/BaseCard.vue';
import SerieDeOcorrencias from '@/components/overview/IncidentSeries.vue';
import TileKpi from '@/components/all/ui/KpiTile.vue';
import { agrupar } from '@/services/realtime/realtime.service.js';
import { filtrosDaQuery, useDashboardStore } from '@/stores/dashboard.store.js';
import { acontecimentoDaDivergencia, acontecimentoDoProgresso, useTempoRealStore } from '@/stores/realtime.store.js';

const dashboard = useDashboardStore();
const tempoReal = useTempoRealStore();
const route = useRoute();
const router = useRouter();

/**
 * Uma carga por recorte: os agregados enchem os tiles e o gráfico, os painéis trazem as
 * linhas nominais, e o que o servidor já registrou semeia o cartão "Ao vivo" — que daí em
 * diante recebe os acontecimentos pelo canal privado do admin.
 */
async function carregar() {
    // O recorte mudou: o que estava na lista é de outro período.
    tempoReal.limpar();

    await relerRecorte();
}

/**
 * Relê o recorte **sem** esvaziar o cartão: é o caminho da reconexão e o do acontecimento
 * que chega pelo canal. A semente passa pela mesma chave de acontecimento da transmissão, e
 * por isso a divergência que já entrou ao vivo não vira uma segunda linha.
 */
async function relerRecorte() {
    dashboard.carregarAgregados();

    await dashboard.carregarPaineis();

    tempoReal.semear(dashboard.divergenciasAbertas.map(acontecimentoDaDivergencia));
}

/**
 * Releitura agrupada depois de um acontecimento: um manifesto fechando dispara progresso e
 * divergência quase juntos, e cada evento pediria os mesmos agregados de novo.
 *
 * O progresso mexe só nos números; a divergência mexe também no cartão de divergências
 * abertas, então ela relê o recorte inteiro.
 */
const relerNumeros = agrupar(() => dashboard.carregarAgregados());

const relerTudo = agrupar(() => relerRecorte());

/**
 * O cartão "Ao vivo" e os tiles recebem o campo sem recarregar a página: a parada concluída
 * e o manifesto fechado chegam em `manifesto.progresso`, a divergência em
 * `divergencia.aberta`.
 */
function assinarCanal() {
    return tempoReal.assinarAdmin({
        'divergencia.aberta': (evento) => {
            tempoReal.registrar(acontecimentoDaDivergencia(evento));
            relerTudo();
        },
        'manifesto.progresso': (evento) => {
            tempoReal.registrar(acontecimentoDoProgresso(evento));
            relerNumeros();
        },
    });
}

/**
 * O recorte mora na URL, e não na store: é isso que torna a tela filtrada compartilhável
 * por link e reconstrói o mesmo estado quando a URL é recarregada. A troca de filtro só
 * reescreve a query; quem recarrega os dados é o observador dela, num lugar só.
 *
 * @param {{ de: string, ate: string, filialId: number|null }} filtros
 */
function queryDoRecorte(filtros) {
    return {
        de: filtros.de,
        ate: filtros.ate,
        ...(filtros.filialId === null ? {} : { filial_id: String(filtros.filialId) }),
    };
}

function mesmaQuery(atual, desejada) {
    const chaves = new Set([...Object.keys(atual), ...Object.keys(desejada)]);

    return [...chaves].every((chave) => (atual[chave] ?? null) === (desejada[chave] ?? null));
}

/**
 * Escreve o recorte na URL. `replace` em vez de `push`: abrir a tela e ter o período do dia
 * gravado na barra de endereço não é um passo de navegação para o botão "voltar" desfazer.
 */
function aplicar(filtros) {
    const query = queryDoRecorte(filtros);

    if (mesmaQuery(route.query, query)) {
        return;
    }

    router.replace({ query });
}

let pararDeOuvirReconexao = null;

let cancelarAssinatura = null;

onMounted(() => {
    dashboard.definirFiltros(filtrosDaQuery(route.query));

    // Link sem filtro recebe o recorte normalizado na URL: quem copiar a barra de endereço
    // leva a mesma tela, e não "o dia de quem abrir".
    aplicar(dashboard.filtros);

    carregar();

    cancelarAssinatura = assinarCanal();

    // Enquanto a conexão esteve fora, o campo continuou andando e os eventos perdidos não
    // são reenviados. A volta relê os agregados e os painéis — a mesma fonte dos números que
    // o evento traria — sem esvaziar o que a lista já mostra.
    pararDeOuvirReconexao = tempoReal.aoReconectar(() => relerRecorte());
});

onUnmounted(() => {
    pararDeOuvirReconexao?.();
    cancelarAssinatura?.();
});

watch(() => route.query, (query) => {
    if (dashboard.definirFiltros(filtrosDaQuery(query))) {
        carregar();
    }
});

function abrir(destino) {
    router.push(destino);
}
</script>

<template>
    <section class="pagina">
        <div class="pagina__cabecalho">
            <h1 class="pagina__titulo">Visão geral</h1>
            <span class="pagina__recorte">
                {{ dashboard.filtros.de }} a {{ dashboard.filtros.ate }} · {{ dashboard.nomeDaFilial }}
            </span>
        </div>

        <FiltrosDoDashboard
            :filtros="dashboard.filtros"
            :filiais="dashboard.filiaisDisponiveis"
            @aplicar="aplicar"
        />

        <div v-if="dashboard.falha" class="pagina__falha" role="alert">
            <span>{{ dashboard.falha.mensagem }}</span>
            <button type="button" class="pagina__botao" @click="dashboard.carregarAgregados()">
                Tentar de novo
            </button>
        </div>

        <div class="pagina__kpis">
            <TileKpi
                v-for="kpi in dashboard.kpis"
                :key="kpi.chave"
                :data-kpi="kpi.chave"
                :rotulo="kpi.rotulo"
                :valor="kpi.valor ?? ''"
                :complemento="kpi.complemento"
                :tom="kpi.tom"
                :carregando="dashboard.aguardandoNumeros"
                como-botao
                @click="abrir(kpi.destino)"
            />
        </div>

        <div class="pagina__cartoes pagina__cartoes--largos">
            <PainelCard titulo="Entregas por filial · hoje">
                <EntregasPorFilial
                    :linhas="dashboard.entregasPorFilial"
                    :carregando="dashboard.aguardandoNumeros"
                />
            </PainelCard>

            <PainelCard titulo="Divergências abertas">
                <template #acoes>
                    <span class="pagina__contador">{{ dashboard.agregados?.divergencias?.abertas ?? '—' }}</span>
                </template>
                <DivergenciasAbertas
                    :linhas="dashboard.divergenciasRecentes"
                    :carregando="dashboard.carregandoPaineis"
                />
            </PainelCard>
        </div>

        <div class="pagina__cartoes pagina__cartoes--estreitos">
            <PainelCard titulo="Ao vivo">
                <template #acoes>
                    <IndicadorTempoReal />
                </template>
                <PainelAoVivo
                    :acontecimentos="tempoReal.acontecimentos"
                    :carregando="dashboard.carregandoPaineis"
                />
            </PainelCard>

            <PainelCard titulo="Canhotos pendentes">
                <CanhotosPendentes
                    :linhas="dashboard.canhotosPorFilial"
                    :carregando="dashboard.carregandoPaineis"
                />
            </PainelCard>

            <PainelCard titulo="Ocorrências · 7 dias">
                <template #acoes>
                    <RouterLink class="pagina__link" :to="{ name: 'ocorrencias' }">Ver todas</RouterLink>
                </template>
                <SerieDeOcorrencias
                    :linhas="dashboard.serieDeOcorrencias"
                    :carregando="dashboard.carregandoPaineis"
                />
            </PainelCard>
        </div>
    </section>
</template>

<style scoped src="@/styles/pages/overview/overview_page.css"></style>
