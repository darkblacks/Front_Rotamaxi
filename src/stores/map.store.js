import { defineStore } from 'pinia';
import { mapaService } from '@/services/api/map.api.js';
import { dashboardService } from '@/services/api/dashboard.api.js';
import { aplicarDelta, EVENTOS_DO_MANIFESTO, EVENTOS_QUE_RELEEM } from '@/domain/map/merge.js';
import { mesclarPosicao } from '@/domain/map/positions.js';
import { atrasoDaEtapa } from '@/domain/map/delay.js';
import { ordenarEtapas } from '@/domain/map/stages.js';
import { useTempoRealStore } from '@/stores/realtime.store.js';

/** Quantos manifestos da lista recebem assinatura realtime além do selecionado. */
export const LIMITE_DE_ASSINATURAS = 15;

/** Intervalo do fallback quando o socket está indisponível (nunca menor que 30s). */
export const INTERVALO_FALLBACK_MS = 30000;

const FILTROS_VAZIOS = () => ({ filialId: null, status: '', motorista: '', placa: '', q: '' });

/** Assinaturas vivas por manifesto: id -> { cancelar, ouvintes }. Fora do estado reativo. */
const assinaturas = new Map();

/** Evita resposta antiga sobrescrever a nova quando o usuário troca de manifesto rápido. */
let tokenDoDetalhe = 0;

