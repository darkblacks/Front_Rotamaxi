<script setup>
import { computed, reactive, ref } from 'vue';
import LookupSelect from './LookupSelect.vue';
import PointPicker from './PointPicker.vue';
import { lookupService } from '@/services/api/planning.api.js';
import { TIPOS_DE_SERVICO, exigeCliente, formularioVazio, validarServico } from '@/domain/planning/services.js';

/**
 * Criar Serviço (DEMANDA, v2.1): um tipo (COLETA / TRANSFERÊNCIA / DISTRIBUIÇÃO) + um local real;
 * cliente (obrigatório em coleta e distribuição); pallets previstos; janela; observações.
 * Sem origem/destino: isso é do manifesto. Receber no CT do ponto final NÃO é serviço.
 */
defineProps({
    salvando: { type: Boolean, default: false },
    errosDoServidor: { type: Array, default: () => [] },
});

const emit = defineEmits(['salvar', 'cancelar']);

const f = reactive(formularioVazio());
const tentou = ref(false);
const erros = computed(() => (tentou.value ? validarServico(f) : {}));

// Serviço = tipo + local: o texto do local muda com o tipo; origem/destino são do manifesto.
const tituloDoLocal = computed(() => ({
    coleta: 'Local da coleta',
    distribuicao: 'Local da entrega (cliente)',
    transferencia: 'Local da transferência (CT / filial)',
}[f.tipo] ?? 'Local do serviço'));

function enviar() {
    tentou.value = true;
    if (Object.keys(validarServico(f)).length > 0) return;
    emit('salvar', { ...f });
}
</script>

<template>
    <form class="form" @submit.prevent="enviar">
        <fieldset class="form__tipos">
            <legend class="lookup__titulo">Tipo de serviço</legend>
            <label v-for="t in TIPOS_DE_SERVICO" :key="t.id" class="form__tipo">
                <input v-model="f.tipo" type="radio" name="tipo-servico" :value="t.id" />
                {{ t.rotulo }}
            </label>
            <small v-if="erros.tipo" class="lookup__mensagem">{{ erros.tipo }}</small>
        </fieldset>

        <PointPicker v-model="f.local" :titulo="tituloDoLocal" :erro="erros.local" />

        <LookupSelect
            v-model="f.cliente"
            :titulo="exigeCliente(f.tipo) ? 'Cliente (obrigatório)' : 'Cliente (opcional)'"
            placeholder="Buscar cliente"
            :buscar="(q) => lookupService.clientes(q)"
            :rotulo="(c) => c.nome ?? c.razao_social ?? `Cliente ${c.id}`"
            :detalhe="(c) => c.documento ?? ''"
            :erro="erros.cliente"
        />

        <div class="form__grade">
            <label class="form__campo">
                <span class="lookup__titulo">Pallets previstos</span>
                <input v-model="f.pallets_previstos" class="lookup__entrada" type="number" min="0" step="1" />
                <small v-if="erros.pallets_previstos" class="lookup__mensagem">{{ erros.pallets_previstos }}</small>
            </label>
            <label class="form__campo">
                <span class="lookup__titulo">Janela — início</span>
                <input v-model="f.janela_inicio" class="lookup__entrada" type="datetime-local" />
            </label>
            <label class="form__campo">
                <span class="lookup__titulo">Janela — fim</span>
                <input v-model="f.janela_fim" class="lookup__entrada" type="datetime-local" />
                <small v-if="erros.janela" class="lookup__mensagem">{{ erros.janela }}</small>
            </label>
        </div>

        <label class="form__campo">
            <span class="lookup__titulo">Observações</span>
            <textarea v-model="f.observacoes" class="lookup__entrada" rows="2"></textarea>
        </label>

        <ul v-if="errosDoServidor.length" class="form__erros" role="alert">
            <li v-for="(e, i) in errosDoServidor" :key="i">{{ e }}</li>
        </ul>

        <div class="form__acoes">
            <button type="button" class="botao" @click="emit('cancelar')">Cancelar</button>
            <button type="submit" class="botao botao--primario" :disabled="salvando">{{ salvando ? 'Salvando…' : 'Criar serviço' }}</button>
        </div>
    </form>
</template>

<style scoped src="@/styles/components/operations/planning/planning.css"></style>
