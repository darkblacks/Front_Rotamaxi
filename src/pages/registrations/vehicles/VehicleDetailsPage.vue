<script setup>
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { ArrowLeft, CircleAlert, Pencil, RefreshCw } from 'lucide-vue-next';
import PainelCard from '@/components/all/ui/BaseCard.vue';
import EstadoVazio from '@/components/all/ui/EmptyState.vue';
import VeiculoDocumentos from '@/components/registrations/vehicles/details/VehicleDocuments.vue';
import VeiculoRefrigeracao from '@/components/registrations/vehicles/details/VehicleRefrigeration.vue';
import VeiculoValoracao from '@/components/registrations/vehicles/details/VehicleValuation.vue';
import { buscarCadastro, fotosVeiculo } from '@/services/api/registrations.api.js';
import { falhaFrota } from '@/services/api/fleet.api.js';
import { resumoFinanceiro } from '@/services/api/vehicle-extra.api.js';
import { rotuloPropriedade, notaPropriedade, reais, mascarar, rotuloPendencia, destinoVoltar, queryVoltar } from '@/domain/vehicles/fleet-model.js';
import { camposDaCategoria, depreciacaoLinhaReta, fotosPendentes, FOTO_POSICOES } from '@/domain/vehicles/registration.js';

const route = useRoute();
const router = useRouter();
const id = computed(() => route.params.id);

const veiculo = ref(null);
const frota = ref(null);
const fotos = ref({});
const carregando = ref(true);
const erro = ref('');
const resumoDocs = ref(null);
const resumoServidor = ref(null);

const abas = computed(() => [
    ['identificacao', 'Identificação'], ['propriedade', 'Propriedade e comercial'], ['fotos', 'Fotos'],
    ['documentos', 'Documentos'], ...(campos.value.refrigeracao ? [['refrigeracao', 'Refrigeração']] : []), ['fipe', 'FIPE e valoração'],
]);
const aba = computed(() => (abas.value.some(([k]) => k === route.query.aba) ? route.query.aba : 'identificacao'));
const irParaAba = (k) => router.replace({ query: { ...route.query, aba: k } });

const campos = computed(() => camposDaCategoria(veiculo.value?.categoria));
const propriedade = computed(() => frota.value?.propriedade ?? (veiculo.value?.vinculo === 'proprio' ? 'proprio' : veiculo.value?.vinculo || null));
const fotosUrl = (pos) => { const v = fotos.value?.[pos]; return typeof v === 'string' ? v : v?.url; };
const semFoto = computed(() => fotosPendentes(fotos.value));
const deprec = computed(() => (veiculo.value ? depreciacaoLinhaReta({ ...veiculo.value, vinculo: propriedade.value === 'proprio' ? 'proprio' : '' }) : null));

async function carregar() {
    carregando.value = true;
    erro.value = '';
    try {
        veiculo.value = await buscarCadastro('veiculos', id.value);
    } catch (e) {
        veiculo.value = null;
        erro.value = falhaFrota(e, 'o cadastro do veículo');
        carregando.value = false;
        return;
    }
    const [fo, rs] = await Promise.allSettled([fotosVeiculo(id.value), resumoFinanceiro(id.value)]);
    fotos.value = fo.status === 'fulfilled' ? fo.value : {};
    resumoServidor.value = rs.status === 'fulfilled' ? rs.value : null; // 404 = ainda não disponível: usa só o espelho local
    carregando.value = false;
}
watch(id, carregar, { immediate: true });

function voltar() {
    router.push(destinoVoltar(route.query, { name: 'cadastros-item', params: { tipo: 'veiculos' }, query: { aba: 'placas' } }));
}
const dataBr = (d) => (d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : '—');
const v = (x) => (x === undefined || x === null || x === '' ? '—' : x);
const moeda = (x) => (x != null && x !== '' ? reais(x) : '—');
</script>

