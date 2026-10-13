import { defineStore } from 'pinia';
import { dashboardService } from '@/services/api/dashboard.api.js';
import { manifestoService } from '@/services/api/manifests.api.js';

/**
 * Status da divergência, na ordem do ciclo, com o tom do design.
 *
 * `aberta` é o estado de nascimento e também o destino da reabertura; por isso ele aparece
 * tanto no filtro quanto entre os destinos de decisão.
 */
export const STATUS_DA_DIVERGENCIA = [
    { slug: 'aberta', rotulo: 'Aberta', tom: 'bad' },
    { slug: 'justificada', rotulo: 'Justificada', tom: 'warn' },
    { slug: 'resolvida', rotulo: 'Resolvida', tom: 'ok' },
];

/**
 * Tipos semeados em `tipos_divergencia`. A lista é do domínio e não muda com o recorte,
 * então ela é o menu do filtro e do registro manual.
 */
export const TIPOS_DE_DIVERGENCIA = [
    { slug: 'pallet', rotulo: 'Pallet' },
    { slug: 'km', rotulo: 'KM' },
    { slug: 'carga', rotulo: 'Carga' },
];

/**
 * Quantas divergências o servidor manda por página.
 */
export const DIVERGENCIAS_POR_PAGINA = 25;

/**
 * Quantos manifestos o seletor do registro manual oferece. O modal é para o caso avulso:
 * ele lista os manifestos recentes, e não a operação inteira.
 */
export const MANIFESTOS_DO_REGISTRO = 100;

/**
 * Normaliza o recorte da lista vindo da URL.
 *
 * Como a tela 02, ela **não** assume o dia corrente: divergência aberta continua cobrando
 * depois da semana em que nasceu, e abrir já filtrada em hoje esconderia justamente o caso
 * antigo que ninguém tratou.
 *
 * @param {{ status?: string|null, tipo?: string|null, filial_id?: string|number|null, de?: string|null, ate?: string|null, page?: string|number|null }} query
 */
export function filtrosDaQueryDeDivergencias(query = {}) {
    const filial = Number.parseInt(query.filial_id, 10);
    const pagina = Number.parseInt(query.page, 10);
    const de = texto(query.de);
    const ate = texto(query.ate);

    return {
        status: STATUS_DA_DIVERGENCIA.some((status) => status.slug === query.status) ? query.status : null,
        tipo: TIPOS_DE_DIVERGENCIA.some((tipo) => tipo.slug === query.tipo) ? query.tipo : null,
        filialId: Number.isInteger(filial) && filial > 0 ? filial : null,
        de,
        // Período invertido na URL responderia 422; a tela conserta antes de pedir.
        ate: de !== null && ate !== null && ate < de ? de : ate,
        pagina: Number.isInteger(pagina) && pagina > 0 ? pagina : 1,
    };
}

function texto(valor) {
    return typeof valor === 'string' && valor !== '' ? valor : null;
}

/**
 * Tom do badge de um status, para a lista e o detalhe falarem a mesma língua.
 */
export function tomDoStatus(slug) {
    return STATUS_DA_DIVERGENCIA.find((status) => status.slug === slug)?.tom ?? 'neutro';
}

/**
 * Estado da tela de divergências e do detalhe com resolução (US-9.3, US-8.2).
 *
 * A lista é paginada pelo servidor e filtrada por status, tipo, filial e período — os
 * mesmos quatro filtros que a API aceita.
 *
 * O detalhe mostra os **três números** e a trilha de decisões. A trilha é histórico: a tela
 * a exibe inteira e nunca a edita. Decidir acrescenta uma linha; nada é reescrito.
 */
