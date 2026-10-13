<script setup>
import { computed } from 'vue';
import EstadoVazio from '@/components/all/ui/EmptyState.vue';

const props = defineProps({
    // Linhas de `entregas.por_filial` do endpoint de agregados.
    linhas: { type: Array, default: () => [] },
    carregando: { type: Boolean, default: false },
});

/**
 * Cada barra é a filial inteira: a fatia verde são as entregas concluídas, a vermelha as
 * não realizadas e o trilho restante o que ainda está por fazer. A largura é percentual
 * do total **daquela** filial, e não do maior total, porque a barra responde "quanto do
 * dia desta filial já fechou", não "qual filial é a maior".
 */
const barras = computed(() => props.linhas.map((linha) => {
    const total = linha.total > 0 ? linha.total : 0;

    return {
        filialId: linha.filial_id,
        codigo: linha.codigo ?? '—',
        nome: linha.nome ?? '',
        total,
        concluidas: linha.concluidas,
        naoRealizadas: linha.nao_realizadas,
        pendentes: linha.pendentes,
        larguraConcluidas: total === 0 ? '0%' : `${(linha.concluidas / total) * 100}%`,
        larguraNaoRealizadas: total === 0 ? '0%' : `${(linha.nao_realizadas / total) * 100}%`,
    };
}));
</script>

<template>
    <div class="entregas">
        <div class="entregas__legenda">
            <span class="entregas__chave"><i class="entregas__cor entregas__cor--ok"></i>Concluídas</span>
            <span class="entregas__chave"><i class="entregas__cor entregas__cor--bad"></i>Não realizadas</span>
            <span class="entregas__chave"><i class="entregas__cor entregas__cor--track"></i>Pendentes</span>
        </div>

        <div v-if="carregando" class="entregas__esqueleto" aria-hidden="true">
            <span v-for="linha in 4" :key="linha" class="entregas__barra-esqueleto"></span>
        </div>

        <EstadoVazio
            v-else-if="barras.length === 0"
            mensagem="Nenhuma entrega no período."
            tracejado
        />

        <div
            v-for="barra in barras"
            v-else
            :key="barra.filialId"
            class="entregas__linha"
            :data-filial="barra.filialId"
        >
            <span class="entregas__codigo" :title="barra.nome">{{ barra.codigo }}</span>
            <div
                class="entregas__trilho"
                role="img"
                :aria-label="`${barra.nome}: ${barra.concluidas} concluídas, ${barra.naoRealizadas} não realizadas e ${barra.pendentes} pendentes de ${barra.total}`"
            >
                <div class="entregas__fatia entregas__fatia--ok" :style="{ width: barra.larguraConcluidas }"></div>
                <div class="entregas__fatia entregas__fatia--bad" :style="{ width: barra.larguraNaoRealizadas }"></div>
            </div>
            <span class="entregas__numeros">{{ barra.concluidas }}/{{ barra.total }}</span>
        </div>
    </div>
</template>

<style scoped src="@/styles/components/overview/deliveries_by_branch.css"></style>