<template>
    <div class="vd">
        <button type="button" class="vd__voltar" @click="voltar"><ArrowLeft :size="16" /> Voltar à frota</button>

        <div v-if="carregando" class="vd__msg" aria-busy="true">Carregando veículo…</div>
        <div v-else-if="erro" class="vd__erro" role="alert"><CircleAlert :size="18" /> {{ erro }} <button type="button" class="vd__botao" @click="carregar"><RefreshCw :size="14" /> Tentar novamente</button></div>
        <template v-else-if="veiculo">
            <header class="vd__topo">
                <div>
                    <h1>{{ veiculo.placa }}</h1>
                    <p>{{ [veiculo.marca_nome, veiculo.modelo_nome].filter(Boolean).join(' ') || 'Sem modelo informado' }} · {{ rotuloPropriedade(propriedade) }} · {{ campos.reboque ? 'Reboque' : 'Motorizado' }}</p>
                </div>
                <RouterLink class="vd__botao" :to="{ name: 'veiculo-editar', params: { id }, query: queryVoltar(route.fullPath) }"><Pencil :size="15" /> Editar cadastro</RouterLink>
            </header>

            <p v-if="semFoto.length" class="vd__pend" role="status">Fotos pendentes: {{ semFoto.map((f) => f.nome).join(', ') }}. Não impede o uso do veículo.</p>
            <p v-if="resumoDocs && (resumoDocs.vencidos || resumoDocs.a_vencer)" class="vd__pend vd__pend--bad" role="status">Documentos: {{ resumoDocs.vencidos }} vencido(s), {{ resumoDocs.a_vencer }} vencendo em até 30 dias.</p>

            <div class="vd__abas" role="tablist" aria-label="Seções do veículo">
                <button v-for="[k, nome] in abas" :id="`aba-${k}`" :key="k" type="button" role="tab" class="vd__aba" :class="{ 'vd__aba--ativa': aba === k }" :aria-selected="aba === k" :aria-controls="`painel-${k}`" @click="irParaAba(k)">{{ nome }}</button>
            </div>

            <PainelCard v-if="aba === 'identificacao'" id="painel-identificacao" titulo="Identificação e especificações">
                <dl class="vd__dl" role="tabpanel" aria-labelledby="aba-identificacao">
                    <dt>Placa</dt><dd>{{ veiculo.placa }}</dd>
                    <dt>Categoria</dt><dd>{{ campos.reboque ? 'Reboque / semirreboque' : 'Motorizado' }}</dd>
                    <dt>Renavam</dt><dd>{{ mascarar(veiculo.renavam) }} <button type="button" class="vd__botao vd__botao--mini" disabled title="Revelação auditada ainda não disponível no servidor">Revelar</button></dd>
                    <dt>Chassi</dt><dd>{{ mascarar(veiculo.chassi) }}</dd>
                    <dt>Marca / modelo</dt><dd>{{ v([veiculo.marca_nome, veiculo.modelo_nome].filter(Boolean).join(' ')) }}</dd>
                    <dt>Ano modelo / fabricação</dt><dd>{{ v(veiculo.ano_modelo) }} / {{ v(veiculo.ano_fabricacao) }}</dd>
                    <dt>Tipo operacional</dt><dd>{{ v(veiculo.tipo_operacional) }}</dd>
                    <template v-if="campos.combustivel"><dt>Combustível</dt><dd>{{ v(veiculo.combustivel) }}</dd></template>
                    <template v-if="campos.carroceria"><dt>Tipo de carroceria</dt><dd>{{ v(veiculo.tipo_carroceria) }}</dd></template>
                    <template v-if="campos.eixos"><dt>Eixos</dt><dd>{{ v(veiculo.eixos) }}</dd></template>
                    <dt>Cor</dt><dd>{{ v(veiculo.cor) }}</dd>
                    <dt>Nº de frota</dt><dd>{{ v(veiculo.numero_frota) }}</dd>
                    <dt>PBT / tara (kg)</dt><dd>{{ v(veiculo.pbt_kg) }} / {{ v(veiculo.tara_kg) }}</dd>
                    <dt>Situação</dt><dd>{{ veiculo.is_active === false ? 'Inativo' : 'Ativo' }}</dd>
                </dl>
                <p v-if="frota?.pendencias?.length" class="vd__nota">Pendências: {{ frota.pendencias.map(rotuloPendencia).join(', ') }}.</p>
                <small class="vd__nota">Alterar placa e revelar identificadores exigem endpoints de auditoria ainda não disponíveis; use “Editar cadastro” para os demais campos.</small>
            </PainelCard>

            <PainelCard v-else-if="aba === 'propriedade'" id="painel-propriedade" titulo="Propriedade e comercial">
                <dl class="vd__dl" role="tabpanel" aria-labelledby="aba-propriedade">
                    <dt>Propriedade</dt><dd>{{ rotuloPropriedade(propriedade) }} <small class="vd__nota">{{ notaPropriedade(propriedade) }}</small></dd>
                    <dt>Transportadora</dt><dd>{{ frota?.prestador_nome || (propriedade === 'proprio' ? '—' : 'Transportadora não vinculada') }}</dd>
                    <template v-if="propriedade === 'proprio'">
                        <dt>Data de compra</dt><dd>{{ dataBr(veiculo.data_compra) }}</dd>
                        <dt>Valor de compra (custo)</dt><dd>{{ moeda(veiculo.valor_compra) }}</dd>
                        <dt>Taxa de depreciação a.a.</dt><dd>{{ veiculo.taxa_depreciacao_anual != null && veiculo.taxa_depreciacao_anual !== '' ? `${veiculo.taxa_depreciacao_anual}%` : 'pendente' }}</dd>
                        <dt>Data / valor de venda</dt><dd>{{ dataBr(veiculo.data_venda) }} / {{ moeda(veiculo.valor_venda) }}</dd>
                    </template>
                </dl>
                <div v-if="propriedade === 'proprio'" class="vd__contabil">
                    <strong>Valor contábil gerencial (linha reta) <small>· não é FIPE nem avaliação manual</small></strong>
                    <span v-if="deprec?.estado === 'calculado'">{{ reais(deprec.valor_contabil) }} <small class="vd__nota">após {{ deprec.dias }} dias{{ deprec.parouNaVenda ? ' (até a data de venda)' : '' }} · estimativa local</small></span>
                    <span v-else class="vd__nota">Pendente: {{ deprec?.motivo }}</span>
                    <small v-if="resumoServidor?.depreciacao?.estado === 'calculado'" class="vd__nota">Servidor: {{ reais(resumoServidor.depreciacao.valor_contabil) }}</small>
                </div>
                <p v-else class="vd__nota">Sem aquisição/depreciação: {{ rotuloPropriedade(propriedade) }} não é patrimônio da empresa.</p>
            </PainelCard>

            <PainelCard v-else-if="aba === 'fotos'" id="painel-fotos" titulo="Fotos">
                <div class="vd__fotos" role="tabpanel" aria-labelledby="aba-fotos">
                    <figure v-for="[pos, nome] in FOTO_POSICOES" :key="pos">
                        <img v-if="fotosUrl(pos)" :src="fotosUrl(pos)" :alt="`Foto ${nome.toLowerCase()} do veículo ${veiculo.placa}`" loading="lazy" />
                        <div v-else class="vd__sem-foto">Pendente</div>
                        <figcaption>{{ nome }}</figcaption>
                    </figure>
                </div>
                <EstadoVazio v-if="semFoto.length === 4" mensagem="Nenhuma foto cadastrada. Use Editar cadastro para enviar." tracejado />
            </PainelCard>

            <PainelCard v-else-if="aba === 'documentos'" id="painel-documentos" titulo="Documentos">
                <VeiculoDocumentos :veiculo-id="id" @resumo="resumoDocs = $event" />
            </PainelCard>

            <PainelCard v-else-if="aba === 'refrigeracao'" id="painel-refrigeracao" titulo="Refrigeração">
                <VeiculoRefrigeracao :veiculo-id="id" />
            </PainelCard>

            <PainelCard v-else id="painel-fipe" titulo="FIPE e valoração">
                <VeiculoValoracao :veiculo-id="id" :veiculo="veiculo" @frota="frota = $event" />
            </PainelCard>
        </template>
    </div>
</template>

<style scoped src="@/styles/pages/registrations/vehicles/vehicle_details_page.css"></style>