export const useMapaStore = defineStore('mapaOperacional', {
    state: () => ({
        filtros: FILTROS_VAZIOS(),
        somenteAtivos: true,
        mostrar: { veiculos: true, celulares: true, pontos: true },
        manifestos: [],
        filiais: [],
        selecionadoId: null,
        detalhe: null,
        carregandoLista: false,
        carregandoDetalhe: false,
        falhaLista: null,
        falhaDetalhe: null,
        ultimaAtualizacao: null,
    }),

    getters: {
        parametros(state) {
            const f = state.filtros;
            const p = {};
            if (f.filialId !== null) p.filial_id = f.filialId;
            if (f.status) p.status = f.status;
            if (f.motorista) p.motorista = f.motorista;
            if (f.placa) p.placa = f.placa;
            if (f.q) p.q = f.q;
            if (state.somenteAtivos) p.somente_ativos = 1;
            return p;
        },

        manifestoSelecionado(state) {
            return state.detalhe?.manifesto ?? state.manifestos.find((m) => m.id === state.selecionadoId) ?? null;
        },

        etapas(state) {
            return ordenarEtapas(state.detalhe?.etapas);
        },

        /** Etapa que ainda não terminou e tem maior atraso previsto: alimenta o EtaAlertCard. */
        etapaEmAtraso() {
            const abertas = this.etapas.filter((e) => !['CONCLUIDA', 'PULADA', 'CANCELADA'].includes(e.status));
            let pior = null;
            for (const e of abertas) {
                const atraso = atrasoDaEtapa(e);
                if (atraso > 0 && (pior === null || atraso > pior.atraso)) pior = { etapa: e, atraso };
            }
            return pior;
        },

        ocorrenciasAbertas(state) {
            return (state.detalhe?.ocorrencias ?? []).filter((o) => (o.status ?? 'aberta') === 'aberta');
        },

        idsParaAssinar(state) {
            const ids = state.manifestos.slice(0, LIMITE_DE_ASSINATURAS).map((m) => m.id);
            if (state.selecionadoId !== null && !ids.includes(state.selecionadoId)) ids.push(state.selecionadoId);
            return ids;
        },
    },

    actions: {
        definirFiltros(parcial) {
            this.filtros = { ...this.filtros, ...parcial };
        },

        limparFiltros() {
            this.filtros = FILTROS_VAZIOS();
        },

        async carregarFiliais() {
            if (this.filiais.length > 0) return;
            const { ok, dados } = await dashboardService.agregados({});
            this.filiais = ok ? dados?.data?.filiais ?? [] : [];
        },

        async carregarLista() {
            this.carregandoLista = true;
            const { ok, dados, falha } = await mapaService.manifestos(this.parametros);
            if (ok) {
                this.manifestos = dados?.data ?? [];
                this.falhaLista = null;
                this.ultimaAtualizacao = new Date().toISOString();
                // Selecionado sumiu do recorte: mantém o detalhe aberto, mas não o apaga sozinho.
                if (this.selecionadoId === null && this.manifestos.length === 1) {
                    await this.selecionar(this.manifestos[0].id);
                }
            } else {
                this.manifestos = [];
                this.falhaLista = falha;
            }
            this.carregandoLista = false;
            this.sincronizarAssinaturas();
            return ok;
        },

        async selecionar(id) {
            this.selecionadoId = id ?? null;
            this.detalhe = null;
            this.falhaDetalhe = null;
            if (id === null || id === undefined) {
                this.sincronizarAssinaturas();
                return;
            }
            this.sincronizarAssinaturas();
            await this.carregarDetalhe();
        },

        /** Refaz o GET completo do manifesto selecionado (reconexão, fallback, rota nova). */
        async carregarDetalhe() {
            const id = this.selecionadoId;
            if (id === null) return false;
            const token = ++tokenDoDetalhe;
            this.carregandoDetalhe = this.detalhe === null;
            const { ok, dados, falha } = await mapaService.manifesto(id);
            if (token !== tokenDoDetalhe) return false;
            if (ok) {
                this.detalhe = dados?.data ?? null;
                this.falhaDetalhe = null;
                this.ultimaAtualizacao = new Date().toISOString();
            } else {
                this.falhaDetalhe = falha;
            }
            this.carregandoDetalhe = false;
            return ok;
        },

        /** Recarrega lista e detalhe (botão, reconexão, fallback lento). */
        async recarregarTudo() {
            await Promise.all([this.carregarLista(), this.selecionadoId !== null ? this.carregarDetalhe() : null]);
        },

        /** Aplica um delta realtime do manifesto `manifestoId`. */
        aplicarEvento(manifestoId, nome, payload) {
            if (EVENTOS_QUE_RELEEM.includes(nome)) {
                if (manifestoId === this.selecionadoId) this.carregarDetalhe();
                return;
            }

            if (manifestoId === this.selecionadoId && this.detalhe) {
                this.detalhe = aplicarDelta(this.detalhe, nome, payload);
            }

            // O resumo na lista (e o marcador de quem não está selecionado) também acompanha.
            this.manifestos = this.manifestos.map((m) => {
                if (m.id !== manifestoId) return m;
                if (nome === 'tracking.position.updated') {
                    return { ...m, ultima_posicao: mesclarPosicao(m.ultima_posicao, payload) };
                }
                if ((nome === 'manifest.eta.updated' || nome === 'manifest.delay.detected') && payload.atraso_minutos !== undefined) {
                    return { ...m, atraso_minutos: payload.atraso_minutos };
                }
                if (nome === 'manifest.occurrence.created') {
                    return { ...m, ocorrencias_abertas: (m.ocorrencias_abertas ?? 0) + 1 };
                }
                return m;
            });
        },

        /** Acerta as assinaturas `manifesto.{id}` com os manifestos exibidos/selecionado. */
        sincronizarAssinaturas() {
            const tempoReal = useTempoRealStore();
            const desejados = new Set(this.idsParaAssinar);

            for (const id of [...assinaturas.keys()]) {
                if (!desejados.has(id)) {
                    assinaturas.get(id).cancelar();
                    assinaturas.delete(id);
                }
            }

            for (const id of desejados) {
                if (assinaturas.has(id)) continue;
                const ouvintes = {};
                EVENTOS_DO_MANIFESTO.forEach((nome) => {
                    ouvintes[nome] = (payload) => this.aplicarEvento(id, nome, payload ?? {});
                });
                assinaturas.set(id, { cancelar: tempoReal.assinarManifesto(id, ouvintes) });
            }
        },

        /** Reassina tudo (ex.: o socket subiu depois da montagem; assinar sem Echo é no-op). */
        reassinar() {
            this.cancelarAssinaturas();
            this.sincronizarAssinaturas();
        },

        cancelarAssinaturas() {
            for (const { cancelar } of assinaturas.values()) cancelar();
            assinaturas.clear();
        },
    },
});
