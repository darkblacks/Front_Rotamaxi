<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import BadgeDeStatus from '@/components/all/ui/StatusBadge.vue';
import EstadoVazio from '@/components/all/ui/EmptyState.vue';
import PainelCard from '@/components/all/ui/BaseCard.vue';
import { dataEHora } from '@/utils/format.js';
import { tomDoStatus, useDivergenciasStore } from '@/stores/divergences.store.js';

/**
 * Detalhe da divergência, com resolução (US-9.3, US-8.2).
 *
 * A tela mostra os **três números** — esperado, declarado e conferido — e a diferença que o
 * servidor gravou, e é daqui que o admin justifica o caso e o move para `justificada` ou
 * `resolvida`. Reabrir também sai daqui, e exige motivo como qualquer outra decisão.
 *
 * O histórico é só leitura: quem decidiu, quando e por quê aparece inteiro e não tem campo
 * de edição nenhum. Decidir de novo acrescenta uma linha; nada é reescrito — inclusive
 * `resolvido_por`, que o servidor carimba uma única vez.
 */
const route = useRoute();
const divergencias = useDivergenciasStore();

/**
 * Destinos que o admin pode dar ao caso. `aberta` é a reabertura de um caso encerrado.
 */
const DECISOES = [
    { slug: 'justificada', rotulo: 'Justificar' },
    { slug: 'resolvida', rotulo: 'Resolver' },
    { slug: 'aberta', rotulo: 'Reabrir' },
];

const status = ref('justificada');
const justificativa = ref('');

const divergencia = computed(() => divergencias.divergencia);
const numeros = computed(() => divergencias.numerosDoDetalhe);
const trilha = computed(() => divergencias.trilhaDoDetalhe);

const erros = computed(() => divergencias.falhaDaDecisao?.errors ?? {});

/**
 * Sem motivo não há decisão: o servidor exige a justificativa, e a tela evita a ida inútil.
 */
const podeDecidir = computed(() => justificativa.value.trim() !== '' && ! divergencias.decidindo);

async function decidir() {
    if (! podeDecidir.value) {
        return;
    }

    const registrada = await divergencias.decidir(
        route.params.divergencia,
        status.value,
        justificativa.value.trim(),
    );

    if (registrada) {
        justificativa.value = '';
    }
}

function carregar() {
    return divergencias.carregarDetalhe(route.params.divergencia);
}

onMounted(carregar);

watch(() => route.params.divergencia, carregar);
</script>

