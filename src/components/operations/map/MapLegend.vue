<script setup>
import { COR_POR_NOME } from '@/domain/map/stages.js';
import { estadoDoSinal, formatarIdade, idadeDoSinal, ROTULO_DO_SINAL } from '@/domain/map/positions.js';

/** Legenda de cores/linhas e estado do sinal de veículo e celular (entidades independentes). */
const props = defineProps({
    posicoes: { type: Object, default: null },
    agora: { type: Number, default: () => Date.now() },
});

function sinal(tipo) {
    const pos = props.posicoes?.[tipo] ?? null;
    const estado = estadoDoSinal(pos, props.agora);
    return {
        estado,
        rotulo: ROTULO_DO_SINAL[estado],
        idade: pos ? formatarIdade(idadeDoSinal(pos, props.agora)) : '—',
        bateria: pos?.battery ?? null,
    };
}
</script>

<template>
    <div class="legenda">
        <ul class="legenda__lista" aria-label="Legenda">
            <li><i class="legenda__ponto" :style="{ background: COR_POR_NOME.vermelho }"></i> Coleta</li>
            <li><i class="legenda__ponto" :style="{ background: COR_POR_NOME.azul }"></i> CT</li>
            <li><i class="legenda__ponto" :style="{ background: COR_POR_NOME.verde }"></i> Distribuição</li>
            <li><i class="legenda__ponto" :style="{ background: COR_POR_NOME.neutro }"></i> Base / estacionamento</li>
            <li><i class="legenda__linha legenda__linha--rota"></i> Rota planejada</li>
            <li><i class="legenda__linha legenda__linha--trajeto"></i> Trajeto realizado</li>
        </ul>
        <dl class="legenda__sinais">
            <div>
                <dt>Veículo</dt>
                <dd :data-sinal="sinal('vehicle').estado">
                    {{ sinal('vehicle').rotulo }} · {{ sinal('vehicle').idade }}
                </dd>
            </div>
            <div>
                <dt>Celular</dt>
                <dd :data-sinal="sinal('phone').estado">
                    {{ sinal('phone').rotulo }} · {{ sinal('phone').idade }}
                    <template v-if="sinal('phone').bateria !== null"> · bat. {{ sinal('phone').bateria }}%</template>
                </dd>
            </div>
        </dl>
    </div>
</template>

<style scoped src="@/styles/components/operations/map/map_panels.css"></style>
