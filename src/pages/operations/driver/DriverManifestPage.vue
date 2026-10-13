<script setup>
import { badgeDoManifesto, textoDaCarga } from '@/domain/planning/status.js';
import { computed, onMounted, reactive } from 'vue';
import BaseCard from '@/components/all/ui/BaseCard.vue';
import EstadoVazio from '@/components/all/ui/EmptyState.vue';
import IndicadorTempoReal from '@/components/all/status/RealtimeIndicator.vue';
import StatusBadge from '@/components/all/ui/StatusBadge.vue';
import DriverServiceCard from '@/components/operations/driver/DriverServiceCard.vue';
import OccurrenceReportForm from '@/components/operations/shared/OccurrenceReportForm.vue';
import OperationalMap from '@/components/operations/map/OperationalMap.vue';
import PalletChain from '@/components/operations/pallets/PalletChain.vue';
import { useOperationalRealtime } from '@/composables/useOperationalRealtime.js';
import { permissoesDeAcao } from '@/domain/access/actions.js';
import { formatarAtraso } from '@/domain/map/delay.js';
import { atorDoAceiteNaEtapa } from '@/domain/operations/driver.js';
import { EVENTOS_OPERACIONAIS } from '@/services/realtime/operational.js';
import { ROTULO_DO_PAPEL, ROTULO_DO_STATUS } from '@/domain/map/stages.js';
import { useAuthStore } from '@/stores/auth.store.js';
import { useMotoristaStore } from '@/stores/driver.store.js';
import { dataEHora } from '@/utils/format.js';

/**
 * Meu manifesto (/painel/operacoes/meu-manifesto). Pensada para 390px, com o mesmo
 * contrato do futuro Android: próxima etapa, aceite da carga/pallets, mini-mapa, serviços
 * (descarga + canhoto) e ocorrência. Nada de lista longa antes da ação principal.
 */
const motorista = useMotoristaStore();
const auth = useAuthStore();
const permissoes = computed(() => permissoesDeAcao(auth.papeis));

// Quantidade que o motorista confirma em cada aceite pendente (padrão: o conferido).
const quantidades = reactive({});

const EVENTOS = [...EVENTOS_OPERACIONAIS, 'manifest.eta.updated', 'manifest.delay.detected', 'tracking.position.updated', 'manifest.route.updated'];
const DELTAS = ['manifest.eta.updated', 'manifest.delay.detected', 'tracking.position.updated', 'manifest.stop.status_changed'];

useOperationalRealtime({
    alvo: () => ({ manifestoIds: [motorista.manifestoId] }),
    recarregar: () => motorista.carregar(),
    eventos: EVENTOS,
    aoEvento(nome, payload) {
        if (DELTAS.includes(nome)) {
            motorista.aplicarDelta(nome, payload);
            return false;
        }
        return true;
    },
});

const proxima = computed(() => motorista.proxima);
const atraso = computed(() => proxima.value?.atraso_minutos ?? 0);
const ocorrencia = computed(() => motorista.ocorrenciaRelevante);

function quantidadeDe(item) {
    return quantidades[item.etapa_id] ?? item.quantidade_conferida ?? item.quantidade_esperada ?? 0;
}

function etapaDoAceite(item) {
    return motorista.etapas.find((e) => e.id === item.etapa_id) ?? null;
}

function aceitar(item) {
    const ator = atorDoAceiteNaEtapa(etapaDoAceite(item), motorista.servicos);
    return motorista.aceitar({ ...item, quantidade: quantidadeDe(item) }, ator);
}

async function reportar(corpo, limpar) {
    if (await motorista.reportarOcorrencia(corpo)) limpar();
}

onMounted(() => motorista.carregar());
</script>

