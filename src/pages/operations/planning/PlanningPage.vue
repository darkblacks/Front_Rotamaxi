<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import BaseCard from '@/components/all/ui/BaseCard.vue';
import EmptyState from '@/components/all/ui/EmptyState.vue';
import StatusBadge from '@/components/all/ui/StatusBadge.vue';
import IndicadorTempoReal from '@/components/all/status/RealtimeIndicator.vue';
import ServiceForm from '@/components/operations/planning/ServiceForm.vue';
import { STATUS_DO_SERVICO, TIPOS_DE_SERVICO, localDoServico, rotuloDoTipo, tipoDoServico } from '@/domain/planning/services.js';
import { agrupar } from '@/services/realtime/realtime.service.js';
import { useServicosStore } from '@/stores/planning.store.js';
import { useTempoRealStore } from '@/stores/realtime.store.js';
import { dataEHora } from '@/utils/format.js';

/**
 * Planejamento / Serviços: lista de demandas e serviços, filtros e criação de Serviço.
 * Atualiza por `private-filial.{id}` (manifest.service.updated) sem polling curto.
 */
const store = useServicosStore();
const tempoReal = useTempoRealStore();
const criando = ref(false);
const assinaturas = new Map();
let debounce = null;
let pararReconexao = null;

const recarregar = agrupar(() => store.carregar());

function sincronizarAssinaturas() {
    const desejadas = store.filiais.map((f) => f.id);
    [...assinaturas.keys()].filter((id) => !desejadas.includes(id)).forEach((id) => {
        assinaturas.get(id)();
        assinaturas.delete(id);
    });
    desejadas.filter((id) => !assinaturas.has(id)).forEach((id) => {
        assinaturas.set(id, tempoReal.assinarFilial(id, {
            'manifest.service.updated': recarregar,
        }));
    });
}

function filtrar(parcial) {
    store.definirFiltros(parcial);
    clearTimeout(debounce);
    debounce = setTimeout(() => store.carregar(), 350);
}

async function salvar(formulario) {
    if (await store.criar(formulario)) criando.value = false;
}

onMounted(async () => {
    store.carregar();
    pararReconexao = tempoReal.aoReconectar(() => store.carregar());
    await store.carregarFiliais();
    sincronizarAssinaturas();
});

onUnmounted(() => {
    clearTimeout(debounce);
    pararReconexao?.();
    [...assinaturas.values()].forEach((cancelar) => cancelar());
    assinaturas.clear();
});

watch(() => tempoReal.conectado, (c) => {
    if (c) {
        [...assinaturas.values()].forEach((cancelar) => cancelar());
        assinaturas.clear();
        sincronizarAssinaturas();
    }
});

function nomeDoLocal(s) {
    return localDoServico(s)?.nome ?? '—';
}
</script>

<template>
    <section class="plan">
        <div class="plan__cabecalho">
            <h1 class="plan__titulo">Planejamento / Serviços</h1>
            <span class="plan__acoes">
                <IndicadorTempoReal />
                <RouterLink class="botao" :to="{ name: 'manifesto-novo' }">Novo manifesto</RouterLink>
                <button type="button" class="botao botao--primario" @click="criando = !criando">
                    {{ criando ? 'Fechar formulário' : 'Novo serviço' }}
                </button>
            </span>
        </div>

        <BaseCard v-if="criando" titulo="Novo serviço">
            <ServiceForm :salvando="store.salvando" :erros-do-servidor="store.errosDoServidor" @salvar="salvar" @cancelar="criando = false" />
        </BaseCard>

        <BaseCard>
            <div class="plan__filtros">
                <label class="plan__filtro"><span>Buscar</span>
                    <input class="plan__controle" type="search" placeholder="Número, cliente, ponto" :value="store.filtros.q" @input="filtrar({ q: $event.target.value })" />
                </label>
                <label class="plan__filtro"><span>Status</span>
                    <select class="plan__controle" :value="store.filtros.status" @change="filtrar({ status: $event.target.value })">
                        <option value="">Todos</option>
                        <option v-for="(s, id) in STATUS_DO_SERVICO" :key="id" :value="id">{{ s.rotulo }}</option>
                    </select>
                </label>
                <label class="plan__filtro"><span>Tipo</span>
                    <select class="plan__controle" :value="store.filtros.tipo" @change="filtrar({ tipo: $event.target.value })">
                        <option value="">Todos</option>
                        <option v-for="t in TIPOS_DE_SERVICO" :key="t.id" :value="t.id">{{ t.rotulo }}</option>
                    </select>
                </label>
            </div>
        </BaseCard>

        <div v-if="store.falha" class="plan__falha" role="alert">
            <span>{{ store.falha.mensagem }}</span>
            <button type="button" class="botao" @click="store.carregar()">Tentar de novo</button>
        </div>
        <EmptyState v-else-if="store.carregando && store.servicos.length === 0" mensagem="Carregando serviços…" tracejado />
        <EmptyState v-else-if="store.servicos.length === 0" mensagem="Nenhum serviço encontrado. Crie um serviço para começar." tracejado />

        <ul v-else class="plan__lista">
            <li v-for="s in store.servicos" :key="s.id" class="servico" :data-servico="s.id">
                <div class="servico__topo">
                    <strong>{{ s.numero ?? `#${s.id}` }} · {{ rotuloDoTipo(tipoDoServico(s)) }}</strong>
                    <StatusBadge :rotulo="STATUS_DO_SERVICO[s.status]?.rotulo ?? s.status" :tom="STATUS_DO_SERVICO[s.status]?.tom ?? 'neutro'" />
                </div>
                <span class="servico__meta">
                    Local: {{ nomeDoLocal(s) }}<template v-if="localDoServico(s)?.endereco"> · {{ localDoServico(s).endereco }}</template>
                    <template v-if="s.cliente?.nome || s.cliente_nome"> · {{ s.cliente?.nome ?? s.cliente_nome }}</template>
                </span>
                <span class="servico__meta">
                    <template v-if="s.pallets_previstos != null">{{ s.pallets_previstos }} pallets previstos · </template>
                    <template v-if="s.janela_inicio || s.janela_fim">janela {{ dataEHora(s.janela_inicio) }} – {{ dataEHora(s.janela_fim) }} · </template>
                    <template v-if="s.ordem != null">ordem {{ s.ordem }} · </template>
                    <template v-if="s.manifesto_id">
                        <RouterLink :to="{ name: 'manifesto-planejar', params: { manifesto: s.manifesto_id } }">manifesto {{ s.manifesto_numero ?? s.manifesto_id }}</RouterLink>
                    </template>
                    <template v-else>sem manifesto</template>
                </span>
                <span v-if="s.observacoes" class="servico__meta">{{ s.observacoes }}</span>
            </li>
        </ul>
    </section>
</template>

<style scoped src="@/styles/pages/operations/planning/planning_page.css"></style>
<style scoped src="@/styles/components/operations/planning/planning.css"></style>
