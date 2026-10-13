<script setup>
import { ref } from 'vue';
import { RefreshCw } from 'lucide-vue-next';
import { falhaCadastro } from '@/services/api/registrations.api.js';
import { listFipeBrands, listFipeModels, resolveFipeYears, getFipeQuote } from '@/services/api/fipe.api.js';
import { CATEGORIAS_FIPE, valorFipeExibivel } from '@/domain/vehicles/fleet-model.js';

/**
 * Cinco selects encadeados (categoria > marca > modelo > ano/combustível > mês) sobre os
 * endpoints catalogo-local/*. A categoria NUNCA é escolhida em silêncio. O mês é sempre o
 * mais recente do provedor: a API não permite escolher outro.
 */
const emit = defineEmits(['resultado']);

const tipo = ref('');
const marcaId = ref('');
const modeloId = ref('');
const anoCodigo = ref('');
const marcas = ref([]);
const modelos = ref([]);
const anos = ref([]);
const cotacao = ref(null);
const consultadoEm = ref('');
const carga = ref({ marcas: false, modelos: false, anos: false, cotacao: false });
const erro = ref({ marcas: '', modelos: '', anos: '', cotacao: '' });
let seq = { marcas: 0, modelos: 0, anos: 0, cotacao: 0 };

function limparAbaixo(nivel) {
    const ordem = ['marcas', 'modelos', 'anos', 'cotacao'];
    ordem.slice(ordem.indexOf(nivel)).forEach((n) => { seq[n]++; erro.value[n] = ''; carga.value[n] = false; });
    if (nivel === 'marcas') { marcaId.value = ''; marcas.value = []; }
    if (['marcas', 'modelos'].includes(nivel)) { modeloId.value = ''; modelos.value = []; }
    if (['marcas', 'modelos', 'anos'].includes(nivel)) { anoCodigo.value = ''; anos.value = []; }
    cotacao.value = null;
    consultadoEm.value = '';
    emit('resultado', null);
}

async function executar(nivel, fn) {
    const minha = ++seq[nivel];
    carga.value[nivel] = true;
    erro.value[nivel] = '';
    try {
        const r = await fn();
        return minha === seq[nivel] ? r : undefined;
    } catch (e) {
        if (minha === seq[nivel]) erro.value[nivel] = falhaCadastro(e);
    } finally {
        if (minha === seq[nivel]) carga.value[nivel] = false;
    }
    return undefined;
}

async function carregarMarcas() {
    const r = await executar('marcas', () => listFipeBrands());
    if (r) marcas.value = r;
}
async function aoTipo() { limparAbaixo('marcas'); if (tipo.value) await carregarMarcas(); }
async function carregarModelos() {
    const r = await executar('modelos', () => listFipeModels(Number(marcaId.value)));
    if (r) modelos.value = r;
}
async function aoMarca() { limparAbaixo('modelos'); if (marcaId.value) await carregarModelos(); }
async function carregarAnos() {
    const marca = marcas.value.find((item) => Number(item.id) === Number(marcaId.value)) ?? null;
    const modelo = modelos.value.find((item) => Number(item.id) === Number(modeloId.value)) ?? null;
    const r = await executar('anos', () => resolveFipeYears({
        preferredType: tipo.value, brandId: Number(marcaId.value), modelId: Number(modeloId.value), brand: marca, model: modelo,
    }));
    if (r) {
        anos.value = r.years;
        // Se o catálogo local estava classificado em outra categoria, usa a categoria que realmente retornou FIPE.
        if (r.years.length && r.type && r.type !== tipo.value) tipo.value = r.type;
    }
}
async function aoModelo() { limparAbaixo('anos'); if (modeloId.value) await carregarAnos(); }
async function consultar() {
    if (!anoCodigo.value) return;
    const r = await executar('cotacao', () => getFipeQuote(tipo.value, Number(marcaId.value), Number(modeloId.value), anoCodigo.value));
    if (!r) return;
    // G09: sem preço e mês de referência válidos, nada é exibido como valor.
    if (!valorFipeExibivel(r)) { erro.value.cotacao = 'Valor não disponível: o provedor não retornou preço com mês de referência.'; return; }
    cotacao.value = r;
    consultadoEm.value = new Date().toLocaleString('pt-BR');
    emit('resultado', { tipo: tipo.value, marcaId: Number(marcaId.value), modeloId: Number(modeloId.value), anoCodigo: anoCodigo.value, cotacao: r, consultadoEm: consultadoEm.value });
}
async function aoAno() { cotacao.value = null; emit('resultado', null); erro.value.cotacao = ''; if (anoCodigo.value) await consultar(); }

