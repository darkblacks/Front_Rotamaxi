<script setup>
import { computed } from 'vue';

/**
 * Rodapé de paginação das listas do painel.
 *
 * Os números vêm todos do servidor — página atual, última página e total do recorte. A tela
 * não conta linhas para descobrir quantas páginas existem: ela tem em mãos uma página só.
 */
const props = defineProps({
    paginacao: { type: Object, required: true },
    carregando: { type: Boolean, default: false },
    // O que a lista pagina: manifestos na tela 02, notas na lista de um código.
    rotulo: { type: String, default: 'manifestos' },
});

const emit = defineEmits(['ir']);

const temAnterior = computed(() => props.paginacao.pagina > 1);

const temProxima = computed(() => props.paginacao.pagina < props.paginacao.ultimaPagina);
</script>

<template>
    <div class="paginacao">
        <span class="paginacao__resumo" data-paginacao="resumo">
            Página {{ paginacao.pagina }} de {{ paginacao.ultimaPagina }} · {{ paginacao.total }} {{ rotulo }}
        </span>
        <div class="paginacao__botoes">
            <button
                type="button"
                class="paginacao__botao"
                data-paginacao="anterior"
                :disabled="! temAnterior || carregando"
                @click="emit('ir', paginacao.pagina - 1)"
            >
                Anterior
            </button>
            <button
                type="button"
                class="paginacao__botao"
                data-paginacao="proxima"
                :disabled="! temProxima || carregando"
                @click="emit('ir', paginacao.pagina + 1)"
            >
                Próxima
            </button>
        </div>
    </div>
</template>

<style scoped src="@/styles/components/all/tables/table_pagination.css"></style>
