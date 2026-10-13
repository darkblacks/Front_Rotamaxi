<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BaseCard from '@/components/all/ui/BaseCard.vue';
import EmptyState from '@/components/all/ui/EmptyState.vue';
import StatusBadge from '@/components/all/ui/StatusBadge.vue';
import IndicadorTempoReal from '@/components/all/status/RealtimeIndicator.vue';
import OperationalMap from '@/components/operations/map/OperationalMap.vue';
import LookupSelect from '@/components/operations/planning/LookupSelect.vue';
import PointPicker from '@/components/operations/planning/PointPicker.vue';
import StopSequenceEditor from '@/components/operations/planning/StopSequenceEditor.vue';
import { lookupService } from '@/services/api/planning.api.js';
import { agrupar } from '@/services/realtime/realtime.service.js';
import { pontoDefinido, pontoParaPayload, deInputLocal, paraInputLocal, localDoServico, rotuloDoTipo, tipoDoServico } from '@/domain/planning/services.js';
import { etapasParaPreview } from '@/domain/planning/sequence.js';
import { badgeDoManifesto, badgeDoServico, textoDaCarga } from '@/domain/planning/status.js';
import { usePlanejadorStore, useServicosStore } from '@/stores/planning.store.js';
import { useTempoRealStore } from '@/stores/realtime.store.js';

/**
 * Montagem de manifesto (v2.1): início, fim, veículo, motorista e lista ORDENADA de serviços
 * empenhados (cada um é tipo + local); etapas e rota são derivadas dos serviços. Paradas
 * operacionais manuais são opcionais. Mapa, recalcular rota e liberar.
 * Sem manifesto na rota = novo manifesto; com `:manifesto` = edição.
 */
const route = useRoute();
const router = useRouter();
const planner = usePlanejadorStore();
const servicos = useServicosStore();
const tempoReal = useTempoRealStore();

const mapaRef = ref(null);
const dados = reactive({ veiculo: null, motorista: null, filialId: null, inicial: null, final: null, previsao: '', observacao: '' });
const alterouPontos = ref(false);
const selecionados = ref([]);
const tentou = ref(false);
const arrastandoServico = ref(null);
const liberado = ref(false);
let cancelarManifesto = null;
let cancelarFilial = null;
let pararReconexao = null;

const idDaRota = computed(() => {
    const n = Number.parseInt(route.params.manifesto, 10);
    return Number.isInteger(n) ? n : null;
});
const existente = computed(() => planner.manifestoId !== null);
const bloqueado = computed(() => !planner.editavel || planner.ocupado);
const dadosOk = computed(() => !!dados.veiculo?.id && !!dados.motorista?.id && dados.filialId !== null && pontoDefinido(dados.inicial) && pontoDefinido(dados.final));
const marcador = computed(() => planner.manifestoId ?? 0);
const rotaDesatualizada = computed(() => planner.sujo);
const etapasPreview = computed(() => etapasParaPreview(planner.rascunho));
const carga = computed(() => textoDaCarga(planner.detalhe));

const recarregar = agrupar(() => planner.recarregar());

function ponto(p) {
    return p?.nome ? { nome: p.nome, latitude: p.lat ?? p.latitude, longitude: p.lng ?? p.longitude } : null;
}

function preencherDeDetalhe() {
    const m = planner.manifesto;
    if (!m) return;
    dados.veiculo = planner.veiculo;
    dados.motorista = planner.motorista;
    dados.filialId = m.filial?.id ?? dados.filialId;
    dados.inicial = ponto(m.ponto_inicial);
    dados.final = ponto(m.ponto_final);
    dados.previsao = paraInputLocal(m.previsao_saida);
    alterouPontos.value = false;
}

function assinar() {
    cancelarManifesto?.();
    cancelarFilial?.();
    cancelarManifesto = cancelarFilial = null;
    if (planner.manifestoId === null) return;
    const ouvintes = {
        'manifest.route.updated': recarregar,
        'manifest.service.updated': recarregar,
        'manifest.stop.status_changed': recarregar,
    };
    cancelarManifesto = tempoReal.assinarManifesto(planner.manifestoId, ouvintes);
    if (dados.filialId !== null) cancelarFilial = tempoReal.assinarFilial(dados.filialId, { 'manifest.service.updated': recarregar });
}

async function criar() {
    tentou.value = true;
    if (!dadosOk.value) return;
    const id = await planner.criarManifesto({
        veiculo: dados.veiculo, motorista: dados.motorista, filialId: dados.filialId,
        inicial: pontoParaPayload(dados.inicial), final: pontoParaPayload(dados.final),
        previsaoSaida: deInputLocal(dados.previsao), observacao: dados.observacao.trim(),
    });
    if (id !== null) router.replace({ name: 'manifesto-planejar', params: { manifesto: id } });
}

