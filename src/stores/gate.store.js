import { defineStore } from 'pinia';
import { dashboardService } from '@/services/api/dashboard.api.js';
import { portariaService } from '@/services/api/gate.api.js';
import { duracaoCurta, minutosDesde } from '@/utils/format.js';

/**
 * As duas colunas do design, na ordem em que a portaria as opera: primeiro quem sai, depois
 * quem volta. O slug é o mesmo status do manifesto, então a coluna nunca precisa traduzir
 * regra de negócio — ela só agrupa o que o servidor já classificou.
 */
export const COLUNAS_DA_FILA = [
    {
        slug: 'aguardando_saida',
        titulo: 'Aguardando saída',
        tom: 'info',
        dica: 'conferência de saída',
    },
    {
        slug: 'aguardando_entrada',
        titulo: 'Aguardando entrada',
        tom: 'warn',
        dica: 'conferência de entrada',
    },
];

/**
 * A partir de quantos minutos a espera no portão vira aviso e, depois, alerta.
 *
 * O veículo parado no portão é caminhão parado: a cor marca o tempo para que o admin veja
 * a fila travando antes de alguém ligar reclamando.
 */
export const ESPERA_EM_ATENCAO = 30;

export const ESPERA_CRITICA = 60;

/**
 * As duas ações do evento `fila.atualizada`, com o mesmo nome que o servidor publica.
 */
export const ACAO_ENTROU = 'entrou';

export const ACAO_SAIU = 'saiu';

/**
 * Normaliza o recorte da fila vindo da URL. Só a filial recorta: a fila é sempre o agora
 * do portão, e filtrar período nela não faria sentido nenhum.
 *
 * @param {{ filial_id?: string|number|null }} query
 */
export function filtrosDaQueryDaFila(query = {}) {
    const filial = Number.parseInt(query.filial_id, 10);

    return {
        filialId: Number.isInteger(filial) && filial > 0 ? filial : null,
    };
}

/**
 * Estado da tela 03 Fila da portaria (US-9.3, US-4.1).
 *
 * A tela é de **monitoramento**: o admin vê a fila de todas as filiais e não age sobre ela.
 * Conferir continua sendo ato do porteiro no portão, no app dele — por isso não há nenhuma
 * ação de conferência aqui, nem no serviço que esta store consome.
 */
export const usePortariaStore = defineStore('portaria', {
    state: () => ({
        filtros: { filialId: null },
        manifestos: [],
        filiais: [],
        carregando: false,
        falha: null,
        // Relógio da espera: sem ele o "há 12min" congelaria no instante da carga.
        agora: new Date(),
    }),

    getters: {
        /**
         * Parâmetros do recorte como a API os espera.
         */
        parametros(state) {
            return state.filtros.filialId === null ? {} : { filial_id: state.filtros.filialId };
        },

        /**
         * As duas colunas do design, cada uma com os seus cartões e a contagem própria.
         *
         * O agrupamento é pelo status que o servidor mandou: manifesto de status
         * desconhecido não inventa coluna, ele simplesmente não aparece na fila.
         */
        colunas(state) {
            return COLUNAS_DA_FILA.map((coluna) => {
                const cartoes = state.manifestos
                    .filter((manifesto) => manifesto.status === coluna.slug)
                    .map((manifesto) => cartaoDaFila(manifesto, coluna, state.agora))
                    .sort((um, outro) => (outro.minutos ?? 0) - (um.minutos ?? 0));

                return {
                    ...coluna,
                    total: cartoes.length,
                    cartoes,
                    vazia: cartoes.length === 0,
                };
            });
        },

        /**
         * `true` quando nenhuma das duas colunas tem veículo — portão vazio, não é falha.
         */
        vazia(state) {
            return ! state.carregando && state.falha === null && state.manifestos.length === 0;
        },

        /**
         * Opções de filial do filtro. A lista vem do servidor independente do recorte: é o
         * menu do próprio filtro, então ela não pode encolher por causa dele.
         */
        filiaisDisponiveis(state) {
            return state.filiais;
        },

        /**
         * Filial do recorte, como o cabeçalho da tela a escreve.
         */
        nomeDaFilial(state) {
            if (state.filtros.filialId === null) {
                return 'Todas as filiais';
            }

            const filial = state.filiais.find((linha) => linha.id === state.filtros.filialId);

            return filial === undefined ? `Filial ${state.filtros.filialId}` : `${filial.codigo} · ${filial.nome}`;
        },
    },

    actions: {
        /**
         * Aplica o recorte vindo da URL. Recorte igual ao atual não recarrega nada.
         *
         * @returns {boolean} se o recorte mudou
         */
        definirFiltros(filtros) {
            const proximo = { filialId: filtros.filialId ?? null };
            const mudou = proximo.filialId !== this.filtros.filialId;

            this.filtros = proximo;

            return mudou;
        },

        /**
         * Carrega a fila do recorte. A falha vira estado exibível, com nova tentativa — a
         * tela de monitoramento em branco esconderia justamente o que ela existe para ver.
         */
        async carregar() {
            this.carregando = true;

            const { ok, dados, falha } = await portariaService.fila(this.parametros);

            if (ok) {
                this.manifestos = dados.data;
                this.falha = null;
            } else {
                this.manifestos = [];
                this.falha = falha;
            }

            this.agora = new Date();
            this.carregando = false;

            return ok;
        },

        /**
         * Carrega o menu de filiais do filtro, do mesmo lugar que as outras telas: a lista
         * de filiais ativas dos agregados, que ignora o recorte de propósito.
         */
        async carregarFiliais() {
            if (this.filiais.length > 0) {
                return true;
            }

            const { ok, dados } = await dashboardService.agregados({});

            this.filiais = ok ? dados.data.filiais ?? [] : [];

            return ok;
        },

        /**
         * Aplica um `fila.atualizada` vindo do canal da filial (US-9.4).
         *
         * O manifesto que sai é removido na hora; o que entra aparece na coluna do seu
         * status. Em nenhum dos dois casos a linha pode dobrar: o id manda, e a linha
         * existente é substituída em vez de somada — é isso que segura a releitura depois
         * de uma queda de conexão sem duplicar cartão.
         *
         * O evento carrega o que a portaria declarou, não o que o servidor deriva: o
         * `pallets_esperados` da coluna de entrada continua vindo da leitura da fila, e por
         * isso a tela reconcilia com `carregar()` depois de aplicar o evento.
         *
         * @param {{ acao: string, manifesto_id: number }} evento
         */
        aplicarEventoDaFila(evento) {
            const anterior = this.manifestos.find((manifesto) => manifesto.id === evento.manifesto_id) ?? null;
            const semEle = this.manifestos.filter((manifesto) => manifesto.id !== evento.manifesto_id);

            if (evento.acao === ACAO_SAIU) {
                this.manifestos = semEle;

                return;
            }

            this.manifestos = [...semEle, linhaDoEvento(evento, anterior, this.filiais)];
            this.agora = new Date();
        },

        /**
         * Reposiciona o relógio da espera. Quem o chama de tempos em tempos é a tela; o
         * cartão não recalcula sozinho, porque `Date.now()` dentro de getter não é reativo.
         */
        marcarAgora() {
            this.agora = new Date();
        },
    },
});

