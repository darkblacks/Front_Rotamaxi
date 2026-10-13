<script setup>
// DEV-ONLY: fixtures sintéticas, sem API. Não usar dados reais.
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import EslRevisaoModal from '@/components/registrations/vehicles/esl/EslReviewModal.vue';
import { montarFila, precisaRevisao, proximoIndice } from '@/domain/vehicles/esl/review-queue.js';

const estado = useRoute().query.estado || 'modelo';
const marcas = [{ id: 1, nome: 'Fiat' }, { id: 2, nome: 'Volkswagen' }];
const modelosPorMarca = ref({ 1: [{ id: 11, nome: 'Fiorino Furgão' }, { id: 12, nome: 'Strada' }, { id: 13, nome: 'Uno' }], 2: [{ id: 21, nome: 'Delivery 11.180' }, { id: 22, nome: 'Saveiro' }] });
const baseItem = { marca_nome: 'FIAT', ano_fabricacao: 2019, ano_modelo: 2020, tipo_veiculo_esl: 'Utilitário', chassi: '9BD00000000000001', renavam: '00000000001' };
const cria = (n, placa, extra, item) => ({ row: { linha: n, placa, acao: 'revisar', marca_id: 1, ...extra }, item: { ...baseItem, modelo_nome: 'FIORINO FURGAO 1.4', tipo_proprietario_esl: 'Agregado', agregado_esl_nome: 'Transp Exemplo Ltda', ...item } });
const dupl = { prestador_classe: 'possivel_duplicado', prestador_nome_origem: 'Transp Exemplo Ltda', prestador_ambiguos: [{ id: 3, nome: 'Transporte Exemplo S/A' }, { id: 5, nome: 'Transp. Exemplo Sul' }] };
const fixtures = {
    modelo: [cria(1, 'ABC1D23', {}, {}), cria(2, 'ABC1D24', {}, {})],
    prestador: [cria(1, 'ABC1D23', { acao: 'criar', ...dupl }, { modelo_id: 11 })],
    ambos: [cria(1, 'ABC1D23', dupl, {})],
    ultimo: [cria(1, 'ABC1D23', {}, {})],
};
const itens = ref(fixtures[estado] || fixtures.modelo);
const preview = computed(() => itens.value.map(x => x.row));
const itemDe = r => itens.value.find(x => x.row.linha === r.linha).item;
const ignoradas = ref([]);
const ehPend = l => { const r = preview.value.find(x => x.linha === l); return precisaRevisao(r, itemDe(r), ignoradas.value.includes(l)); };
const fila = ref(montarFila(preview.value, itemDe, r => false));
const idx = ref(estado === 'ultimo' ? 0 : 0);
const total = estado === 'ultimo' ? 17 : fila.value.length;
const indiceExibido = estado === 'ultimo' ? 16 : idx;
const aberto = ref(true);
const log = ref('');
const atual = computed(() => aberto.value ? preview.value.find(x => x.linha === fila.value[idx.value]) : null);
function avancar() {
    const p = proximoIndice(fila.value, idx.value, ehPend);
    if (p === null) { aberto.value = false; log.value = 'Revisão concluída (fixture, nada gravado).'; } else idx.value = p;
}
function ok(p) {
    const it = atual.value && itemDe(atual.value);
    if (p.modeloId) it.modelo_id = p.modeloId;
    if (p.marcaId) it.marca_id = p.marcaId;
    if (p.prestadorId !== undefined) it.prestador_servico_id = p.prestadorId;
    log.value = 'OK: ' + JSON.stringify(p);
    avancar();
}
function ignorar() { ignoradas.value.push(atual.value.linha); log.value = 'Ignorada ' + atual.value.placa; avancar(); }
</script>
<template>
    <div style="padding:24px;color:var(--ink)">
        <p>Harness DEV: estado <b>{{ estado }}</b>. {{ log }}</p>
        <button v-if="!aberto" type="button" @click="$router.go(0)">Reabrir</button>
        <EslRevisaoModal v-if="atual" :row="atual" :item="itemDe(atual)" :indice="Number(indiceExibido?.value ?? indiceExibido)" :total="total"
            :marcas="marcas" :modelos-por-marca="modelosPorMarca" @ok="ok" @ignorar="ignorar" @fechar="aberto = false" />
    </div>
</template>

<style scoped src="@/styles/pages/dev/review_modal_harness_page.css"></style>
