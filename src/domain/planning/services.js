/**
 * Regras puras do cadastro de Serviços (contrato v2.1).
 * Serviço = TIPO + LOCAL. Origem, destino, ponto inicial/final e rota são do MANIFESTO.
 */

export const TIPOS_DE_SERVICO = [
    { id: 'coleta', rotulo: 'Coleta' },
    { id: 'transferencia', rotulo: 'Transferência' },
    { id: 'distribuicao', rotulo: 'Distribuição' },
];

export const STATUS_DO_SERVICO = {
    DEMANDA: { rotulo: 'Demanda', tom: 'neutro' },
    EMPENHADO: { rotulo: 'Empenhado', tom: 'info' },
    EM_EXECUCAO: { rotulo: 'Em execução', tom: 'warn' },
    CONCLUIDO: { rotulo: 'Concluído', tom: 'ok' },
    CANCELADO: { rotulo: 'Cancelado', tom: 'bad' },
};

/** Tipo único do serviço (aceita `tipos[0]` de payload legado). */
export function tipoDoServico(servico) {
    return servico?.tipo ?? (Array.isArray(servico?.tipos) ? servico.tipos[0] : null) ?? null;
}

export function rotuloDoTipo(tipo) {
    return TIPOS_DE_SERVICO.find((x) => x.id === tipo)?.rotulo ?? (tipo ? String(tipo) : '—');
}

/** Local do serviço: `local` do payload; aceita o snapshot. */
export function localDoServico(servico) {
    return servico?.local ?? servico?.local_snapshot ?? null;
}

/** Cliente é obrigatório para coleta e distribuição; opcional para transferência. */
export function exigeCliente(tipo) {
    return tipo === 'coleta' || tipo === 'distribuicao';
}

export function coordenadaValida(lat, lng) {
    if (lat === '' || lat === null || lat === undefined || lng === '' || lng === null || lng === undefined) return false;
    const a = Number(lat);
    const b = Number(lng);
    return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180;
}

/** Ponto escolhido: do lookup ({kind,id}) ou manual ({latitude,longitude,nome}). */
export function pontoDefinido(p) {
    if (!p) return false;
    if (p.kind && p.id) return true;
    return coordenadaValida(p.latitude, p.longitude) && !!String(p.nome ?? '').trim();
}

export function pontoParaPayload(p) {
    if (!pontoDefinido(p)) return null;
    if (p.kind && p.id) return { kind: p.kind, id: p.id };
    return { latitude: Number(p.latitude), longitude: Number(p.longitude), nome: String(p.nome).trim() };
}

/** CT ou filial (natureza `ct` do lookup). */
function ehCtOuFilial(p) {
    return p?.kind === 'filial' || (p?.naturezas ?? []).includes('ct');
}

/** Datetime-local <-> ISO. */
export function paraInputLocal(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const z = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}

export function deInputLocal(valor) {
    if (!valor) return null;
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function janelaValida(inicio, fim) {
    if (!inicio || !fim) return true;
    return new Date(fim).getTime() >= new Date(inicio).getTime();
}

/**
 * Valida o formulário no cliente (o servidor valida de novo e devolve 422).
 * @returns {Record<string,string>} erros por campo; vazio = válido
 */
export function validarServico(f) {
    const erros = {};
    if (!f.tipo) erros.tipo = 'Escolha o tipo do serviço.';
    if (!pontoDefinido(f.local)) {
        erros.local = 'Defina o local do serviço.';
    } else if (f.local.kind && !coordenadaValida(f.local.latitude, f.local.longitude)) {
        erros.local = 'O local precisa estar georreferenciado (informe as coordenadas).';
    } else if (f.tipo === 'transferencia' && f.local.kind && !ehCtOuFilial(f.local)) {
        erros.local = 'O local da transferência deve ser um CT ou filial.';
    }
    // Serviço = tipo + local + cliente: obrigatório em coleta e distribuição, opcional em transferência.
    if (exigeCliente(f.tipo) && !f.cliente) erros.cliente = 'Coleta e distribuição exigem o cliente.';
    if (f.pallets_previstos !== '' && f.pallets_previstos !== null && f.pallets_previstos !== undefined) {
        const n = Number(f.pallets_previstos);
        if (!Number.isInteger(n) || n < 0) erros.pallets_previstos = 'Informe um número inteiro de pallets (0 ou mais).';
    }
    if (!janelaValida(f.janela_inicio, f.janela_fim)) erros.janela = 'O fim da janela não pode ser anterior ao início.';
    return erros;
}

/** Corpo do POST /mapa/servicos: tipo + local, sem origem/destino. */
export function montarPayloadServico(f) {
    const payload = { tipo: f.tipo, local: pontoParaPayload(f.local) };
    if (f.cliente?.id) payload.cliente_pessoa_id = f.cliente.id;
    if (f.pallets_previstos !== '' && f.pallets_previstos !== null && f.pallets_previstos !== undefined) {
        payload.pallets_previstos = Number(f.pallets_previstos);
    }
    if (f.janela_inicio) payload.janela_inicio = deInputLocal(f.janela_inicio) ?? f.janela_inicio;
    if (f.janela_fim) payload.janela_fim = deInputLocal(f.janela_fim) ?? f.janela_fim;
    if (f.observacoes?.trim()) payload.observacoes = f.observacoes.trim();
    return payload;
}

export function formularioVazio() {
    return {
        tipo: '', cliente: null, local: null,
        pallets_previstos: '', janela_inicio: '', janela_fim: '', observacoes: '',
    };
}
