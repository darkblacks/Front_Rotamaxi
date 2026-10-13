import axios from 'axios';

/**
 * Instância única de HTTP do painel. Toda chamada do SPA passa por aqui: a API é
 * stateless por token Bearer, sem sessão por cookie e sem CSRF stateful.
 */
const http = axios.create({
    baseURL: '/api/v1',
    headers: {
        Accept: 'application/json',
    },
});

let authStore = null;
let router = null;

/**
 * Enquanto o guard de rota decide para onde ir, o interceptor não redireciona: um `push`
 * no meio da navegação cancelaria a decisão do guard e engoliria a mensagem do login.
 */
let redirecionamentoSuspenso = 0;

/**
 * Executa a chamada com o redirecionamento automático do interceptor suspenso.
 *
 * @param {() => Promise<any>} callback
 */
export async function semRedirecionar(callback) {
    redirecionamentoSuspenso += 1;

    try {
        return await callback();
    } finally {
        redirecionamentoSuspenso -= 1;
    }
}

/**
 * Manda o painel de volta ao login, limpando o estado local. O motivo vira a mensagem
 * que a tela de login mostra — sem ele o usuário só veria a tela trocar sozinha.
 */
function devolverAoLogin(motivo) {
    authStore?.limpar();

    if (redirecionamentoSuspenso > 0 || router === null) {
        return;
    }

    if (router.currentRoute.value.name !== 'login') {
        router.push({ name: 'login', query: { motivo } });
    }
}

/**
 * Liga a instância ao estado e ao roteador no boot. Sem isso o interceptor de 401
 * ainda responde, só não tem estado para limpar nem para onde redirecionar.
 */
export function configurarHttp(dependencias) {
    authStore = dependencias.authStore ?? null;
    router = dependencias.router ?? null;
}

http.interceptors.request.use((config) => {
    const token = authStore?.token;

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

http.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;

        // Token ausente, inválido ou revogado: o estado local não vale mais nada e a
        // tela seguinte seria uma sequência de 401. Limpa e devolve ao login.
        if (status === 401) {
            devolverAoLogin('sessao-encerrada');
        }

        // 403 num endpoint do painel: o token é válido, mas o papel não é `admin` — todas
        // as telas do painel responderiam o mesmo. Volta ao login dizendo o porquê.
        if (status === 403 && (error.config?.url ?? '').startsWith('/admin') && authStore?.temPapelDoPainel !== true) {
            devolverAoLogin('sem-permissao');
        }

        return Promise.reject(error);
    },
);

/**
 * Mensagens de falha por natureza do erro. A API já responde `message` em português;
 * estas cobrem o que não vem da API — rede caída e resposta sem corpo.
 */
const MENSAGENS = {
    rede: 'Sem resposta do servidor. Verifique a conexão e tente de novo.',
    cancelada: 'Requisição cancelada.',
    autenticacao: 'Sua sessão expirou. Entre novamente.',
    permissao: 'Você não tem permissão para esta ação.',
    naoEncontrado: 'Registro não encontrado.',
    validacao: 'Confira os dados informados.',
    limite: 'Muitas tentativas. Aguarde um instante e tente de novo.',
    servidor: 'Falha inesperada no servidor. Tente de novo em instantes.',
};

const TIPOS_POR_STATUS = {
    401: 'autenticacao',
    403: 'permissao',
    404: 'naoEncontrado',
    422: 'validacao',
    429: 'limite',
};

/**
 * Traduz o erro do axios no estado de falha que a tela sabe exibir.
 *
 * @returns {{ tipo: string, status: number|null, mensagem: string, errors: object, tentarEm: number|null, tentarDeNovo: boolean }}
 */
export function extrairFalha(error) {
    const status = error?.response?.status ?? null;

    if (status === null) {
        const tipo = axios.isCancel?.(error) ? 'cancelada' : 'rede';

        return {
            tipo,
            status: null,
            mensagem: MENSAGENS[tipo],
            errors: {},
            tentarEm: null,
            tentarDeNovo: tipo === 'rede',
        };
    }

    const tipo = TIPOS_POR_STATUS[status] ?? 'servidor';
    const corpo = error.response?.data ?? {};

    return {
        tipo,
        status,
        mensagem: typeof corpo.message === 'string' && corpo.message !== '' ? corpo.message : MENSAGENS[tipo],
        errors: corpo.errors ?? {},
        // O 429 do login informa em quantos segundos o CPF volta a poder tentar; a tela
        // mostra esse tempo correndo em vez de um "tente mais tarde" sem prazo.
        tentarEm: typeof corpo.tentar_em === 'number' ? corpo.tentar_em : null,
        tentarDeNovo: status >= 500 || status === 429,
    };
}

/**
 * Executa a chamada e devolve sempre um resultado, nunca uma exceção solta: erro de
 * rede ou de API vira `{ ok: false, falha }` e a tela mostra o estado de falha com
 * opção de nova tentativa, em vez de ficar em branco.
 *
 * @returns {Promise<{ ok: boolean, dados: any, falha: object|null }>}
 */
export async function requisitar(callback) {
    try {
        const resposta = await callback(http);

        return { ok: true, dados: resposta?.data ?? null, falha: null };
    } catch (error) {
        return { ok: false, dados: null, falha: extrairFalha(error) };
    }
}

export default http;