async function salvarDados() {
    const payload = {};
    if (dados.veiculo?.id && dados.veiculo.id !== planner.veiculo?.id) payload.veiculo_id = dados.veiculo.id;
    if (dados.motorista?.id && dados.motorista.id !== planner.motorista?.id) payload.motorista_id = dados.motorista.id;
    if (alterouPontos.value) {
        payload.ponto_inicial = pontoParaPayload(dados.inicial);
        payload.ponto_final = pontoParaPayload(dados.final);
    }
    if (Object.keys(payload).length === 0) return;
    if (await planner.atualizarDados(payload)) preencherDeDetalhe();
}

function aoMudarPonto(campo, valor) {
    dados[campo] = valor;
    alterouPontos.value = true;
}

function soltarServico(destino) {
    if (arrastandoServico.value !== null) planner.arrastarServico(arrastandoServico.value, destino);
    arrastandoServico.value = null;
}

async function salvarSequencia() { await planner.salvarSequencia(); }
async function recalcular() { await planner.recalcularRota(); }
async function liberar() {
    if (await planner.liberar()) liberado.value = true;
}
async function empenhar() {
    for (const id of selecionados.value) {
        // eslint-disable-next-line no-await-in-loop
        if (!(await planner.empenhar(id))) break;
    }
    selecionados.value = [];
}

onMounted(async () => {
    planner.reiniciar();
    servicos.carregarFiliais();
    pararReconexao = tempoReal.aoReconectar(() => { assinar(); planner.recarregar(); });
    if (idDaRota.value !== null) {
        if (await planner.carregar(idDaRota.value)) preencherDeDetalhe();
    } else {
        planner.carregarDemandas();
    }
    assinar();
});

onUnmounted(() => {
    cancelarManifesto?.();
    cancelarFilial?.();
    pararReconexao?.();
    planner.reiniciar();
});

watch(() => tempoReal.conectado, (c) => { if (c) assinar(); });
watch(() => idDaRota.value, async (id) => {
    if (id === null) return;
    if (id !== planner.manifestoId || planner.detalhe === null) {
        if (await planner.carregar(id)) preencherDeDetalhe();
    } else {
        preencherDeDetalhe();
    }
    assinar();
});
</script>

