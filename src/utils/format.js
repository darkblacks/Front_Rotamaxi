/**
 * Formatação de data e hora das telas do painel.
 *
 * A API devolve tudo em ISO 8601 com fuso; a conversão para a hora local acontece só aqui,
 * para que nenhuma tela invente o seu próprio jeito de mostrar o mesmo instante.
 */

/**
 * Hora e minuto do instante, na hora local. Valor ausente vira travessão, e não "Invalid
 * Date": o painel mostra buraco de dado como buraco, nunca como erro de formatação.
 *
 * @param {string|null|undefined} iso
 */
export function horaCurta(iso) {
    const data = paraData(iso);

    if (data === null) {
        return '—';
    }

    return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Data e hora do instante, na hora local.
 *
 * @param {string|null|undefined} iso
 */
export function dataEHora(iso) {
    const data = paraData(iso);

    if (data === null) {
        return '—';
    }

    return data.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * @param {string|null|undefined} iso
 * @returns {Date|null}
 */
function paraData(iso) {
    if (typeof iso !== 'string' || iso === '') {
        return null;
    }

    const data = new Date(iso);

    return Number.isNaN(data.getTime()) ? null : data;
}

/**
 * Data de calendário `YYYY-MM-DD` escrita como `DD/MM`. A conversão é feita no texto, e não
 * pelo `Date`: a data do manifesto é um dia de operação, não um instante, e interpretá-la
 * como meia-noite UTC moveria a viagem para o dia anterior em fuso negativo.
 *
 * @param {string|null|undefined} data
 */
export function dataDoDia(data) {
    if (typeof data !== 'string' || ! /^\d{4}-\d{2}-\d{2}/.test(data)) {
        return '—';
    }

    const [ano, mes, dia] = data.slice(0, 10).split('-');

    return `${dia}/${mes}/${ano}`;
}

/**
 * Número com separador de milhar em pt-BR. Valor ausente vira travessão — a lista mostra
 * buraco de dado como buraco, e nunca como zero.
 *
 * @param {number|string|null|undefined} valor
 * @param {number} casas
 */
export function numero(valor, casas = 0) {
    if (valor === null || valor === undefined || valor === '') {
        return '—';
    }

    const numerico = Number(valor);

    if (Number.isNaN(numerico)) {
        return '—';
    }

    return numerico.toLocaleString('pt-BR', {
        minimumFractionDigits: casas,
        maximumFractionDigits: casas,
    });
}

/**
 * Coordenada de GPS como o painel a escreve. Linha sem ponto informado vira travessão: o
 * evento existiu, o aparelho é que não mandou onde.
 *
 * @param {{ latitude: number|null, longitude: number|null }|null|undefined} gps
 */
export function coordenada(gps) {
    const latitude = gps?.latitude;
    const longitude = gps?.longitude;

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return '—';
    }

    return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

/**
 * Minutos decorridos desde um instante ISO, ou `null` quando não há instante.
 *
 * É o relógio da fila do portão: o veículo espera desde que o motorista declarou, e a
 * conta é sempre contra o agora de quem olha a tela.
 *
 * @param {string|null|undefined} iso
 * @param {Date} agora
 */
export function minutosDesde(iso, agora = new Date()) {
    if (typeof iso !== 'string' || iso === '') {
        return null;
    }

    const instante = new Date(iso);

    if (Number.isNaN(instante.getTime())) {
        return null;
    }

    return Math.max(0, Math.floor((agora.getTime() - instante.getTime()) / 60000));
}

/**
 * Espera em `h/min`, como o cartão da fila a escreve: `12min`, `2h05`.
 *
 * @param {number|null|undefined} minutos
 */
export function duracaoCurta(minutos) {
    if (typeof minutos !== 'number' || Number.isNaN(minutos)) {
        return '—';
    }

    if (minutos < 60) {
        return `${minutos}min`;
    }

    return `${Math.floor(minutos / 60)}h${String(minutos % 60).padStart(2, '0')}`;
}
