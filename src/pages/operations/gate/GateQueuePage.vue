<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CartaoDaFila from '@/components/operations/gate/QueueCard.vue';
import EstadoVazio from '@/components/all/ui/EmptyState.vue';
import ContextoDaPortaria from '@/components/operations/gate/GateContextPanel.vue';
import FiltroDeFilial from '@/components/all/filters/BranchFilter.vue';
import IndicadorTempoReal from '@/components/all/status/RealtimeIndicator.vue';
import { agrupar } from '@/services/realtime/realtime.service.js';
import { filtrosDaQueryDaFila, usePortariaStore } from '@/stores/gate.store.js';
import { useTempoRealStore } from '@/stores/realtime.store.js';
import { useAuthStore } from '@/stores/auth.store.js';
import { permissoesDeAcao } from '@/domain/access/actions.js';

/**
 * Tela 03 Fila da portaria (US-9.3, US-4.1).
 *
 * Duas colunas, como no design: "Aguardando saída" e "Aguardando entrada". No painel do
 * admin ela é **monitoramento**: mostra o portão de todas as filiais e não oferece ação
 * nenhuma de conferência — conferir continua sendo ato do porteiro, no app dele, dentro da
 * filial dele. O clique no cartão abre o manifesto, que é leitura.
 *
 * O recorte por filial mora na URL, então a fila de uma filial é compartilhável por link.
 * A fila muda sozinha: o manifesto que entra e o que sai chegam pelo canal privado da
 * filial, sem refresh. Quando o recorte é "todas as filiais", o painel assina o canal de
 * cada filial — a autorização de canal deixa só o administrador fazer isso.
 */
const portaria = usePortariaStore();

/** Cartão aberto no painel de contexto (GET /portaria/contexto). */
const cartaoDoContexto = ref(null);
const tempoReal = useTempoRealStore();
const auth = useAuthStore();

/** Só o porteiro (e o admin) registra chegada/saída; a tela nunca tem aceite de pallets. */
const podeRegistrar = computed(() => permissoesDeAcao(auth.papeis).registrarPortaria);
const mensagemDeRegistro = ref(null);

/** Coluna (status do manifesto) do cartão aberto: define se o registro é chegada ou saída. */
const colunaDoContexto = computed(() => portaria.manifestos.find((m) => m.id === cartaoDoContexto.value?.id)?.status ?? 'aguardando_entrada');
const route = useRoute();
const router = useRouter();

/**
 * De quanto em quanto tempo o "na fila" é recalculado. A espera é o número que envelhece
 * sozinho na tela: sem este relógio, `12min` ficaria `12min` para sempre.
 */
const INTERVALO_DO_RELOGIO = 30000;

let relogio = null;

let pararDeOuvirReconexao = null;

/**
 * Reconciliação da fila depois dos eventos. O evento traz o que o motorista declarou; o que
 * o servidor deriva — o esperado de pallets da coluna de entrada — continua vindo da
 * leitura. A releitura substitui a lista inteira, então ela não duplica cartão nenhum.
 */
const relerFila = agrupar(() => portaria.carregar());

/**
 * Assinaturas vivas, por filial, com o seu cancelamento. A tela guarda isto porque o
 * recorte muda sem recarregar: a filial que sai de cena precisa ser abandonada e a que
 * entra, assinada, sem derrubar as que continuam valendo.
 *
 * @type {Map<number, () => void>}
 */
const assinaturasDeFilial = new Map();

/**
 * Acerta as assinaturas com o recorte atual: uma por filial em observação. Filial que saiu
 * do recorte é abandonada — continuar ouvindo a fila que ninguém olha só gastaria socket.
 */
function sincronizarAssinaturas() {
    // Admin observa as filiais do menu; porteiro (sem o menu de filiais) assina a própria
    // filial e as filiais das linhas da fila.
    const doUsuario = [auth.filialDoUsuario, ...portaria.manifestos.map((m) => m.filial_id)].filter((id) => id != null);
    const desejadas = [...new Set(portaria.filtros.filialId !== null
        ? [portaria.filtros.filialId]
        : [...portaria.filiaisDisponiveis.map((filial) => filial.id), ...doUsuario])];

    [...assinaturasDeFilial.keys()]
        .filter((filialId) => ! desejadas.includes(filialId))
        .forEach((filialId) => cancelarAssinatura(filialId));

    desejadas
        .filter((filialId) => ! assinaturasDeFilial.has(filialId))
        .forEach((filialId) => {
            assinaturasDeFilial.set(filialId, tempoReal.assinarFilial(filialId, {
                'fila.atualizada': (evento) => {
                    portaria.aplicarEventoDaFila(evento);
                    relerFila();
                },
                // Registro da portaria (outro porteiro/aba): a fila é relida sem refresh.
                'manifest.portaria.registered': () => relerFila(),
                'manifest.custody.changed': () => relerFila(),
            }));
        });
}

function cancelarAssinatura(filialId) {
    assinaturasDeFilial.get(filialId)?.();
    assinaturasDeFilial.delete(filialId);
}

function abrirContexto(cartao) {
    mensagemDeRegistro.value = null;
    cartaoDoContexto.value = cartao;
}

