<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import AnexosDoManifesto from '@/components/operations/manifests/ManifestAttachments.vue';
import BadgeDeStatus from '@/components/all/ui/StatusBadge.vue';
import EstadoVazio from '@/components/all/ui/EmptyState.vue';
import LinhaDoTempoManifesto from '@/components/operations/manifests/ManifestTimeline.vue';
import PainelCard from '@/components/all/ui/BaseCard.vue';
import ReatribuicaoDoManifesto from '@/components/operations/manifests/ManifestReassignment.vue';
import TrajetoDoManifesto from '@/components/operations/manifests/ManifestRoute.vue';
import { dataDoDia, dataEHora, numero } from '@/utils/format.js';
import { manifestoService } from '@/services/api/manifests.api.js';
import { agrupar } from '@/services/realtime/realtime.service.js';
import { podeAcessar } from '@/domain/access/roles.js';
import { useAuthStore } from '@/stores/auth.store.js';
import { STATUS_DO_MANIFESTO } from '@/stores/manifests.store.js';
import { useTempoRealStore } from '@/stores/realtime.store.js';

/**
 * Detalhe do manifesto: o cabeçalho da viagem e a linha do tempo do que aconteceu em campo
 * (US-9.3, US-8.4).
 *
 * A tela pede dois endpoints em paralelo: o detalhe — manifesto, paradas, conferências e
 * divergências — e a linha do tempo, que reconstrói a viagem evento a evento e traz a série
 * de posições do trajeto.
 *
 * A única ação da tela é a reatribuição (US-8.7): ela vive aqui porque é do manifesto que
 * se decide trocar o motorista, e depois de aplicada a tela recarrega — o cabeçalho, a
 * linha do tempo e o novo dono precisam contar a mesma história.
 */
const route = useRoute();
const podePlanejar = podeAcessar(useAuthStore().papeis, ['roteirizador']);
const tempoReal = useTempoRealStore();

const detalhe = ref(null);
const linhaDoTempo = ref([]);
const posicoes = ref([]);
const carregando = ref(true);
const falha = ref(null);

const manifesto = computed(() => detalhe.value?.manifesto ?? null);

const TONS_POR_STATUS_DE_DIVERGENCIA = {
    aberta: 'bad',
    justificada: 'warn',
    resolvida: 'ok',
};

/**
 * Os anexos saem da própria linha do tempo, que já os traz na ordem de envio. A URL de
 * leitura **não** é aproveitada daqui: a miniatura pede a dela no clique, porque a assinatura
 * dura poucos minutos e a que veio com a lista já teria vencido.
 */
const anexos = computed(() => linhaDoTempo.value
    .filter((linha) => linha.referencia?.tipo === 'anexo')
    .map((linha) => ({
        id: linha.referencia.id,
        descricao: linha.descricao ?? linha.tipo,
        enviadoEm: linha.ocorrido_em,
        mimeType: linha.detalhe?.mime_type ?? null,
    })));

const divergencias = computed(() => detalhe.value?.divergencias ?? []);

const conferencias = computed(() => detalhe.value?.conferencias ?? []);

const status = computed(
    () => STATUS_DO_MANIFESTO.find((linha) => linha.slug === manifesto.value?.status) ?? null,
);

const filial = computed(() => {
    const dados = manifesto.value;

    if (dados === null) {
        return '—';
    }

    return dados.filial_nome ? `${dados.filial_codigo} · ${dados.filial_nome}` : `Filial ${dados.filial_id}`;
});

async function carregar() {
    carregando.value = true;

    const id = route.params.manifesto;

    const [respostaDetalhe, respostaLinha] = await Promise.all([
        manifestoService.detalhe(id),
        manifestoService.linhaDoTempo(id),
    ]);

    if (respostaDetalhe.ok) {
        detalhe.value = respostaDetalhe.dados.data;
        falha.value = null;
    } else {
        detalhe.value = null;
        falha.value = respostaDetalhe.falha;
    }

    linhaDoTempo.value = respostaLinha.ok ? respostaLinha.dados.data.linha_do_tempo : [];

    // Série vazia é estado normal da viagem: o motorista pode não ter mandado ping nenhum.
    posicoes.value = respostaLinha.ok ? respostaLinha.dados.data.posicoes : [];

    carregando.value = false;
}

