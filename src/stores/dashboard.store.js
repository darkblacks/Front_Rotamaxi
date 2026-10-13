import { defineStore } from 'pinia';
import { dashboardService } from '@/services/api/dashboard.api.js';

/**
 * Data de hoje no formato que a API aceita no filtro (`YYYY-MM-DD`), no fuso do navegador.
 */
export function hojeIso() {
    const agora = new Date();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');

    return `${agora.getFullYear()}-${mes}-${dia}`;
}

/**
 * Dias que o cartão "Ocorrências · 7 dias" olha para trás, contando o dia corrente.
 */
export const DIAS_DA_SERIE_DE_OCORRENCIAS = 7;

/**
 * Quantas divergências abertas o cartão lista. O cartão é chamada para a tela cheia de
 * divergências, não a lista inteira.
 */
export const LIMITE_DE_DIVERGENCIAS = 6;

/**
 * Subtrai dias de uma data `YYYY-MM-DD` sem mexer no fuso: a data volta como texto, do
 * mesmo jeito que entrou, porque é isso que o filtro da API recebe.
 */
export function recuarDias(data, dias) {
    const [ano, mes, dia] = data.split('-').map(Number);
    const referencia = new Date(Date.UTC(ano, mes - 1, dia));

    referencia.setUTCDate(referencia.getUTCDate() - dias);

    return referencia.toISOString().slice(0, 10);
}

/**
 * Normaliza o recorte que vem da URL. Link sem período nenhum abre no dia corrente — é a
 * tela de abertura da operação, não um relatório histórico.
 *
 * @param {{ de?: string|null, ate?: string|null, filial_id?: string|number|null }} query
 */
export function filtrosDaQuery(query = {}) {
    const hoje = hojeIso();
    const de = typeof query.de === 'string' && query.de !== '' ? query.de : hoje;
    const ate = typeof query.ate === 'string' && query.ate !== '' ? query.ate : hoje;
    const filial = Number.parseInt(query.filial_id, 10);

    return {
        de,
        // Período invertido na URL responderia 422; a tela conserta antes de pedir.
        ate: ate < de ? de : ate,
        filialId: Number.isInteger(filial) && filial > 0 ? filial : null,
    };
}

/**
 * Estado da tela 01 Visão geral (US-9.3).
 *
 * Um único recorte — período e filial — governa a tela inteira: os KPIs, o gráfico de
 * entregas, as divergências e as duas cobranças de canhoto saem todos do mesmo filtro,
 * então nenhum cartão mostra um "período" próprio. A série de ocorrências é a exceção
 * declarada no design: ela é sempre dos últimos sete dias, mas obedece à filial.
 */
