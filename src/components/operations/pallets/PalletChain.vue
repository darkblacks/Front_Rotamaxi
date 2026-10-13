<script setup>
import { computed } from 'vue';
import { divergenciaDaCadeia, montarCadeia, saldoDisponivel, textoDaDiferenca } from '@/domain/pallets/chain.js';
import { dataEHora } from '@/utils/format.js';

/**
 * Cadeia de custódia de pallets: ESPERADO -> CONFERIDO -> ACEITO MOTORISTA -> INFORMADO
 * PORTARIA -> RECEBIDO CT -> ACEITO CT. Reutilizável (recebimento, manifesto, mapa).
 *
 * Mostra cada elo como veio do servidor, sem sobrescrever nada. Divergência é destacada e
 * nunca bloqueia; o informado da portaria é só registro, sem aceite.
 */
const props = defineProps({
    // `pallets` do GET /mapa/manifestos/{id}/pallets (ou o resumo do detalhe do mapa).
    pallets: { type: Object, default: null },
    compacto: { type: Boolean, default: false },
});

const elos = computed(() => montarCadeia(props.pallets));
const total = computed(() => divergenciaDaCadeia(props.pallets));
const saldo = computed(() => saldoDisponivel(props.pallets));
const algumPreenchido = computed(() => elos.value.some((e) => e.preenchido));
</script>

<template>
    <div class="cadeia" :class="{ 'cadeia--compacta': compacto }">
        <p v-if="!algumPreenchido" class="cadeia__vazio">Nenhum registro de pallets neste manifesto.</p>

        <ol v-else class="cadeia__elos">
            <li
                v-for="elo in elos"
                :key="elo.chave"
                class="elo"
                :class="{ 'elo--pendente': elo.pendente, 'elo--divergente': elo.divergente, 'elo--informativo': elo.semAceite }"
                :data-elo="elo.chave"
            >
                <span class="elo__rotulo">{{ elo.rotulo }}</span>
                <strong class="elo__valor">{{ elo.preenchido ? elo.quantidade : '—' }}</strong>
                <span v-if="elo.divergente" class="elo__dif" role="status">{{ textoDaDiferenca(elo.diferenca) }} vs. esperado</span>
                <span class="elo__meta">
                    <template v-if="elo.preenchido">
                        {{ elo.usuario ?? elo.ator }}<template v-if="elo.registradoEm"> · {{ dataEHora(elo.registradoEm) }}</template>
                    </template>
                    <template v-else>aguardando {{ elo.ator.toLowerCase() }}</template>
                </span>
                <span v-if="elo.semAceite && !compacto" class="elo__nota">só registro, sem aceite</span>
            </li>
        </ol>

        <p v-if="total !== null && total !== 0" class="cadeia__alerta" role="alert">
            Divergência de {{ textoDaDiferenca(total) }} pallet(s) em relação ao esperado. Todos os registros foram preservados;
            a divergência não bloqueia a operação.
        </p>
        <p v-if="saldo !== null && !compacto" class="cadeia__saldo">Saldo disponível para o próximo manifesto: <strong>{{ saldo }}</strong> (aceito pelo CT)</p>
    </div>
</template>

<style scoped src="@/styles/components/operations/pallets/pallet_chain.css"></style>