<template>
    <section class="motorista">
        <div class="motorista__cabecalho">
            <h1 class="motorista__titulo">Meu manifesto</h1>
            <span class="motorista__recorte"><IndicadorTempoReal /></span>
        </div>

        <div v-if="motorista.falha" class="aviso aviso--erro" role="alert">
            {{ motorista.falha.mensagem }}
            <button type="button" class="botao botao--pequeno" @click="motorista.carregar()">Tentar de novo</button>
        </div>
        <EstadoVazio v-else-if="motorista.carregando" mensagem="Carregando seu manifesto…" tracejado />
        <EstadoVazio v-else-if="motorista.semManifesto" mensagem="Você não tem manifesto ativo no momento." tracejado />

        <template v-else-if="motorista.manifesto">
            <p v-if="motorista.aviso" class="aviso aviso--ok" role="status">{{ motorista.aviso }}</p>
            <p v-if="motorista.erroDaAcao" class="aviso aviso--erro" role="alert">{{ motorista.erroDaAcao.mensagem }}</p>

            <BaseCard :titulo="`MAN ${motorista.manifesto.numero ?? motorista.manifesto.id} · ${motorista.manifesto.placa ?? ''}`">
                <template #acoes>
                    <StatusBadge :rotulo="`Manifesto: ${badgeDoManifesto(motorista.manifesto).rotulo}`" tom="info" />
                    <StatusBadge :rotulo="textoDaCarga(motorista.dados ?? { manifesto: motorista.manifesto })" tom="neutro" />
                </template>
                <div v-if="proxima" class="proxima" data-bloco="proxima-etapa">
                    <span class="proxima__rotulo">Próxima etapa</span>
                    <strong class="proxima__nome">{{ proxima.ordem }}. {{ proxima.nome }}</strong>
                    <span class="proxima__meta">
                        {{ ROTULO_DO_PAPEL[proxima.papel] ?? proxima.papel }} · {{ ROTULO_DO_STATUS[proxima.status] ?? proxima.status }}
                    </span>
                    <dl class="detalhe">
                        <div><dt>ETA</dt><dd>{{ proxima.eta ? dataEHora(proxima.eta) : '—' }}</dd></div>
                        <div><dt>Janela até</dt><dd>{{ proxima.janela_fim ? dataEHora(proxima.janela_fim) : '—' }}</dd></div>
                        <div v-if="atraso > 0"><dt>Atraso previsto</dt><dd class="proxima__atraso">{{ formatarAtraso(atraso) }}</dd></div>
                    </dl>
                    <p v-if="proxima.endereco" class="proxima__meta">{{ proxima.endereco }}</p>
                </div>
                <EstadoVazio v-else mensagem="Todas as etapas foram concluídas." />
                <p v-if="ocorrencia" class="aviso" :class="{ 'aviso--erro': ocorrencia.severidade !== 'atencao' }" role="status">
                    Ocorrência aberta: {{ String(ocorrencia.tipo ?? '').replaceAll('_', ' ') }}<template v-if="ocorrencia.descricao"> — {{ ocorrencia.descricao }}</template>
                </p>
            </BaseCard>

            <BaseCard v-if="motorista.aAceitar.length" titulo="Aceitar carga / pallets">
                <div class="bloco">
                    <div v-for="item in motorista.aAceitar" :key="item.etapa_id" class="aceite" data-bloco="aceite">
                        <p class="aceite__texto">
                            Conferido: <strong>{{ item.quantidade_conferida ?? '—' }}</strong>
                            · Esperado: <strong>{{ item.quantidade_esperada ?? '—' }}</strong>
                        </p>
                        <div class="campo">
                            <label class="campo__rotulo" :for="`aceite-${item.etapa_id}`">Quantidade que você está assumindo</label>
                            <input
                                :id="`aceite-${item.etapa_id}`"
                                class="campo__entrada"
                                type="number"
                                inputmode="numeric"
                                min="0"
                                step="1"
                                :value="quantidadeDe(item)"
                                :disabled="motorista.ocupado || !permissoes.aceitarComoMotorista"
                                @input="quantidades[item.etapa_id] = $event.target.value"
                            />
                        </div>
                        <button
                            type="button"
                            class="botao botao--ok botao--grande"
                            :disabled="motorista.ocupado || !permissoes.aceitarComoMotorista"
                            data-acao="aceitar"
                            @click="aceitar(item)"
                        >
                            ACEITAR CARGA/PALLETS
                        </button>
                    </div>
                </div>
            </BaseCard>

            <BaseCard titulo="Rota">
                <div class="motorista__mapa">
                    <OperationalMap
                        :etapas="motorista.etapas"
                        :rota="motorista.dados.rota ?? null"
                        :trajeto="motorista.dados.trajeto ?? null"
                        :posicoes="motorista.dados.posicoes ?? null"
                        :manifesto-id="motorista.manifestoId"
                        :etapa-destacada-id="proxima?.id ?? null"
                    />
                </div>
            </BaseCard>

            <BaseCard titulo="Serviços">
                <EstadoVazio v-if="motorista.servicos.length === 0" mensagem="Nenhum serviço empenhado neste manifesto." tracejado />
                <div v-else class="bloco">
                    <DriverServiceCard
                        v-for="servico in motorista.servicos"
                        :key="servico.id"
                        :servico="servico"
                        :ocupado="motorista.ocupado"
                        :passo="motorista.passo"
                        :pode-operar="permissoes.aceitarComoMotorista"
                        @concluir="(dados) => motorista.concluirServico(servico, dados)"
                    />
                </div>
            </BaseCard>

            <BaseCard titulo="Pallets">
                <PalletChain :pallets="motorista.dados.pallets" compacto />
            </BaseCard>

            <BaseCard v-if="permissoes.reportarOcorrencia" titulo="Reportar ocorrência">
                <OccurrenceReportForm :ocupado="motorista.ocupado" :etapas="motorista.etapas" @enviar="reportar" />
            </BaseCard>
        </template>
    </section>
</template>

<style scoped src="@/styles/pages/operations/driver/driver_manifest_page.css"></style>
<style scoped src="@/styles/components/operations/shared/operation_form.css"></style>
<style scoped src="@/styles/pages/operations/operation_page.css"></style>
