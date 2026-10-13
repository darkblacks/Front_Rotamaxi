/**
 * Papéis do painel e visibilidade das telas de Operações.
 * Cada tela declara os papéis que a enxergam; `admin` enxerga tudo. Nunca depende de
 * usuário com vários papéis: basta ter UM dos papéis exigidos.
 */

export const PAPEIS = ['admin', 'roteirizador', 'conferente', 'porteiro', 'equipe_ct', 'motorista', 'sac'];

const ADMIN = ['admin'];
const PLANEJAMENTO = ['admin', 'roteirizador'];

/**
 * Menu Operações, na ordem de exibição. `rota` é o nome da rota; `papeis` quem vê.
 */
export const MENU_OPERACOES = [
    { id: 'mapa-operacional', rotulo: 'Mapa operacional', rota: 'mapa-operacional', papeis: ['admin', 'roteirizador', 'sac', 'porteiro', 'conferente', 'equipe_ct'] },
    { id: 'manifestos', rotulo: 'Manifestos', rota: 'manifestos', papeis: PLANEJAMENTO },
    { id: 'planejamento', rotulo: 'Planejamento / Serviços', rota: 'planejamento', papeis: PLANEJAMENTO },
    { id: 'fila-portaria', rotulo: 'Fila da portaria', rota: 'fila-portaria', papeis: ['admin', 'porteiro'] },
    { id: 'conferencia', rotulo: 'Conferência / Coletas', rota: 'conferencia', papeis: ['admin', 'conferente'] },
    { id: 'recebimentos', rotulo: 'Recebimentos CT', rota: 'recebimentos', papeis: ['admin', 'equipe_ct'] },
    { id: 'ocorrencias', rotulo: 'Ocorrências', rota: 'ocorrencias', papeis: ['admin', 'sac', 'roteirizador'] },
    { id: 'meu-manifesto', rotulo: 'Meu manifesto', rota: 'meu-manifesto', papeis: ['admin', 'motorista'] },
    { id: 'emprestimos-operacionais', rotulo: 'Empréstimos de motoristas', rota: 'emprestimos-operacionais', papeis: ADMIN },
    { id: 'saldo-pallets', rotulo: 'Saldo de pallets', rota: 'saldo-pallets', papeis: ADMIN },
    { id: 'divergencias', rotulo: 'Divergências', rota: 'divergencias', papeis: ADMIN },
];

export function temPapelDoPainel(papeisDoUsuario) {
    return (papeisDoUsuario ?? []).some((p) => PAPEIS.includes(p));
}

/**
 * @param {string[]} papeisDoUsuario
 * @param {string[]|undefined} exigidos  sem exigência => só admin (padrão seguro)
 */
export function podeAcessar(papeisDoUsuario, exigidos) {
    const meus = papeisDoUsuario ?? [];
    if (meus.includes('admin')) return true;
    const lista = exigidos && exigidos.length > 0 ? exigidos : ADMIN;
    return lista.some((p) => meus.includes(p));
}

export function menuVisivel(papeisDoUsuario, menu = MENU_OPERACOES) {
    return menu.filter((item) => podeAcessar(papeisDoUsuario, item.papeis));
}

/** Primeira tela do menu que o usuário enxerga (destino padrão após o login). */
export function primeiraRotaPermitida(papeisDoUsuario) {
    return menuVisivel(papeisDoUsuario)[0]?.rota ?? null;
}

/** Papéis exigidos por uma rota: `meta.papeis`, senão o item de menu correspondente, senão só admin. */
export function papeisDaRota(meta, nome) {
    if (meta?.papeis) return meta.papeis;
    const id = meta?.menu ?? nome;
    return MENU_OPERACOES.find((i) => i.id === id)?.papeis;
}
