<script setup>
import { ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { ArrowLeft, Plus } from 'lucide-vue-next';
import PainelCard from '@/components/all/ui/BaseCard.vue';
import CadeiaFipe from '@/components/registrations/vehicles/fipe/FipeChain.vue';
import { queryCriarVeiculoDaConsulta, destinoVoltar, queryVoltar } from '@/domain/vehicles/fleet-model.js';

const router = useRouter();
const route = useRoute();
const resultado = ref(null);
const chave = ref(0);

function criarVeiculo() {
    const r = resultado.value;
    if (!r) return;
    router.push({
        name: 'veiculo-novo',
        query: { ...queryCriarVeiculoDaConsulta({ tipo: r.tipo, marcaId: r.marcaId, modeloId: r.modeloId, anoCodigo: r.anoCodigo, codigoFipe: r.cotacao.codigo_fipe }), ...queryVoltar(route.query.voltar) },
    });
}
</script>

<template>
    <div class="cfp">
        <RouterLink class="cfp__voltar" :to="destinoVoltar(route.query, { name: 'cadastros-item', params: { tipo: 'veiculos' }, query: { aba: 'placas' } })"><ArrowLeft :size="16" /> Voltar à frota</RouterLink>
        <PainelCard titulo="Consulta FIPE avulsa">
            <p class="cfp__texto">Consulta o valor na tabela FIPE sem vincular a nenhum veículo. A consulta não grava nada.</p>
            <CadeiaFipe :key="chave" @resultado="resultado = $event" />
            <div v-if="resultado" class="cfp__acoes">
                <button type="button" class="cfp__botao cfp__botao--principal" @click="criarVeiculo"><Plus :size="16" /> Criar veículo a partir do resultado</button>
                <button type="button" class="cfp__botao" @click="chave++; resultado = null">Consultar outro</button>
            </div>
            <p v-if="resultado" class="cfp__texto">O veículo criado receberá marca, modelo e ano como proposta; o vínculo FIPE só vale depois de você salvar o cadastro.</p>
        </PainelCard>
    </div>
</template>

<style scoped src="@/styles/pages/registrations/vehicles/fipe_lookup_page.css"></style>