<template>
    <section class="planner">
        <div class="plan__cabecalho">
            <h1 class="plan__titulo">
                {{ existente ? `Planejar manifesto ${planner.manifesto?.numero ?? ''}` : 'Novo manifesto' }}
            </h1>
            <span class="plan__acoes">
                <IndicadorTempoReal />
                <StatusBadge v-if="planner.manifesto?.status" :rotulo="`Manifesto: ${badgeDoManifesto(planner.manifesto).rotulo}`" tom="info" />
                <StatusBadge v-if="existente" :rotulo="carga" tom="neutro" />
                <RouterLink class="botao" :to="{ name: 'planejamento' }">Serviços</RouterLink>
                <button v-if="existente" type="button" class="botao" @click="planner.recarregar()">Atualizar</button>
            </span>
        </div>

        <div v-if="planner.falha" class="plan__falha" role="alert">
            <span>{{ planner.falha.mensagem }}</span>
            <button type="button" class="botao" @click="planner.carregar(idDaRota)">Tentar de novo</button>
        </div>
        <EmptyState v-else-if="planner.carregando" mensagem="Carregando manifesto…" tracejado />

        <div v-else class="planner__grade">
            <div class="planner__col">
                <BaseCard titulo="1. Dados do manifesto">
                    <div class="planner__campos">
                        <LookupSelect
                            v-model="dados.veiculo" titulo="Veículo / placa" placeholder="Buscar placa"
                            :buscar="(q) => lookupService.veiculos(q)"
                            :rotulo="(v) => v.placa ?? `Veículo ${v.id}`"
                            :detalhe="(v) => [v.descricao, v.tipo].filter(Boolean).join(' · ')"
                            :erro="tentou && !dados.veiculo?.id ? 'Escolha o veículo.' : ''"
                            :desabilitado="bloqueado"
                        />
                        <LookupSelect
                            v-model="dados.motorista" titulo="Motorista" placeholder="Buscar motorista"
                            :buscar="(q) => lookupService.motoristas(q)"
                            :rotulo="(m) => m.nome ?? `Motorista ${m.id}`"
                            :detalhe="(m) => m.documento ?? ''"
                            :erro="tentou && !dados.motorista?.id ? 'Escolha o motorista.' : ''"
                            :desabilitado="bloqueado"
                        />
                        <label class="form__campo">
                            <span class="lookup__titulo">Filial / CT</span>
                            <select v-model="dados.filialId" class="lookup__entrada" :disabled="existente || bloqueado">
                                <option :value="null">Selecione…</option>
                                <option v-for="f in servicos.filiais" :key="f.id" :value="f.id">{{ f.codigo }} · {{ f.nome }}</option>
                            </select>
                            <small v-if="tentou && dados.filialId === null" class="lookup__mensagem">Escolha a filial.</small>
                        </label>
                        <label class="form__campo">
                            <span class="lookup__titulo">Previsão de saída</span>
                            <input v-model="dados.previsao" type="datetime-local" class="lookup__entrada" :disabled="existente || bloqueado" />
                        </label>
                        <PointPicker :model-value="dados.inicial" titulo="Ponto inicial" :erro="tentou && !pontoDefinido(dados.inicial) ? 'Defina o ponto inicial.' : ''" :desabilitado="bloqueado" @update:model-value="aoMudarPonto('inicial', $event)" />
                        <PointPicker :model-value="dados.final" titulo="Ponto final" :erro="tentou && !pontoDefinido(dados.final) ? 'Defina o ponto final.' : ''" :desabilitado="bloqueado" @update:model-value="aoMudarPonto('final', $event)" />
                        <label v-if="!existente" class="form__campo">
                            <span class="lookup__titulo">Observação</span>
                            <textarea v-model="dados.observacao" class="lookup__entrada" rows="2"></textarea>
                        </label>
                    </div>
                    <ul v-if="planner.mensagens.length && !existente" class="form__erros" role="alert">
                        <li v-for="(m, i) in planner.mensagens" :key="i">{{ m }}</li>
                    </ul>
                    <div class="planner__linha-acoes">
                        <button v-if="!existente" type="button" class="botao botao--primario" :disabled="planner.ocupado" @click="criar">
                            {{ planner.ocupado ? 'Criando…' : 'Criar manifesto' }}
                        </button>
                        <button v-else type="button" class="botao" :disabled="bloqueado" @click="salvarDados">Salvar dados</button>
                    </div>
                </BaseCard>

                <template v-if="existente">
                    <BaseCard titulo="2. Serviços do manifesto (ordem de execução)">
                        <p class="planner__dica">
                            Rota = ponto inicial + locais dos serviços, nesta ordem + ponto final.
                            <strong>Ponto final do manifesto = recebimento do CT (não é serviço):</strong>
                            não crie serviço para ele. Se um serviço tiver o mesmo local do ponto final, ele é vinculado ao fim e a rota não duplica a parada.
                        </p>
                        <p v-if="planner.sujo" class="planner__aviso-sujo">Salve as paradas manuais antes de empenhar ou reordenar serviços.</p>
                        <ol v-if="planner.servicosEmpenhados.length" class="planner__servicos" aria-label="Serviços empenhados em ordem">
                            <li
                                v-for="(s, i) in planner.servicosEmpenhados"
                                :key="s.id"
                                class="planner__servico"
                                :draggable="!bloqueado"
                                @dragstart="arrastandoServico = s.id"
                                @dragover.prevent
                                @drop.prevent="soltarServico(s.id)"
                            >
                                <span class="planner__ordem">{{ i + 1 }}</span>
                                <span class="planner__servico-texto">
                                    <strong>{{ s.numero ?? `#${s.id}` }} · {{ rotuloDoTipo(tipoDoServico(s)) }}</strong>
                                    <small>
                                        {{ localDoServico(s)?.nome ?? 'local não definido' }}
                                        <template v-if="s.pallets_previstos != null"> · {{ s.pallets_previstos }} pallets</template>
                                    </small>
                                </span>
                                <StatusBadge :rotulo="`Serviço: ${badgeDoServico(s).rotulo}`" :tom="badgeDoServico(s).tom" />
                                <button type="button" class="botao botao--icone" :disabled="bloqueado || i === 0" aria-label="Subir serviço" @click="planner.moverServico(s.id, -1)">↑</button>
                                <button type="button" class="botao botao--icone" :disabled="bloqueado || i === planner.servicosEmpenhados.length - 1" aria-label="Descer serviço" @click="planner.moverServico(s.id, 1)">↓</button>
                                <button type="button" class="botao" :disabled="bloqueado" @click="planner.desempenhar(s.id)">Desempenhar</button>
                            </li>
                        </ol>
                        <EmptyState v-else mensagem="Nenhum serviço empenhado neste manifesto." tracejado />
                        <div v-if="planner.ordemSuja" class="planner__linha-acoes">
                            <button type="button" class="botao" :disabled="bloqueado" @click="planner.descartarOrdem()">Descartar ordem</button>
                            <button type="button" class="botao botao--primario" :disabled="bloqueado || planner.sujo" @click="planner.salvarOrdemServicos()">Salvar ordem e recalcular rota</button>
                        </div>

                        <span class="lookup__titulo">Serviços disponíveis (demanda)</span>
                        <ul v-if="planner.demandas.length" class="planner__servicos" aria-label="Serviços disponíveis">
                            <li v-for="s in planner.demandas" :key="s.id" class="planner__servico">
                                <input v-model="selecionados" type="checkbox" :value="s.id" :disabled="bloqueado || planner.sujo || planner.ordemSuja" :aria-label="`Selecionar serviço ${s.numero ?? s.id}`" />
                                <span class="planner__servico-texto">
                                    <strong>{{ s.numero ?? `#${s.id}` }} · {{ rotuloDoTipo(tipoDoServico(s)) }}</strong>
                                    <small>{{ localDoServico(s)?.nome ?? 'local não definido' }}</small>
                                </span>
                                <StatusBadge :rotulo="`Serviço: ${badgeDoServico(s).rotulo}`" :tom="badgeDoServico(s).tom" />
                            </li>
                        </ul>
                        <EmptyState v-else mensagem="Nenhuma demanda disponível. Crie serviços em Planejamento." tracejado />
                        <div class="planner__linha-acoes">
                            <button type="button" class="botao botao--primario" :disabled="selecionados.length === 0 || bloqueado || planner.sujo || planner.ordemSuja" @click="empenhar">
                                Empenhar {{ selecionados.length || '' }} selecionado(s)
                            </button>
                        </div>
                    </BaseCard>

                    <BaseCard titulo="3. Paradas operacionais (opcional)">
                        <p class="planner__dica">Paradas extras sem serviço, como estacionamento. Os locais dos serviços entram sozinhos na rota.</p>
                        <p v-if="planner.sujo" class="planner__aviso-sujo">Há alterações não salvas nas paradas.</p>
                        <EmptyState v-if="planner.rascunho.length === 0" mensagem="Sem etapas ainda." tracejado />
                        <StopSequenceEditor
                            :etapas="planner.rascunho" :desabilitado="bloqueado"
                            @adicionar="planner.adicionarParada" @remover="planner.removerParada"
                            @mover="planner.mover" @arrastar="planner.arrastar" @editar="planner.editar"
                        />
                        <div class="planner__linha-acoes">
                            <button type="button" class="botao" :disabled="!planner.sujo || bloqueado" @click="planner.descartar()">Descartar</button>
                            <button type="button" class="botao botao--primario" :disabled="!planner.sujo || bloqueado" @click="salvarSequencia">Salvar paradas</button>
                        </div>
                    </BaseCard>

                    <BaseCard titulo="4. Validação e liberação">
                        <ul class="planner__msgs" aria-label="Validação RN §20">
                            <li v-for="(m, i) in planner.validacao" :key="`v${i}`" :class="`planner__msg--${m.nivel}`">{{ m.texto }}</li>
                            <li v-for="(a, i) in planner.servidorAvisos" :key="`s${i}`" class="planner__msg--aviso">{{ typeof a === 'string' ? a : a.mensagem ?? JSON.stringify(a) }}</li>
                            <li v-if="!planner.validacao.length && !planner.servidorAvisos.length" class="planner__msg--ok">Sem pendências de validação.</li>
                        </ul>
                        <ul v-if="planner.mensagens.length" class="form__erros" role="alert">
                            <li v-for="(m, i) in planner.mensagens" :key="i">{{ m }}</li>
                        </ul>
                        <p v-if="liberado" class="planner__msg--ok" role="status">Manifesto liberado para execução.</p>
                        <div class="planner__linha-acoes">
                            <button type="button" class="botao" :disabled="bloqueado || planner.sujo || planner.ordemSuja" @click="recalcular">Recalcular rota</button>
                            <button type="button" class="botao botao--primario" :disabled="!planner.podeLiberar || bloqueado" @click="liberar">
                                Liberar para execução
                            </button>
                        </div>
                        <RouterLink class="botao" :to="{ name: 'manifestos' }">Voltar aos manifestos</RouterLink>
                    </BaseCard>
                </template>
                <EmptyState v-else mensagem="Crie o manifesto para montar a sequência, empenhar serviços e liberar." tracejado />
            </div>

            <div class="planner__mapa">
                <OperationalMap
                    ref="mapaRef"
                    :etapas="etapasPreview"
                    :rota="planner.detalhe?.rota ?? null"
                    :trajeto="null"
                    :posicoes="null"
                    :manifesto-id="marcador"
                    :mostrar="{ veiculos: false, celulares: false, pontos: true }"
                >
                    <div v-if="rotaDesatualizada" class="plan__sobre">Rota desatualizada: salve as alterações e recalcule.</div>
                </OperationalMap>
            </div>
        </div>
    </section>
</template>

<style scoped src="@/styles/pages/operations/planning/planning_page.css"></style>
<style scoped src="@/styles/components/operations/planning/planning.css"></style>
