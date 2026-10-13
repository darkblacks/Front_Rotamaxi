<script setup>
import { ref } from 'vue';
import EstadoVazio from '@/components/all/ui/EmptyState.vue';
import { dataEHora } from '@/utils/format.js';
import { manifestoService } from '@/services/api/manifests.api.js';

/**
 * Miniaturas dos anexos do manifesto (US-8.4, US-6.2).
 *
 * O bucket nunca é público: a imagem só abre por URL assinada de validade curta, e a URL é
 * pedida **sob demanda**, no clique da miniatura. Assinar tudo na abertura da tela entregaria
 * URL vencida justamente para a miniatura que ninguém abriu, e gastaria assinatura em anexo
 * que o admin nem olhou.
 */
const props = defineProps({
    linhas: { type: Array, default: () => [] },
    carregando: { type: Boolean, default: false },
});

/** Anexo aberto agora, com a URL que acabou de ser assinada. */
const aberto = ref(null);

const pedindo = ref(null);

const falha = ref(null);

async function abrir(anexo) {
    if (aberto.value?.id === anexo.id) {
        aberto.value = null;

        return;
    }

    pedindo.value = anexo.id;
    falha.value = null;

    const { ok, dados, falha: erro } = await manifestoService.urlDeAnexo(anexo.id);

    pedindo.value = null;

    if (! ok) {
        aberto.value = null;
        falha.value = erro;

        return;
    }

    aberto.value = {
        id: anexo.id,
        descricao: anexo.descricao,
        url: dados.leitura?.url ?? null,
        expiraEm: dados.leitura?.expira_em ?? null,
        mimeType: dados.data?.mime_type ?? anexo.mimeType,
    };
}

function ehImagem(mimeType) {
    return typeof mimeType === 'string' && mimeType.startsWith('image/');
}

defineExpose({ abrir });
</script>

<template>
    <EstadoVazio v-if="carregando" mensagem="Carregando os anexos…" tracejado />

    <EstadoVazio
        v-else-if="props.linhas.length === 0"
        mensagem="Nenhum anexo confirmado neste manifesto."
        tracejado
    />

    <div v-else class="anexos">
        <div v-if="falha" class="anexos__falha" role="alert">{{ falha.mensagem }}</div>

        <ul class="anexos__grade">
            <li v-for="anexo in props.linhas" :key="anexo.id" class="anexo">
                <button
                    type="button"
                    class="anexo__miniatura"
                    :data-anexo="anexo.id"
                    :disabled="pedindo === anexo.id"
                    @click="abrir(anexo)"
                >
                    <span class="anexo__icone" aria-hidden="true">{{ ehImagem(anexo.mimeType) ? '▣' : '▤' }}</span>
                    <span class="anexo__descricao">{{ anexo.descricao }}</span>
                    <small class="anexo__quando">{{ dataEHora(anexo.enviadoEm) }}</small>
                    <small class="anexo__acao">{{ pedindo === anexo.id ? 'assinando…' : 'abrir' }}</small>
                </button>
            </li>
        </ul>

        <figure v-if="aberto" class="aberto">
            <img v-if="ehImagem(aberto.mimeType)" class="aberto__imagem" :src="aberto.url" :alt="aberto.descricao">
            <figcaption class="aberto__legenda">
                <a class="aberto__link" :href="aberto.url" target="_blank" rel="noopener">
                    {{ aberto.descricao }}
                </a>
                <small>URL assinada expira em {{ dataEHora(aberto.expiraEm) }}</small>
            </figcaption>
        </figure>
    </div>
</template>

<style scoped src="@/styles/components/operations/manifests/manifest_attachments.css"></style>