/**
 * Releitura agrupada do detalhe. A parada que fecha muda o cabeçalho, a linha do tempo e o
 * quadro de paradas ao mesmo tempo: os três saem dos mesmos dois endpoints, e recarregá-los
 * uma vez por rajada basta.
 */
const relerDetalhe = agrupar(() => carregar());

/**
 * O acontecimento só interessa se for deste manifesto: a tela aberta é de uma viagem, e o
 * canal do admin carrega a operação inteira.
 */
function ehDesteManifesto(evento) {
    return Number(evento.manifesto_id) === Number(route.params.manifesto);
}

let cancelarAssinatura = null;

let pararDeOuvirReconexao = null;

onMounted(() => {
    carregar();

    cancelarAssinatura = tempoReal.assinarAdmin({
        'manifesto.progresso': (evento) => {
            if (ehDesteManifesto(evento)) {
                relerDetalhe();
            }
        },
        'divergencia.aberta': (evento) => {
            if (ehDesteManifesto(evento)) {
                relerDetalhe();
            }
        },
    });

    // A queda da conexão não perde o que aconteceu no meio dela: a volta relê o detalhe
    // inteiro, que é a fonte dos mesmos fatos que os eventos trariam.
    pararDeOuvirReconexao = tempoReal.aoReconectar(() => carregar());
});

onUnmounted(() => {
    pararDeOuvirReconexao?.();
    cancelarAssinatura?.();
});
</script>

