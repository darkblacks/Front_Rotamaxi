import { defineStore } from 'pinia';
import { dashboardService } from '@/services/api/dashboard.api.js';

/**
 * Como a lista de clientes pode ser ordenada. O saldo é a ordem de abertura: a tela existe
 * para cobrar quem tem pallet parado, e não para folhear o cadastro em ordem alfabética.
 */
export const ORDENS_DE_CLIENTE = [
    { campo: 'saldo', rotulo: 'Saldo' },
    { campo: 'movimentos', rotulo: 'Movimentos' },
    { campo: 'nome', rotulo: 'Cliente' },
];

/**
 * Normaliza o recorte da tela vindo da URL.
 *
 * Período ausente **não** vira o dia de hoje: o saldo de pallet é passivo acumulado, e um
 * dia só mostraria quase nada. Sem período na URL, quem decide a janela é o servidor, pela
 * `dashboard.janela_padrao_dias`, e a tela escreve no cabeçalho a janela que recebeu.
 *
 * @param {{ de?: string|null, ate?: string|null, filial_id?: string|number|null, cliente?: string|number|null, ordem?: string|null, direcao?: string|null }} query
 */
export function filtrosDaQueryDePallets(query = {}) {
    const filial = Number.parseInt(query.filial_id, 10);
    const cliente = Number.parseInt(query.cliente, 10);
    const de = texto(query.de);
    const ate = texto(query.ate);

    return {
        de,
        // Período invertido na URL responderia 422; a tela conserta antes de pedir.
        ate: de !== null && ate !== null && ate < de ? de : ate,
        filialId: Number.isInteger(filial) && filial > 0 ? filial : null,
        clienteId: Number.isInteger(cliente) && cliente > 0 ? cliente : null,
        ordem: ORDENS_DE_CLIENTE.some((ordem) => ordem.campo === query.ordem) ? query.ordem : 'saldo',
        direcao: query.direcao === 'asc' ? 'asc' : 'desc',
    };
}

function texto(valor) {
    return typeof valor === 'string' && valor !== '' ? valor : null;
}

/**
 * Estado da tela 04 Saldo de pallets (US-9.3, US-8.5).
 *
 * Todo número da tela vem do endpoint de agregados, no mesmo recorte: os quatro tiles, a
 * quebra por filial e a lista de clientes. A ordenação da lista é local — reordenar não é
 * recortar, e pedir ao servidor a mesma lista em outra ordem gastaria uma ida sem trazer
 * dado novo.
 */
