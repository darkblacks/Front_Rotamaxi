<script setup>
import { onMounted, ref } from 'vue';
import BadgeDeStatus from '@/components/all/ui/StatusBadge.vue';
import EstadoVazio from '@/components/all/ui/EmptyState.vue';
import PainelCard from '@/components/all/ui/BaseCard.vue';
import TabelaDoPainel from '@/components/all/tables/BaseTable.vue';
import { dataEHora } from '@/utils/format.js';
import { useDispositivosStore } from '@/stores/devices.store.js';

/**
 * Administração de dispositivos (US-9.3, US-1.4).
 *
 * A tela lista os aparelhos ativos **por usuário**, com o último `pull` de cada um, e revoga
 * um aparelho por vez: escolher, escrever o motivo e confirmar. A confirmação nomeia o
 * aparelho e o dono — revogar o telefone errado tira da rua quem estava trabalhando.
 *
 * Revogar não apaga nada do que aquele aparelho enviou. O histórico embaixo mostra quem
 * tirou o acesso, quando e por quê, e não é editável por esta tela.
 */
const dispositivos = useDispositivosStore();

const alvo = ref(null);
const motivo = ref('');

const COLUNAS = [
    { chave: 'dispositivo', rotulo: 'Aparelho' },
    { chave: 'ultimo_pull', rotulo: 'Último pull', largura: '170px' },
    { chave: 'criado_em', rotulo: 'Conectado em', largura: '170px' },
    { chave: 'acoes', rotulo: '', alinhamento: 'right', largura: '120px' },
];

const COLUNAS_DO_HISTORICO = [
    { chave: 'usuario', rotulo: 'Usuário' },
    { chave: 'motivo', rotulo: 'Motivo' },
    { chave: 'autor', rotulo: 'Revogado por' },
    { chave: 'revogado_em', rotulo: 'Revogado em', largura: '170px' },
];

function pedirRevogacao(grupo, dispositivo) {
    alvo.value = { ...dispositivo, dono: grupo.nome };
    motivo.value = '';
}

function cancelar() {
    alvo.value = null;
    motivo.value = '';
}

async function confirmar() {
    const revogado = await dispositivos.revogar(
        alvo.value.usuarioId,
        alvo.value.id,
        motivo.value.trim(),
    );

    if (revogado) {
        cancelar();
    }
}

onMounted(() => dispositivos.carregar());
</script>

<template>
    <section class="pagina">
        <div class="pagina__cabecalho">
            <h1 class="pagina__titulo">Dispositivos</h1>
            <span class="pagina__recorte">{{ dispositivos.dispositivos.length }} aparelhos ativos</span>
        </div>

        <div v-if="dispositivos.falha" class="pagina__falha" role="alert">
            <span>{{ dispositivos.falha.mensagem }}</span>
            <button type="button" class="pagina__botao" @click="dispositivos.carregar()">Tentar de novo</button>
        </div>

        <EstadoVazio
            v-else-if="dispositivos.carregando && dispositivos.dispositivos.length === 0"
            mensagem="Carregando os dispositivos…"
            tracejado
        />

        <EstadoVazio
            v-else-if="dispositivos.vazia"
            mensagem="Nenhum aparelho ativo no momento."
            tracejado
        />

        <PainelCard
            v-for="grupo in dispositivos.porUsuario"
            v-else
            :key="grupo.usuarioId"
            :titulo="grupo.nome"
            :data-usuario="grupo.usuarioId"
        >
            <template #acoes>
                <BadgeDeStatus :rotulo="grupo.papel" tom="info" />
                <span class="pagina__recorte">
                    último pull {{ grupo.ultimoPullEm === null ? 'nunca' : dataEHora(grupo.ultimoPullEm) }}
                </span>
            </template>

            <TabelaDoPainel :colunas="COLUNAS" :largura-minima="620">
                <tr v-for="dispositivo in grupo.dispositivos" :key="dispositivo.id" data-dispositivo>
                    <td class="dispositivo__nome">{{ dispositivo.nome }}</td>
                    <td>{{ dispositivo.ultimoPullEm === null ? 'nunca' : dataEHora(dispositivo.ultimoPullEm) }}</td>
                    <td>{{ dataEHora(dispositivo.criadoEm) }}</td>
                    <td class="dispositivo__acoes">
                        <button
                            type="button"
                            class="pagina__botao"
                            data-acao="revogar"
                            :disabled="dispositivos.revogando === dispositivo.id"
                            @click="pedirRevogacao(grupo, dispositivo)"
                        >
                            Revogar
                        </button>
                    </td>
                </tr>
            </TabelaDoPainel>
        </PainelCard>

        <PainelCard titulo="Histórico de revogações">
            <EstadoVazio
                v-if="dispositivos.historico.length === 0"
                mensagem="Nenhuma revogação registrada."
                tracejado
            />

            <!-- O histórico é registro: a tela o mostra e não o edita. -->
            <TabelaDoPainel v-else :colunas="COLUNAS_DO_HISTORICO" :largura-minima="700">
                <tr v-for="linha in dispositivos.historico" :key="linha.id" data-revogacao>
                    <td>{{ linha.usuario }}</td>
                    <td>{{ linha.motivo }}</td>
                    <td>{{ linha.autor }}</td>
                    <td>{{ dataEHora(linha.revogadoEm) }}</td>
                </tr>
            </TabelaDoPainel>
        </PainelCard>

        <div v-if="alvo" class="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-revogacao">
            <div class="modal__caixa">
                <h2 id="titulo-revogacao" class="modal__titulo">Revogar dispositivo</h2>

                <p class="modal__pergunta">
                    Revogar <strong>{{ alvo.nome }}</strong> de <strong>{{ alvo.dono }}</strong>?
                    Os demais aparelhos dele continuam funcionando, e nada do que este enviou é apagado.
                </p>

                <div v-if="dispositivos.falhaDaRevogacao" class="modal__falha" role="alert">
                    {{ dispositivos.falhaDaRevogacao.mensagem }}
                </div>

                <label class="modal__campo">
                    <span class="modal__rotulo">Motivo</span>
                    <textarea
                        v-model="motivo"
                        class="modal__controle"
                        rows="2"
                        data-campo="motivo"
                        placeholder="Aparelho perdido, troca de telefone, desligamento…"
                    ></textarea>
                </label>

                <div class="modal__acoes">
                    <button type="button" class="pagina__botao" @click="cancelar">Cancelar</button>
                    <button
                        type="button"
                        class="pagina__botao pagina__botao--perigo"
                        data-acao="confirmar-revogacao"
                        :disabled="dispositivos.revogando !== null"
                        @click="confirmar"
                    >
                        {{ dispositivos.revogando !== null ? 'Revogando…' : 'Confirmar revogação' }}
                    </button>
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped src="@/styles/pages/settings/devices_page.css"></style>
