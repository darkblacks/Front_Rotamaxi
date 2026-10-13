<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { numero } from '@/utils/format.js';

/**
 * Um veículo parado no portão, como o design desenha o cartão da fila: placa em destaque,
 * a viagem em uma linha, o tempo de espera e os três números declarados.
 *
 * O cartão **não** tem ação de conferência: no painel do admin a fila é monitoramento, e a
 * conferência continua sendo o ato do porteiro no portão. O clique abre o manifesto, que é
 * leitura.
 */
const props = defineProps({
    cartao: { type: Object, required: true },
    // Porteiro: o clique no cartão abre o registro (contexto) em vez de navegar ao manifesto.
    abrirContexto: { type: Boolean, default: false },
    rotuloDoContexto: { type: String, default: 'Ver contexto da portaria' },
});

const emit = defineEmits(['contexto']);

const TONS = {
    neutro: 'var(--muted)',
    ok: 'var(--ok)',
    warn: 'var(--warn)',
    bad: 'var(--bad)',
};

function aoClicar(evento) {
    if (! props.abrirContexto) {
        return;
    }

    evento.preventDefault();
    emit('contexto', props.cartao);
}

const corDaEspera = computed(() => TONS[props.cartao.esperaTom] ?? TONS.neutro);
</script>

<template>
    <component
        :is="abrirContexto ? 'div' : RouterLink"
        class="cartao"
        :class="{ 'cartao--clicavel': abrirContexto }"
        v-bind="abrirContexto ? { role: 'button', tabindex: 0 } : { to: cartao.destino }"
        :data-manifesto="cartao.numero"
        @click="aoClicar"
        @keydown.enter="aoClicar"
    >
        <div class="cartao__identificacao">
            <span class="cartao__placa">{{ cartao.placa }}</span>
            <span class="cartao__viagem">
                MAN {{ cartao.numero }} · {{ cartao.filial }} · {{ cartao.motorista }}
            </span>
        </div>

        <div class="cartao__espera">
            <span class="cartao__tempo" :style="{ color: corDaEspera }">{{ cartao.espera }}</span>
            <span class="cartao__legenda">na fila</span>
        </div>

        <div class="cartao__numeros">
            <div class="cartao__numero">
                <small class="cartao__legenda">{{ cartao.kmRotulo }}</small>
                <b class="cartao__valor">{{ numero(cartao.km) }}</b>
            </div>
            <div class="cartao__numero">
                <small class="cartao__legenda">pallets declarados</small>
                <b class="cartao__valor">{{ numero(cartao.declarados) }}</b>
            </div>
            <div class="cartao__numero" :class="{ 'cartao__numero--alerta': cartao.divergente }">
                <small class="cartao__legenda">{{ cartao.esperados === null ? 'destinos' : 'pallets esperados' }}</small>
                <b class="cartao__valor" :class="{ 'cartao__valor--alerta': cartao.divergente }">
                    {{ numero(cartao.esperados === null ? cartao.destinos : cartao.esperados) }}
                </b>
            </div>
        </div>

        <button type="button" class="cartao__contexto" @click.prevent.stop="emit('contexto', cartao)">
            {{ rotuloDoContexto }}
        </button>
    </component>
</template>

<style scoped src="@/styles/components/operations/gate/queue_card.css"></style>
