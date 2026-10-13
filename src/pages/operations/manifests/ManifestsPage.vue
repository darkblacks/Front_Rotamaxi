<script setup>
import { onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BadgeDeStatus from '@/components/all/ui/StatusBadge.vue';
import BarraDeProgresso from '@/components/all/ui/ProgressBar.vue';
import EstadoVazio from '@/components/all/ui/EmptyState.vue';
import FiltrosDeManifestos from '@/components/operations/manifests/ManifestFilters.vue';
import PaginacaoDoPainel from '@/components/all/tables/TablePagination.vue';
import TabelaDoPainel from '@/components/all/tables/BaseTable.vue';
import { dataDoDia, numero } from '@/utils/format.js';
import { podeAcessar } from '@/domain/access/roles.js';
import { useAuthStore } from '@/stores/auth.store.js';
import { filtrosDaQueryDeManifestos, useManifestosStore } from '@/stores/manifests.store.js';
import { useTempoRealStore } from '@/stores/realtime.store.js';

/**
 * Tela 02 Manifestos (US-9.3, US-3.1).
 *
 * As colunas são as do design: manifesto, placa, data, motorista, filial, status, progresso
 * das paradas, os agregados da viagem — serviços, volumes, peso e retiradas — e o indicador
 * `erros/OK`, que é o único lugar da lista onde a sincronização aparece.
 *
 * O recorte e a página moram na URL: a lista filtrada é compartilhável por link e volta
 * igual depois de um refresh.
 */
const manifestos = useManifestosStore();
const podePlanejar = podeAcessar(useAuthStore().papeis, ['roteirizador']);
const tempoReal = useTempoRealStore();
const route = useRoute();
const router = useRouter();

let pararDeOuvirReconexao = null;

let cancelarAssinatura = null;

const COLUNAS = [
    { chave: 'manifesto', rotulo: 'Manifesto', largura: '110px' },
    { chave: 'placa', rotulo: 'Placa', largura: '104px' },
    { chave: 'data', rotulo: 'Data', largura: '104px' },
    { chave: 'motorista', rotulo: 'Motorista' },
    { chave: 'filial', rotulo: 'Filial', largura: '64px' },
    { chave: 'status', rotulo: 'Status', largura: '124px' },
    { chave: 'progresso', rotulo: 'Progresso', largura: '150px' },
    { chave: 'servicos', rotulo: 'Serviços', largura: '78px', alinhamento: 'right' },
    { chave: 'volumes', rotulo: 'Volumes', largura: '78px', alinhamento: 'right' },
    { chave: 'peso', rotulo: 'Peso', largura: '96px', alinhamento: 'right' },
    { chave: 'retiradas', rotulo: 'Retiradas', largura: '84px', alinhamento: 'right' },
    { chave: 'sync', rotulo: 'Erros/OK', largura: '84px', alinhamento: 'right' },
];

/**
 * Query que representa o recorte. Filtro não escolhido não aparece na URL, e a página 1 é
 * implícita: o link da lista sem filtro fica limpo.
 */
function queryDoRecorte(filtros) {
    return {
        ...(filtros.status === null ? {} : { status: filtros.status }),
        ...(filtros.filialId === null ? {} : { filial_id: String(filtros.filialId) }),
        ...(filtros.de === null ? {} : { de: filtros.de }),
        ...(filtros.ate === null ? {} : { ate: filtros.ate }),
        ...(filtros.pagina === 1 ? {} : { page: String(filtros.pagina) }),
    };
}

function mesmaQuery(atual, desejada) {
    const chaves = new Set([...Object.keys(atual), ...Object.keys(desejada)]);

    return [...chaves].every((chave) => (atual[chave] ?? null) === (desejada[chave] ?? null));
}

function aplicar(filtros) {
    const query = queryDoRecorte(filtros);

    if (mesmaQuery(route.query, query)) {
        return;
    }

    router.replace({ query });
}

function irParaPagina(pagina) {
    aplicar({ ...manifestos.filtros, pagina });
}

onMounted(() => {
    manifestos.definirFiltros(filtrosDaQueryDeManifestos(route.query));
    manifestos.carregarFiliais();
    manifestos.carregar();

    // A parada concluída e o manifesto fechado mudam o status e o progresso da linha que já
    // está na tela — os dois números vêm derivados no próprio evento, sem nova consulta.
    cancelarAssinatura = tempoReal.assinarAdmin({
        'manifesto.progresso': (evento) => manifestos.aplicarProgresso(evento),
    });

    // A volta da conexão relê a página do recorte: a lista inteira é substituída, e por isso
    // a releitura não duplica linha nenhuma.
    pararDeOuvirReconexao = tempoReal.aoReconectar(() => manifestos.carregar());
});

onUnmounted(() => {
    pararDeOuvirReconexao?.();
    cancelarAssinatura?.();
});

watch(() => route.query, (query) => {
    if (manifestos.definirFiltros(filtrosDaQueryDeManifestos(query))) {
        manifestos.carregar();
    }
});

function abrir(linha) {
    router.push(linha.destino);
}
</script>

<template>
    <section class="pagina">
        <div class="pagina__cabecalho">
            <h1 class="pagina__titulo">Manifestos</h1>
            <span class="pagina__recorte">
                {{ manifestos.paginacao.total }} no recorte
                <RouterLink
                    v-if="podePlanejar"
                    class="pagina__botao"
                    :to="{ name: 'manifesto-novo' }"
                    data-acao="novo-manifesto"
                >Novo manifesto</RouterLink>
            </span>
        </div>

        <FiltrosDeManifestos
            :filtros="manifestos.filtros"
            :filiais="manifestos.filiaisDisponiveis"
            @aplicar="aplicar"
        />

        <div v-if="manifestos.falha" class="pagina__falha" role="alert">
            <span>{{ manifestos.falha.mensagem }}</span>
            <button type="button" class="pagina__botao" @click="manifestos.carregar()">
                Tentar de novo
            </button>
        </div>

        <EstadoVazio v-else-if="manifestos.carregando && manifestos.linhas.length === 0" mensagem="Carregando os manifestos…" tracejado />

        <EstadoVazio v-else-if="manifestos.vazia" mensagem="Nenhum manifesto neste filtro." tracejado />

        <template v-else>
            <TabelaDoPainel :colunas="COLUNAS" :largura-minima="1080">
                <tr
                    v-for="linha in manifestos.linhasDaTabela"
                    :key="linha.id"
                    class="linha"
                    :data-manifesto="linha.numero"
                    @click="abrir(linha)"
                >
                    <td class="linha__numero">{{ linha.numero }}</td>
                    <td><span class="linha__placa">{{ linha.placa }}</span></td>
                    <td class="linha__data">{{ dataDoDia(linha.data) }}</td>
                    <td class="linha__motorista">{{ linha.motorista }}</td>
                    <td class="linha__filial" :title="linha.filialNome">{{ linha.filial }}</td>
                    <td><BadgeDeStatus :rotulo="linha.statusRotulo" :tom="linha.statusTom" /></td>
                    <td>
                        <div class="linha__progresso">
                            <BarraDeProgresso
                                class="linha__barra"
                                :valor="linha.concluidas"
                                :total="linha.totalDeParadas"
                                tom="neutro"
                            />
                            <span class="linha__contagem">{{ linha.concluidas }}/{{ linha.totalDeParadas }}</span>
                        </div>
                    </td>
                    <td class="linha__agregado">{{ numero(linha.servicos) }}</td>
                    <td class="linha__agregado">{{ numero(linha.volumes) }}</td>
                    <td class="linha__agregado">{{ numero(linha.peso, 1) }}</td>
                    <td class="linha__agregado">{{ numero(linha.retiradas) }}</td>
                    <td class="linha__agregado">
                        <span :class="['linha__indicador', { 'linha__indicador--erros': linha.indicador === 'erros' }]">
                            {{ linha.indicador }}
                        </span>
                    </td>
                </tr>
            </TabelaDoPainel>

            <PaginacaoDoPainel
                :paginacao="manifestos.paginacao"
                :carregando="manifestos.carregando"
                @ir="irParaPagina"
            />
        </template>
    </section>
</template>

<style scoped src="@/styles/pages/operations/manifests/manifests_page.css"></style>
