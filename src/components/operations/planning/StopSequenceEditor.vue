<script setup>
import { ref } from 'vue';
import PointPicker from './PointPicker.vue';
import { PAPEIS_DE_ETAPA, aplicarPonto, etapaVazia, paradaManual } from '@/domain/planning/sequence.js';
import { deInputLocal, paraInputLocal, pontoDefinido } from '@/domain/planning/services.js';
import { corHexDaEtapa } from '@/domain/map/stages.js';

/**
 * Sequência de etapas em montagem. Início e fim ficam nas pontas (pontos definidos nos dados
 * do manifesto); as paradas se reordenam por setas ou arrastando.
 */
const props = defineProps({
    etapas: { type: Array, default: () => [] },
    desabilitado: { type: Boolean, default: false },
});

const emit = defineEmits(['adicionar', 'remover', 'mover', 'arrastar', 'editar']);

const novoPonto = ref(null);
const novoPapel = ref('coleta');
const arrastando = ref(null);

function adicionar() {
    if (!pontoDefinido(novoPonto.value) && !(novoPonto.value?.kind && novoPonto.value?.id)) return;
    const base = etapaVazia('parada', novoPapel.value);
    const p = novoPonto.value;
    emit('adicionar', aplicarPonto(base, p.kind ? p : { ...p, kind: null, id: null }));
    novoPonto.value = null;
}

function aoSoltar(chaveDestino) {
    if (arrastando.value && arrastando.value !== chaveDestino) emit('arrastar', arrastando.value, chaveDestino);
    arrastando.value = null;
}

function rotuloTipo(e) {
    if (e.tipo_etapa === 'inicio') return 'Início do manifesto';
    if (e.tipo_etapa === 'fim') return 'Fim do manifesto';
    return ehManual(e) ? 'Parada manual' : 'Via serviço';
}

function janela(e, campo, ev) {
    emit('editar', e.chave, { [campo]: deInputLocal(ev.target.value) });
}

function ehManual(e) {
    return paradaManual(e);
}

function ehMovel(e) {
    return ehManual(e) && !props.desabilitado;
}
</script>

<template>
    <div class="sequencia">
        <ol class="sequencia__lista">
            <li
                v-for="(e, i) in etapas"
                :key="e.chave"
                class="etapa"
                :class="{ 'etapa--fixa': !ehManual(e) }"
                :draggable="ehMovel(e)"
                @dragstart="arrastando = e.chave"
                @dragover.prevent
                @drop.prevent="aoSoltar(e.chave)"
            >
                <span class="etapa__ordem" :style="{ background: corHexDaEtapa({ papel: e.papel }) }">{{ e.ordem ?? i + 1 }}</span>
                <div class="etapa__corpo">
                    <strong class="etapa__nome">{{ e.nome || 'Ponto não definido' }}</strong>
                    <small class="etapa__meta">{{ rotuloTipo(e) }}<template v-if="e.latitude == null"> · sem coordenadas</template></small>
                    <div v-if="ehManual(e)" class="etapa__campos">
                        <select
                            class="lookup__entrada"
                            :value="e.papel"
                            :disabled="desabilitado"
                            aria-label="Papel da etapa"
                            @change="emit('editar', e.chave, { papel: $event.target.value })"
                        >
                            <option v-for="p in PAPEIS_DE_ETAPA" :key="p.id" :value="p.id">{{ p.rotulo }}</option>
                        </select>
                        <label class="etapa__janela">Janela de
                            <input class="lookup__entrada" type="datetime-local" :value="paraInputLocal(e.janela_inicio)" :disabled="desabilitado" @change="janela(e, 'janela_inicio', $event)" />
                        </label>
                        <label class="etapa__janela">até
                            <input class="lookup__entrada" type="datetime-local" :value="paraInputLocal(e.janela_fim)" :disabled="desabilitado" @change="janela(e, 'janela_fim', $event)" />
                        </label>
                    </div>
                </div>
                <div v-if="ehManual(e)" class="etapa__acoes">
                    <button type="button" class="botao botao--icone" :disabled="desabilitado" aria-label="Subir" @click="emit('mover', e.chave, -1)">↑</button>
                    <button type="button" class="botao botao--icone" :disabled="desabilitado" aria-label="Descer" @click="emit('mover', e.chave, 1)">↓</button>
                    <button type="button" class="botao botao--icone" :disabled="desabilitado" aria-label="Remover etapa" @click="emit('remover', e.chave)">×</button>
                </div>
            </li>
        </ol>

        <div v-if="!desabilitado" class="sequencia__nova">
            <PointPicker v-model="novoPonto" titulo="Adicionar parada manual" />
            <label class="form__campo">
                <span class="lookup__titulo">Papel</span>
                <select v-model="novoPapel" class="lookup__entrada">
                    <option v-for="p in PAPEIS_DE_ETAPA" :key="p.id" :value="p.id">{{ p.rotulo }}</option>
                </select>
            </label>
            <button type="button" class="botao" :disabled="!novoPonto" @click="adicionar">Adicionar parada</button>
        </div>
    </div>
</template>

<style scoped src="@/styles/components/operations/planning/planning.css"></style>