export const usePalletsStore = defineStore('pallets', {
    state: () => ({
        filtros: { de: null, ate: null, filialId: null, clienteId: null, ordem: 'saldo', direcao: 'desc' },
        agregados: null,
        carregando: false,
        falha: null,
        extrato: null,
        carregandoExtrato: false,
        falhaDoExtrato: null,
    }),

    getters: {
        /**
         * Parâmetros do recorte como a API os espera. Filtro não informado não vai na query:
         * é o servidor que aplica a janela padrão quando o período não foi escolhido.
         */
        parametros(state) {
            return {
                ...(state.filtros.de === null ? {} : { de: state.filtros.de }),
                ...(state.filtros.ate === null ? {} : { ate: state.filtros.ate }),
                ...(state.filtros.filialId === null ? {} : { filial_id: state.filtros.filialId }),
            };
        },

        /**
         * O período que o servidor de fato aplicou, que é o único que descreve os números na
         * tela. Enquanto a resposta não chegou, vale o que a URL pediu.
         */
        recorteEfetivo(state) {
            return {
                de: state.agregados?.filtros?.de ?? state.filtros.de,
                ate: state.agregados?.filtros?.ate ?? state.filtros.ate,
            };
        },

        /**
         * `true` enquanto não houver número nenhum do servidor: é o que faz o tile mostrar
         * esqueleto em vez de zero, que é resultado legítimo da operação.
         */
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
         * Os quatro tiles do design, na ordem dele.
         *
         * @returns {Array<{ chave: string, rotulo: string, valor: number|null, complemento: string, tom: string }>}
         */
        tiles(state) {
            const numeros = state.agregados;
            const pallets = numeros?.pallets;
            const limiar = pallets?.limiar_saldo_alto ?? 0;

            return [
                {
                    chave: 'pallets-em-clientes',
                    rotulo: 'Pallets em clientes',
                    valor: pallets?.em_clientes ?? null,
                    complemento: numeros === null ? '' : `${pallets.por_cliente.length} clientes com movimento`,
                    tom: 'accent',
                },
                {
                    chave: 'pallets-em-transito',
                    rotulo: 'Em trânsito (motoristas)',
                    valor: pallets?.em_transito ?? null,
                    complemento: numeros === null ? '' : `${pallets.por_motorista.length} motoristas`,
                    tom: 'info',
                },
                {
                    chave: 'clientes-com-saldo-alto',
                    rotulo: `Clientes com saldo ≥ ${limiar}`,
                    valor: pallets?.clientes_com_saldo_alto ?? null,
                    complemento: numeros === null ? '' : 'saldo a cobrar',
                    tom: (pallets?.clientes_com_saldo_alto ?? 0) > 0 ? 'warn' : 'ok',
                },
                {
                    chave: 'divergencias-de-pallet',
                    rotulo: 'Divergências de pallet abertas',
                    valor: numeros?.divergencias?.pallet_abertas ?? null,
                    complemento: numeros === null ? '' : `${numeros.divergencias.abertas} abertas no total`,
                    tom: (numeros?.divergencias?.pallet_abertas ?? 0) > 0 ? 'bad' : 'ok',
                },
            ];
        },

        /**
         * A quebra "Por filial" do design: o que saiu de cada filial e onde esse pallet está.
         * A largura da barra é a participação da filial no maior saldo em cliente.
         */
        porFilial(state) {
            const linhas = state.agregados?.pallets?.por_filial ?? [];
            const maior = linhas.reduce((maximo, linha) => Math.max(maximo, linha.em_clientes, linha.em_transito), 0);

            return linhas.map((linha) => ({
                filialId: linha.filial_id,
                codigo: linha.codigo ?? '—',
                nome: linha.nome ?? '',
                movimentos: linha.movimentos,
                emClientes: linha.em_clientes,
                emTransito: linha.em_transito,
                largura: maior === 0 ? '0%' : `${(linha.em_clientes / maior) * 100}%`,
            }));
        },

        /**
         * A lista de clientes na ordem pedida. O destaque marca quem passou do limiar de
         * cobrança, que é o mesmo número que o tile conta.
         *
         * A tela inteira fala na **perspectiva do cliente**: saldo positivo é pallet parado
         * no pátio dele. A API escreve o saldo na perspectiva de quem carrega — `entregue`
         * subtrai —, então o sinal é invertido aqui, num lugar só, e não em cada componente.
         */
        clientes(state) {
            const pallets = state.agregados?.pallets;
            const limiar = pallets?.limiar_saldo_alto ?? 0;
            const sinal = state.filtros.direcao === 'asc' ? 1 : -1;

            return [...(pallets?.por_cliente ?? [])]
                .map((cliente) => {
                    const saldo = -cliente.saldo;

                    return {
                        id: cliente.pessoa_id,
                        nome: cliente.nome ?? '—',
                        cidade: cliente.cidade ?? '—',
                        documento: cliente.documento,
                        movimentos: cliente.movimentos,
                        saldo,
                        aCobrar: limiar > 0 && saldo >= limiar,
                        devedorTom: saldo > 0 ? 'positivo' : (saldo < 0 ? 'negativo' : 'neutro'),
                    };
                })
                .sort((um, outro) => sinal * compararClientes(um, outro, state.filtros.ordem));
        },

        /**
         * O cliente cujo extrato está aberto, como a lista o descreve. `null` enquanto
         * ninguém foi escolhido — a tela abre na lista, e o extrato é o passo seguinte.
         */
        clienteSelecionado(state) {
            if (state.filtros.clienteId === null) {
                return null;
            }

            return this.clientes.find((cliente) => cliente.id === state.filtros.clienteId)
                ?? nomeDoExtrato(state.extrato, state.filtros.clienteId);
        },

        /**
         * O extrato do cliente, linha a linha, na perspectiva do pátio dele: `entregue` soma
         * e `recolhido` subtrai, ao contrário do sinal que a API usa para quem carrega.
         *
         * O acumulado é o que o servidor calculou — a tela não refaz a conta, senão o
         * `saldo_anterior` do período viraria zero e o extrato filtrado mentiria.
         */
        linhasDoExtrato(state) {
            return (state.extrato?.movimentos ?? []).map((movimento) => ({
                id: movimento.id,
                ocorridoEm: movimento.ocorrido_em,
                tipo: movimento.tipo?.slug ?? '—',
                tipoNome: movimento.tipo?.nome ?? '—',
                // `entregue` deixa pallet no cliente; `recolhido` o traz de volta.
                entrada: (movimento.tipo?.sinal ?? 0) < 0,
                manifesto: movimento.manifesto?.numero ?? '—',
                manifestoId: movimento.manifesto?.id ?? null,
                motorista: movimento.motorista?.nome ?? '—',
                quantidade: movimento.quantidade,
                efeito: -movimento.efeito,
                acumulado: -movimento.acumulado,
            }));
        },

        /**
         * O cabeçalho do extrato: saldo no cliente, acumulado inicial do período e a janela
         * que o servidor de fato aplicou.
         */
        resumoDoExtrato(state) {
            if (state.extrato === null) {
                return null;
            }

            return {
                nome: state.extrato.cliente?.nome ?? '—',
                documento: state.extrato.cliente?.documento ?? '',
                saldo: -state.extrato.saldo_consolidado,
                acumuladoInicial: -state.extrato.saldo_anterior,
                de: state.extrato.periodo?.de ?? null,
                ate: state.extrato.periodo?.ate ?? null,
            };
        },

        /**
         * `true` quando o cliente escolhido não teve movimento **no período**. Não é falha e
         * nem cliente sem saldo: o acumulado inicial continua valendo, e é o que o estado
         * vazio mostra junto com o convite para alargar a janela.
         */
        extratoVazio(state) {
            return state.filtros.clienteId !== null
                && ! state.carregandoExtrato
                && state.falhaDoExtrato === null
                && state.extrato !== null
                && state.extrato.movimentos.length === 0;
        },

        /**
         * `true` quando o recorte não devolveu movimento de pallet nenhum — estado vazio da
         * lista, e não falha de carregamento.
         */
        vazia(state) {
            return ! state.carregando
                && state.falha === null
                && state.agregados !== null
                && (state.agregados.pallets?.por_cliente ?? []).length === 0;
        },
    },

    actions: {
        /**
         * Aplica o recorte vindo da URL.
         *
         * A ordenação vive no mesmo lugar, mas não recarrega nada: ela só reordena o que já
         * está na tela.
         *
         * @returns {boolean} se o recorte que exige nova consulta mudou
         */
        definirFiltros(filtros) {
            const proximo = {
                de: filtros.de ?? null,
                ate: filtros.ate ?? null,
                filialId: filtros.filialId ?? null,
                clienteId: filtros.clienteId ?? null,
                ordem: filtros.ordem ?? 'saldo',
                direcao: filtros.direcao ?? 'desc',
            };

            const periodo = proximo.de !== this.filtros.de || proximo.ate !== this.filtros.ate;

            const recarga = {
                agregados: periodo || proximo.filialId !== this.filtros.filialId,
                // O período muda o extrato tanto quanto a troca de cliente: ele recorta as
                // linhas e recalcula o acumulado inicial.
                extrato: proximo.clienteId !== null
                    && (periodo || proximo.clienteId !== this.filtros.clienteId),
            };

            this.filtros = proximo;

            if (proximo.clienteId === null) {
                this.extrato = null;
                this.falhaDoExtrato = null;
            }

            return recarga;
        },

        /**
         * Carrega os agregados do recorte. A falha vira estado exibível, com nova tentativa.
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
         * Carrega o extrato do cliente escolhido, no mesmo período da tela.
         *
         * A janela mandada é a que o servidor **aplicou** nos agregados, e não a que a URL
         * pediu: sem período na URL, quem escolheu a janela foi ele, e o extrato precisa
         * falar do mesmo pedaço de tempo que os tiles.
         */
        async carregarExtrato() {
            if (this.filtros.clienteId === null) {
                return false;
            }

            this.carregandoExtrato = true;

            const { de, ate } = this.recorteEfetivo;
            const cliente = this.filtros.clienteId;

            const { ok, dados, falha } = await dashboardService.extratoDePallets(cliente, {
                ...(de === null ? {} : { de }),
                ...(ate === null ? {} : { ate }),
            });

            // A resposta lenta de um cliente não pode sobrescrever o extrato de outro já
            // escolhido: quem chegou tarde para a seleção atual é descartado.
            if (this.filtros.clienteId !== cliente) {
                this.carregandoExtrato = false;

                return ok;
            }

            if (ok) {
                this.extrato = dados.data;
                this.falhaDoExtrato = null;
            } else {
                this.extrato = null;
                this.falhaDoExtrato = falha;
            }

            this.carregandoExtrato = false;

            return ok;
        },
    },
});

/**
 * Identificação mínima do cliente do extrato quando ele não está na lista do recorte —
 * caso do link compartilhado de um cliente que não teve movimento na janela.
 */
function nomeDoExtrato(extrato, clienteId) {
    if (extrato?.cliente?.id !== clienteId) {
        return null;
    }

    return {
        id: clienteId,
        nome: extrato.cliente.nome ?? '—',
        cidade: '—',
        documento: extrato.cliente.documento,
        movimentos: 0,
        saldo: -extrato.saldo_consolidado,
        aCobrar: false,
        devedorTom: 'neutro',
    };
}

/**
 * Comparação sempre **crescente**; quem inverte é o sinal da direção. Um comparador por
 * campo que já embutisse a direção daria duas fontes de verdade para a mesma ordem.
 */
function compararClientes(um, outro, campo) {
    if (campo === 'nome') {
        return um.nome.localeCompare(outro.nome, 'pt-BR');
    }

    if (campo === 'movimentos') {
        return um.movimentos - outro.movimentos;
    }

    return um.saldo - outro.saldo;
}