defineExpose({ cotacao, consultadoEm });
</script>

<template>
    <div class="cf" aria-live="polite">
        <div class="cf__linha">
            <label class="cf__campo">Categoria
                <select v-model="tipo" @change="aoTipo">
                    <option value="">Selecione a categoria</option>
                    <option v-for="(rotulo, chave) in CATEGORIAS_FIPE" :key="chave" :value="chave">{{ rotulo }}</option>
                </select>
            </label>
            <label class="cf__campo">Marca
                <select v-model="marcaId" :disabled="!tipo || carga.marcas" @change="aoMarca">
                    <option value="">{{ carga.marcas ? 'Carregando…' : 'Selecione a marca' }}</option>
                    <option v-for="m in marcas" :key="m.id" :value="m.id">{{ m.nome }}</option>
                </select>
                <small v-if="erro.marcas" class="cf__erro">{{ erro.marcas }} <button type="button" class="cf__link" @click="carregarMarcas"><RefreshCw :size="12" /> Tentar novamente</button></small>
                <small v-else-if="tipo && !carga.marcas && !marcas.length" class="cf__ajuda">Nenhuma marca encontrada.</small>
            </label>
            <label class="cf__campo">Modelo / versão
                <select v-model="modeloId" :disabled="!marcaId || carga.modelos" @change="aoModelo">
                    <option value="">{{ carga.modelos ? 'Carregando…' : 'Selecione o modelo' }}</option>
                    <option v-for="m in modelos" :key="m.id" :value="m.id">{{ m.nome }}</option>
                </select>
                <small v-if="erro.modelos" class="cf__erro">{{ erro.modelos }} <button type="button" class="cf__link" @click="carregarModelos"><RefreshCw :size="12" /> Tentar novamente</button></small>
                <small v-else-if="marcaId && !carga.modelos && !modelos.length" class="cf__ajuda">Nenhum modelo encontrado.</small>
            </label>
            <label class="cf__campo">Ano / combustível
                <select v-model="anoCodigo" :disabled="!modeloId || carga.anos" @change="aoAno">
                    <option value="">{{ carga.anos ? 'Consultando FIPE…' : 'Selecione o ano' }}</option>
                    <option v-for="a in anos" :key="a.codigo" :value="a.codigo">{{ a.nome }}</option>
                </select>
                <small v-if="erro.anos" class="cf__erro">{{ erro.anos }} <button type="button" class="cf__link" @click="carregarAnos"><RefreshCw :size="12" /> Tentar novamente</button></small>
                <small v-else-if="modeloId && !carga.anos && !anos.length" class="cf__ajuda">Nenhum ano FIPE encontrado para este modelo.</small>
            </label>
            <label class="cf__campo">Mês de referência
                <select disabled><option>Mais recente (definido pelo provedor)</option></select>
            </label>
        </div>
        <p v-if="carga.cotacao" class="cf__ajuda">Consultando cotação…</p>
        <p v-if="erro.cotacao" class="cf__erro" role="alert">{{ erro.cotacao }} <button type="button" class="cf__link" @click="consultar"><RefreshCw :size="12" /> Tentar novamente</button></p>
        <dl v-if="cotacao" class="cf__resultado">
            <dt>Valor FIPE</dt><dd><strong>{{ Number(cotacao.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }}</strong></dd>
            <dt>Código FIPE</dt><dd>{{ cotacao.codigo_fipe || '—' }}</dd>
            <dt>Marca / modelo</dt><dd>{{ cotacao.marca }} {{ cotacao.modelo }}</dd>
            <dt>Ano / combustível</dt><dd>{{ cotacao.ano_modelo ?? '—' }} · {{ cotacao.combustivel || '—' }}</dd>
            <dt>Mês de referência</dt><dd>{{ cotacao.mes_referencia }}</dd>
            <dt>Consultado em</dt><dd>{{ consultadoEm }}</dd>
            <dt>Fonte</dt><dd>{{ cotacao.fonte || 'FIPE' }}</dd>
        </dl>
    </div>
</template>

<style scoped src="@/styles/components/registrations/vehicles/fipe/fipe_chain.css"></style>
