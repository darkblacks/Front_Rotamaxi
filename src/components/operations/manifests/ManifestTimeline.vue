<script setup>
import BadgeDeStatus from '@/components/all/ui/StatusBadge.vue';
import EstadoVazio from '@/components/all/ui/EmptyState.vue';
import { coordenada, dataEHora } from '@/utils/format.js';

/**
 * Linha do tempo vertical do manifesto (US-8.4).
 *
 * A ordem é a que o servidor mandou — `ocorrido_em`, a hora do **dispositivo** —, e a tela
 * não reordena nada: `recebido_em` conta a história da rede, não a do campo. As duas horas
 * aparecem lado a lado em cada linha, junto do GPS, para que a distância entre elas fique
 * visível.
 *
 * O evento `fora_de_prazo` — aceito depois do fechamento do manifesto — é destacado com o
 * token `warn`: é ele que pede conferência humana.
 */
defineProps({
    linhas: { type: Array, default: () => [] },
    carregando: { type: Boolean, default: false },
});

const TONS_POR_ORIGEM = {
    motorista: 'accent',
    portaria: 'info',
    sistema: 'neutro',
};
</script>

<template>
    <EstadoVazio v-if="carregando" mensagem="Carregando a linha do tempo…" tracejado />

    <EstadoVazio
        v-else-if="linhas.length === 0"
        mensagem="Nenhum acontecimento registrado neste manifesto."
        tracejado
    />

    <ol v-else class="linha-do-tempo">
        <li
            v-for="linha in linhas"
            :key="`${linha.referencia.tipo}-${linha.referencia.id}`"
            class="evento"
            :class="{ 'evento--fora-de-prazo': linha.fora_de_prazo }"
            :data-evento="linha.tipo"
        >
            <span class="evento__marcador" aria-hidden="true"></span>

            <div class="evento__corpo">
                <div class="evento__titulo">
                    <strong class="evento__descricao">{{ linha.descricao ?? linha.tipo }}</strong>
                    <BadgeDeStatus :rotulo="linha.origem" :tom="TONS_POR_ORIGEM[linha.origem] ?? 'neutro'" />
                    <BadgeDeStatus v-if="linha.fora_de_prazo" rotulo="fora de prazo" tom="warn" />
                    <BadgeDeStatus
                        v-else-if="linha.estado"
                        :rotulo="linha.estado"
                        tom="neutro"
                    />
                </div>

                <dl class="evento__horas">
                    <div class="evento__hora">
                        <dt>no aparelho</dt>
                        <dd data-hora="dispositivo">{{ dataEHora(linha.ocorrido_em) }}</dd>
                    </div>
                    <div class="evento__hora">
                        <dt>no servidor</dt>
                        <dd data-hora="servidor">{{ dataEHora(linha.recebido_em) }}</dd>
                    </div>
                    <div class="evento__hora">
                        <dt>GPS</dt>
                        <dd data-hora="gps">{{ coordenada(linha.gps) }}</dd>
                    </div>
                </dl>
            </div>
        </li>
    </ol>
</template>

<style scoped src="@/styles/components/operations/manifests/manifest_timeline.css"></style>
