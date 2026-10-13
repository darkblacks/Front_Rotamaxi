import { defineStore } from 'pinia';
import { dashboardService } from '@/services/api/dashboard.api.js';
import { listaDe, montagemService, servicosService } from '@/services/api/planning.api.js';
import { mapaService } from '@/services/api/map.api.js';
import { montarPayloadServico } from '@/domain/planning/services.js';
import { moverServico, moverServicoPara, ordemMudou, ordenarServicos, payloadDaOrdem } from '@/domain/planning/order.js';
import {
    adicionarParada, atualizarEtapa, etapasParaPayload, mensagensDeValidacao, moverParada,
    moverParaPosicao, mudou, rascunhoDeEtapas, removerParada, validarSequencia,
} from '@/domain/planning/sequence.js';

/** Serviços (lista + criação). */
export const useServicosStore = defineStore('planejamentoServicos', {
    state: () => ({
        filtros: { status: '', tipo: '', q: '' },
        servicos: [],
        filiais: [],
        carregando: false,
        falha: null,
        salvando: false,
        errosDoServidor: [],
    }),

    getters: {
        parametros(state) {
            const p = {};
            Object.entries(state.filtros).forEach(([k, v]) => { if (v) p[k] = v; });
            return p;
        },
        demandas: (state) => state.servicos.filter((s) => s.status === 'DEMANDA'),
    },

    actions: {
        definirFiltros(parcial) {
            this.filtros = { ...this.filtros, ...parcial };
        },

        async carregar() {
            this.carregando = true;
            const { ok, dados, falha } = await servicosService.listar(this.parametros);
            if (ok) {
                this.servicos = listaDe(dados);
                this.falha = null;
            } else {
                this.servicos = [];
                this.falha = falha;
            }
            this.carregando = false;
            return ok;
        },

        async carregarFiliais() {
            if (this.filiais.length > 0) return;
            const { ok, dados } = await dashboardService.agregados({});
            this.filiais = ok ? dados?.data?.filiais ?? [] : [];
        },

        async criar(formulario) {
            this.salvando = true;
            this.errosDoServidor = [];
            const { ok, falha } = await servicosService.criar(montarPayloadServico(formulario));
            this.salvando = false;
            if (!ok) {
                this.errosDoServidor = mensagensDeValidacao(falha);
                return false;
            }
            await this.carregar();
            return true;
        },
    },
});

const ESTADO_VAZIO = () => ({
    manifestoId: null,
    detalhe: null,
    rascunho: [],
    salvas: [],
    ordemServicos: [],
    ordemSalva: [],
    carregando: false,
    falha: null,
    ocupado: false,
    mensagens: [],
    servidorAvisos: [],
    demandas: [],
    veiculo: null,
    motorista: null,
});

