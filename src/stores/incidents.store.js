import { defineStore } from 'pinia';
import { dashboardService } from '@/services/api/dashboard.api.js';
import { hojeIso, recuarDias } from '@/stores/dashboard.store.js';

/**
 * Os três períodos do seletor da tela 05, na ordem do design.
 *
 * `dias` é quanto se recua a partir de hoje **contando o dia corrente**: "7 dias" é hoje
 * mais os seis anteriores, que é como a operação lê a semana.
 */
export const PERIODOS_DE_OCORRENCIA = [
    { chave: 'hoje', rotulo: 'Hoje', dias: 1 },
    { chave: '7d', rotulo: '7 dias', dias: 7 },
    { chave: '30d', rotulo: '30 dias', dias: 30 },
];

/**
 * Período de abertura da tela: a semana, que é a janela em que um código domina ou some.
 */
export const PERIODO_PADRAO = '7d';

/**
 * Quantas notas o servidor manda por página da lista de um código.
 */
export const NOTAS_POR_PAGINA = 25;

/**
 * Recorte que o período nomeado representa em datas.
 */
export function periodoEmDatas(chave, hoje = hojeIso()) {
    const periodo = PERIODOS_DE_OCORRENCIA.find((opcao) => opcao.chave === chave) ?? PERIODOS_DE_OCORRENCIA[1];

    return { de: recuarDias(hoje, periodo.dias - 1), ate: hoje };
}

/**
 * Normaliza o recorte da tela vindo da URL.
 *
 * O período viaja como o nome do botão — `hoje`, `7d`, `30d` —, e não como duas datas: é
 * assim que o design o oferece, e é o que faz o link compartilhado continuar significando
 * "a última semana" quando alguém o abre depois.
 *
 * @param {{ periodo?: string|null, filial_id?: string|number|null, codigo?: string|null, page?: string|number|null }} query
 */
export function filtrosDaQueryDeOcorrencias(query = {}) {
    const filial = Number.parseInt(query.filial_id, 10);
    const pagina = Number.parseInt(query.page, 10);

    return {
        periodo: PERIODOS_DE_OCORRENCIA.some((opcao) => opcao.chave === query.periodo) ? query.periodo : PERIODO_PADRAO,
        filialId: Number.isInteger(filial) && filial > 0 ? filial : null,
        codigo: typeof query.codigo === 'string' && query.codigo !== '' ? query.codigo : null,
        pagina: Number.isInteger(pagina) && pagina > 0 ? pagina : 1,
    };
}

/**
 * Estado da tela 05 Ocorrências (US-9.3, US-8.3).
 *
 * A tabela por código e a quebra por filial vêm do mesmo endpoint de agregados das outras
 * telas: contagem e participação percentual já calculadas no recorte. A tela não divide
 * número por número para chegar à porcentagem — repetir a conta no cliente daria dois
 * significados para o mesmo "%".
 *
 * Clicar num código abre a lista das notas que o receberam, paginada pelo servidor, no
 * mesmo período e na mesma filial que geraram a contagem.
 */
