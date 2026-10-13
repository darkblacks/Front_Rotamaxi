<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BadgeDeStatus from '@/components/all/ui/StatusBadge.vue';
import EstadoVazio from '@/components/all/ui/EmptyState.vue';
import FiltrosDeDivergencias from '@/components/operations/divergences/DivergenceFilters.vue';
import NovaDivergenciaModal from '@/components/operations/divergences/NewDivergenceModal.vue';
import PaginacaoDoPainel from '@/components/all/tables/TablePagination.vue';
import TabelaDoPainel from '@/components/all/tables/BaseTable.vue';
import { dataEHora } from '@/utils/format.js';
import { agrupar } from '@/services/realtime/realtime.service.js';
import { filtrosDaQueryDeDivergencias, useDivergenciasStore } from '@/stores/divergences.store.js';
import { useTempoRealStore } from '@/stores/realtime.store.js';

/**
 * Tela de divergências (US-9.3, US-8.2).
 *
 * A lista é filtrável por status, tipo, filial e período — os quatro filtros que a API
 * aceita — e paginada pelo servidor. Clicar na linha abre o detalhe, onde ficam os três
 * números, a justificativa e a trilha de quem decidiu o quê.
 *
 * O modal "Nova divergência" do design vive aqui e serve **apenas** ao registro manual pelo
 * admin: a divergência da conferência da portaria continua nascendo sozinha.
 */
const divergencias = useDivergenciasStore();
const tempoReal = useTempoRealStore();
const route = useRoute();
const router = useRouter();

let pararDeOuvirReconexao = null;

let cancelarAssinatura = null;

/**
 * A divergência nasce na conferência da portaria, e a lista precisa mostrá-la sem refresh.
 * Quem traz a linha completa — manifesto, filial, motorista e origem — é a própria consulta
 * paginada do recorte: a releitura substitui a página inteira, então a divergência que
 * chegou pelo canal não vira uma segunda linha.
 */
const relerLista = agrupar(() => divergencias.carregar());

const modalAberto = ref(false);

const COLUNAS = [
    { chave: 'manifesto', rotulo: 'Manifesto' },
    { chave: 'tipo', rotulo: 'Tipo', largura: '90px' },
    { chave: 'status', rotulo: 'Status', largura: '110px' },
    { chave: 'filial', rotulo: 'Filial', largura: '80px' },
    { chave: 'motorista', rotulo: 'Motorista' },
    { chave: 'diferenca', rotulo: 'Diferença', alinhamento: 'right', largura: '90px' },
    { chave: 'origem', rotulo: 'Origem', largura: '130px' },
    { chave: 'criado_em', rotulo: 'Aberta em', largura: '150px' },
];

function queryDoRecorte(filtros) {
    return {
        ...(filtros.status === null ? {} : { status: filtros.status }),
        ...(filtros.tipo === null ? {} : { tipo: filtros.tipo }),
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

/**
 * Trocar de filtro recomeça a paginação: a página 3 do recorte anterior não descreve nada
 * no recorte novo.
 */
function aplicarFiltros(filtros) {
    aplicar({ ...filtros, pagina: 1 });
}

function irParaPagina(pagina) {
    aplicar({ ...divergencias.filtros, pagina });
}

function abrir(linha) {
    router.push({ name: 'divergencia', params: { divergencia: linha.id } });
}

async function abrirModal() {
    modalAberto.value = true;

    await divergencias.carregarManifestosDoRegistro();
}

async function registrar(payload) {
    const registrada = await divergencias.registrar(payload);

    if (registrada !== null) {
        modalAberto.value = false;
        router.push({ name: 'divergencia', params: { divergencia: registrada.id } });
    }
}

onMounted(async () => {
    divergencias.definirFiltros(filtrosDaQueryDeDivergencias(route.query));

    await divergencias.carregar();

    divergencias.carregarFiliais();

    cancelarAssinatura = tempoReal.assinarAdmin({
        'divergencia.aberta': () => relerLista(),
    });

    pararDeOuvirReconexao = tempoReal.aoReconectar(() => divergencias.carregar());
});

onUnmounted(() => {
    pararDeOuvirReconexao?.();
    cancelarAssinatura?.();
});

watch(() => route.query, (query) => {
    if (divergencias.definirFiltros(filtrosDaQueryDeDivergencias(query))) {
        divergencias.carregar();
    }
});
</script>

<template>
    <section class="pagina">
        <div class="pagina__cabecalho">
            <h1 class="pagina__titulo">Divergências</h1>
            <button type="button" class="pagina__botao pagina__botao--primario" data-acao="nova-divergencia" @click="abrirModal">
                Nova divergência
            </button>
        </div>

        <FiltrosDeDivergencias
            :filtros="divergencias.filtros"
            :filiais="divergencias.filiais"
            @aplicar="aplicarFiltros"
        />

        <div v-if="divergencias.falha" class="pagina__falha" role="alert">
            <span>{{ divergencias.falha.mensagem }}</span>
            <button type="button" class="pagina__botao" @click="divergencias.carregar()">Tentar de novo</button>
        </div>

        <EstadoVazio
            v-else-if="divergencias.carregando && divergencias.linhas.length === 0"
            mensagem="Carregando as divergências…"
            tracejado
        />

        <EstadoVazio
            v-else-if="divergencias.vazia"
            mensagem="Nenhuma divergência no recorte."
            tracejado
        />

        <template v-else>
            <TabelaDoPainel :colunas="COLUNAS" :largura-minima="900">
                <tr
                    v-for="linha in divergencias.linhasDaLista"
                    :key="linha.id"
                    class="linha"
                    :data-divergencia="linha.id"
                    @click="abrir(linha)"
                >
                    <td class="linha__manifesto">{{ linha.manifesto }}</td>
                    <td><BadgeDeStatus :rotulo="linha.tipo" tom="info" /></td>
                    <td><BadgeDeStatus :rotulo="linha.status" :tom="linha.tom" /></td>
                    <td>{{ linha.filial }}</td>
                    <td>{{ linha.motorista }}</td>
                    <td class="linha__diferenca">{{ linha.diferenca }}</td>
                    <td class="linha__origem">{{ linha.origem }}</td>
                    <td>{{ dataEHora(linha.criadoEm) }}</td>
                </tr>
            </TabelaDoPainel>

            <PaginacaoDoPainel
                :paginacao="divergencias.paginacao"
                :carregando="divergencias.carregando"
                rotulo="divergências"
                @ir="irParaPagina"
            />
        </template>

        <NovaDivergenciaModal
            v-if="modalAberto"
            :manifestos="divergencias.opcoesDeManifesto"
            :enviando="divergencias.registrando"
            :falha="divergencias.falhaDoRegistro"
            @registrar="registrar"
            @fechar="modalAberto = false"
        />
    </section>
</template>

<style scoped src="@/styles/pages/operations/divergences/divergences_page.css"></style>