/** Montagem de manifesto (novo ou existente). */
export const usePlanejadorStore = defineStore('planejamentoManifesto', {
    state: ESTADO_VAZIO,

    getters: {
        manifesto: (s) => s.detalhe?.manifesto ?? null,
        /** Serviços empenhados na ordem local (a que será salva). */
        servicosEmpenhados: (s) => {
            const todos = ordenarServicos(s.detalhe?.servicos).filter((x) => !['CANCELADO'].includes(x.status));
            const porId = new Map(todos.map((x) => [x.id, x]));
            const ordenados = s.ordemServicos.map((id) => porId.get(id)).filter(Boolean);
            return ordenados.length === todos.length ? ordenados : todos;
        },
        ordemSuja: (s) => ordemMudou(s.ordemServicos, s.ordemSalva),
        sujo: (s) => mudou(s.rascunho, s.salvas),
        validacao(s) {
            return validarSequencia(s.rascunho, {
                veiculo: s.veiculo ?? (s.detalhe?.manifesto?.placa ? { placa: s.detalhe.manifesto.placa } : null),
                motorista: s.motorista ?? (s.detalhe?.manifesto?.motorista_nome ? { nome: s.detalhe.manifesto.motorista_nome } : null),
                servicos: s.detalhe?.servicos ?? [],
            });
        },
        temErro() {
            return this.validacao.some((m) => m.nivel === 'erro');
        },
        editavel() {
            const status = this.manifesto?.status;
            return !status || !['fechado', 'cancelado'].includes(status);
        },
        podeLiberar() {
            return this.manifestoId !== null && this.manifesto?.status === 'disponivel' && !this.sujo && !this.ordemSuja && !this.temErro;
        },
    },

    actions: {
        reiniciar() {
            Object.assign(this, ESTADO_VAZIO());
        },

        _aplicarDetalhe(detalhe) {
            this.detalhe = detalhe;
            this.manifestoId = detalhe?.manifesto?.id ?? this.manifestoId;
            this.rascunho = rascunhoDeEtapas(detalhe?.etapas);
            this.salvas = this.rascunho.map((e) => ({ ...e }));
            this.servidorAvisos = detalhe?.avisos ?? [];
            this.ordemSalva = ordenarServicos(detalhe?.servicos).filter((x) => x.status !== 'CANCELADO').map((x) => x.id);
            this.ordemServicos = [...this.ordemSalva];
            const m = detalhe?.manifesto;
            if (m) {
                const veiculoId = m.veiculo_id ?? m.veiculo?.id ?? null;
                const motoristaId = m.motorista_id ?? m.motorista?.id ?? null;
                this.veiculo = m.placa ? { id: veiculoId, placa: m.placa, descricao: '' } : null;
                this.motorista = m.motorista_nome ? { id: motoristaId, nome: m.motorista_nome } : null;
            }
        },

        async carregar(id) {
            this.manifestoId = id;
            this.carregando = true;
            this.falha = null;
            const { ok, dados, falha } = await mapaService.manifesto(id);
            if (ok) {
                this._aplicarDetalhe(dados?.data ?? null);
            } else {
                this.falha = falha;
            }
            this.carregando = false;
            await this.carregarDemandas();
            return ok;
        },

        /** Releitura silenciosa (evento realtime / pós-ação). Não perde edição local não salva. */
        async recarregar() {
            if (this.manifestoId === null) return;
            const sujoAntes = this.sujo;
            const rascunho = this.rascunho;
            const ordemSujaAntes = this.ordemSuja;
            const ordem = this.ordemServicos;
            const { ok, dados } = await mapaService.manifesto(this.manifestoId);
            if (!ok) return;
            this._aplicarDetalhe(dados?.data ?? null);
            if (sujoAntes) this.rascunho = rascunho;
            if (ordemSujaAntes) this.ordemServicos = ordem;
            await this.carregarDemandas();
        },

        async carregarDemandas() {
            const { ok, dados } = await servicosService.listar({ status: 'DEMANDA' });
            this.demandas = ok ? listaDe(dados) : [];
        },

        /** @returns {Promise<number|null>} id criado */
        async criarManifesto({ veiculo, motorista, filialId, inicial, final, previsaoSaida, observacao }) {
            this.ocupado = true;
            this.mensagens = [];
            const payload = {
                veiculo_id: veiculo.id, motorista_id: motorista.id, filial_id: filialId,
                ponto_inicial: inicial, ponto_final: final,
                ...(previsaoSaida ? { previsao_saida: previsaoSaida } : {}),
                ...(observacao ? { observacao } : {}),
            };
            const { ok, dados, falha } = await montagemService.criar(payload);
            this.ocupado = false;
            if (!ok) {
                this.mensagens = mensagensDeValidacao(falha);
                return null;
            }
            const id = (dados?.data ?? dados)?.id ?? null;
            if (id !== null) await this.carregar(id);
            return id;
        },

        async atualizarDados(payload) {
            return this._acao(() => montagemService.atualizar(this.manifestoId, payload));
        },

        async salvarSequencia(motivo = '') {
            const ok = await this._acao(() => montagemService.salvarEtapas(this.manifestoId, etapasParaPayload(this.rascunho, motivo)));
            return ok;
        },

        async salvarOrdemServicos() {
            return this._acao(() => montagemService.ordenarServicos(this.manifestoId, payloadDaOrdem(this.ordemServicos).servico_ids));
        },

        async recalcularRota() {
            return this._acao(() => montagemService.recalcularRota(this.manifestoId));
        },

        async liberar() {
            return this._acao(() => montagemService.liberar(this.manifestoId));
        },

        async empenhar(servicoId) {
            return this._acao(() => servicosService.empenhar(servicoId, this.manifestoId));
        },

        async desempenhar(servicoId) {
            return this._acao(() => servicosService.desempenhar(servicoId));
        },

        async _acao(chamada) {
            this.ocupado = true;
            this.mensagens = [];
            const { ok, dados, falha } = await chamada();
            if (!ok) {
                this.mensagens = mensagensDeValidacao(falha);
            } else {
                const avisos = dados?.avisos ?? dados?.data?.avisos;
                if (Array.isArray(avisos) && avisos.length) this.servidorAvisos = avisos;
                await this._recarregarAposAcao();
            }
            this.ocupado = false;
            return ok;
        },

        async _recarregarAposAcao() {
            const { ok, dados } = await mapaService.manifesto(this.manifestoId);
            if (ok) {
                const avisos = this.servidorAvisos;
                this._aplicarDetalhe(dados?.data ?? null);
                if (avisos.length && !(dados?.data?.avisos ?? []).length) this.servidorAvisos = avisos;
            }
            await this.carregarDemandas();
        },

        // Edição local do rascunho.
        adicionarParada(parada) { this.rascunho = adicionarParada(this.rascunho, parada); },
        removerParada(chave) { this.rascunho = removerParada(this.rascunho, chave); },
        moverServico(id, delta) { this.ordemServicos = moverServico(this.ordemServicos, id, delta); },
        arrastarServico(origem, destino) { this.ordemServicos = moverServicoPara(this.ordemServicos, origem, destino); },
        descartarOrdem() { this.ordemServicos = [...this.ordemSalva]; },
        mover(chave, delta) { this.rascunho = moverParada(this.rascunho, chave, delta); },
        arrastar(origem, destino) { this.rascunho = moverParaPosicao(this.rascunho, origem, destino); },
        editar(chave, campos) { this.rascunho = atualizarEtapa(this.rascunho, chave, campos); },
        descartar() { this.rascunho = this.salvas.map((e) => ({ ...e })); },
    },
});
