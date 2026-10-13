import { criarEcho } from '@/services/realtime/echo.js';

/**
 * Conexão do tempo real do painel (US-9.4).
 *
 * O Echo vive aqui, e não na store: ele é um objeto com socket aberto e não tem por que ser
 * reativo nem serializável. A store guarda o que a tela mostra — o estado da conexão e os
 * acontecimentos —, e este serviço guarda o que fala com o servidor.
 *
 * Há uma conexão só para o painel inteiro, com todas as telas dividindo o mesmo socket: a
 * troca de tela tira e põe assinatura de canal, não derruba e levanta conexão.
 */
let echo = null;

/**
 * Token que abriu a conexão atual. Token trocado — outro login na mesma aba — obriga a
 * refazer a conexão: a autorização de canal usa o header, e o antigo já não vale.
 */
let tokenAtual = null;

/**
 * Canais assinados, por nome, com quantos grupos de ouvintes dependem de cada um.
 *
 * A contagem existe porque duas telas podem querer o mesmo canal ao mesmo tempo — é o que
 * acontece na navegação, quando a tela nova monta antes de a antiga desmontar. Abandonar o
 * canal na saída da primeira deixaria a segunda surda; por isso ele só é abandonado quando
 * o último ouvinte vai embora.
 *
 * @type {Map<string, { canal: object, ouvintes: number }>}
 */
const canais = new Map();

/**
 * Ouvintes do estado da conexão. Recebem o estado cru do transporte; quem o traduz para os
 * três estados do indicador é a store — é ela que fala a língua da interface.
 *
 * @type {Set<(estado: string) => void>}
 */
const ouvintesDoEstado = new Set();

function avisarEstado(estado) {
    ouvintesDoEstado.forEach((ouvinte) => ouvinte(estado));
}

/**
 * Liga os avisos de estado ao transporte. O `state_change` do pusher-js cobre o ciclo
 * inteiro — conectando, conectado, indisponível, desconectado —, que é justamente o que o
 * indicador precisa dizer ao operador.
 */
function observarConexao(instancia) {
    const conexao = instancia?.connector?.pusher?.connection;

    if (! conexao) {
        return;
    }

    avisarEstado(conexao.state);

    conexao.bind('state_change', ({ current }) => avisarEstado(current));

    // Falha na conexão não é "conectando": ela precisa aparecer como queda, senão o
    // indicador ficaria eternamente em "reconectando" depois de um erro definitivo.
    conexao.bind('error', () => avisarEstado(conexao.state));
}

export const tempoRealService = {
    /**
     * Abre a conexão autenticada pelo token do painel. Chamar de novo com o mesmo token não
     * reabre nada — é o caso da tela que remonta com a conexão de pé.
     *
     * @param {string|null} token
     */
    conectar(token) {
        if (! token) {
            return null;
        }

        if (echo !== null && tokenAtual === token) {
            return echo;
        }

        this.desconectar();

        echo = criarEcho(token);

        if (echo === null) {
            tokenAtual = null;
            avisarEstado('unavailable');
            return null;
        }

        tokenAtual = token;
        observarConexao(echo);

        return echo;
    },

    /**
     * Fecha a conexão e esquece as assinaturas. É o que o logout faz: token revogado não
     * pode continuar recebendo evento da operação.
     */
    desconectar() {
        canais.clear();

        if (echo !== null) {
            echo.disconnect();
        }

        echo = null;
        tokenAtual = null;
    },

    /**
     * Assina um canal privado, registra os ouvintes por nome de evento e devolve como
     * cancelar exatamente estes ouvintes.
     *
     * Quem assina é sempre quem cancela: a tela que sai de cena desfaz o que registrou e
     * não desliga o que outra tela ainda usa.
     *
     * @param {string} nome  nome do canal, sem o prefixo `private-`
     * @param {Record<string, (payload: object) => void>} ouvintes
     * @returns {() => void}
     */
    assinar(nome, ouvintes) {
        if (echo === null) {
            return () => {};
        }

        const registro = canais.get(nome) ?? { canal: echo.private(nome), ouvintes: 0 };
        const canal = registro.canal;

        Object.entries(ouvintes).forEach(([evento, ouvinte]) => {
            // O ponto na frente diz ao Echo que o nome do evento é literal, e não uma
            // classe do namespace da aplicação — é o nome que `broadcastAs()` publica.
            canal.listen(`.${evento}`, ouvinte);
        });

        registro.ouvintes += 1;
        canais.set(nome, registro);

        return () => this.cancelar(nome, ouvintes);
    },

    /**
     * Desliga um grupo de ouvintes. O canal só é abandonado quando o último grupo sai — a
     * tela que ficou continua recebendo o que pediu.
     *
     * @param {string} nome
     * @param {Record<string, (payload: object) => void>} ouvintes
     */
    cancelar(nome, ouvintes) {
        const registro = canais.get(nome);

        if (registro === undefined) {
            return;
        }

        Object.entries(ouvintes).forEach(([evento, ouvinte]) => {
            registro.canal.stopListening(`.${evento}`, ouvinte);
        });

        registro.ouvintes -= 1;

        if (registro.ouvintes > 0) {
            return;
        }

        canais.delete(nome);

        echo?.leave(nome);
    },

    /**
     * Nomes dos canais assinados agora. Serve à tela que precisa acertar as assinaturas
     * quando o recorte muda — a fila da portaria troca de filial sem recarregar.
     *
     * @returns {string[]}
     */
    canaisAssinados() {
        return [...canais.keys()];
    },

    /**
     * Registra um ouvinte do estado cru da conexão e devolve como cancelá-lo.
     *
     * @param {(estado: string) => void} ouvinte
     * @returns {() => void}
     */
    aoMudarEstado(ouvinte) {
        ouvintesDoEstado.add(ouvinte);

        return () => ouvintesDoEstado.delete(ouvinte);
    },

    /**
     * `true` quando existe conexão aberta. Usado pelas telas para não assinar canal antes
     * de o painel ter conexão.
     */
    conectado() {
        return echo !== null;
    },
};

/**
 * Agrupa chamadas seguidas numa só, depois da rajada.
 *
 * O campo não manda um acontecimento por vez: um manifesto fechando dispara progresso e
 * divergência quase juntos, e cada um pediria a releitura dos agregados. Sem agrupar, a
 * tela faria três consultas para mostrar o mesmo número.
 *
 * @param {() => void} callback
 * @param {number} espera
 * @returns {() => void}
 */
export function agrupar(callback, espera = 800) {
    let agendado = null;

    return () => {
        if (agendado !== null) {
            clearTimeout(agendado);
        }

        agendado = setTimeout(() => {
            agendado = null;
            callback();
        }, espera);
    };
}
