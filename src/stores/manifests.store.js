import { defineStore } from 'pinia';
import { dashboardService } from '@/services/api/dashboard.api.js';
import { manifestoService } from '@/services/api/manifests.api.js';

/**
 * Status do manifesto na ordem do ciclo, com o rótulo e o tom do design.
 *
 * A lista é do domínio e não muda com o recorte — é a mesma sequência semeada em
 * `status_manifestos` —, então ela é o menu do filtro e vive no cliente. O tom vem do mapa
 * de cores da tela 02 do design.
 */
export const STATUS_DO_MANIFESTO = [
    { slug: 'disponivel', rotulo: 'Disponível', tom: 'neutro' },
    { slug: 'aguardando_saida', rotulo: 'Aguard. saída', tom: 'info' },
    { slug: 'em_viagem', rotulo: 'Em viagem', tom: 'accent' },
    { slug: 'aguardando_entrada', rotulo: 'Aguard. entrada', tom: 'warn' },
    { slug: 'fechado', rotulo: 'Fechado', tom: 'ok' },
];

/**
 * Quantas linhas o servidor manda por página da lista.
 */
export const MANIFESTOS_POR_PAGINA = 25;

/**
 * Normaliza o recorte da lista vindo da URL.
 *
 * Diferente da visão geral, a lista **não** assume o dia corrente: ela é a tela de procurar
 * manifesto, e abrir já filtrada em hoje esconderia a viagem da semana passada. Sem período
 * na URL, o período não é filtrado.
 *
 * @param {{ status?: string|null, filial_id?: string|number|null, de?: string|null, ate?: string|null, page?: string|number|null }} query
 */
