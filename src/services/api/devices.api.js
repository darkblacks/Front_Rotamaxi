import { requisitar } from '@/services/api/http.js';

/**
 * Endpoints da administração de dispositivos (US-9.3, US-1.4).
 *
 * A revogação é sempre de **um** aparelho: o endpoint recebe o usuário e o dispositivo,
 * porque derrubar todos os aparelhos de alguém por engano tiraria da rua o motorista que
 * só perdeu um telefone.
 */
export const dispositivoService = {
    /**
     * Aparelhos ativos de todos os usuários, com o dono e o último `pull` de cada um.
     */
    lista() {
        return requisitar((http) => http.get('/admin/dispositivos'));
    },

    /**
     * Histórico de revogações, da mais recente para a mais antiga. A linha sobrevive ao
     * token revogado: é ela que diz quem tirou o acesso, quando e por quê.
     */
    revogacoes() {
        return requisitar((http) => http.get('/admin/dispositivos/revogacoes'));
    },

    /**
     * Revoga um dispositivo. O motivo é opcional para a API e pedido pela tela: revogação
     * sem motivo vira um histórico que não explica nada.
     *
     * @param {number|string} usuarioId
     * @param {number|string} dispositivoId
     * @param {string} motivo
     */
    revogar(usuarioId, dispositivoId, motivo) {
        return requisitar((http) => http.delete(
            `/admin/usuarios/${usuarioId}/dispositivos/${dispositivoId}`,
            { data: { motivo } },
        ));
    },
};
