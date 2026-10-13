<script setup>
import BadgeDeStatus from '@/components/all/ui/StatusBadge.vue';
import EstadoVazio from '@/components/all/ui/EmptyState.vue';
import { horaCurta } from '@/utils/format.js';

defineProps({
    // Linhas de `divergenciasRecentes` da store da visão geral.
    linhas: { type: Array, default: () => [] },
    carregando: { type: Boolean, default: false },
});
</script>

<template>
    <div class="divergencias">
        <div v-if="carregando" class="divergencias__esqueleto" aria-hidden="true">
            <span v-for="linha in 3" :key="linha" class="divergencias__linha-esqueleto"></span>
        </div>

        <EstadoVazio
            v-else-if="linhas.length === 0"
            mensagem="Nenhuma divergência aberta no período."
            tracejado
        />

        <RouterLink
            v-for="linha in linhas"
            v-else
            :key="linha.id"
            class="divergencias__linha"
            :to="linha.destino"
            :data-divergencia="linha.id"
        >
            <BadgeDeStatus :rotulo="linha.tipo" tom="bad" />
            <span class="divergencias__identificacao">
                <strong>MAN {{ linha.manifestoNumero }}</strong>
                <small>{{ linha.filial }} · {{ horaCurta(linha.criadoEm) }}</small>
            </span>
            <span class="divergencias__numeros">
                <span class="divergencias__numero">
                    <small>esperado</small>{{ linha.esperado }}
                </span>
                <span class="divergencias__numero">
                    <small>declarado</small>{{ linha.declarado }}
                </span>
                <span class="divergencias__numero">
                    <small>conferido</small>{{ linha.conferido }}
                </span>
                <span class="divergencias__numero divergencias__numero--diferenca">
                    <small>dif.</small>{{ linha.diferenca }}
                </span>
            </span>
        </RouterLink>
    </div>
</template>

<style scoped src="@/styles/components/operations/divergences/open_divergences.css"></style>
