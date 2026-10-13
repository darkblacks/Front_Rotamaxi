import { defineStore } from 'pinia';
import { CANAL_DE_OCORRENCIAS, CANAL_DO_ADMIN, canalDaFilial, canalDoManifesto } from '@/services/realtime/echo.js';
import { tempoRealService } from '@/services/realtime/realtime.service.js';

/**
 * Estados da conexão do tempo real que a interface mostra (US-9.4).
 *
 * São os três estados do indicador: ligado ao canal, tentando voltar e sem conexão. O
 * painel nunca fica sem dizer em qual deles está — tela muda sozinha sem aviso é pior do
 * que tela parada com aviso.
 */
export const CONECTADO = 'conectado';

export const RECONECTANDO = 'reconectando';

export const OFFLINE = 'offline';

/**
 * Quantos acontecimentos o cartão "Ao vivo" guarda. Passado disso a lista rola sem fim e
 * o navegador paga por um histórico que ninguém lê — o histórico completo está na linha do
 * tempo do manifesto.
 */
export const LIMITE_DE_ACONTECIMENTOS = 40;

/**
 * Tradução do estado cru do transporte para os três estados do indicador.
 *
 * "Conectando" e "indisponível" são a mesma coisa para quem olha a tela: o painel está
 * tentando voltar. Falha definitiva e desconexão são "sem conexão" — aí a tela é uma
 * fotografia da última leitura, e isso precisa estar escrito.
 */
export const ESTADOS_DO_TRANSPORTE = {
    initialized: OFFLINE,
    connecting: RECONECTANDO,
    connected: CONECTADO,
    unavailable: RECONECTANDO,
    failed: OFFLINE,
    disconnected: OFFLINE,
};

/**
 * Quem quer ser avisado quando a conexão volta. Não moram no estado da store porque são
 * funções das telas: o que a store guarda é o que a interface desenha.
 *
 * @type {Set<() => void>}
 */
const ouvintesDeReconexao = new Set();

/**
 * Cancelamento da observação do transporte, para o logout não deixar ouvinte pendurado.
 *
 * @type {(() => void)|null}
 */
let cancelarObservacao = null;

const ROTULOS = {
    [CONECTADO]: 'Ao vivo',
    [RECONECTANDO]: 'Reconectando…',
    [OFFLINE]: 'Sem conexão',
};

const TONS = {
    [CONECTADO]: 'ok',
    [RECONECTANDO]: 'warn',
    [OFFLINE]: 'bad',
};

/**
 * Converte o payload de `divergencia.aberta` — do canal privado do admin ou da leitura
 * REST da mesma divergência — no acontecimento que o cartão mostra.
 *
 * A chave é o que impede linha repetida: a releitura depois de uma queda de conexão traz
 * de volta divergências que já entraram pelo WebSocket, e elas precisam se reconhecer.
 */
export function acontecimentoDaDivergencia(divergencia) {
    const manifesto = divergencia.manifesto?.numero ?? divergencia.numero ?? divergencia.manifesto_id;

    return {
        chave: `divergencia:${divergencia.id}`,
        quando: divergencia.criado_em ?? new Date().toISOString(),
        tom: 'bad',
        texto: `Divergência de ${divergencia.tipo ?? 'carga'} aberta · MAN ${manifesto} · dif. ${divergencia.diferenca}`,
    };
}

/**
 * Converte o payload de `manifesto.progresso` no acontecimento do cartão. A origem diz o
 * que mudou: uma parada recebeu desfecho ou o manifesto fechou na portaria.
 */
export function acontecimentoDoProgresso(progresso) {
    const fechamento = progresso.origem === 'fechamento';
    const paradas = progresso.paradas ?? {};

    return {
        chave: fechamento
            ? `manifesto:${progresso.manifesto_id}:fechado`
            : `manifesto:${progresso.manifesto_id}:paradas:${paradas.concluidas ?? 0}:${paradas.nao_realizadas ?? 0}`,
        quando: progresso.atualizado_em ?? new Date().toISOString(),
        tom: fechamento ? 'info' : 'ok',
        texto: fechamento
            ? `Manifesto ${progresso.numero} fechado na portaria`
            : `MAN ${progresso.numero} · ${paradas.concluidas ?? 0}/${paradas.total ?? 0} entregas concluídas`,
    };
}

/**
 * Conexão do tempo real e o que ela já trouxe (US-9.4).
 *
 * A store é o ponto de encontro entre o cartão "Ao vivo" e o Echo: a tela semeia a lista
 * com o que o servidor já sabia e o WebSocket empilha o que acontece a partir de agora.
 * Quem liga o Echo a ela é a fase 40 — daí o estado nascer `offline`, e não "conectado por
 * suposição".
 */