<template>
    <section class="pagina">
        <div class="pagina__cabecalho">
            <h1 class="pagina__titulo">Manifesto {{ manifesto?.numero ?? '' }}</h1>
            <span class="pagina__acoes-topo">
                <RouterLink
                    v-if="podePlanejar && manifesto"
                    class="pagina__botao"
                    :to="{ name: 'manifesto-planejar', params: { manifesto: manifesto.id } }"
                    data-acao="planejar"
                >Planejar</RouterLink>
                <RouterLink class="pagina__volta" :to="{ name: 'manifestos' }">Voltar aos manifestos</RouterLink>
            </span>
        </div>

        <div v-if="falha" class="pagina__falha" role="alert">
            <span>{{ falha.mensagem }}</span>
            <button type="button" class="pagina__botao" @click="carregar">Tentar de novo</button>
        </div>

        <EstadoVazio v-else-if="carregando" mensagem="Carregando o manifesto…" tracejado />

        <template v-else-if="manifesto">
            <PainelCard :titulo="`MAN ${manifesto.numero}`">
                <template #acoes>
                    <BadgeDeStatus
                        :rotulo="status?.rotulo ?? manifesto.status ?? '—'"
                        :tom="status?.tom ?? 'neutro'"
                    />
                </template>

                <dl class="cabecalho">
                    <div class="cabecalho__item">
                        <dt>Motorista</dt>
                        <dd data-cabecalho="motorista">{{ manifesto.motorista_nome ?? '—' }}</dd>
                    </div>
                    <div class="cabecalho__item">
                        <dt>Veículo</dt>
                        <dd data-cabecalho="veiculo">{{ manifesto.veiculo_placa ?? '—' }}</dd>
                    </div>
                    <div class="cabecalho__item">
                        <dt>Filial</dt>
                        <dd data-cabecalho="filial">{{ filial }}</dd>
                    </div>
                    <div class="cabecalho__item">
                        <dt>Data</dt>
                        <dd data-cabecalho="data">{{ dataDoDia(manifesto.data) }}</dd>
                    </div>
                </dl>

                <dl class="agregados">
                    <div class="agregados__item">
                        <dt>Serviços</dt>
                        <dd>{{ numero(manifesto.total_servicos) }}</dd>
                    </div>
                    <div class="agregados__item">
                        <dt>Volumes</dt>
                        <dd>{{ numero(manifesto.total_volumes) }}</dd>
                    </div>
                    <div class="agregados__item">
                        <dt>Peso real</dt>
                        <dd>{{ numero(manifesto.peso_real, 1) }}</dd>
                    </div>
                    <div class="agregados__item">
                        <dt>Retiradas</dt>
                        <dd>{{ numero(manifesto.total_retiradas) }}</dd>
                    </div>
                    <div class="agregados__item">
                        <dt>Saldo de pallets</dt>
                        <dd>{{ numero(manifesto.saldo_pallets) }}</dd>
                    </div>
                </dl>
            </PainelCard>

            <PainelCard titulo="Reatribuir manifesto">
                <ReatribuicaoDoManifesto :manifesto="manifesto" @reatribuido="carregar" />
            </PainelCard>

            <PainelCard titulo="Linha do tempo">
                <template #acoes>
                    <span class="pagina__contador">{{ linhaDoTempo.length }} acontecimentos</span>
                </template>
                <LinhaDoTempoManifesto :linhas="linhaDoTempo" />
            </PainelCard>

            <PainelCard titulo="Anexos">
                <template #acoes>
                    <span class="pagina__contador">{{ anexos.length }}</span>
                </template>
                <AnexosDoManifesto :linhas="anexos" />
            </PainelCard>

            <PainelCard titulo="Trajeto">
                <TrajetoDoManifesto :posicoes="posicoes" />
            </PainelCard>

            <PainelCard titulo="Divergências do manifesto">
                <template #acoes>
                    <span class="pagina__contador">{{ divergencias.length }}</span>
                </template>

                <EstadoVazio
                    v-if="divergencias.length === 0"
                    mensagem="Nenhuma divergência neste manifesto."
                    tracejado
                />

                <ul v-else class="lista">
                    <li v-for="divergencia in divergencias" :key="divergencia.id" class="lista__item" data-divergencia>
                        <div class="lista__topo">
                            <BadgeDeStatus :rotulo="divergencia.tipo ?? '—'" tom="info" />
                            <BadgeDeStatus
                                :rotulo="divergencia.status ?? '—'"
                                :tom="TONS_POR_STATUS_DE_DIVERGENCIA[divergencia.status] ?? 'neutro'"
                            />
                            <RouterLink
                                class="lista__link"
                                :to="{ name: 'divergencia', params: { divergencia: divergencia.id } }"
                            >
                                abrir
                            </RouterLink>
                        </div>
                        <span class="lista__numeros">
                            esperado {{ numero(divergencia.valor_esperado) }} ·
                            declarado {{ numero(divergencia.valor_declarado) }} ·
                            conferido {{ numero(divergencia.valor_conferido) }} ·
                            diferença {{ numero(divergencia.diferenca) }}
                        </span>
                        <small class="lista__quando">{{ dataEHora(divergencia.criado_em) }}</small>
                    </li>
                </ul>
            </PainelCard>

            <PainelCard titulo="Conferências da portaria">
                <template #acoes>
                    <span class="pagina__contador">{{ conferencias.length }}</span>
                </template>

                <EstadoVazio
                    v-if="conferencias.length === 0"
                    mensagem="Nenhuma conferência registrada na portaria."
                    tracejado
                />

                <ul v-else class="lista">
                    <li v-for="conferencia in conferencias" :key="conferencia.id" class="lista__item" data-conferencia>
                        <div class="lista__topo">
                            <BadgeDeStatus :rotulo="conferencia.tipo ?? '—'" tom="info" />
                            <small class="lista__quando">{{ dataEHora(conferencia.conferido_em) }}</small>
                        </div>
                        <span class="lista__numeros">
                            pallets conferidos {{ numero(conferencia.pallets_conferidos) }} ·
                            esperados {{ numero(conferencia.pallets_esperados) }} ·
                            km {{ numero(conferencia.km_conferido) }} ·
                            lacre {{ conferencia.lacre ?? '—' }}
                        </span>
                    </li>
                </ul>
            </PainelCard>
        </template>
    </section>
</template>

<style scoped src="@/styles/pages/operations/manifests/manifest_details_page.css"></style>
