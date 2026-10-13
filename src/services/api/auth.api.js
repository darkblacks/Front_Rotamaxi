import { requisitar } from '@/services/api/http.js';

/**
 * Autenticação do painel. O endpoint é o mesmo do aplicativo do motorista: o painel não
 * tem login próprio, sessão por cookie nem CSRF stateful — só o token Bearer do Sanctum.
 */
export const authService = {
    /**
     * @param {{ cpf: string, pin: string, dispositivo: string }} credenciais
     */
    entrar(credenciais) {
        return requisitar((http) => http.post('/auth/login', credenciais));
    },

    /**
     * Revoga no servidor o token desta aba. Sem isso o token seguiria válido para sempre.
     */
    sair() {
        return requisitar((http) => http.post('/auth/logout'));
    },

    /**
     * Perfil do token guardado. É o que devolve os papéis depois de um refresh da página.
     */
    perfil() {
        return requisitar((http) => http.get('/perfil'));
    },

    /**
     * Resolve o registro real de `users` do usuário autenticado para descobrir se ele
     * está vinculado a uma Pessoa. O perfil legado não expõe `pessoa_id`.
     */
    usuarios(filtros = {}) {
        return requisitar((http) => http.get('/admin/usuarios', { params: filtros }));
    },
};