export const useDivergenciasStore = defineStore('divergencias', {
    state: () => ({
        filtros: { status: null, tipo: null, filialId: null, de: null, ate: null, pagina: 1 },
        linhas: [],
        paginacao: { pagina: 1, ultimaPagina: 1, total: 0, porPagina: DIVERGENCIAS_POR_PAGINA },
        filiais: [],
        carregando: false,
        falha: null,
        // Detalhe aberto pela rota `divergencia`.
        divergencia: null,
        carregandoDetalhe: false,
        falhaDoDetalhe: null,
        decidindo: false,
        falhaDaDecisao: null,
        // Registro manual: o modal "Nova divergência" do design.
        manifestosDoRegistro: [],
        registrando: false,
        falhaDoRegistro: null,
    }),

    getters: {
        /**
         * Parâmetros do recorte como a API os espera. Filtro não informado não vai na query:
         * mandar `status=` vazio pediria validação de um filtro que ninguém escolheu.
         */
        parametros(state) {
            return {
                ...(state.filtros.status === null ? {} : { status: state.filtros.status }),
                ...(state.filtros.tipo === null ? {} : { tipo: state.filtros.tipo }),
                ...(state.filtros.filialId === null ? {} : { filial_id: state.filtros.filialId }),
                ...(state.filtros.de === null ? {} : { de: state.filtros.de }),
                ...(state.filtros.ate === null ? {} : { ate: state.filtros.ate }),
                page: state.filtros.pagina,
                per_page: DIVERGENCIAS_POR_PAGINA,
            };
        },

        /**
         * As linhas da lista, como a tabela as escreve.
         */
        linhasDaLista(state) {
            return state.linhas.map((linha) => ({
                id: linha.id,
                tipo: linha.tipo ?? '—',
                status: linha.status ?? '—',
                tom: tomDoStatus(linha.status),
                manifestoId: linha.manifesto?.id ?? linha.manifesto_id,
                manifesto: linha.manifesto?.numero ?? '—',
                filial: linha.manifesto?.filial_codigo ?? '—',
                motorista: linha.manifesto?.motorista_nome ?? '—',
                esperado: linha.valor_esperado,
                declarado: linha.valor_declarado,
                conferido: linha.valor_conferido,
                diferenca: linha.diferenca,
                origem: linha.conferencia_portaria_id === null ? 'Registro manual' : 'Conferência',
                criadoEm: linha.criado_em,
            }));
        },

        /**
         * `true` quando o recorte não devolveu divergência nenhuma — estado vazio, e não
         * falha de carregamento.
         */
        vazia(state) {
            return ! state.carregando && state.falha === null && state.linhas.length === 0;
        },

        /**
         * Os três números do detalhe, mais a diferença que o servidor gravou.
         */
        numerosDoDetalhe(state) {
            if (state.divergencia === null) {
                return null;
            }

            return {
                esperado: state.divergencia.valor_esperado,
                declarado: state.divergencia.valor_declarado,
                conferido: state.divergencia.valor_conferido,
                diferenca: state.divergencia.diferenca,
            };
        },

        /**
         * A trilha de decisões, da mais antiga para a mais recente, como o servidor a
         * devolveu. É histórico: a tela não reordena, não resume e não edita.
         */
        trilhaDoDetalhe(state) {
            return (state.divergencia?.decisoes ?? []).map((decisao) => ({
                id: decisao.id,
                status: decisao.status ?? '—',
                tom: tomDoStatus(decisao.status),
                justificativa: decisao.justificativa,
                autor: decisao.decidido_por_nome ?? '—',
                decididoEm: decisao.decidido_em,
            }));
        },

        /**
         * Manifestos oferecidos no modal de registro manual.
         */
        opcoesDeManifesto(state) {
            return state.manifestosDoRegistro.map((manifesto) => ({
                id: manifesto.id,
                rotulo: `${manifesto.numero ?? '—'} · ${manifesto.veiculo_placa ?? 'sem placa'}`,
            }));
        },
    },

    actions: {
        /**
         * Aplica o recorte vindo da URL.
         *
         * @returns {boolean} se algo que exige nova consulta mudou
         */
        definirFiltros(filtros) {
            const proximo = {
                status: filtros.status ?? null,
                tipo: filtros.tipo ?? null,
                filialId: filtros.filialId ?? null,
                de: filtros.de ?? null,
                ate: filtros.ate ?? null,
                pagina: filtros.pagina ?? 1,
            };

            const mudou = Object.keys(proximo).some((chave) => proximo[chave] !== this.filtros[chave]);

            this.filtros = proximo;

            return mudou;
        },

        /**
         * Carrega a página de divergências do recorte.
         */
        async carregar() {
            this.carregando = true;

            const { ok, dados, falha } = await dashboardService.divergencias(this.parametros);

            if (ok) {
                this.linhas = dados.data ?? [];
                this.paginacao = {
                    pagina: dados.meta?.current_page ?? 1,
                    ultimaPagina: dados.meta?.last_page ?? 1,
                    total: dados.meta?.total ?? this.linhas.length,
                    porPagina: dados.meta?.per_page ?? DIVERGENCIAS_POR_PAGINA,
                };
                this.falha = null;
            } else {
                this.linhas = [];
                this.falha = falha;
            }

            this.carregando = false;

            return ok;
        },

        /**
         * Carrega as filiais do seletor. Elas vêm do endpoint de agregados, que é quem
         * conhece a lista ativa — o mesmo menu das outras telas.
         */
        async carregarFiliais() {
            const { ok, dados } = await dashboardService.agregados({});

            if (ok) {
                this.filiais = dados.data?.filiais ?? [];
            }

            return ok;
        },

        /**
         * Carrega uma divergência com os três números e a trilha.
         */
        async carregarDetalhe(id) {
            this.carregandoDetalhe = true;

            const { ok, dados, falha } = await dashboardService.divergencia(id);

            if (ok) {
                this.divergencia = dados.data;
                this.falhaDoDetalhe = null;
            } else {
                this.divergencia = null;
                this.falhaDoDetalhe = falha;
            }

            this.carregandoDetalhe = false;

            return ok;
        },

        /**
         * Registra a decisão do admin e recarrega o detalhe com a trilha atualizada.
         *
         * A justificativa é obrigatória em qualquer decisão — inclusive na reabertura —, e
         * quem a valida é o servidor: a tela só evita a ida inútil quando o campo está
         * vazio.
         */
        async decidir(id, status, justificativa) {
            this.decidindo = true;

            const { ok, dados, falha } = await dashboardService.decidirDivergencia(id, { status, justificativa });

            if (ok) {
                this.divergencia = dados.data;
                this.falhaDaDecisao = null;
            } else {
                this.falhaDaDecisao = falha;
            }

            this.decidindo = false;

            return ok;
        },

        /**
         * Carrega os manifestos que o modal de registro manual oferece.
         */
        async carregarManifestosDoRegistro() {
            const { ok, dados } = await manifestoService.lista({ per_page: MANIFESTOS_DO_REGISTRO });

            if (ok) {
                this.manifestosDoRegistro = dados.data ?? [];
            }

            return ok;
        },

        /**
         * Registra manualmente uma divergência e recarrega a lista.
         */
        async registrar(payload) {
            this.registrando = true;

            const { ok, dados, falha } = await dashboardService.registrarDivergencia(payload);

            if (ok) {
                this.falhaDoRegistro = null;
                await this.carregar();
            } else {
                this.falhaDoRegistro = falha;
            }

            this.registrando = false;

            return ok ? dados.data : null;
        },
    },
});