<template>
    <section class="pagina">
        <div class="pagina__cabecalho">
            <h1 class="pagina__titulo">Divergência</h1>
            <RouterLink class="pagina__volta" :to="{ name: 'divergencias' }">Voltar às divergências</RouterLink>
        </div>

        <div v-if="divergencias.falhaDoDetalhe" class="pagina__falha" role="alert">
            <span>{{ divergencias.falhaDoDetalhe.mensagem }}</span>
            <button type="button" class="pagina__botao" @click="carregar">Tentar de novo</button>
        </div>

        <EstadoVazio v-else-if="divergencias.carregandoDetalhe && divergencia === null" mensagem="Carregando a divergência…" tracejado />

        <template v-else-if="divergencia">
            <PainelCard :titulo="`MAN ${divergencia.manifesto?.numero ?? '—'}`">
                <template #acoes>
                    <BadgeDeStatus :rotulo="divergencia.tipo ?? '—'" tom="info" />
                    <BadgeDeStatus
                        :rotulo="divergencia.status ?? '—'"
                        :tom="tomDoStatus(divergencia.status)"
                    />
                </template>

                <dl class="numeros">
                    <div class="numeros__item">
                        <dt>esperado</dt>
                        <dd>{{ numeros.esperado }}</dd>
                    </div>
                    <div class="numeros__item">
                        <dt>declarado</dt>
                        <dd>{{ numeros.declarado }}</dd>
                    </div>
                    <div class="numeros__item">
                        <dt>conferido</dt>
                        <dd>{{ numeros.conferido }}</dd>
                    </div>
                    <div class="numeros__item numeros__item--diferenca">
                        <dt>diferença</dt>
                        <dd>{{ numeros.diferenca }}</dd>
                    </div>
                </dl>

                <dl class="contexto">
                    <div class="contexto__item">
                        <dt>Filial</dt>
                        <dd>{{ divergencia.manifesto?.filial_nome ?? '—' }}</dd>
                    </div>
                    <div class="contexto__item">
                        <dt>Motorista</dt>
                        <dd>{{ divergencia.manifesto?.motorista_nome ?? '—' }}</dd>
                    </div>
                    <div class="contexto__item">
                        <dt>Aberta em</dt>
                        <dd>{{ dataEHora(divergencia.criado_em) }}</dd>
                    </div>
                    <div class="contexto__item">
                        <dt>Origem</dt>
                        <dd>{{ divergencia.conferencia_portaria_id === null ? 'Registro manual' : 'Conferência da portaria' }}</dd>
                    </div>
                    <div class="contexto__item">
                        <dt>Justificativa atual</dt>
                        <dd>{{ divergencia.justificativa ?? '—' }}</dd>
                    </div>
                </dl>
            </PainelCard>

            <PainelCard titulo="Registrar decisão">
                <div v-if="divergencias.falhaDaDecisao" class="pagina__falha" role="alert">
                    {{ divergencias.falhaDaDecisao.mensagem }}
                </div>

                <div class="decisao">
                    <label class="decisao__campo">
                        <span class="decisao__rotulo">Destino</span>
                        <select v-model="status" class="decisao__controle" data-campo="status">
                            <option v-for="opcao in DECISOES" :key="opcao.slug" :value="opcao.slug">
                                {{ opcao.rotulo }}
                            </option>
                        </select>
                        <small v-if="erros.status" class="decisao__erro">{{ erros.status[0] }}</small>
                    </label>

                    <label class="decisao__campo decisao__campo--largo">
                        <span class="decisao__rotulo">Justificativa</span>
                        <textarea
                            v-model="justificativa"
                            class="decisao__controle decisao__controle--texto"
                            rows="3"
                            data-campo="justificativa"
                            placeholder="O que houve e o que foi combinado"
                        ></textarea>
                        <small v-if="erros.justificativa" class="decisao__erro">{{ erros.justificativa[0] }}</small>
                    </label>
                </div>

                <div class="decisao__acoes">
                    <span class="decisao__nota">
                        A decisão entra na trilha com autor e data; nenhuma decisão anterior é apagada.
                    </span>
                    <button
                        type="button"
                        class="pagina__botao pagina__botao--primario"
                        data-acao="decidir"
                        :disabled="! podeDecidir"
                        @click="decidir"
                    >
                        {{ divergencias.decidindo ? 'Registrando…' : 'Registrar decisão' }}
                    </button>
                </div>
            </PainelCard>

            <PainelCard titulo="Trilha de decisões">
                <EstadoVazio
                    v-if="trilha.length === 0"
                    mensagem="Nenhuma decisão registrada."
                    tracejado
                />
                <!-- A trilha é histórico: ela aparece inteira e não é editável por esta tela. -->
                <ol v-else class="trilha">
                    <li v-for="decisao in trilha" :key="decisao.id" class="trilha__item">
                        <BadgeDeStatus :rotulo="decisao.status" :tom="decisao.tom" />
                        <span class="trilha__texto">
                            <strong>{{ decisao.autor }}</strong>
                            <small>{{ dataEHora(decisao.decididoEm) }}</small>
                            <span>{{ decisao.justificativa }}</span>
                        </span>
                    </li>
                </ol>
            </PainelCard>
        </template>
    </section>
</template>

<style scoped src="@/styles/pages/operations/divergences/divergence_details_page.css"></style>
