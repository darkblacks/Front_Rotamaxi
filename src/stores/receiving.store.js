import { defineStore } from 'pinia';
import { palletsService, recebimentoService } from '@/services/api/operations.api.js';
import { corpoDoRecebimento, normalizarRecebimento } from '@/domain/operations/receiving.js';

let tokenDaLista = 0;
let tokenDaCadeia = 0;

/** Recebimentos do CT: lista por situação e detalhe com a cadeia de pallets. */
export const useRecebimentosStore = defineStore('recebimentos', {
    state: () => ({
        status: 'aguardando',
        itens: [],
        carregando: false,
        falha: null,
        selecionadoId: null,
        cadeia: null,
        carregandoCadeia: false,
        falhaDaCadeia: null,
        salvando: false,
        erroDaAcao: null,
        aviso: null,
    }),

    getters: {
        selecionado: (state) => state.itens.find((i) => i.manifestoId === state.selecionadoId) ?? null,
        manifestoIds: (state) => [...new Set(state.itens.map((i) => i.manifestoId).filter((id) => id != null))],
    },

    actions: {
        definirStatus(status) {
            if (status === this.status) return false;
            this.status = status;
            this.selecionadoId = null;
            this.cadeia = null;
            this.aviso = null;
            this.erroDaAcao = null;
            return true;
        },

        async carregar() {
            const token = ++tokenDaLista;
            this.carregando = this.itens.length === 0;
            const { ok, dados, falha } = await recebimentoService.lista({ status: this.status });
            if (token !== tokenDaLista) return false;
            if (ok) {
                this.itens = (dados?.data ?? []).map(normalizarRecebimento);
                this.falha = null;
                if (this.selecionadoId !== null && !this.itens.some((i) => i.manifestoId === this.selecionadoId)) {
                    this.selecionadoId = null;
                    this.cadeia = null;
                } else if (this.selecionadoId !== null) {
                    this.carregarCadeia();
                }
            } else {
                this.falha = falha;
            }
            this.carregando = false;
            return ok;
        },

        async selecionar(manifestoId) {
            this.selecionadoId = manifestoId;
            this.cadeia = null;
            this.erroDaAcao = null;
            this.aviso = null;
            await this.carregarCadeia();
        },

        /** Cadeia completa (com autor e hora de cada elo); a lista só traz as quantidades. */
        async carregarCadeia() {
            const id = this.selecionadoId;
            if (id === null) return false;
            const token = ++tokenDaCadeia;
            this.carregandoCadeia = this.cadeia === null;
            const { ok, dados, falha } = await palletsService.cadeia(id);
            if (token !== tokenDaCadeia || id !== this.selecionadoId) return false;
            if (ok) {
                this.cadeia = dados?.data?.pallets ?? dados?.data ?? null;
                this.falhaDaCadeia = null;
            } else {
                this.falhaDaCadeia = falha;
            }
            this.carregandoCadeia = false;
            return ok;
        },

        /** Registra o recebido e dá o aceite do CT (fecha a custódia). Divergência não bloqueia. */
        async aceitar(manifestoId, formulario) {
            this.salvando = true;
            this.erroDaAcao = null;
            const recebido = await recebimentoService.receber(manifestoId, corpoDoRecebimento(formulario));
            if (!recebido.ok) {
                this.salvando = false;
                this.erroDaAcao = recebido.falha;
                return false;
            }
            const { ok, falha } = await recebimentoService.aceitar(manifestoId, Number(formulario.recebido));
            this.salvando = false;
            if (!ok) {
                this.erroDaAcao = falha;
                // O recebido já foi gravado: relê para mostrar o estado real.
                this.carregar();
                return false;
            }
            this.aviso = 'Recebimento aceito. A custódia foi fechada no CT.';
            await this.carregar();
            return true;
        },
    },
});
