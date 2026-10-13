<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { X } from 'lucide-vue-next';
import { recomendarModelosEsl } from '@/domain/vehicles/esl/smart-models.js';
import { camposPendentes, melhorCandidatoPrestador, rotuloProgresso } from '@/domain/vehicles/esl/review-queue.js';

/**
 * Revisão placa a placa da importação ESL. Só mostra, para decidir, o que ainda está
 * pendente; o restante é leitura. Não grava nada: emite a decisão e a página aplica
 * exatamente o fluxo inline existente (simulação apenas).
 */
const props = defineProps({
    row: { type: Object, required: true },
    item: { type: Object, default: () => ({}) },
    indice: { type: Number, default: 0 },
    total: { type: Number, default: 1 },
    marcas: { type: Array, default: () => [] },
    modelosPorMarca: { type: Object, default: () => ({}) },
    ocupado: { type: Boolean, default: false },
});
const emit = defineEmits(['ok', 'ignorar', 'fechar', 'carregar-modelos']);

const caixa = ref(null);
const botaoOk = ref(null);
const marcaId = ref('');
const modeloId = ref('');
const prestadorId = ref('');
let anterior = null;

const pend = computed(() => camposPendentes(props.row, props.item));
const marcaEfetiva = computed(() => Number(marcaId.value || props.item.marca_id || props.row.marca_id) || null);
const listaModelos = computed(() => props.modelosPorMarca[marcaEfetiva.value] || props.row.sugestoes || []);
const ranking = computed(() => recomendarModelosEsl(props.item.modelo_nome || props.row.modelo_nome, listaModelos.value));
// Pré-seleciona SEMPRE o candidato mais bem ranqueado (o usuário confirma com OK ou troca):
// pré-seleção de alta confiança > melhor dos "mais prováveis" > melhor com alguma correspondência (pontuação > 0).
const melhorCandidato = computed(() => {
    const r = ranking.value;
    if (r.preSelecionado) return r.preSelecionado;
    if (r.principais.length) return r.principais[0];
    return [...r.demais].filter(m => (m.pontuacao ?? 0) > 0).sort((x, y) => y.pontuacao - x.pontuacao)[0] || null;
});
const candidatos = computed(() => props.row.prestador_ambiguos || []);

const resumo = computed(() => {
    const i = props.item, r = props.row;
    const proprietario = i.agregado_esl_nome || i.proprietario_esl_nome || r.prestador_nome_origem;
    const itens = [
        ['Placa', r.placa],
        ['Fabricante (ESL)', i.marca_nome || r.marca_nome],
        ['Modelo (ESL)', i.modelo_nome || r.modelo_nome],
        ['Ano', [i.ano_fabricacao, i.ano_modelo].filter(Boolean).join(' / ')],
        ['Vínculo', i.tipo_proprietario_esl],
        ['Proprietário / agregado', proprietario],
        ['Tipo', i.tipo_veiculo_esl],
        ['Chassi', i.chassi],
        ['Renavam', i.renavam],
    ];
    return itens.filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '');
});

function iniciar() {
    marcaId.value = '';
    modeloId.value = '';
    prestadorId.value = '';
    const melhor = melhorCandidatoPrestador(props.row);
    if (pend.value.prestador && melhor) prestadorId.value = String(melhor.id);
    prepararModelo();
}
function prepararModelo() {
    if (!pend.value.modelo) return;
    const m = marcaEfetiva.value;
    if (m && !props.modelosPorMarca[m]) emit('carregar-modelos', m);
    const sug = melhorCandidato.value;
    modeloId.value = sug ? String(sug.id) : '';
}
watch(() => props.row.linha, async () => {
    iniciar();
    await nextTick();
    focoInicial();
});
// Modelos chegam depois (carregamento assíncrono): preenche a sugestão se ainda vazio.
watch(() => melhorCandidato.value?.id, id => {
    if (pend.value.modelo && !modeloId.value && id) modeloId.value = String(id);
});
function aoTrocarMarca() {
    modeloId.value = '';
    prepararModelo();
}

const valido = computed(() => (!pend.value.marca || Boolean(marcaId.value))
    && (!pend.value.modelo || Boolean(modeloId.value)));

