<script setup>
import { computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BadgeDeStatus from '@/components/all/ui/StatusBadge.vue';
import EstadoVazio from '@/components/all/ui/EmptyState.vue';
import FiltrosDeOcorrencias from '@/components/operations/incidents/IncidentFilters.vue';
import OcorrenciasPorFilial from '@/components/overview/IncidentsByBranch.vue';
import PaginacaoDoPainel from '@/components/all/tables/TablePagination.vue';
import PainelCard from '@/components/all/ui/BaseCard.vue';
import TabelaDoPainel from '@/components/all/tables/BaseTable.vue';
import { dataEHora, dataDoDia, numero } from '@/utils/format.js';
import SacOccurrences from '@/components/operations/sac/SacOccurrences.vue';
import { filtrosDaQueryDeOcorrencias, useOcorrenciasStore } from '@/stores/incidents.store.js';
import { useAuthStore } from '@/stores/auth.store.js';

/**
 * Tela 05 Ocorrências por código (US-9.3, US-8.3).
 *
 * A tabela mostra cada código com a contagem e a participação percentual no período, e o
 * cartão "Por filial" repete o mesmo recorte quebrado por filial de manifesto. Os dois
 * números vêm prontos do endpoint de agregados: a tela não divide contagem por total para
 * chegar à porcentagem.
 *
 * Clicar num código abre as notas que o receberam, paginadas pelo servidor. O código
 * aberto, o período e a filial moram na URL, então a tela de um código é compartilhável por
 * link e volta igual depois do refresh.
 */
const ocorrencias = useOcorrenciasStore();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

/**
 * Duas visões na mesma tela: "mapa" (ocorrências de /mapa/ocorrencias, tratadas pelo SAC) e
 * "codigo" (agregado por código das NFs, só admin: o endpoint é do painel administrativo).
 * Quem não é admin só tem a visão do mapa.
 */
const visao = computed(() => {
    if (! auth.ehAdmin) return 'mapa';
    return route.query.visao === 'mapa' ? 'mapa' : 'codigo';
});

function trocarVisao(nova) {
    router.replace({ query: nova === 'mapa' ? { visao: 'mapa' } : {} });
}

const COLUNAS = [
    { chave: 'codigo', rotulo: 'Cód.', largura: '64px' },
    { chave: 'descricao', rotulo: 'Descrição' },
    { chave: 'participacao', rotulo: '' },
    { chave: 'total', rotulo: 'NFs', alinhamento: 'right', largura: '70px' },
    { chave: 'percentual', rotulo: '%', alinhamento: 'right', largura: '64px' },
    { chave: 'exige', rotulo: 'Exige', largura: '170px' },
];

const COLUNAS_DAS_NOTAS = [
    { chave: 'nota', rotulo: 'Nota' },
    { chave: 'cliente', rotulo: 'Cliente' },
    { chave: 'manifesto', rotulo: 'Manifesto' },
    { chave: 'filial', rotulo: 'Filial', largura: '80px' },
    { chave: 'motorista', rotulo: 'Motorista' },
    { chave: 'registrado_em', rotulo: 'Registrada em', largura: '150px' },
];

/**
 * Query que representa o recorte. Período padrão e primeira página são implícitos: a URL
 * compartilhada só carrega o que alguém de fato escolheu.
 */
function queryDoRecorte(filtros) {
    return {
        ...(filtros.periodo === '7d' ? {} : { periodo: filtros.periodo }),
        ...(filtros.filialId === null ? {} : { filial_id: String(filtros.filialId) }),
        ...(filtros.codigo === null ? {} : { codigo: filtros.codigo }),
        ...(filtros.pagina === 1 ? {} : { page: String(filtros.pagina) }),
        ...(route.query.visao ? { visao: String(route.query.visao) } : {}),
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
 * Clicar no código abre as notas dele; clicar no código já aberto fecha a lista e devolve a
 * tabela à tela inteira. Trocar de código sempre volta à primeira página.
 */
function abrirCodigo(codigo) {
    aplicar({
        ...ocorrencias.filtros,
        codigo: ocorrencias.filtros.codigo === codigo ? null : codigo,
        pagina: 1,
    });
}

function irParaPagina(pagina) {
    aplicar({ ...ocorrencias.filtros, pagina });
}

function aplicarRecorte(filtros) {
    // Trocar período ou filial recomeça a paginação: a página 3 do recorte anterior não
    // descreve nada no recorte novo.
    aplicar({ ...filtros, pagina: 1 });
}

async function iniciarPorCodigo() {
    ocorrencias.definirFiltros(filtrosDaQueryDeOcorrencias(route.query));

    await ocorrencias.carregar();

    ocorrencias.carregarNotas();
}

onMounted(() => {
    if (visao.value === 'codigo') iniciarPorCodigo();
});

watch(visao, (nova) => {
    if (nova === 'codigo') iniciarPorCodigo();
});

watch(() => route.query, async (query) => {
    if (visao.value !== 'codigo') return;

    const recarga = ocorrencias.definirFiltros(filtrosDaQueryDeOcorrencias(query));

    if (recarga.agregados) {
        await ocorrencias.carregar();
    }

    if (recarga.notas) {
        ocorrencias.carregarNotas();
    }
});
</script>

<template>
    <section class="pagina">
        <div class="pagina__cabecalho">
            <h1 class="pagina__titulo">{{ visao === 'mapa' ? 'Ocorrências do mapa' : 'Ocorrências por código' }}</h1>
            <span v-if="visao === 'codigo'" class="pagina__recorte">
                {{ dataDoDia(ocorrencias.datas.de) }} a {{ dataDoDia(ocorrencias.datas.ate) }}
                · {{ ocorrencias.nomeDaFilial }}
            </span>
        </div>

        <div v-if="auth.ehAdmin" class="pagina__abas" role="group" aria-label="Visão das ocorrências">
            <button type="button" class="pagina__botao" :aria-pressed="visao === 'mapa'" :class="{ 'pagina__botao--ativo': visao === 'mapa' }" @click="trocarVisao('mapa')">Mapa operacional (SAC)</button>
            <button type="button" class="pagina__botao" :aria-pressed="visao === 'codigo'" :class="{ 'pagina__botao--ativo': visao === 'codigo' }" @click="trocarVisao('codigo')">Por código (NFs)</button>
        </div>

        <SacOccurrences v-if="visao === 'mapa'" />

        <template v-else>

        <FiltrosDeOcorrencias
            :filtros="ocorrencias.filtros"
            :filiais="ocorrencias.filiaisDisponiveis"
            @aplicar="aplicarRecorte"
        />

        <div v-if="ocorrencias.falha" class="pagina__falha" role="alert">
            <span>{{ ocorrencias.falha.mensagem }}</span>
            <button type="button" class="pagina__botao" @click="ocorrencias.carregar()">
                Tentar de novo
            </button>
        </div>

        <div class="pagina__colunas">
            <div class="pagina__principal">
                <EstadoVazio
                    v-if="ocorrencias.aguardandoNumeros && ocorrencias.carregando"
                    mensagem="Carregando as ocorrências do período…"
                    tracejado
                />

                <EstadoVazio
                    v-else-if="ocorrencias.vazia"
                    mensagem="Nenhuma ocorrência registrada no período."
                    tracejado
                />

                <TabelaDoPainel v-else :colunas="COLUNAS" :largura-minima="620">
                    <tr
                        v-for="linha in ocorrencias.linhasPorCodigo"
                        :key="linha.codigo"
                        class="linha"
                        :class="{ 'linha--aberta': linha.selecionada }"
                        :data-ocorrencia="linha.codigo"
                        @click="abrirCodigo(linha.codigo)"
                    >
                        <td class="linha__codigo">{{ linha.codigo }}</td>
                        <td>{{ linha.descricao }}</td>
                        <td>
                            <div class="linha__trilho">
                                <div class="linha__fatia" :style="{ width: linha.largura }"></div>
                            </div>
                        </td>
                        <td class="linha__total">{{ numero(linha.total) }}</td>
                        <td class="linha__percentual">{{ linha.percentual }}</td>
                        <td>
                            <div class="linha__exigencias">
                                <span v-for="exigencia in linha.exigencias" :key="exigencia" class="linha__exigencia">
                                    {{ exigencia }}
                                </span>
                            </div>
                        </td>
                    </tr>
                </TabelaDoPainel>

                <PainelCard v-if="ocorrencias.codigoSelecionado" :titulo="`Notas com ${ocorrencias.codigoSelecionado.codigo} · ${ocorrencias.codigoSelecionado.descricao}`">
                    <template #acoes>
                        <BadgeDeStatus
                            :rotulo="`${ocorrencias.codigoSelecionado.total} NFs · ${ocorrencias.codigoSelecionado.percentual}`"
                            tom="accent"
                        />
                        <button type="button" class="pagina__botao" @click="abrirCodigo(ocorrencias.filtros.codigo)">
                            Fechar
                        </button>
                    </template>

                    <div v-if="ocorrencias.falhaDasNotas" class="pagina__falha" role="alert">
                        <span>{{ ocorrencias.falhaDasNotas.mensagem }}</span>
                        <button type="button" class="pagina__botao" @click="ocorrencias.carregarNotas()">
                            Tentar de novo
                        </button>
                    </div>

                    <EstadoVazio
                        v-else-if="ocorrencias.carregandoNotas && ocorrencias.notas.length === 0"
                        mensagem="Carregando as notas do código…"
                        tracejado
                    />

                    <EstadoVazio
                        v-else-if="ocorrencias.listaDeNotasVazia"
                        mensagem="Nenhuma nota com esse código no período."
                        tracejado
                    />

                    <template v-else>
                        <TabelaDoPainel :colunas="COLUNAS_DAS_NOTAS" :largura-minima="760">
                            <tr v-for="nota in ocorrencias.linhasDasNotas" :key="nota.id" data-nota>
                                <td>
                                    <strong class="nota__numero">{{ nota.numeroNf }}</strong>
                                    <small v-if="nota.serie" class="nota__serie">série {{ nota.serie }}</small>
                                </td>
                                <td>
                                    <span>{{ nota.cliente }}</span>
                                    <small v-if="nota.cidade" class="nota__cidade">{{ nota.cidade }}</small>
                                </td>
                                <td>
                                    <RouterLink
                                        v-if="nota.manifestoId"
                                        :to="{ name: 'manifesto', params: { manifesto: nota.manifestoId } }"
                                    >
                                        {{ nota.manifesto }}
                                    </RouterLink>
                                    <span v-else>{{ nota.manifesto }}</span>
                                </td>
                                <td>{{ nota.filial }}</td>
                                <td>{{ nota.motorista }}</td>
                                <td>{{ dataEHora(nota.registradoEm) }}</td>
                            </tr>
                        </TabelaDoPainel>

                        <PaginacaoDoPainel
                            :paginacao="ocorrencias.paginacaoDasNotas"
                            :carregando="ocorrencias.carregandoNotas"
                            rotulo="notas"
                            @ir="irParaPagina"
                        />
                    </template>
                </PainelCard>
            </div>

            <aside class="pagina__lateral">
                <PainelCard>
                    <span class="taxa__rotulo">Ocorrências no período</span>
                    <span class="taxa__valor">{{ numero(ocorrencias.totalDeOcorrencias) }}</span>
                    <span class="taxa__complemento">
                        {{ ocorrencias.linhasPorCodigo.length }} códigos distintos
                    </span>
                </PainelCard>

                <PainelCard titulo="Por filial">
                    <OcorrenciasPorFilial
                        :linhas="ocorrencias.porFilial"
                        :carregando="ocorrencias.aguardandoNumeros && ocorrencias.carregando"
                    />
                </PainelCard>

                <p class="pagina__nota">
                    Códigos internos do transmassa-web. A tradução para OCOREN continua no transmassa-web.
                </p>
            </aside>
        </div>
        </template>
    </section>
</template>

<style scoped src="@/styles/pages/operations/incidents/incidents_page.css"></style>