/**
 * Monta a linha da fila a partir do evento, aproveitando o que a leitura REST já trouxe.
 *
 * O evento tem o declarado pelo motorista; o derivado pelo servidor — o esperado de pallets
 * — só existe na leitura da fila. Enquanto a reconciliação não chega, vale o que a tela já
 * sabia sobre aquele manifesto, e não um zero inventado.
 */
function linhaDoEvento(evento, anterior, filiais) {
    const filial = filiais.find((linha) => linha.id === evento.filial_id) ?? null;

    return {
        ...(anterior ?? {}),
        id: evento.manifesto_id,
        numero: evento.numero,
        status: evento.status,
        filial_id: evento.filial_id,
        filial_codigo: anterior?.filial_codigo ?? filial?.codigo ?? null,
        filial_nome: anterior?.filial_nome ?? filial?.nome ?? null,
        veiculo_placa: evento.veiculo_placa,
        motorista_nome: evento.motorista ?? anterior?.motorista_nome ?? null,
        km_inicial_declarado: evento.km_inicial_declarado,
        km_final_declarado: evento.km_final_declarado,
        pallets_declarados_saida: evento.pallets_declarados_saida,
        pallets_declarados_entrada: evento.pallets_declarados_entrada,
        quantidade_destinos: evento.quantidade_destinos,
        pallets_esperados: anterior?.pallets_esperados ?? null,
        // O manifesto que acabou de entrar na fila começa a esperar agora; o que já estava
        // nela mantém a hora em que entrou, senão a espera se zeraria a cada evento.
        na_fila_desde: anterior?.na_fila_desde ?? evento.atualizado_em ?? new Date().toISOString(),
    };
}

/**
 * Converte o manifesto da fila no cartão do design: placa em destaque, identificação da
 * viagem, o tempo de espera e os três números que o porteiro confere.
 */
function cartaoDaFila(manifesto, coluna, agora) {
    const minutos = minutosDesde(manifesto.na_fila_desde, agora);
    const saida = coluna.slug === 'aguardando_saida';
    const esperados = manifesto.pallets_esperados ?? 0;
    const declarados = saida ? manifesto.pallets_declarados_saida : manifesto.pallets_declarados_entrada;

    return {
        id: manifesto.id,
        numero: manifesto.numero,
        placa: manifesto.veiculo_placa ?? '—',
        filial: manifesto.filial_codigo ?? '—',
        filialNome: manifesto.filial_nome ?? '',
        motorista: manifesto.motorista_nome ?? '—',
        minutos,
        espera: duracaoCurta(minutos),
        esperaTom: tomDaEspera(minutos),
        km: saida ? manifesto.km_inicial_declarado : manifesto.km_final_declarado,
        kmRotulo: saida ? 'km inicial declarado' : 'km final declarado',
        declarados,
        // Na entrada, o declarado tem com o que ser comparado: o esperado é o saldo que
        // saiu com o veículo e ainda não ficou em cliente nenhum. Na saída não há
        // esperado — o que o motorista declara é o ponto de partida da viagem.
        esperados: saida ? null : esperados,
        divergente: ! saida && declarados !== null && declarados !== undefined && declarados !== esperados,
        destinos: manifesto.quantidade_destinos,
        destino: { name: 'manifesto', params: { manifesto: manifesto.id } },
    };
}

function tomDaEspera(minutos) {
    if (minutos === null) {
        return 'neutro';
    }

    if (minutos >= ESPERA_CRITICA) {
        return 'bad';
    }

    return minutos >= ESPERA_EM_ATENCAO ? 'warn' : 'ok';
}
