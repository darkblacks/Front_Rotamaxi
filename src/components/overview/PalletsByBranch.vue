<script setup>
import EstadoVazio from '@/components/all/ui/EmptyState.vue';
import { numero } from '@/utils/format.js';

/**
 * Quebra "Por filial" do saldo de pallets (US-8.5).
 *
 * Cada linha responde onde está o pallet que saiu daquela filial: o que ficou em cliente e
 * o que continua em trânsito com o motorista. A barra compara as filiais entre si — é a
 * pergunta "qual filial tem mais pallet parado em cliente".
 */
defineProps({
    // Linhas de `pallets.por_filial` do endpoint de agregados, já preparadas pela store.
    linhas: { type: Array, default: () => [] },
    carregando: { type: Boolean, default: false },
});
</script>

<template>
    <EstadoVazio v-if="carregando && linhas.length === 0" mensagem="Carregando as filiais…" />

    <EstadoVazio v-else-if="linhas.length === 0" mensagem="Sem movimento de pallet no recorte." />

    <ul v-else class="filiais">
        <li v-for="linha in linhas" :key="linha.filialId" class="filial" :data-filial="linha.codigo">
            <div class="filial__identificacao">
                <span class="filial__codigo">{{ linha.codigo }}</span>
                <span class="filial__nome">{{ linha.nome }}</span>
            </div>
            <div class="filial__barra">
                <span class="filial__fatia" :style="{ width: linha.largura }"></span>
            </div>
            <div class="filial__numeros">
                <span class="filial__numero">
                    <small>em clientes</small>
                    <b>{{ numero(linha.emClientes) }}</b>
                </span>
                <span class="filial__numero">
                    <small>em trânsito</small>
                    <b>{{ numero(linha.emTransito) }}</b>
                </span>
                <span class="filial__numero">
                    <small>movimentos</small>
                    <b>{{ numero(linha.movimentos) }}</b>
                </span>
            </div>
        </li>
    </ul>
</template>

<style scoped src="@/styles/components/overview/pallets_by_branch.css"></style>