export const useOcorrenciasStore = defineStore('ocorrencias', {
    state: () => ({
        filtros: { periodo: PERIODO_PADRAO, filialId: null, codigo: null, pagina: 1 },
        agregados: null,
        carregando: false,
        falha: null,
        notas: [],
        paginacaoDasNotas: { pagina: 1, ultimaPagina: 1, total: 0, porPagina: NOTAS_POR_PAGINA },
        carregandoNotas: false,
        falhaDasNotas: null,
    }),

    getters: {
        /**
         * O período do recorte em datas, como a API o espera.
         */
        datas(state) {
            return periodoEmDatas(state.filtros.periodo);
        },

        /**
         * Parâmetros do recorte. Filial não escolhida não vai na query: mandar `filial_id=`
         * vazio pediria validação de um filtro que ninguém escolheu.
         */
        parametros(state) {
            return {
                ...this.datas,
                ...(state.filtros.filialId === null ? {} : { filial_id: state.filtros.filialId }),
            };
        },

        aguardandoNumeros(state) {
            return state.agregados === null;
        },

        filiaisDisponiveis(state) {
            return state.agregados?.filiais ?? [];
        },

        nomeDaFilial(state) {
            if (state.filtros.filialId === null) {
                return 'Todas as filiais';
            }

            const filial = (state.agregados?.filiais ?? []).find((linha) => linha.id === state.filtros.filialId);

            return filial === undefined ? `Filial ${state.filtros.filialId}` : `${filial.codigo} · ${filial.nome}`;
        },

        /**
         * Total de ocorrências do recorte — o denominador de toda participação da tela.
         */
        totalDeOcorrencias(state) {
            return state.agregados?.ocorrencias?.total ?? 0;
        },

        /**
         * A tabela por código do design: contagem, participação e as exigências do tipo.
         *
         * A largura da barra é a participação do código no **maior** código do recorte, e
         * não na soma: barra proporcional ao total deixaria toda linha pequena demais para
         * comparar quando um código domina o período.
         */
        linhasPorCodigo(state) {
            const codigos = state.agregados?.ocorrencias?.taxa_por_codigo ?? [];
            const maior = codigos.reduce((maximo, linha) => Math.max(maximo, linha.total), 0);

            return codigos.map((linha) => ({
                codigo: linha.codigo,
                descricao: linha.descricao ?? '—',
                total: linha.total,
                // A participação é a do servidor, apenas escrita em porcentagem.
                participacao: linha.taxa,
                percentual: `${(linha.taxa * 100).toFixed(1)}%`,
                largura: maior === 0 ? '0%' : `${(linha.total / maior) * 100}%`,
                exigencias: [
                    ...(linha.exige_recebedor ? ['Recebedor'] : []),
                    ...(linha.exige_assinatura ? ['Assinatura'] : []),
                    ...(linha.exige_comprovante ? ['Comprovante'] : []),
                ],
                selecionada: linha.codigo === state.filtros.codigo,
            }));
        },

        /**
         * O cartão "Por filial": quantas ocorrências cada filial produziu e que fatia do
         * total elas são.
         */
        porFilial(state) {
            const linhas = state.agregados?.ocorrencias?.por_filial ?? [];
            const maior = linhas.reduce((maximo, linha) => Math.max(maximo, linha.total), 0);

            return linhas.map((linha) => ({
                filialId: linha.filial_id,
                codigo: linha.codigo ?? '—',
                nome: linha.nome ?? '',
                total: linha.total,
                percentual: `${(linha.taxa * 100).toFixed(1)}%`,
                largura: maior === 0 ? '0%' : `${(linha.total / maior) * 100}%`,
            }));
        },

        /**
         * A linha da tabela que está aberta, com descrição e contagem — é o cabeçalho da
         * lista de notas. `null` enquanto ninguém clicou em código nenhum.
         */
        codigoSelecionado(state) {
            if (state.filtros.codigo === null) {
                return null;
            }

            return this.linhasPorCodigo.find((linha) => linha.codigo === state.filtros.codigo)
                ?? { codigo: state.filtros.codigo, descricao: '—', total: 0, percentual: '0.0%' };
        },

        /**
         * As notas do código aberto, como a lista as mostra.
         */
        linhasDasNotas(state) {
            return state.notas.map((nota) => ({
                id: nota.id,
                numeroNf: nota.nota_fiscal?.numero_nf ?? '—',
                serie: nota.nota_fiscal?.serie ?? '',
                volumes: nota.nota_fiscal?.volumes ?? null,
                cliente: nota.parada?.cliente_nome ?? '—',
                cidade: nota.parada?.cidade ?? '',
                manifestoId: nota.manifesto?.id ?? null,
                manifesto: nota.manifesto?.numero ?? '—',
                filial: nota.manifesto?.filial_codigo ?? '—',
                motorista: nota.manifesto?.motorista_nome ?? '—',
                comentario: nota.comentario ?? '',
                registradoEm: nota.registrado_em,
            }));
        },

        /**
         * `true` quando o recorte não teve ocorrência nenhuma — estado vazio da tabela, e
         * não falha de carregamento.
         */
        vazia(state) {
            return ! state.carregando
                && state.falha === null
                && state.agregados !== null
                && (state.agregados.ocorrencias?.taxa_por_codigo ?? []).length === 0;
        },

        /**
         * `true` quando o código aberto não devolveu nota nenhuma no recorte.
         */
        listaDeNotasVazia(state) {
            return state.filtros.codigo !== null
                && ! state.carregandoNotas
                && state.falhaDasNotas === null
                && state.notas.length === 0;
        },
    },

    actions: {
        /**
         * Aplica o recorte vindo da URL e diz o que precisa ser recarregado.
         *
         * @returns {{ agregados: boolean, notas: boolean }}
         */
        definirFiltros(filtros) {
            const proximo = {
                periodo: filtros.periodo ?? PERIODO_PADRAO,
                filialId: filtros.filialId ?? null,
                codigo: filtros.codigo ?? null,
                pagina: filtros.pagina ?? 1,
            };

            const recorte = proximo.periodo !== this.filtros.periodo
                || proximo.filialId !== this.filtros.filialId;

            const recarga = {
                agregados: recorte,
                // O recorte muda a lista de notas tanto quanto a troca de código: ela é do
                // mesmo período e da mesma filial que geraram a contagem.
                notas: proximo.codigo !== null
                    && (recorte || proximo.codigo !== this.filtros.codigo || proximo.pagina !== this.filtros.pagina),
            };

            this.filtros = proximo;

            if (proximo.codigo === null) {
                this.notas = [];
                this.falhaDasNotas = null;
            }

            return recarga;
        },

        /**
         * Carrega a tabela por código e a quebra por filial do recorte.
         */
        async carregar() {
            this.carregando = true;

            const { ok, dados, falha } = await dashboardService.agregados(this.parametros);

            if (ok) {
                this.agregados = dados.data;
                this.falha = null;
            } else {
                this.agregados = null;
                this.falha = falha;
            }

            this.carregando = false;

            return ok;
        },

        /**
         * Carrega as notas do código aberto, paginadas pelo servidor.
         */
        async carregarNotas() {
            if (this.filtros.codigo === null) {
                return false;
            }

            this.carregandoNotas = true;

            const codigo = this.filtros.codigo;

            const { ok, dados, falha } = await dashboardService.ocorrenciasPorCodigo({
                ...this.parametros,
                codigo,
                page: this.filtros.pagina,
                per_page: NOTAS_POR_PAGINA,
            });

            // A resposta lenta de um código não pode sobrescrever a lista de outro já
            // aberto: quem chegou tarde para a seleção atual é descartado.
            if (this.filtros.codigo !== codigo) {
                this.carregandoNotas = false;

                return ok;
            }

            if (ok) {
                this.notas = dados.data ?? [];
                this.paginacaoDasNotas = {
                    pagina: dados.meta?.current_page ?? 1,
                    ultimaPagina: dados.meta?.last_page ?? 1,
                    total: dados.meta?.total ?? this.notas.length,
                    porPagina: dados.meta?.per_page ?? NOTAS_POR_PAGINA,
                };
                this.falhaDasNotas = null;
            } else {
                this.notas = [];
                this.falhaDasNotas = falha;
            }

            this.carregandoNotas = false;

            return ok;
        },
    },
});
