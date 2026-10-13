/**
 * Registro de chegada na portaria (POST /mapa/portaria/chegada). O porteiro só registra:
 * presença, hodômetro e o que o motorista informou. Nunca aceite, nunca custódia.
 */

/** Quantidade de pallets informada: vazio é `null`; 0 ("nenhum") é válido; inválido é NaN. */
export function lerQuantidade(valor) {
    if (valor === null || valor === undefined || String(valor).trim() === '') return null;
    const n = Number(String(valor).replace(',', '.'));
    return Number.isFinite(n) && n >= 0 && Number.isInteger(n) ? n : NaN;
}

/**
 * @param {{ hodometro: any, perguntarPallets: boolean, palletsInformados: any,
 *   ajustarHorario: boolean, chegadaEm: string|null, justificativa: string, ultimoHodometro?: number|null }} f
 * @returns {{ erros: Record<string,string>, avisos: string[] }}
 */
export function validarChegada(f) {
    const erros = {};
    const avisos = [];

    const km = Number(String(f.hodometro ?? '').replace(',', '.'));
    if (f.hodometro === null || f.hodometro === undefined || String(f.hodometro).trim() === '') {
        erros.hodometro = 'Informe o hodômetro.';
    } else if (!Number.isFinite(km) || km < 0) {
        erros.hodometro = 'Hodômetro inválido.';
    } else if (f.ultimoHodometro != null && km < Number(f.ultimoHodometro)) {
        avisos.push(`Hodômetro menor que o último registrado (${f.ultimoHodometro} km). Confira antes de enviar.`);
    }

    if (f.perguntarPallets) {
        const q = lerQuantidade(f.palletsInformados);
        if (q === null) erros.pallets = 'Informe a quantidade (use 0 se não houver pallets).';
        else if (Number.isNaN(q)) erros.pallets = 'Quantidade inválida (número inteiro, 0 ou mais).';
    }

    if (f.ajustarHorario) {
        if (!f.chegadaEm) erros.chegada = 'Informe o horário de chegada.';
        if (!String(f.justificativa ?? '').trim()) erros.justificativa = 'Justifique o ajuste do horário.';
    }

    return { erros, avisos };
}

/**
 * Corpo do POST. `pallets_informados` só vai quando a pergunta existe; `chegada_em` só com
 * ajuste (e então acompanha `justificativa`). Não existe campo de aceite aqui, de propósito.
 */
export function montarCorpoDaChegada({ manifestoId, hodometro, perguntarPallets, palletsInformados, ajustarHorario, chegadaEm, justificativa, observacao }) {
    const corpo = {
        manifesto_id: manifestoId,
        hodometro_km: Number(String(hodometro).replace(',', '.')),
    };
    if (perguntarPallets) corpo.pallets_informados = lerQuantidade(palletsInformados);
    if (ajustarHorario && chegadaEm) {
        corpo.chegada_em = chegadaEm;
        corpo.justificativa = String(justificativa).trim();
    }
    if (String(observacao ?? '').trim()) corpo.observacao = String(observacao).trim();
    return corpo;
}

export function montarCorpoDaSaida({ manifestoId, hodometro }) {
    const corpo = { manifesto_id: manifestoId };
    const km = Number(String(hodometro ?? '').replace(',', '.'));
    if (String(hodometro ?? '').trim() !== '' && Number.isFinite(km) && km >= 0) corpo.hodometro_km = km;
    return corpo;
}