function focoInicial() {
    (botaoOk.value && !botaoOk.value.disabled ? botaoOk.value : caixa.value)?.focus();
}
function confirmar() {
    if (!valido.value || props.ocupado) return;
    emit('ok', {
        marcaId: pend.value.marca ? Number(marcaId.value) : null,
        modeloId: pend.value.modelo ? Number(modeloId.value) : null,
        prestadorId: pend.value.prestador ? (prestadorId.value === '' ? null : Number(prestadorId.value)) : undefined,
    });
}
function aoTeclar(e) {
    if (e.key === 'Escape') { e.preventDefault(); emit('fechar'); return; }
    if (e.key !== 'Tab') return;
    const foco = [...caixa.value.querySelectorAll('button:not([disabled]),select:not([disabled]),[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])')];
    if (!foco.length) { e.preventDefault(); return; }
    const primeiro = foco[0], ultimo = foco[foco.length - 1];
    if (e.shiftKey && (document.activeElement === primeiro || document.activeElement === caixa.value)) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
}

onMounted(async () => {
    anterior = document.activeElement;
    iniciar();
    await nextTick();
    focoInicial();
});
onBeforeUnmount(() => anterior?.focus?.());
</script>

<template>
    <div class="erm" @keydown="aoTeclar">
        <div ref="caixa" class="erm__caixa" role="dialog" aria-modal="true" aria-labelledby="erm-titulo" tabindex="-1">
            <div class="erm__cabecalho">
                <div>
                    <h2 id="erm-titulo" class="erm__titulo">Revisar placa {{ row.placa }}</h2>
                    <small class="erm__progresso">{{ rotuloProgresso(indice, total) }}</small>
                </div>
                <button type="button" class="erm__x" aria-label="Fechar sem alterar" @click="emit('fechar')"><X :size="17" /></button>
            </div>

            <dl class="erm__resumo" aria-label="Dados já confirmados do ESL">
                <div v-for="[rotulo, valor] in resumo" :key="rotulo">
                    <dt>{{ rotulo }}</dt>
                    <dd>{{ valor }}</dd>
                </div>
            </dl>

            <div class="erm__revisao">
                <label v-if="pend.marca" class="erm__campo">
                    <span class="erm__rotulo">Fabricante cadastrado</span>
                    <select v-model="marcaId" class="erm__controle" @change="aoTrocarMarca">
                        <option value="">Escolha o fabricante</option>
                        <option v-for="m in marcas" :key="m.id" :value="String(m.id)">{{ m.nome }}</option>
                    </select>
                </label>

                <label v-if="pend.modelo" class="erm__campo">
                    <span class="erm__rotulo">Modelo cadastrado equivalente a "{{ item.modelo_nome || row.modelo_nome }}"</span>
                    <select v-model="modeloId" class="erm__controle" :disabled="!marcaEfetiva">
                        <option value="">Selecione o modelo do catálogo</option>
                        <optgroup v-if="ranking.principais.length" label="Mais prováveis">
                            <option v-for="m in ranking.principais" :key="'p' + m.id" :value="String(m.id)">{{ m.nome }}</option>
                        </optgroup>
                        <optgroup v-if="ranking.demais.length" label="Demais modelos da marca">
                            <option v-for="m in ranking.demais" :key="'d' + m.id" :value="String(m.id)">{{ m.nome }}</option>
                        </optgroup>
                    </select>
                </label>

                <label v-if="pend.prestador" class="erm__campo">
                    <span class="erm__rotulo">Terceiro de transporte para "{{ row.prestador_nome_origem }}"</span>
                    <select v-model="prestadorId" class="erm__controle">
                        <option value="">Não vincular</option>
                        <option v-for="p in candidatos" :key="p.id" :value="String(p.id)">{{ p.nome }}</option>
                    </select>
                </label>
            </div>

            <div class="erm__acoes">
                <button type="button" class="erm__botao" :disabled="ocupado" @click="emit('ignorar')">Ignorar</button>
                <button ref="botaoOk" type="button" class="erm__botao erm__botao--primario" :disabled="!valido || ocupado" @click="confirmar">
                    {{ ocupado ? 'Conferindo…' : 'OK' }}
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped src="@/styles/components/registrations/vehicles/esl/esl_review_modal.css"></style>