export const useTempoRealStore = defineStore('tempoReal', {
    state: () => ({
        estado: OFFLINE,
        acontecimentos: [],
        // A conexão já esteve de pé alguma vez nesta sessão. É o que separa a primeira
        // conexão — a tela acabou de carregar tudo — de uma reconexão, que exige releitura
        // porque o painel esteve cego por um tempo.
        jaConectou: false,
    }),

    getters: {
        rotuloDaConexao(state) {
            return ROTULOS[state.estado] ?? ROTULOS[OFFLINE];
        },

        tomDaConexao(state) {
            return TONS[state.estado] ?? TONS[OFFLINE];
        },

        conectado(state) {
            return state.estado === CONECTADO;
        },
    },

    actions: {
        definirEstado(estado) {
            if (! [CONECTADO, RECONECTANDO, OFFLINE].includes(estado)) {
                return;
            }

            const anterior = this.estado;

            this.estado = estado;

            if (estado !== CONECTADO) {
                return;
            }

            // Voltou depois de uma queda: enquanto o painel esteve fora, o campo continuou
            // andando e os eventos perdidos não são reenviados. Quem ouve a reconexão relê
            // os endpoints agregados — a fonte dos mesmos números que o evento traria.
            if (this.jaConectou && anterior !== CONECTADO) {
                ouvintesDeReconexao.forEach((ouvinte) => ouvinte());
            }

            this.jaConectou = true;
        },

        /**
         * Abre a conexão do painel com o token do administrador — o **mesmo** token Bearer
         * das chamadas REST. Sem token não há conexão: a autorização de canal responderia
         * 401 e o indicador ficaria piscando por nada.
         *
         * @param {string|null} token
         */
        conectar(token) {
            if (! token) {
                this.definirEstado(OFFLINE);

                return;
            }

            cancelarObservacao ??= tempoRealService.aoMudarEstado((estado) => {
                this.definirEstado(ESTADOS_DO_TRANSPORTE[estado] ?? OFFLINE);
            });

            tempoRealService.conectar(token);
        },

        /**
         * Fecha a conexão e zera o indicador. É o que o logout faz — token revogado não
         * continua escutando a operação.
         */
        desconectar() {
            cancelarObservacao?.();
            cancelarObservacao = null;

            tempoRealService.desconectar();

            this.estado = OFFLINE;
            this.jaConectou = false;
        },

        /**
         * Assina o canal privado do administrador, onde chegam `divergencia.aberta` e
         * `manifesto.progresso`. Devolve como desfazer a assinatura — a tela que sai de
         * cena desliga o que registrou.
         *
         * @param {Record<string, (payload: object) => void>} ouvintes
         * @returns {() => void}
         */
        assinarAdmin(ouvintes) {
            return tempoRealService.assinar(CANAL_DO_ADMIN, ouvintes);
        },

        /**
         * Assina o canal privado da fila de uma filial, onde chega `fila.atualizada`.
         *
         * @param {number} filialId
         * @param {Record<string, (payload: object) => void>} ouvintes
         * @returns {() => void}
         */
        assinarFilial(filialId, ouvintes) {
            return tempoRealService.assinar(canalDaFilial(filialId), ouvintes);
        },

        /**
         * Assina o canal privado de um manifesto (Mapa Operacional).
         *
         * @param {number|string} manifestoId
         * @param {Record<string, (payload: object) => void>} ouvintes
         * @returns {() => void}
         */
        assinarManifesto(manifestoId, ouvintes) {
            return tempoRealService.assinar(canalDoManifesto(manifestoId), ouvintes);
        },

        /**
         * Assina o canal privado das ocorrências (SAC).
         *
         * @param {Record<string, (payload: object) => void>} ouvintes
         * @returns {() => void}
         */
        assinarOcorrencias(ouvintes) {
            return tempoRealService.assinar(CANAL_DE_OCORRENCIAS, ouvintes);
        },

        /**
         * Registra o que fazer quando a conexão voltar, e devolve como cancelar — a tela
         * que sai de cena não relê nada.
         *
         * @param {() => void} callback
         * @returns {() => void}
         */
        aoReconectar(callback) {
            ouvintesDeReconexao.add(callback);

            return () => ouvintesDeReconexao.delete(callback);
        },

        /**
         * Empilha um acontecimento. A lista fica sempre em ordem cronológica inversa, e a
         * chave repetida atualiza a linha existente em vez de duplicá-la — é o que mantém
         * a releitura pós-queda de conexão sem linha dobrada.
         */
        registrar(acontecimento) {
            const semAnterior = this.acontecimentos.filter((linha) => linha.chave !== acontecimento.chave);

            this.acontecimentos = [acontecimento, ...semAnterior]
                .sort((uma, outra) => (uma.quando < outra.quando ? 1 : -1))
                .slice(0, LIMITE_DE_ACONTECIMENTOS);
        },

        /**
         * Semeia a lista com o que o servidor já registrou no período. Sem isso o cartão
         * abriria vazio em toda troca de tela, mesmo com o dia cheio de acontecimento.
         */
        semear(acontecimentos) {
            acontecimentos.forEach((acontecimento) => this.registrar(acontecimento));
        },

        /**
         * Esvazia a lista. O recorte da tela mudou: o que estava nela é de outro período.
         */
        limpar() {
            this.acontecimentos = [];
        },
    },
});
