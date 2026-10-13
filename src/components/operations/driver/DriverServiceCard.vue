<script setup>
import { badgeDoServico } from '@/domain/planning/status.js';
import { localDoServico, rotuloDoTipo, tipoDoServico } from '@/domain/planning/services.js';
import { computed, ref } from 'vue';
import StatusBadge from '@/components/all/ui/StatusBadge.vue';
import { pendenciasDaConclusao, servicoAberto, TIPOS_DE_CANHOTO, validarArquivoDoCanhoto } from '@/domain/operations/driver.js';
import { rotulo } from '@/domain/operations/text.js';

/**
 * Um serviço do manifesto. Distribuição se conclui com descarga confirmada + canhoto
 * (foto pela câmera ou arquivo). Coleta e transferência não pedem descarga nem canhoto.
 */
const props = defineProps({
    servico: { type: Object, required: true },
    ocupado: { type: Boolean, default: false },
    passo: { type: String, default: null },
    podeOperar: { type: Boolean, default: true },
});

const emit = defineEmits(['concluir']);

const descarga = ref(false);
const arquivo = ref(null);
const erroDoArquivo = ref('');
const aberto = computed(() => servicoAberto(props.servico));
const ehDistribuicao = computed(() => tipoDoServico(props.servico) === 'distribuicao');
const tipos = computed(() => [rotuloDoTipo(tipoDoServico(props.servico)), localDoServico(props.servico)?.nome].filter(Boolean).join(' · ') || 'serviço');
const pendencias = computed(() => pendenciasDaConclusao(props.servico, { descarga: descarga.value, canhotoAnexoId: arquivo.value ? 'novo' : null }));
const nomeDoCliente = computed(() => rotulo(props.servico.cliente ?? props.servico.cliente_nome, ''));

function escolher(evento) {
    const arq = evento.target.files?.[0] ?? null;
    erroDoArquivo.value = arq ? (validarArquivoDoCanhoto(arq) ?? '') : '';
    arquivo.value = erroDoArquivo.value ? null : arq;
}
</script>

<template>
    <article class="servico" :data-servico="servico.id">
        <header class="servico__topo">
            <strong class="servico__titulo">{{ servico.descricao || tipos }}</strong>
            <StatusBadge :rotulo="`Serviço: ${badgeDoServico(servico).rotulo}`" :tom="badgeDoServico(servico).tom" />
        </header>
        <p class="servico__meta">{{ tipos }}<template v-if="nomeDoCliente"> · {{ nomeDoCliente }}</template></p>

        <p v-if="aberto && !ehDistribuicao" class="campo__dica" data-aviso="sem-descarga">Este serviço não pede descarga nem canhoto ao motorista.</p>

        <form v-if="aberto && podeOperar && ehDistribuicao" class="form" @submit.prevent>
            <label class="servico__check">
                <input v-model="descarga" type="checkbox" :disabled="ocupado" />
                <span>Descarga concluída</span>
            </label>

            <div v-if="ehDistribuicao" class="campo">
                <label class="campo__rotulo" :for="`canhoto-${servico.id}`">Canhoto (foto ou arquivo)</label>
                <input
                    :id="`canhoto-${servico.id}`"
                    class="campo__entrada"
                    type="file"
                    :accept="TIPOS_DE_CANHOTO.join(',')"
                    capture="environment"
                    :disabled="ocupado"
                    @change="escolher"
                />
                <span v-if="erroDoArquivo" class="campo__erro">{{ erroDoArquivo }}</span>
                <span v-else-if="arquivo" class="campo__dica">{{ arquivo.name }}</span>
                <span v-else-if="servico.canhoto_anexo_id" class="campo__dica">Canhoto já anexado.</span>
            </div>

            <ul v-if="pendencias.length" class="lista-simples">
                <li v-for="p in pendencias" :key="p">{{ p }}</li>
            </ul>
            <p v-if="passo" class="aviso aviso--info" role="status">{{ passo }}</p>

            <button type="button" class="botao botao--ok botao--grande" :disabled="ocupado || pendencias.length > 0" data-acao="concluir" @click="emit('concluir', { descarga, arquivo })">
                Concluir serviço
            </button>
        </form>
    </article>
</template>

<style scoped src="@/styles/components/operations/shared/operation_form.css"></style>
<style scoped src="@/styles/components/operations/driver/driver_manifest.css"></style>
