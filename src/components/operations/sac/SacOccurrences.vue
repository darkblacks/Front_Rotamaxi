<script setup>
import { computed, onMounted, ref } from 'vue';
import BaseCard from '@/components/all/ui/BaseCard.vue';
import BaseTable from '@/components/all/tables/BaseTable.vue';
import EmptyState from '@/components/all/ui/EmptyState.vue';
import IndicadorTempoReal from '@/components/all/status/RealtimeIndicator.vue';
import StatusBadge from '@/components/all/ui/StatusBadge.vue';
import { useOperationalRealtime } from '@/composables/useOperationalRealtime.js';
import { permissoesDeAcao } from '@/domain/access/actions.js';
import { formatarAtraso } from '@/domain/map/delay.js';
import { ACOES_DE_TRATATIVA, SEVERIDADES, TIPOS_REPORTAVEIS, severidadeDe } from '@/domain/operations/occurrences.js';
import { useAuthStore } from '@/stores/auth.store.js';
import { useOcorrenciasMapaStore } from '@/stores/map-occurrences.store.js';
import { dataEHora } from '@/utils/format.js';

/**
 * Ocorrências do mapa (SAQ) para o SAC: lista com vínculos (manifesto, serviço, etapa,
 * veículo, motorista, horário), filtros e tratativa (assumir, encaminhar, comentar,
 * resolver). Atualiza sozinha pelo canal `private-ocorrencias`.
 */
const ocorrencias = useOcorrenciasMapaStore();
const auth = useAuthStore();
const pode = computed(() => permissoesDeAcao(auth.papeis).tratarOcorrencia);

const COLUNAS = [
    { chave: 'tipo', rotulo: 'Tipo' },
    { chave: 'severidade', rotulo: 'Gravidade', largura: '100px' },
    { chave: 'manifesto', rotulo: 'Manifesto', largura: '110px' },
    { chave: 'servico', rotulo: 'Serviço' },
    { chave: 'etapa', rotulo: 'Etapa' },
    { chave: 'veiculo', rotulo: 'Veículo · Motorista' },
    { chave: 'quando', rotulo: 'Horário', largura: '120px' },
    { chave: 'status', rotulo: 'Situação', largura: '100px' },
];

const acao = ref('assumir');
const texto = ref('');
const destino = ref('');

const regra = computed(() => ACOES_DE_TRATATIVA.find((a) => a.chave === acao.value));
const selecionada = computed(() => ocorrencias.selecionada);

useOperationalRealtime({
    alvo: () => ({ ocorrencias: true, filialIds: [auth.filialDoUsuario] }),
    recarregar: () => ocorrencias.carregar(),
    eventos: ['manifest.occurrence.created', 'manifest.occurrence.updated'],
    aoEvento: (_nome, payload) => { ocorrencias.aplicarEvento(payload); },
});

function filtrar(parcial) {
    ocorrencias.definirFiltros(parcial);
    ocorrencias.carregar();
}

async function tratar() {
    if (await ocorrencias.tratar(acao.value, texto.value, destino.value)) {
        texto.value = '';
        destino.value = '';
    }
}

onMounted(() => ocorrencias.carregar());
</script>

