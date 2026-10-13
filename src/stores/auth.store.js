import { defineStore } from 'pinia';
import { authService } from '@/services/api/auth.api.js';
import { semRedirecionar } from '@/services/api/http.js';
import { temPapelDoPainel } from '@/domain/access/roles.js';

const CHAVE_TOKEN = 'tms.painel.token';

/**
 * Papel exigido para entrar no painel. Motorista e porteiro autenticam no mesmo endpoint,
 * mas os endpoints do painel respondem 403 para eles.
 */
export const PAPEL_DO_PAINEL = 'admin';

export const MENSAGEM_SEM_PERMISSAO = 'Seu usuário não tem um papel com acesso ao painel (admin, roteirizador, conferente, porteiro, equipe CT, motorista ou SAC).';

export const MENSAGEM_SESSAO_ENCERRADA = 'Sua sessão expirou. Entre novamente.';

/**
 * Nome do token Sanctum deste navegador. O login apaga o token de mesmo nome, então o
 * painel não acumula um token por aba.
 */
const DISPOSITIVO = 'Painel administrativo';

/**
 * Leitura e escrita do token protegidas por try/catch: em janela privada ou com
 * armazenamento bloqueado, o acesso lança e derrubaria o boot do SPA.
 */
function lerToken() {
    try {
        return window.localStorage.getItem(CHAVE_TOKEN);
    } catch {
        return null;
    }
}

function gravarToken(token) {
    try {
        if (token === null) {
            window.localStorage.removeItem(CHAVE_TOKEN);

            return;
        }

        window.localStorage.setItem(CHAVE_TOKEN, token);
    } catch {
        // Sem armazenamento o token vale só para a aba aberta.
    }
}

export const useAuthStore = defineStore('auth', {
    state: () => ({
        token: null,
        usuario: null,
        pessoaId: null,
        vinculoPessoaCarregado: false,
        entrando: false,
    }),

    getters: {
        autenticado: (state) => state.token !== null,
        perfilCarregado: (state) => state.usuario !== null,
        papeis: (state) => state.usuario?.papeis ?? [],
        ehAdmin: (state) => (state.usuario?.papeis ?? []).includes(PAPEL_DO_PAINEL),
        temPapelDoPainel: (state) => temPapelDoPainel(state.usuario?.papeis ?? []),
        nome: (state) => state.usuario?.nome ?? '',
        filialDoUsuario: (state) => state.usuario?.filial_id ?? state.usuario?.filial?.id ?? null,
        pessoaVinculada: (state) => state.pessoaId !== null,
    },

    actions: {
        restaurar() {
            this.token = lerToken();
        },

        definirToken(token) {
            this.token = token;
            gravarToken(token);
        },

        definirUsuario(usuario) {
            const mudou = this.usuario?.id !== usuario?.id;
            this.usuario = usuario;
            if (mudou) {
                this.pessoaId = null;
                this.vinculoPessoaCarregado = false;
            }
        },

        limpar() {
            this.token = null;
            this.usuario = null;
            this.pessoaId = null;
            this.vinculoPessoaCarregado = false;
            gravarToken(null);
        },

        /**
         * O endpoint /perfil é legado e não contém pessoa_id. Para o painel, resolvemos o
         * próprio registro na listagem real de users e guardamos somente o ID da Pessoa.
         * Foto e demais dados continuam vindo do cadastro de Pessoas, sem duplicação.
         */
        async carregarPessoaVinculada(forcar = false) {
            if (! this.usuario?.id || ! this.ehAdmin) {
                this.pessoaId = null;
                this.vinculoPessoaCarregado = true;
                return null;
            }
            if (this.vinculoPessoaCarregado && ! forcar) {
                return this.pessoaId;
            }

            const busca = this.usuario.cpf || this.usuario.nome || '';
            const { ok, dados } = await authService.usuarios({ busca, por_pagina: 100 });
            if (! ok) {
                return this.pessoaId;
            }
            const lista = Array.isArray(dados?.data) ? dados.data : [];
            const cpfAtual = String(this.usuario.cpf || '').replace(/\D/g, '');
            const registro = lista.find(item => Number(item.id) === Number(this.usuario.id))
                ?? lista.find(item => String(item.cpf || '').replace(/\D/g, '') === cpfAtual);

            this.pessoaId = registro?.pessoa_id ? Number(registro.pessoa_id) : null;
            this.vinculoPessoaCarregado = true;
            return this.pessoaId;
        },

        /**
         * Login pelo mesmo `POST /api/v1/auth/login` do aplicativo. Quem autentica mas não
         * é admin tem o token revogado na hora: ele só tomaria 403 nos endpoints do painel.
         *
         * @param {{ cpf: string, pin: string }} credenciais
         * @returns {Promise<{ ok: boolean, falha: object|null }>}
         */
        async entrar({ cpf, pin }) {
            this.entrando = true;

            try {
                const { ok, dados, falha } = await authService.entrar({
                    cpf,
                    pin,
                    dispositivo: DISPOSITIVO,
                });

                if (! ok) {
                    return { ok: false, falha };
                }

                this.definirToken(dados.token);
                this.definirUsuario(dados.usuario);

                if (! this.temPapelDoPainel) {
                    await this.sair();

                    return {
                        ok: false,
                        falha: {
                            tipo: 'permissao',
                            status: 403,
                            mensagem: MENSAGEM_SEM_PERMISSAO,
                            errors: {},
                            tentarEm: null,
                            tentarDeNovo: false,
                        },
                    };
                }

                void this.carregarPessoaVinculada(true);
                return { ok: true, falha: null };
            } finally {
                this.entrando = false;
            }
        },

        /**
         * Descarta o token no cliente e revoga no servidor. A ordem importa: a revogação
         * precisa do token no header, então o estado local só é limpo depois da chamada.
         */
        async sair() {
            if (this.token !== null) {
                await authService.sair();
            }

            this.limpar();
        },

        /**
         * Carrega o perfil do token guardado — é o que devolve os papéis depois de um
         * refresh, já que só o token sobrevive no armazenamento do navegador.
         *
         * Token inválido ou revogado responde 401; o interceptor já limpou o estado.
         *
         * @returns {Promise<boolean>}
         */
        async carregarPerfil() {
            if (this.perfilCarregado) {
                return true;
            }

            // Chamada feita de dentro do guard de rota: o redirecionamento do interceptor
            // fica suspenso para o guard decidir o destino e a mensagem.
            const { ok, dados } = await semRedirecionar(() => authService.perfil());

            if (! ok) {
                return false;
            }

            // `GET /perfil` responde pelo resource, com o envelope `data`; o login devolve o
            // mesmo perfil já sem envelope.
            this.definirUsuario(dados?.data ?? dados);
            if (this.ehAdmin) void this.carregarPessoaVinculada();

            return true;
        },
    },
});
