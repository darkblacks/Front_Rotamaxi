<script setup>
import EstadoVazio from '@/components/all/ui/EmptyState.vue';

defineProps({
    // Linhas de `canhotosPorFilial` da store da visão geral.
    linhas: { type: Array, default: () => [] },
    carregando: { type: Boolean, default: false },
});
</script>

<template>
    <div class="canhotos">
        <div v-if="carregando" class="canhotos__esqueleto" aria-hidden="true">
            <span v-for="linha in 4" :key="linha" class="canhotos__linha-esqueleto"></span>
        </div>

        <EstadoVazio
            v-else-if="linhas.length === 0"
            mensagem="Nenhum canhoto pendente."
            tracejado
        />

        <!--
            As duas pendências vivem em colunas próprias, nunca somadas: a imagem que não
            subiu se cobra do motorista e o papel que não voltou se cobra da filial.
        -->
        <div v-else class="canhotos__grade">
            <span class="canhotos__cabecalho">Filial</span>
            <span class="canhotos__cabecalho canhotos__cabecalho--numero">Aguard. upload</span>
            <span class="canhotos__cabecalho canhotos__cabecalho--numero">Não entregues</span>

            <template v-for="linha in linhas" :key="linha.filialId ?? 'sem-filial'">
                <span class="canhotos__filial" :title="linha.nome">{{ linha.codigo }} · {{ linha.nome }}</span>
                <span
                    class="canhotos__numero canhotos__numero--upload"
                    :data-aguardando-upload="linha.filialId"
                >{{ linha.aguardandoUpload }}</span>
                <span
                    class="canhotos__numero"
                    :data-sem-entrega-fisica="linha.filialId"
                >{{ linha.semEntregaFisica }}</span>
            </template>
        </div>

        <p class="canhotos__nota">
            Aguard. upload: foto ainda não confirmada no bucket. Não entregues: digitalizado,
            papel ainda não recebido na filial. A cobrança é o que está em aberto hoje,
            independente do período da tela.
        </p>
    </div>
</template>

<style scoped src="@/styles/components/operations/manifests/pending_receipts.css"></style>
