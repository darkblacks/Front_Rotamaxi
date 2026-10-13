<script setup>
import { onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import EstadoVazio from '@/components/all/ui/EmptyState.vue';
import ExtratoDePallets from '@/components/operations/pallets/PalletStatement.vue';
import FiltrosDePallets from '@/components/operations/pallets/PalletFilters.vue';
import PainelCard from '@/components/all/ui/BaseCard.vue';
import PalletsPorFilial from '@/components/overview/PalletsByBranch.vue';
import TileKpi from '@/components/all/ui/KpiTile.vue';
import { dataDoDia, numero } from '@/utils/format.js';
import { filtrosDaQueryDePallets, usePalletsStore } from '@/stores/pallets.store.js';

/**
 * Tela 04 Saldo de pallets (US-9.3, US-8.5).
 *
 * Os quatro tiles do design — pallets em clientes, em trânsito com os motoristas, clientes
 * acima do limiar de cobrança e divergências de pallet abertas —, a quebra "Por filial" e a
 * lista de clientes ordenável por saldo. Todo número vem do endpoint de agregados, no mesmo
 * recorte: a tela não soma linha de detalhe para chegar a total nenhum.
 *
 * O extrato do cliente abre a partir da lista: ele mostra movimento a movimento com saldo
 * acumulado, no mesmo período da tela — mudar o período recorta as linhas e recalcula o
 * acumulado inicial, sem nunca mexer no saldo consolidado.
 *
 * O recorte, a ordem e o cliente aberto moram na URL: a tela ordenada por saldo de uma
 * filial, com o extrato de um cliente, é compartilhável por link e volta igual depois de um
 * refresh.
 */
const pallets = usePalletsStore();
const route = useRoute();
const router = useRouter();

/**
 * Query que representa o recorte. Filtro não escolhido não aparece na URL, e a ordem padrão
 * — saldo decrescente, que é a ordem de cobrança — também é implícita.
 */
function queryDoRecorte(filtros) {
    return {
        ...(filtros.de === null ? {} : { de: filtros.de }),
        ...(filtros.ate === null ? {} : { ate: filtros.ate }),
        ...(filtros.filialId === null ? {} : { filial_id: String(filtros.filialId) }),
        ...(filtros.clienteId === null ? {} : { cliente: String(filtros.clienteId) }),
        ...(filtros.ordem === 'saldo' ? {} : { ordem: filtros.ordem }),
        ...(filtros.direcao === 'desc' ? {} : { direcao: filtros.direcao }),
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
 * Clicar na coluna ordena por ela. Coluna já ordenada inverte a direção; coluna nova entra
 * na direção que faz sentido para ela — saldo e movimentos do maior para o menor, nome de A
 * a Z.
 */
function ordenarPor(campo) {
    const mesmoCampo = pallets.filtros.ordem === campo;
    const padrao = campo === 'nome' ? 'asc' : 'desc';

    aplicar({
        ...pallets.filtros,
        ordem: campo,
        direcao: mesmoCampo ? (pallets.filtros.direcao === 'asc' ? 'desc' : 'asc') : padrao,
    });
}

/**
 * Abre o extrato do cliente da linha. Clicar no cliente já aberto o fecha — a lista volta a
 * ser a tela inteira, que é o que se quer depois de terminar de olhar um caso.
 */
function abrirExtrato(cliente) {
    aplicar({
        ...pallets.filtros,
        clienteId: pallets.filtros.clienteId === cliente.id ? null : cliente.id,
    });
}

function indicadorDaOrdem(campo) {
    if (pallets.filtros.ordem !== campo) {
        return '';
    }

    return pallets.filtros.direcao === 'asc' ? '↑' : '↓';
}

onMounted(async () => {
    pallets.definirFiltros(filtrosDaQueryDePallets(route.query));

    // O extrato usa a janela que o servidor aplicou nos agregados, então ele espera por ela:
    // pedir os dois em paralelo mandaria o extrato sem período na primeira carga.
    await pallets.carregar();

    pallets.carregarExtrato();
});

watch(() => route.query, async (query) => {
    const recarga = pallets.definirFiltros(filtrosDaQueryDePallets(query));

    if (recarga.agregados) {
        await pallets.carregar();
    }

    if (recarga.extrato) {
        pallets.carregarExtrato();
    }
});
</script>

<template>
    <section class="pagina">
        <div class="pagina__cabecalho">
            <h1 class="pagina__titulo">Saldo de pallets</h1>
            <span class="pagina__recorte">
                {{ dataDoDia(pallets.recorteEfetivo.de) }} a {{ dataDoDia(pallets.recorteEfetivo.ate) }}
                · {{ pallets.nomeDaFilial }}
            </span>
        </div>

        <FiltrosDePallets
            :filtros="pallets.filtros"
            :filiais="pallets.filiaisDisponiveis"
            @aplicar="aplicar"
        />

        <div v-if="pallets.falha" class="pagina__falha" role="alert">
            <span>{{ pallets.falha.mensagem }}</span>
            <button type="button" class="pagina__botao" @click="pallets.carregar()">
                Tentar de novo
            </button>
        </div>

        <div class="pagina__tiles">
            <TileKpi
                v-for="tile in pallets.tiles"
                :key="tile.chave"
                :data-kpi="tile.chave"
                :rotulo="tile.rotulo"
                :valor="tile.valor ?? ''"
                :complemento="tile.complemento"
                :tom="tile.tom"
                :carregando="pallets.aguardandoNumeros"
            />
        </div>

        <PainelCard titulo="Por filial">
            <PalletsPorFilial :linhas="pallets.porFilial" :carregando="pallets.carregando" />
        </PainelCard>

        <PainelCard titulo="Clientes com pallet">
            <template #acoes>
                <span class="pagina__contador">{{ pallets.clientes.length }} clientes</span>
            </template>

            <EstadoVazio
                v-if="pallets.carregando && pallets.clientes.length === 0"
                mensagem="Carregando os clientes…"
            />

            <EstadoVazio v-else-if="pallets.vazia" mensagem="Nenhum movimento de pallet neste recorte." />

            <table v-else class="clientes">
                <thead>
                    <tr>
                        <th scope="col">
                            <button type="button" class="clientes__ordem" data-ordem="nome" @click="ordenarPor('nome')">
                                Cliente {{ indicadorDaOrdem('nome') }}
                            </button>
                        </th>
                        <th scope="col" class="clientes__direita">
                            <button
                                type="button"
                                class="clientes__ordem"
                                data-ordem="movimentos"
                                @click="ordenarPor('movimentos')"
                            >
                                Movim. {{ indicadorDaOrdem('movimentos') }}
                            </button>
                        </th>
                        <th scope="col" class="clientes__direita">
                            <button type="button" class="clientes__ordem" data-ordem="saldo" @click="ordenarPor('saldo')">
                                Saldo {{ indicadorDaOrdem('saldo') }}
                            </button>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="cliente in pallets.clientes"
                        :key="cliente.id"
                        class="cliente"
                        :class="{
                            'cliente--cobrar': cliente.aCobrar,
                            'cliente--aberto': cliente.id === pallets.filtros.clienteId,
                        }"
                        :data-cliente="cliente.id"
                        @click="abrirExtrato(cliente)"
                    >
                        <td>
                            <div class="cliente__identificacao">
                                <span class="cliente__nome">{{ cliente.nome }}</span>
                                <span class="cliente__cidade">{{ cliente.cidade }}</span>
                            </div>
                        </td>
                        <td class="clientes__direita cliente__movimentos">{{ numero(cliente.movimentos) }}</td>
                        <td class="clientes__direita">
                            <span class="cliente__saldo" :class="`cliente__saldo--${cliente.devedorTom}`">
                                {{ numero(cliente.saldo) }}
                            </span>
                        </td>
                    </tr>
                </tbody>
            </table>
        </PainelCard>

        <PainelCard titulo="Extrato do cliente">
            <template #acoes>
                <button
                    v-if="pallets.filtros.clienteId !== null"
                    type="button"
                    class="pagina__botao"
                    @click="aplicar({ ...pallets.filtros, clienteId: null })"
                >
                    Fechar extrato
                </button>
            </template>

            <div v-if="pallets.falhaDoExtrato" class="pagina__falha" role="alert">
                <span>{{ pallets.falhaDoExtrato.mensagem }}</span>
                <button type="button" class="pagina__botao" @click="pallets.carregarExtrato()">
                    Tentar de novo
                </button>
            </div>

            <ExtratoDePallets
                v-else
                :resumo="pallets.resumoDoExtrato"
                :linhas="pallets.linhasDoExtrato"
                :carregando="pallets.carregandoExtrato"
                :vazio="pallets.extratoVazio"
            />
        </PainelCard>
    </section>
</template>

<style scoped src="@/styles/pages/operations/pallets/pallet_balance_page.css"></style>