<template>
    <div class="sac">
        <div class="sac__filtros">
            <select class="campo__entrada" aria-label="Situação" :value="ocorrencias.filtros.status" @change="filtrar({ status: $event.target.value })">
                <option value="">Todas</option>
                <option value="aberta">Abertas</option>
                <option value="resolvida">Resolvidas</option>
            </select>
            <select class="campo__entrada" aria-label="Tipo" :value="ocorrencias.filtros.tipo" @change="filtrar({ tipo: $event.target.value })">
                <option value="">Todos os tipos</option>
                <option v-for="t in TIPOS_REPORTAVEIS" :key="t.chave" :value="t.chave">{{ t.rotulo }}</option>
            </select>
            <select class="campo__entrada" aria-label="Gravidade" :value="ocorrencias.filtros.severidade" @change="filtrar({ severidade: $event.target.value })">
                <option value="">Qualquer gravidade</option>
                <option v-for="s in SEVERIDADES" :key="s.chave" :value="s.chave">{{ s.rotulo }}</option>
            </select>
            <input class="campo__entrada" type="date" aria-label="De" :value="ocorrencias.filtros.de" @change="filtrar({ de: $event.target.value })" />
            <input class="campo__entrada" type="date" aria-label="Até" :value="ocorrencias.filtros.ate" @change="filtrar({ ate: $event.target.value })" />
            <span class="sac__tempo-real"><IndicadorTempoReal /></span>
        </div>

        <div v-if="ocorrencias.falha" class="aviso aviso--erro" role="alert">
            {{ ocorrencias.falha.mensagem }}
            <button type="button" class="botao botao--pequeno" @click="ocorrencias.carregar()">Tentar de novo</button>
        </div>
        <EmptyState v-else-if="ocorrencias.carregando" mensagem="Carregando as ocorrências do mapa…" tracejado />
        <EmptyState v-else-if="ocorrencias.itens.length === 0" mensagem="Nenhuma ocorrência neste filtro." tracejado />

        <BaseTable v-else :colunas="COLUNAS" :largura-minima="880">
            <tr
                v-for="o in ocorrencias.itens"
                :key="o.id"
                class="sac__linha"
                :class="{ 'sac__linha--ativa': o.id === ocorrencias.selecionadaId }"
                :data-ocorrencia="o.id"
                tabindex="0"
                @click="ocorrencias.selecionar(o.id)"
                @keydown.enter="ocorrencias.selecionar(o.id)"
            >
                <td><strong>{{ o.tipoRotulo }}</strong><small v-if="o.atrasoMinutos" class="sac__sub">atraso {{ formatarAtraso(o.atrasoMinutos) }}</small></td>
                <td><StatusBadge :rotulo="severidadeDe(o.severidade).rotulo" :tom="severidadeDe(o.severidade).tom" /></td>
                <td>
                    <RouterLink v-if="o.manifestoId && auth.ehAdmin" :to="{ name: 'manifesto', params: { manifesto: o.manifestoId } }" @click.stop>{{ o.manifesto }}</RouterLink>
                    <span v-else>{{ o.manifesto }}</span>
                </td>
                <td>{{ o.servico }}</td>
                <td>{{ o.etapa }}</td>
                <td>{{ o.veiculo }}<small class="sac__sub">{{ o.motorista }}</small></td>
                <td>{{ dataEHora(o.criadaEm) }}</td>
                <td><StatusBadge :rotulo="o.status === 'resolvida' ? 'Resolvida' : 'Aberta'" :tom="o.status === 'resolvida' ? 'ok' : 'warn'" /></td>
            </tr>
        </BaseTable>

        <BaseCard v-if="selecionada" :titulo="`${selecionada.tipoRotulo} · MAN ${selecionada.manifesto}`">
            <template #acoes>
                <button type="button" class="botao botao--pequeno" @click="ocorrencias.selecionar(null)">Fechar</button>
            </template>
            <div class="bloco">
                <p v-if="selecionada.descricao" class="sac__descricao">{{ selecionada.descricao }}</p>
                <dl class="detalhe">
                    <div><dt>Serviço</dt><dd>{{ selecionada.servico }}</dd></div>
                    <div><dt>Etapa</dt><dd>{{ selecionada.etapa }}</dd></div>
                    <div><dt>Veículo</dt><dd>{{ selecionada.veiculo }}</dd></div>
                    <div><dt>Motorista</dt><dd>{{ selecionada.motorista }}</dd></div>
                    <div><dt>Horário</dt><dd>{{ dataEHora(selecionada.criadaEm) }}</dd></div>
                    <div v-if="selecionada.responsavel"><dt>Responsável</dt><dd>{{ selecionada.responsavel }}</dd></div>
                </dl>

                <ul v-if="selecionada.tratativas.length" class="sac__historico">
                    <li v-for="(t, i) in selecionada.tratativas" :key="t.id ?? i">
                        <strong>{{ t.acao }}</strong>
                        <span v-if="t.texto"> — {{ t.texto }}</span>
                        <small class="sac__sub">{{ t.user?.nome ?? t.usuario ?? '' }} {{ t.created_at ? dataEHora(t.created_at) : '' }}</small>
                    </li>
                </ul>

                <form v-if="pode && selecionada.status !== 'resolvida'" class="form" @submit.prevent="tratar">
                    <div class="form__grade">
                        <div class="campo">
                            <label class="campo__rotulo" for="sac-acao">Ação</label>
                            <select id="sac-acao" v-model="acao" class="campo__entrada" :disabled="ocorrencias.tratando">
                                <option v-for="a in ACOES_DE_TRATATIVA" :key="a.chave" :value="a.chave">{{ a.rotulo }}</option>
                            </select>
                        </div>
                        <div v-if="regra?.exigeDestino" class="campo">
                            <label class="campo__rotulo" for="sac-destino">Encaminhar para</label>
                            <input id="sac-destino" v-model="destino" class="campo__entrada" type="text" :disabled="ocorrencias.tratando" />
                        </div>
                    </div>
                    <div class="campo">
                        <label class="campo__rotulo" for="sac-texto">Texto{{ regra?.exigeTexto ? '' : ' (opcional)' }}</label>
                        <textarea id="sac-texto" v-model="texto" class="campo__entrada" :disabled="ocorrencias.tratando"></textarea>
                    </div>
                    <p v-if="ocorrencias.erroDaAcao" class="aviso aviso--erro" role="alert">{{ ocorrencias.erroDaAcao.mensagem }}</p>
                    <p v-if="ocorrencias.aviso" class="aviso aviso--ok" role="status">{{ ocorrencias.aviso }}</p>
                    <button type="submit" class="botao botao--primario" :disabled="ocorrencias.tratando">{{ regra?.rotulo }}</button>
                </form>
                <p v-else-if="!pode" class="aviso aviso--info">Somente leitura: seu perfil não trata ocorrências.</p>
            </div>
        </BaseCard>
    </div>
</template>

<style scoped src="@/styles/components/operations/shared/operation_form.css"></style>
<style scoped src="@/styles/pages/operations/operation_page.css"></style>
<style scoped src="@/styles/components/operations/sac/sac_occurrences.css"></style>
