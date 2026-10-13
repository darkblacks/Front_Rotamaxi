<script setup>
import { computed } from 'vue';
import EstadoVazio from '@/components/all/ui/EmptyState.vue';
import { coordenada, dataEHora } from '@/utils/format.js';

/**
 * Trajeto do manifesto: a série de posições desenhada ponto a ponto (US-7.5).
 *
 * Manifesto sem nenhum ping mostra **estado vazio, não erro**: enviar posição é opção do
 * motorista, então a ausência de pontos é um estado normal da viagem.
 *
 * O desenho é um SVG normalizado pelos extremos da própria série — não é mapa, é a forma do
 * caminho. A latitude cresce para o norte e o eixo do SVG cresce para baixo, por isso ela é
 * invertida; sem isso o trajeto sairia espelhado.
 */
const props = defineProps({
    posicoes: { type: Array, default: () => [] },
    carregando: { type: Boolean, default: false },
});

const LARGURA = 600;

const ALTURA = 200;

const MARGEM = 10;

const pontos = computed(() => {
    const serie = props.posicoes.filter(
        (posicao) => typeof posicao.latitude === 'number' && typeof posicao.longitude === 'number',
    );

    if (serie.length === 0) {
        return '';
    }

    const latitudes = serie.map((posicao) => posicao.latitude);
    const longitudes = serie.map((posicao) => posicao.longitude);

    const escala = (valor, minimo, maximo, tamanho) => {
        // Série de um ponto só — ou parada no mesmo lugar — não tem extensão: o traço vai
        // para o meio, em vez de dividir por zero.
        if (maximo === minimo) {
            return tamanho / 2;
        }

        return MARGEM + ((valor - minimo) / (maximo - minimo)) * (tamanho - MARGEM * 2);
    };

    return serie
        .map((posicao) => {
            const x = escala(posicao.longitude, Math.min(...longitudes), Math.max(...longitudes), LARGURA);
            const y = ALTURA - escala(posicao.latitude, Math.min(...latitudes), Math.max(...latitudes), ALTURA);

            return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');
});

const primeira = computed(() => props.posicoes[0] ?? null);

const ultima = computed(() => props.posicoes[props.posicoes.length - 1] ?? null);
</script>

<template>
    <EstadoVazio v-if="carregando" mensagem="Carregando o trajeto…" tracejado />

    <EstadoVazio
        v-else-if="posicoes.length === 0"
        mensagem="Este manifesto não tem posição registrada."
        tracejado
    >
        <small class="trajeto__aviso">Enviar posição é opção do motorista.</small>
    </EstadoVazio>

    <div v-else class="trajeto" data-trajeto="serie">
        <svg
            class="trajeto__desenho"
            :viewBox="`0 0 ${LARGURA} ${ALTURA}`"
            preserveAspectRatio="none"
            role="img"
            aria-label="Trajeto do manifesto"
        >
            <polyline
                :points="pontos"
                fill="none"
                stroke="var(--accent)"
                stroke-width="2"
                vector-effect="non-scaling-stroke"
                stroke-linejoin="round"
            />
        </svg>

        <dl class="trajeto__extremos">
            <div class="trajeto__item">
                <dt>primeiro ping</dt>
                <dd>{{ dataEHora(primeira?.ocorrido_em) }} · {{ coordenada(primeira) }}</dd>
            </div>
            <div class="trajeto__item">
                <dt>último ping</dt>
                <dd>{{ dataEHora(ultima?.ocorrido_em) }} · {{ coordenada(ultima) }}</dd>
            </div>
            <div class="trajeto__item">
                <dt>pontos</dt>
                <dd>{{ posicoes.length }}</dd>
            </div>
        </dl>
    </div>
</template>

<style scoped src="@/styles/components/operations/manifests/manifest_route.css"></style>
