import { defineStore } from 'pinia';
import { ocorrenciasMapaService } from '@/services/api/operations.api.js';
import { aplicarEventoDeOcorrencia, corpoDaTratativa, normalizarOcorrencia } from '@/domain/operations/occurrences.js';

const FILTROS_VAZIOS = () => ({ status: 'aberta', tipo: '', severidade: '', manifestoId: '', filialId: '', de: '', ate: '' });

let tokenDaLista = 0;

/** Ocorrências do Mapa Operacional (`/mapa/ocorrencias`) para o SAC tratar. */
export const useOcorrenciasMapaStore = defineStore('ocorrenciasMapa', {
    state: () => ({
        filtros: FILTROS_VAZIOS(),
        itens: [],
        carregando: false,
        falha: null,
        selecionadaId: null,
        detalhe: null,
        carregandoDetalhe: false,
        tratando: false,
        erroDaAcao: null,
        aviso: null,
    }),

    getters: {
        parametros(state) {
            const f = state.filtros;
            const p = {};
            if (f.status) p.status = f.status;
            if (f.tipo) p.tipo = f.tipo;
            if (f.severidade) p.severidade = f.severidade;
            if (f.manifestoId) p.manifesto_id = f.manifestoId;
            if (f.filialId) p.filial_id = f.filialId;
            if (f.de) p.de = f.de;
            if (f.ate) p.ate = f.ate;
            return p;
        },
        selecionada: (state) => state.detalhe ?? state.itens.find((o) => o.id === state.selecionadaId) ?? null,
        manifestoIds: (state) => [...new Set(state.itens.map((o) => o.manifestoId).filter((id) => id != null))],
    },

    actions: {
        definirFiltros(parcial) {
            this.filtros = { ...this.filtros, ...parcial };
        },

        limparFiltros() {
            this.filtros = FILTROS_VAZIOS();
        },

        async carregar() {
            const token = ++tokenDaLista;
            this.carregando = this.itens.length === 0;
            const { ok, dados, falha } = await ocorrenciasMapaService.lista(this.parametros);
            if (token !== tokenDaLista) return false;
            if (ok) {
                this.itens = (dados?.data ?? []).map(normalizarOcorrencia);
                this.falha = null;
            } else {
                this.falha = falha;
            }
            this.carregando = false;
            return ok;
        },

        async selecionar(id) {
            this.selecionadaId = id;
            this.detalhe = null;
            this.erroDaAcao = null;
            this.aviso = null;
            if (id === null) return;
            await this.carregarDetalhe();
        },

        async carregarDetalhe() {
            const id = this.selecionadaId;
            if (id === null) return false;
            this.carregandoDetalhe = this.detalhe === null;
            const { ok, dados } = await ocorrenciasMapaService.detalhe(id);
            if (id !== this.selecionadaId) return false;
            if (ok) this.detalhe = normalizarOcorrencia(dados?.data ?? dados);
            this.carregandoDetalhe = false;
            return ok;
        },

        /** Evento realtime: atualiza a linha na hora; a releitura agrupada reconcilia. */
        aplicarEvento(payload) {
            this.itens = aplicarEventoDeOcorrencia(this.itens, payload);
            const id = (payload?.ocorrencia ?? payload)?.id;
            if (id !== undefined && id === this.selecionadaId) this.carregarDetalhe();
        },

        /** assumir | encaminhar | comentar | resolver. */
        async tratar(acao, texto, destino) {
            const { corpo, erro } = corpoDaTratativa(acao, texto, destino);
            if (erro) {
                this.erroDaAcao = { mensagem: erro };
                return false;
            }
            this.tratando = true;
            this.erroDaAcao = null;
            const { ok, falha } = await ocorrenciasMapaService.tratar(this.selecionadaId, corpo);
            this.tratando = false;
            if (!ok) {
                this.erroDaAcao = falha;
                return false;
            }
            this.aviso = 'Tratativa registrada.';
            await Promise.all([this.carregar(), this.carregarDetalhe()]);
            return true;
        },
    },
});