function aoRegistrar(mensagem) {
    mensagemDeRegistro.value = `${cartaoDoContexto.value?.placa ?? ''} · ${mensagem}`;
    cartaoDoContexto.value = null;
    portaria.carregar();
}

function aplicar(filialId) {
    const query = filialId === null ? {} : { filial_id: String(filialId) };

    if ((route.query.filial_id ?? null) === (query.filial_id ?? null)) {
        return;
    }

    router.replace({ query });
}

onMounted(async () => {
    portaria.definirFiltros(filtrosDaQueryDaFila(route.query));
    portaria.carregar();

    relogio = setInterval(() => portaria.marcarAgora(), INTERVALO_DO_RELOGIO);

    // A queda da conexão não perde a fila: a volta relê o portão inteiro, que é a mesma
    // fonte dos eventos que se perderam enquanto o painel esteve fora.
    pararDeOuvirReconexao = tempoReal.aoReconectar(() => portaria.carregar());

    // As assinaturas dependem da lista de filiais quando o recorte é "todas".
    if (auth.ehAdmin) {
        await portaria.carregarFiliais();
    }

    sincronizarAssinaturas();
});

onUnmounted(() => {
    if (relogio !== null) {
        clearInterval(relogio);
    }

    pararDeOuvirReconexao?.();

    [...assinaturasDeFilial.keys()].forEach((filialId) => cancelarAssinatura(filialId));
});

watch(() => route.query, (query) => {
    if (portaria.definirFiltros(filtrosDaQueryDaFila(query))) {
        portaria.carregar();
        sincronizarAssinaturas();
    }
});

// A conexão pode ficar de pé depois da montagem da tela: sem isto, a fila aberta durante a
// reconexão nasceria sem assinatura nenhuma.
// A fila chega depois da montagem: as filiais das linhas entram nas assinaturas.
watch(() => portaria.manifestos.map((m) => m.filial_id).join(','), () => sincronizarAssinaturas());

watch(() => tempoReal.conectado, (conectado) => {
    if (conectado) {
        sincronizarAssinaturas();
    }
});
</script>

<template>
    <section class="pagina">
        <div class="pagina__cabecalho">
            <h1 class="pagina__titulo">Fila da portaria</h1>
            <span class="pagina__recorte">
                {{ portaria.nomeDaFilial }} · atualiza em tempo real
                <IndicadorTempoReal />
            </span>
        </div>

        <div class="pagina__filtros">
            <FiltroDeFilial
                v-if="auth.ehAdmin"
                :filial-id="portaria.filtros.filialId"
                :filiais="portaria.filiaisDisponiveis"
                @aplicar="aplicar"
            />
            <p class="pagina__aviso">
                <template v-if="podeRegistrar">
                    Toque no veículo para registrar a chegada ou a saída. A portaria só registra: o aceite de pallets é da equipe do CT.
                </template>
                <template v-else>
                    Somente leitura: o registro de chegada e saída é feito pelo porteiro.
                </template>
            </p>
            <p v-if="mensagemDeRegistro" class="pagina__aviso pagina__aviso--ok" role="status">{{ mensagemDeRegistro }}</p>
        </div>

        <ContextoDaPortaria
            v-if="cartaoDoContexto"
            :manifesto-id="cartaoDoContexto.id"
            :placa="cartaoDoContexto.placa"
            :coluna="colunaDoContexto"
            :pode-registrar="podeRegistrar"
            @fechar="cartaoDoContexto = null"
            @registrado="aoRegistrar"
        />

        <div v-if="portaria.falha" class="pagina__falha" role="alert">
            <span>{{ portaria.falha.mensagem }}</span>
            <button type="button" class="pagina__botao" @click="portaria.carregar()">
                Tentar de novo
            </button>
        </div>

        <EstadoVazio
            v-else-if="portaria.carregando && portaria.manifestos.length === 0"
            mensagem="Carregando a fila…"
            tracejado
        />

        <div v-else class="pagina__colunas">
            <section v-for="coluna in portaria.colunas" :key="coluna.slug" class="coluna" :data-coluna="coluna.slug">
                <div class="coluna__cabecalho">
                    <i class="coluna__marca" :class="`coluna__marca--${coluna.tom}`"></i>
                    <h2 class="coluna__titulo">{{ coluna.titulo }}</h2>
                    <span class="coluna__contagem">{{ coluna.total }}</span>
                    <span class="coluna__dica">{{ coluna.dica }}</span>
                </div>

                <EstadoVazio v-if="coluna.vazia" mensagem="Fila vazia" tracejado />

                <template v-else>
                    <CartaoDaFila
                        v-for="cartao in coluna.cartoes"
                        :key="cartao.id"
                        :cartao="cartao"
                        :abrir-contexto="podeRegistrar"
                        :rotulo-do-contexto="podeRegistrar ? (coluna.slug === 'aguardando_saida' ? 'Registrar saída' : 'Registrar chegada') : 'Ver contexto da portaria'"
                        @contexto="abrirContexto"
                    />
                </template>
            </section>
        </div>
    </section>
</template>

<style scoped src="@/styles/pages/operations/gate/gate_queue_page.css"></style>
