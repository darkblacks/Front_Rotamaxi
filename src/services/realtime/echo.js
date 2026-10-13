import Echo from 'laravel-echo';

import Pusher from 'pusher-js';

window.Pusher = Pusher;

/**
 * Canal privado onde o painel escuta a operação inteira (US-9.4).
 *
 * É o mesmo nome registrado em `routes/channels.php`; o prefixo `private-` quem acrescenta
 * é o cliente, na hora de pedir a autorização.
 */
export const CANAL_DO_ADMIN = 'admin';

/**
 * Canal privado da fila de uma filial. O painel assina um por filial em observação — a
 * fila de uma filial nunca aparece na coluna da outra.
 */
export function canalDaFilial(filialId) {
    return `filial.${filialId}`;
}

/**
 * Canal privado de um manifesto (Mapa Operacional): posição, ETA, etapas e ocorrências.
 */
export function canalDoManifesto(manifestoId) {
    return `manifesto.${manifestoId}`;
}

/**
 * Canal privado das ocorrências (SAC/admin/roteirizador): `manifest.occurrence.created|updated`.
 */
export const CANAL_DE_OCORRENCIAS = 'ocorrencias';

/**
 * Rota de autorização das assinaturas, a mesma que o app do motorista usa.
 */
export const ENDPOINT_DE_AUTORIZACAO = '/broadcasting/auth';

/**
 * Cria a conexão do tempo real autenticada pelo **mesmo token Bearer** dos endpoints.
 *
 * O painel é stateless: não há sessão por cookie para o `/broadcasting/auth` reconhecer,
 * então o token vai no header da autorização de canal, exatamente como vai nas chamadas
 * REST. Sem token não se cria conexão nenhuma — assinatura anônima só tomaria 401.
 *
 * Nenhuma credencial mora neste arquivo: a chave pública do Reverb vem do ambiente, pelo
 * `VITE_REVERB_APP_KEY`, e o segredo do app nunca chega ao navegador.
 *
 * @param {string} token
 */
export function criarEcho(token) {
    const chave = import.meta.env.VITE_REVERB_APP_KEY;

    if (! chave) {
        return null;
    }

    return new Echo({
        broadcaster: 'reverb',
        key: chave,
        wsHost: import.meta.env.VITE_REVERB_HOST,
        wsPort: import.meta.env.VITE_REVERB_PORT ?? 80,
        wssPort: import.meta.env.VITE_REVERB_PORT ?? 443,
        forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'https') === 'https',
        enabledTransports: ['ws', 'wss'],
        authEndpoint: ENDPOINT_DE_AUTORIZACAO,
        auth: {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
            },
        },
    });
}
