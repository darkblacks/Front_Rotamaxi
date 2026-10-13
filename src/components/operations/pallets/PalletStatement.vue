<script setup>
import EstadoVazio from '@/components/all/ui/EmptyState.vue';
import TabelaDoPainel from '@/components/all/tables/BaseTable.vue';
import { dataEHora, dataDoDia, numero } from '@/utils/format.js';

/**
 * Extrato de pallets de um cliente, movimento a movimento (US-8.5, US-9.3).
 *
 * Cada linha traz data, tipo, manifesto, motorista, quantidade e o **saldo acumulado** até
 * ali, que é o que torna a cobrança auditável. O acumulado é o do servidor: ele já parte do
 * que ficou para trás do período, e refazê-lo aqui zeraria esse começo.
 *
 * Movimento não é editado nem excluído em lugar nenhum — correção é um movimento novo, e as
 * duas linhas aparecem.
 */
defineProps({
    // `resumoDoExtrato` da store: cliente, saldo, acumulado inicial e o período aplicado.
    resumo: { type: Object, default: null },
    // `linhasDoExtrato` da store, já na perspectiva do pátio do cliente.
    linhas: { type: Array, default: () => [] },
    carregando: { type: Boolean, default: false },
    vazio: { type: Boolean, default: false },
});

const COLUNAS = [
    { chave: 'data', rotulo: 'Data', largura: '150px' },
    { chave: 'movimento', rotulo: 'Movimento', largura: '110px' },
    { chave: 'viagem', rotulo: 'Manifesto · Motorista' },
    { chave: 'quantidade', rotulo: 'Qtd', largura: '70px', alinhamento: 'right' },
    { chave: 'acumulado', rotulo: 'Saldo', largura: '80px', alinhamento: 'right' },
];
</script>

<template>
    <EstadoVazio v-if="resumo === null && carregando" mensagem="Carregando o extrato…" />

    <EstadoVazio
        v-else-if="resumo === null"
        mensagem="Escolha um cliente na lista para ver o extrato movimento a movimento."
    />

    <div v-else class="extrato">
        <div class="extrato__cabecalho">
            <div class="extrato__cliente">
                <span class="extrato__legenda">Extrato de pallets</span>
                <span class="extrato__nome">{{ resumo.nome }}</span>
                <span class="extrato__periodo">
                    {{ dataDoDia(resumo.de) }} a {{ dataDoDia(resumo.ate) }} ·
                    acumulado inicial {{ numero(resumo.acumuladoInicial) }}
                </span>
            </div>
            <div class="extrato__saldo">
                <small class="extrato__legenda">saldo no cliente</small>
                <span class="extrato__valor">{{ numero(resumo.saldo) }}</span>
            </div>
        </div>

        <EstadoVazio
            v-if="vazio"
            mensagem="Nenhum movimento deste cliente no período. O acumulado inicial continua valendo."
            tracejado
        />

        <TabelaDoPainel v-else :colunas="COLUNAS" :largura-minima="620">
            <tr v-for="linha in linhas" :key="linha.id" :data-movimento="linha.id">
                <td class="extrato__data">{{ dataEHora(linha.ocorridoEm) }}</td>
                <td>
                    <span class="extrato__tipo" :class="linha.entrada ? 'extrato__tipo--entrada' : 'extrato__tipo--saida'">
                        {{ linha.tipoNome }}
                    </span>
                </td>
                <td class="extrato__viagem">
                    <b class="extrato__manifesto">{{ linha.manifesto }}</b> · {{ linha.motorista }}
                </td>
                <td class="extrato__numero">
                    {{ linha.efeito > 0 ? '+' : '' }}{{ numero(linha.efeito) }}
                </td>
                <td class="extrato__numero extrato__numero--acumulado">{{ numero(linha.acumulado) }}</td>
            </tr>
        </TabelaDoPainel>
    </div>
</template>

<style scoped src="@/styles/components/operations/pallets/pallet_statement.css"></style>