export const useDashboardStore = defineStore('dashboard', {
    state: () => ({
        filtros: { de: hojeIso(), ate: hojeIso(), filialId: null },
        agregados: null,
        ocorrenciasSeteDias: null,
        divergenciasAbertas: [],
        canhotosPendentes: null,
        carregandoAgregados: false,
        carregandoPaineis: false,
        falha: null,
    }),

    getters: {
        /**
         * Parâmetros do recorte como a API os espera.
         */
        parametros(state) {
            return {
                de: state.filtros.de,
                ate: state.filtros.ate,
                ...(state.filtros.filialId === null ? {} : { filial_id: state.filtros.filialId }),
            };
        },

        /**
         * `true` enquanto não houver número nenhum do servidor: é o que faz o tile mostrar
         * esqueleto em vez de zero. Zero é um resultado legítimo da operação, e exibi-lo
         * antes da resposta contaria uma mentira sobre o dia.
         */
        aguardandoNumeros(state) {
            return state.agregados === null;
        },

        /**
         * Opções do seletor de filial. A lista vem do servidor independente do recorte: é o
         * menu do filtro, então ela não pode encolher justamente por causa do filtro.
         */
        filiaisDisponiveis(state) {
            return state.agregados?.filiais ?? [];
        },

        /**
         * Nome da filial do recorte, como o cabeçalho da tela a escreve.
         */
        nomeDaFilial(state) {
            if (state.filtros.filialId === null) {
                return 'Todas as filiais';
            }

            const filial = (state.agregados?.filiais ?? []).find((linha) => linha.id === state.filtros.filialId);

            return filial === undefined ? `Filial ${state.filtros.filialId}` : `${filial.codigo} · ${filial.nome}`;
        },

        /**
         * Entregas por filial do recorte, como o cartão de barras as desenha. Sem filial
         * com parada no período a lista vem vazia — é o estado vazio do cartão, e não um
         * erro de carregamento.
         */
        entregasPorFilial(state) {
            return state.agregados?.entregas?.por_filial ?? [];
        },

        /**
         * As divergências mais recentes do recorte, como o cartão as lista: badge de tipo,
         * os três números, a diferença e o destino do link para a divergência.
         */
        divergenciasRecentes(state) {
            return state.divergenciasAbertas.map((divergencia) => ({
                id: divergencia.id,
                tipo: divergencia.tipo ?? '—',
                manifestoNumero: divergencia.manifesto?.numero ?? '—',
                filial: divergencia.manifesto?.filial_nome ?? divergencia.manifesto?.filial_codigo ?? '—',
                criadoEm: divergencia.criado_em,
                esperado: divergencia.valor_esperado,
                declarado: divergencia.valor_declarado,
                conferido: divergencia.valor_conferido,
                diferenca: divergencia.diferenca,
                destino: { name: 'divergencia', params: { divergencia: divergencia.id } },
            }));
        },

        /**
         * As **duas** pendências de canhoto por filial, contadas separadamente (US-8.6).
         *
         * A imagem que não subiu e o papel que não voltou à filial se cobram de gente
         * diferente: a soma das duas só serve de chamada, então cada uma tem sua coluna e
         * nenhuma linha some dentro da outra.
         */
        canhotosPorFilial(state) {
            const pendencias = state.canhotosPendentes;

            if (pendencias === null) {
                return [];
            }

            const porFilial = new Map();

            const acumular = (linhas, campo) => {
                linhas.forEach((linha) => {
                    const chave = linha.filial?.id ?? 0;

                    if (! porFilial.has(chave)) {
                        porFilial.set(chave, {
                            filialId: linha.filial?.id ?? null,
                            codigo: linha.filial?.codigo ?? '—',
                            nome: linha.filial?.nome ?? 'Sem filial',
                            aguardandoUpload: 0,
                            semEntregaFisica: 0,
                        });
                    }

                    porFilial.get(chave)[campo] += 1;
                });
            };

            acumular(pendencias.aguardando_upload ?? [], 'aguardandoUpload');
            acumular(pendencias.digitalizado_sem_entrega_fisica ?? [], 'semEntregaFisica');

            return [...porFilial.values()].sort((uma, outra) => uma.codigo.localeCompare(outra.codigo));
        },

        /**
         * Série de ocorrências por código dos últimos sete dias, da mais frequente para a
         * menos frequente. A largura da barra é a participação do código no período.
         */
        serieDeOcorrencias(state) {
            const serie = state.ocorrenciasSeteDias?.taxa_por_codigo ?? [];
            const maior = serie.reduce((maximo, linha) => Math.max(maximo, linha.total), 0);

            return serie.map((linha) => ({
                codigo: linha.codigo,
                descricao: linha.descricao,
                total: linha.total,
                taxa: linha.taxa,
                largura: maior === 0 ? '0%' : `${(linha.total / maior) * 100}%`,
            }));
        },

        /**
         * Os cinco tiles da faixa, na ordem do design.
         *
         * @returns {Array<{ chave: string, rotulo: string, valor: number|null, complemento: string, tom: string, destino: object }>}
         */
        kpis(state) {
            const numeros = state.agregados;

            return [
                {
                    chave: 'manifestos-em-viagem',
                    rotulo: 'Manifestos em viagem',
                    valor: numeros?.manifestos?.em_viagem ?? null,
                    complemento: numeros === null
                        ? ''
                        : `de ${numeros.manifestos.total} no período`,
                    tom: 'accent',
                    destino: { name: 'manifestos' },
                },
                {
                    chave: 'entregas-concluidas',
                    rotulo: 'Entregas concluídas',
                    valor: numeros?.entregas?.concluidas ?? null,
                    complemento: numeros === null
                        ? ''
                        : `${numeros.entregas.pendentes} pendentes`,
                    tom: 'ok',
                    destino: { name: 'manifestos' },
                },
                {
                    chave: 'divergencias-abertas',
                    rotulo: 'Divergências abertas',
                    valor: numeros?.divergencias?.abertas ?? null,
                    complemento: numeros === null
                        ? ''
                        : `${numeros.divergencias.total} no período`,
                    tom: (numeros?.divergencias?.abertas ?? 0) > 0 ? 'bad' : 'ok',
                    destino: { name: 'manifestos' },
                },
                {
                    chave: 'canhotos-pendentes',
                    rotulo: 'Canhotos pendentes',
                    valor: numeros?.canhotos?.pendentes ?? null,
                    // As duas pendências aparecem sempre discriminadas: elas se cobram de
                    // gente diferente, e o total só serve de chamada.
                    complemento: numeros === null
                        ? ''
                        : `${numeros.canhotos.aguardando_upload} sem imagem · ${numeros.canhotos.digitalizado_sem_entrega_fisica} sem papel`,
                    tom: (numeros?.canhotos?.pendentes ?? 0) > 0 ? 'warn' : 'ok',
                    destino: { name: 'manifestos' },
                },
                {
                    chave: 'pallets-em-transito',
                    rotulo: 'Pallets em trânsito',
                    valor: numeros?.pallets?.em_transito ?? null,
                    complemento: numeros === null ? '' : 'com os motoristas',
                    tom: 'info',
                    destino: { name: 'saldo-pallets' },
                },
            ];
        },
    },

    actions: {
        /**
         * Aplica o recorte vindo da URL. Recorte igual ao atual não recarrega nada: a
         * navegação que só reescreve a query não deve refazer as consultas.
         *
         * @returns {boolean} se o recorte mudou
         */
        definirFiltros(filtros) {
            const proximo = {
                de: filtros.de,
                ate: filtros.ate,
                filialId: filtros.filialId ?? null,
            };

            const mudou = proximo.de !== this.filtros.de
                || proximo.ate !== this.filtros.ate
                || proximo.filialId !== this.filtros.filialId;

            this.filtros = proximo;

            return mudou;
        },

        /**
         * Carrega os agregados do recorte. A falha não deixa a tela em branco: ela vira
         * estado exibível, com o botão de nova tentativa.
         */
        async carregarAgregados() {
            this.carregandoAgregados = true;

            const { ok, dados, falha } = await dashboardService.agregados(this.parametros);

            if (ok) {
                this.agregados = dados.data;
                this.falha = null;
            } else {
                this.agregados = null;
                this.falha = falha;
            }

            this.carregandoAgregados = false;

            return ok;
        },

        /**
         * Carrega os cartões que precisam de linha nominal: as divergências mais recentes
         * e as duas listas de canhoto pendente. A série de ocorrências vem no mesmo lote,
         * pelo endpoint de agregados, com a janela fixa de sete dias do design.
         */
        async carregarPaineis() {
            this.carregandoPaineis = true;

            const seteDias = {
                de: recuarDias(this.filtros.ate, DIAS_DA_SERIE_DE_OCORRENCIAS - 1),
                ate: this.filtros.ate,
                ...(this.filtros.filialId === null ? {} : { filial_id: this.filtros.filialId }),
            };

            const [divergencias, canhotos, ocorrencias] = await Promise.all([
                dashboardService.divergencias({
                    ...this.parametros,
                    status: 'aberta',
                    per_page: LIMITE_DE_DIVERGENCIAS,
                }),
                // A cobrança de canhoto é passivo acumulado: ela não leva o período da
                // tela, senão a pendência da semana passada sumiria da lista de hoje. A
                // filial continua valendo, porque é ela quem cobra.
                dashboardService.canhotosPendentes(
                    this.filtros.filialId === null ? {} : { filial_id: this.filtros.filialId },
                ),
                dashboardService.agregados(seteDias),
            ]);

            this.divergenciasAbertas = divergencias.ok ? divergencias.dados.data : [];
            this.canhotosPendentes = canhotos.ok ? canhotos.dados.data : null;
            this.ocorrenciasSeteDias = ocorrencias.ok ? ocorrencias.dados.data.ocorrencias : null;

            this.carregandoPaineis = false;

            return divergencias.ok && canhotos.ok && ocorrencias.ok;
        },
    },
});