export function filtrosDaQueryDeManifestos(query = {}) {
    const filial = Number.parseInt(query.filial_id, 10);
    const pagina = Number.parseInt(query.page, 10);
    const de = texto(query.de);
    const ate = texto(query.ate);

    return {
        status: STATUS_DO_MANIFESTO.some((status) => status.slug === query.status) ? query.status : null,
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
 * Estado da tela 02 Manifestos (US-9.3, US-3.1).
 *
 * A paginação é do servidor: a store guarda a página que recebeu e o que o servidor disse
 * sobre o total, e nunca conta linhas para descobrir quantas páginas existem — o filtro que
 * gerou a página é o mesmo que gerou o total.
 */
export const useManifestosStore = defineStore('manifestos', {
    state: () => ({
        filtros: { status: null, filialId: null, de: null, ate: null, pagina: 1 },
        linhas: [],
        paginacao: { pagina: 1, ultimaPagina: 1, total: 0, porPagina: MANIFESTOS_POR_PAGINA },
        filiais: [],
        carregando: false,
        falha: null,
    }),

    getters: {
        /**
         * Parâmetros do recorte como a API os espera. Filtro não informado não vai na query:
         * mandar `status=` vazio pediria validação de um filtro que ninguém escolheu.
         */
        parametros(state) {
            return {
                ...(state.filtros.status === null ? {} : { status: state.filtros.status }),
                ...(state.filtros.filialId === null ? {} : { filial_id: state.filtros.filialId }),
                ...(state.filtros.de === null ? {} : { de: state.filtros.de }),
                ...(state.filtros.ate === null ? {} : { ate: state.filtros.ate }),
                page: state.filtros.pagina,
                per_page: MANIFESTOS_POR_PAGINA,
            };
        },

        /**
         * As linhas da tabela, na ordem em que o servidor as mandou: placa, manifesto, data,
         * progresso, os agregados da viagem e o indicador `erros/OK`.
         */
        linhasDaTabela(state) {
            return state.linhas.map((manifesto) => {
                const status = STATUS_DO_MANIFESTO.find((linha) => linha.slug === manifesto.status);
                const comErros = manifesto.indicador_sincronizacao === 'erros';

                return {
                    id: manifesto.id,
                    numero: manifesto.numero,
                    placa: manifesto.veiculo_placa ?? '—',
                    data: manifesto.data,
                    motorista: manifesto.motorista_nome ?? '—',
                    filial: manifesto.filial_codigo ?? '—',
                    filialNome: manifesto.filial_nome ?? '',
                    status: manifesto.status,
                    statusRotulo: status?.rotulo ?? manifesto.status ?? '—',
                    statusTom: status?.tom ?? 'neutro',
                    concluidas: manifesto.progresso?.concluidas ?? 0,
                    totalDeParadas: manifesto.progresso?.total ?? 0,
                    servicos: manifesto.total_servicos,
                    volumes: manifesto.total_volumes,
                    peso: manifesto.peso_real,
                    retiradas: manifesto.total_retiradas,
                    indicador: manifesto.indicador_sincronizacao,
                    indicadorTom: comErros ? 'bad' : 'neutro',
                    destino: { name: 'manifesto', params: { manifesto: manifesto.id } },
                };
            });
        },

        /**
         * `true` quando o recorte não devolveu manifesto nenhum — é o estado vazio da tela,
         * e não uma falha de carregamento.
         */
        vazia(state) {
            return ! state.carregando && state.falha === null && state.linhas.length === 0;
        },

        temPaginaAnterior(state) {
            return state.paginacao.pagina > 1;
        },

        temProximaPagina(state) {
            return state.paginacao.pagina < state.paginacao.ultimaPagina;
        },

        /**
         * Opções de filial do filtro, como o seletor as escreve.
         */
        filiaisDisponiveis(state) {
            return state.filiais;
        },
    },

    actions: {
        /**
         * Aplica o recorte vindo da URL. Recorte igual ao atual não recarrega nada.
         *
         * @returns {boolean} se o recorte mudou
         */
        definirFiltros(filtros) {
            const proximo = {
                status: filtros.status ?? null,
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
         * Carrega a página de manifestos do recorte. A falha não deixa a tela em branco: ela
         * vira estado exibível, com o botão de nova tentativa.
         */
        async carregar() {
            this.carregando = true;

            const { ok, dados, falha } = await manifestoService.lista(this.parametros);

            if (ok) {
                this.linhas = dados.data;
                this.paginacao = {
                    pagina: dados.meta?.current_page ?? 1,
                    ultimaPagina: dados.meta?.last_page ?? 1,
                    total: dados.meta?.total ?? this.linhas.length,
                    porPagina: dados.meta?.per_page ?? MANIFESTOS_POR_PAGINA,
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
         * Aplica um `manifesto.progresso` do canal do admin na linha que já está na tela
         * (US-9.4).
         *
         * A parada concluída e o manifesto fechado mudam duas coisas da lista: o status e a
         * contagem de paradas. Os dois vêm derivados do servidor no próprio evento, então a
         * linha muda sem nova consulta — e o manifesto que não está nesta página do recorte
         * simplesmente não é tocado.
         *
         * @param {{ manifesto_id: number, status: string, paradas: object }} evento
         * @returns {boolean} se alguma linha da tela mudou
         */
        aplicarProgresso(evento) {
            const indice = this.linhas.findIndex((manifesto) => manifesto.id === evento.manifesto_id);

            if (indice === -1) {
                return false;
            }

            const linha = this.linhas[indice];

            this.linhas.splice(indice, 1, {
                ...linha,
                status: evento.status ?? linha.status,
                progresso: {
                    ...(linha.progresso ?? {}),
                    total: evento.paradas?.total ?? linha.progresso?.total ?? 0,
                    concluidas: evento.paradas?.concluidas ?? linha.progresso?.concluidas ?? 0,
                    pendentes: evento.paradas?.pendentes ?? linha.progresso?.pendentes ?? 0,
                    nao_realizadas: evento.paradas?.nao_realizadas ?? linha.progresso?.nao_realizadas ?? 0,
                },
            });

            return true;
        },

        /**
         * Carrega o menu de filiais do filtro. A lista vem do servidor independente do
         * recorte: é o menu do próprio filtro, então ela não pode encolher por causa dele.
         */
        async carregarFiliais() {
            if (this.filiais.length > 0) {
                return true;
            }

            const { ok, dados } = await dashboardService.agregados({});

            this.filiais = ok ? dados.data.filiais ?? [] : [];

            return ok;
        },
    },
});
