import { defineStore } from 'pinia';

const CHAVE_TEMA = 'tms.painel.tema';
const CHAVE_ASIDE = 'tms.painel.aside-recolhido';

const TEMAS = ['claro', 'escuro'];

/**
 * Leitura do armazenamento do navegador protegida por try/catch: em janela privada
 * ou com armazenamento bloqueado, o acesso lança e derrubaria o boot do SPA.
 */
function ler(chave) {
    try {
        return window.localStorage.getItem(chave);
    } catch {
        return null;
    }
}

function gravar(chave, valor) {
    try {
        window.localStorage.setItem(chave, valor);
    } catch {
        // Sem armazenamento a preferência vale só para a sessão atual.
    }
}

/**
 * Largura de telefone. Fora do navegador (ou sem `matchMedia`), assume tela larga.
 *
 * Fica como função, e não como getter da store: `matchMedia` não é reativo e um getter
 * seria memoizado com o valor da primeira leitura, errando depois de girar o aparelho.
 */
export function telaEstreita() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return false;
    }

    return window.matchMedia('(max-width: 900px)').matches;
}

export const useUiStore = defineStore('ui', {
    state: () => ({
        tema: 'claro',
        asideRecolhido: false,
    }),

    actions: {
        restaurar() {
            const tema = ler(CHAVE_TEMA);
            if (TEMAS.includes(tema)) {
                this.tema = tema;
            }

            // Sem preferência gravada, a largura da tela decide: no telefone o `aside`
            // nasce recolhido para a tela caber sem rolagem horizontal.
            const aside = ler(CHAVE_ASIDE);
            this.asideRecolhido = aside === null ? telaEstreita() : aside === '1';
            this.aplicarTemaNoDocumento();
        },

        definirTema(tema) {
            if (! TEMAS.includes(tema)) {
                return;
            }

            this.tema = tema;
            gravar(CHAVE_TEMA, tema);
            this.aplicarTemaNoDocumento();
        },

        alternarTema() {
            this.definirTema(this.tema === 'escuro' ? 'claro' : 'escuro');
        },

        alternarAside() {
            this.asideRecolhido = ! this.asideRecolhido;
            gravar(CHAVE_ASIDE, this.asideRecolhido ? '1' : '0');
        },

        recolherAside() {
            if (! this.asideRecolhido) {
                this.alternarAside();
            }
        },

        /**
         * O tema vive no elemento raiz, e não no container do SPA, porque `body` também
         * pinta o fundo: preso num descendente, o `body` ficaria no tema claro.
         */
        aplicarTemaNoDocumento() {
            if (typeof document !== 'undefined') {
                document.documentElement.dataset.theme = this.tema;
            }
        },
    },
});
