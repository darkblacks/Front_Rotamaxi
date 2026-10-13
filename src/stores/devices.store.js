import { defineStore } from 'pinia';
import { dispositivoService } from '@/services/api/devices.api.js';

/**
 * Estado da tela de administração de dispositivos (US-9.3, US-1.4).
 *
 * A lista chega plana do servidor, ordenada pelo último uso, e a tela a agrupa **por
 * usuário**: é assim que a pergunta é feita na operação — "com quais aparelhos o fulano
 * está entrando?" —, e não aparelho a aparelho.
 *
 * A revogação é de um aparelho por vez, com confirmação e motivo. Revogar não apaga nada do
 * que aquele aparelho enviou: o dado operacional continua no banco, e o histórico de
 * revogações continua mostrando quem tirou o acesso, quando e por quê.
 */
export const useDispositivosStore = defineStore('dispositivos', {
    state: () => ({
        dispositivos: [],
        revogacoes: [],
        carregando: false,
        falha: null,
        revogando: null,
        falhaDaRevogacao: null,
    }),

    getters: {
        /**
         * Os aparelhos agrupados por usuário, na ordem de quem sincronizou mais
         * recentemente. Usuário sem `ultimo_pull_em` nenhum vai para o fim: ele é o que
         * ninguém precisa olhar primeiro.
         */
        porUsuario(state) {
            const grupos = new Map();

            for (const dispositivo of state.dispositivos) {
                const usuario = dispositivo.usuario;

                if (usuario === null) {
                    continue;
                }

                if (! grupos.has(usuario.id)) {
                    grupos.set(usuario.id, {
                        usuarioId: usuario.id,
                        nome: usuario.nome ?? '—',
                        papel: usuario.papel ?? '—',
                        ultimoPullEm: null,
                        dispositivos: [],
                    });
                }

                const grupo = grupos.get(usuario.id);

                grupo.dispositivos.push({
                    id: dispositivo.id,
                    usuarioId: usuario.id,
                    nome: dispositivo.dispositivo ?? '—',
                    ultimoPullEm: dispositivo.ultimo_pull_em,
                    criadoEm: dispositivo.criado_em,
                });

                if (dispositivo.ultimo_pull_em !== null
                    && (grupo.ultimoPullEm === null || dispositivo.ultimo_pull_em > grupo.ultimoPullEm)) {
                    grupo.ultimoPullEm = dispositivo.ultimo_pull_em;
                }
            }

            return [...grupos.values()].sort((um, outro) => {
                if (um.ultimoPullEm === outro.ultimoPullEm) {
                    return um.nome.localeCompare(outro.nome, 'pt-BR');
                }

                if (um.ultimoPullEm === null) {
                    return 1;
                }

                if (outro.ultimoPullEm === null) {
                    return -1;
                }

                return outro.ultimoPullEm.localeCompare(um.ultimoPullEm);
            });
        },

        /**
         * O histórico de revogações como a tela o escreve. É registro: a tela o mostra e
         * não o edita.
         */
        historico(state) {
            return state.revogacoes.map((revogacao) => ({
                id: revogacao.id,
                usuario: revogacao.usuario?.nome ?? '—',
                autor: revogacao.revogado_por?.nome ?? '—',
                motivo: revogacao.motivo ?? 'sem motivo registrado',
                revogadoEm: revogacao.revogado_em,
            }));
        },

        /**
         * `true` quando não há aparelho ativo nenhum — estado vazio, e não falha.
         */
        vazia(state) {
            return ! state.carregando && state.falha === null && state.dispositivos.length === 0;
        },
    },

    actions: {
        /**
         * Carrega a lista de aparelhos e o histórico de revogações.
         */
        async carregar() {
            this.carregando = true;

            const [lista, historico] = await Promise.all([
                dispositivoService.lista(),
                dispositivoService.revogacoes(),
            ]);

            if (lista.ok) {
                this.dispositivos = lista.dados.data ?? [];
                this.falha = null;
            } else {
                this.dispositivos = [];
                this.falha = lista.falha;
            }

            // O histórico é complemento da tela: falha nele não apaga a lista de ativos.
            this.revogacoes = historico.ok ? (historico.dados.data ?? []) : [];

            this.carregando = false;

            return lista.ok;
        },

        /**
         * Revoga **um** dispositivo e recarrega a tela: o aparelho sai dos ativos e entra
         * no histórico na mesma passada.
         */
        async revogar(usuarioId, dispositivoId, motivo) {
            this.revogando = dispositivoId;

            const { ok, falha } = await dispositivoService.revogar(usuarioId, dispositivoId, motivo);

            if (ok) {
                this.falhaDaRevogacao = null;
                await this.carregar();
            } else {
                this.falhaDaRevogacao = falha;
            }

            this.revogando = null;

            return ok;
        },
    },
});
