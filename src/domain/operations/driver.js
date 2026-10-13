/** Motorista (web responsivo / mesmo contrato do Android): regras da tela "Meu manifesto". */

import { tipoDoServico } from '../planning/services.js';

const TERMINAIS = ['CONCLUIDA', 'PULADA', 'CANCELADA'];

export const TIPOS_DE_CANHOTO = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const TAMANHO_MAXIMO_CANHOTO = 10 * 1024 * 1024;

/** Próxima etapa a executar: a primeira não terminal que não é o início. */
export function proximaEtapa(etapas) {
    return [...(etapas ?? [])]
        .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
        .find((e) => e.tipo_etapa !== 'inicio' && !TERMINAIS.includes(e.status)) ?? null;
}

/** Ator do aceite do motorista conforme o tipo do serviço (contrato v2.1). */
export function atorDoAceite(servico) {
    const tipo = tipoDoServico(servico);
    if (tipo === 'distribuicao') return 'motorista_distribuicao';
    if (tipo === 'transferencia') return 'motorista_transferencia';
    return 'motorista';
}


/** Itens de `a_aceitar` que ainda não têm aceite (quantidade_conferida presente = pode aceitar). */
export function aceitesPendentes(aAceitar) {
    return (aAceitar ?? []).filter((a) => !a.aceito_em && !a.aceito);
}

export function validarArquivoDoCanhoto(arquivo) {
    if (!arquivo) return 'Escolha uma foto ou arquivo do canhoto.';
    if (!TIPOS_DE_CANHOTO.includes(arquivo.type)) return 'Formato não aceito. Use JPG, PNG, WEBP ou PDF.';
    if (!arquivo.size || arquivo.size > TAMANHO_MAXIMO_CANHOTO) return 'O arquivo deve ter até 10 MB.';
    return null;
}

/** Só DISTRIBUIÇÃO pede descarga + canhoto ao motorista; coleta e transferência não. */
export function exigeDescargaECanhoto(servico) {
    return tipoDoServico(servico) === 'distribuicao';
}

/** Pendências para concluir: vazio para coleta/transferência (não exigem nada do motorista). */
export function pendenciasDaConclusao(servico, { descarga, canhotoAnexoId }) {
    if (!exigeDescargaECanhoto(servico)) return [];
    const motivos = [];
    if (!descarga) motivos.push('Confirme a descarga.');
    if (!canhotoAnexoId && !servico?.canhoto_anexo_id) motivos.push('Anexe o canhoto.');
    return motivos;
}

export function servicoAberto(servico) {
    return !['CONCLUIDO', 'CANCELADO'].includes(servico?.status);
}

/** Extrai o necessário da resposta de presign (aceita `data` envelopado ou não). */
export function lerPresign(resposta) {
    const r = resposta?.data ?? resposta ?? {};
    return {
        anexoId: r.anexo_id ?? r.id ?? null,
        url: r.url ?? r.upload_url ?? null,
        metodo: r.method ?? r.metodo ?? 'PUT',
        headers: r.headers ?? {},
    };
}

/**
 * Ator do aceite numa etapa: na coleta é `motorista`; fora dela depende do tipo dos serviços
 * do manifesto (distribuição > transferência > motorista).
 */
export function atorDoAceiteNaEtapa(etapa, servicos) {
    if (etapa?.papel === 'coleta') return 'motorista';
    const lista = (servicos ?? []).filter((s) => servicoAberto(s));
    const doEtapa = lista.filter((s) => s.etapa_id === etapa?.id);
    const base = doEtapa.length ? doEtapa : lista;
    const tipos = base.map((s) => tipoDoServico(s));
    if (tipos.includes('distribuicao')) return 'motorista_distribuicao';
    if (tipos.includes('transferencia')) return 'motorista_transferencia';
    return 'motorista';
}
