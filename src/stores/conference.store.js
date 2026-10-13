import { defineStore } from 'pinia';
import { conferenciaService } from '@/services/api/operations.api.js';
import { corpoDaConferencia, normalizarItemDaFila } from '@/domain/operations/conference.js';

/** Resposta lenta de um status não pode sobrescrever a lista do status atual. */
let tokenDaLista = 0;

/**
 * Fila do Conferente (Coleta). O backend filtra por escopo/filial do usuário; a tela só
 * escolhe o status e trabalha uma etapa por vez.
 */
export const useConferenciaStore = defineStore('conferencia', {
    state: () => ({
        status: 'aguardando',
        itens: [],
        carregando: false,
        falha: null,
        selecionadaId: null,
        salvando: false,
        erroDaAcao: null,
        aviso: null,
    }),

    getters: {
        selecionada: (state) => state.itens.find((i) => i.etapaId === state.selecionadaId) ?? null,
        manifestoIds: (state) => [...new Set(state.itens.map((i) => i.manifestoId).filter((id) => id != null))],
    },

    actions: {
        definirStatus(status) {
            if (status === this.status) return false;
            this.status = status;
            this.selecionadaId = null;
            this.aviso = null;
            this.erroDaAcao = null;
            return true;
        },

        selecionar(etapaId) {
            this.selecionadaId = etapaId;
            this.erroDaAcao = null;
            this.aviso = null;
        },

        async carregar() {
            const token = ++tokenDaLista;
            this.carregando = this.itens.length === 0;
            const { ok, dados, falha } = await conferenciaService.fila({ status: this.status });
            if (token !== tokenDaLista) return false;
            if (ok) {
                this.itens = (dados?.data ?? []).map(normalizarItemDaFila);
                this.falha = null;
                if (this.selecionadaId !== null && !this.itens.some((i) => i.etapaId === this.selecionadaId)) {
                    this.selecionadaId = null;
                }
            } else {
                this.falha = falha;
            }
            this.carregando = false;
            return ok;
        },

        /** Salva campos parciais da conferência (equipe, pallets, tempos, observações). */
        async salvar(etapaId, formulario) {
            this.salvando = true;
            this.erroDaAcao = null;
            const { ok, falha } = await conferenciaService.registrar(etapaId, corpoDaConferencia(formulario));
            this.salvando = false;
            if (!ok) {
                this.erroDaAcao = falha;
                return false;
            }
            this.aviso = 'Conferência salva.';
            await this.carregar();
            return true;
        },

        /** Aceite do Conferente: salva o que estiver na tela e depois aceita a quantidade. */
        async aceitar(etapaId, formulario) {
            this.salvando = true;
            this.erroDaAcao = null;
            const salvo = await conferenciaService.registrar(etapaId, corpoDaConferencia(formulario));
            if (!salvo.ok) {
                this.salvando = false;
                this.erroDaAcao = salvo.falha;
                return false;
            }
            const { ok, falha } = await conferenciaService.aceitar(etapaId, Number(formulario.pallets));
            this.salvando = false;
            if (!ok) {
                this.erroDaAcao = falha;
                return false;
            }
            this.aviso = 'Carga aceita. O motorista já pode assumir os pallets.';
            await this.carregar();
            return true;
        },
    },
});
