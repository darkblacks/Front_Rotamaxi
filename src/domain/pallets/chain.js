/**
 * Cadeia de custódia de pallets (contrato V2, GET /mapa/manifestos/{id}/pallets):
 * ESPERADO -> CONFERIDO -> ACEITO MOTORISTA -> INFORMADO PORTARIA -> RECEBIDO CT -> ACEITO CT.
 *
 * Funções puras. Nada aqui apaga ou sobrescreve valor: cada elo da cadeia é mostrado como
 * veio, e a divergência é evidência, nunca bloqueio.
 */

export const ETAPAS_DA_CADEIA = [
    { chave: 'esperado', rotulo: 'Esperado', ator: 'Roteirizador' },
    { chave: 'conferido', rotulo: 'Conferido', ator: 'Conferente' },
    { chave: 'aceito_motorista', rotulo: 'Aceito motorista', ator: 'Motorista' },
    { chave: 'informado_portaria', rotulo: 'Informado portaria', ator: 'Porteiro', semAceite: true },
    { chave: 'recebido_ct', rotulo: 'Recebido CT', ator: 'Equipe CT' },
    { chave: 'aceito_ct', rotulo: 'Aceito CT', ator: 'Equipe CT' },
];

/**
 * Chaves antigas do resumo V1 (`pallets` do detalhe do manifesto) -> chaves da cadeia V2.
 * `aceito` do V1 não distingue ator: só entra como "aceito motorista" se a V2 não vier.
 */
const ALIAS_V1 = {
    informado: 'informado_portaria',
    recebido: 'recebido_ct',
    aceito: 'aceito_motorista',
};

/** Quantidade de um elo: aceita número, string numérica ou objeto `{quantidade}`. */
export function quantidadeDe(elo) {
    if (elo === null || elo === undefined || elo === '') return null;
    const bruto = typeof elo === 'object' ? elo.quantidade : elo;
    if (bruto === null || bruto === undefined || bruto === '') return null;
    const n = Number(bruto);
    return Number.isFinite(n) ? n : null;
}

function normalizar(pallets) {
    const origem = pallets && typeof pallets === 'object' ? pallets : {};
    const saida = {};
    for (const { chave } of ETAPAS_DA_CADEIA) saida[chave] = origem[chave];
    for (const [antiga, nova] of Object.entries(ALIAS_V1)) {
        if ((saida[nova] === undefined || saida[nova] === null) && origem[antiga] !== undefined) {
            saida[nova] = origem[antiga];
        }
    }
    return saida;
}

/** Referência de comparação: o esperado; sem ele, o que o conferente carregou. */
export function referenciaDaCadeia(pallets) {
    const p = normalizar(pallets);
    return quantidadeDe(p.esperado) ?? quantidadeDe(p.conferido);
}

/**
 * Divergência total: (recebido, senão aceito) - esperado. `null` sem os dois lados.
 * O valor do servidor, quando numérico, é a verdade; o cálculo local só cobre a ausência.
 */
export function divergenciaDaCadeia(pallets) {
    const servidor = quantidadeDe(pallets?.divergencia);
    if (servidor !== null) return servidor;
    const p = normalizar(pallets);
    const esperado = quantidadeDe(p.esperado);
    const real = quantidadeDe(p.recebido_ct) ?? quantidadeDe(p.aceito_ct) ?? quantidadeDe(p.aceito_motorista);
    if (esperado === null || real === null) return null;
    return real - esperado;
}

/** Saldo que o próximo manifesto pode usar: somente o que o CT aceitou. */
export function saldoDisponivel(pallets) {
    return quantidadeDe(normalizar(pallets).aceito_ct);
}

/**
 * Elos da cadeia prontos para exibir. Cada elo preenchido que difere da referência vem
 * marcado `divergente` com a `diferenca` (elo - referência). Elo ausente fica `pendente`.
 */
export function montarCadeia(pallets) {
    const p = normalizar(pallets);
    const referencia = referenciaDaCadeia(pallets);
    return ETAPAS_DA_CADEIA.map((etapa) => {
        const elo = p[etapa.chave];
        const quantidade = quantidadeDe(elo);
        const detalhe = elo && typeof elo === 'object' ? elo : {};
        const preenchido = quantidade !== null;
        const comparavel = preenchido && referencia !== null && etapa.chave !== 'esperado';
        const diferenca = comparavel ? quantidade - referencia : null;
        return {
            ...etapa,
            quantidade,
            preenchido,
            pendente: !preenchido,
            usuario: detalhe.user?.nome ?? detalhe.user ?? detalhe.usuario ?? null,
            atorRegistrado: detalhe.ator ?? null,
            registradoEm: detalhe.registrado_em ?? null,
            diferenca,
            divergente: diferenca !== null && diferenca !== 0,
        };
    });
}

/** "+2", "-1" ou "0" para exibir uma diferença; vazio para `null`. */
export function textoDaDiferenca(diferenca) {
    if (diferenca === null || diferenca === undefined) return '';
    if (diferenca === 0) return '0';
    return diferenca > 0 ? `+${diferenca}` : `${diferenca}`;
}

/** `true` quando existe divergência entre qualquer elo preenchido e a referência. */
export function temDivergencia(pallets) {
    const total = divergenciaDaCadeia(pallets);
    if (total !== null && total !== 0) return true;
    return montarCadeia(pallets).some((e) => e.divergente);
}
