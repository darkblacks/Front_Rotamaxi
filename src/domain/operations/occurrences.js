/** Ocorrências do Mapa Operacional (SAQ/SAC): tipos, severidades e normalização. */
import { idDe, rotulo } from './text.js';

export const TIPOS_DE_OCORRENCIA = [
    { chave: 'atraso', rotulo: 'Atraso' },
    { chave: 'pallet_divergente', rotulo: 'Pallet divergente' },
    { chave: 'recusa_cliente', rotulo: 'Cliente recusou' },
    { chave: 'cliente_recusou', rotulo: 'Cliente recusou' },
    { chave: 'avaria', rotulo: 'Avaria' },
    { chave: 'problema_coleta', rotulo: 'Problema de coleta' },
    { chave: 'problema_ct', rotulo: 'Problema no CT' },
    { chave: 'problema_gps', rotulo: 'GPS' },
    { chave: 'desvio_rota', rotulo: 'Desvio de rota' },
    { chave: 'canhoto', rotulo: 'Canhoto' },
    { chave: 'janela_perdida', rotulo: 'Janela perdida' },
    { chave: 'carga', rotulo: 'Carga' },
    { chave: 'veiculo', rotulo: 'Veículo' },
    { chave: 'outro', rotulo: 'Outro' },
];

/** Tipos que o motorista/executor pode reportar (sem duplicar o alias `cliente_recusou`). */
export const TIPOS_REPORTAVEIS = TIPOS_DE_OCORRENCIA.filter((t) => t.chave !== 'cliente_recusou' && t.chave !== 'janela_perdida');

export const SEVERIDADES = [
    { chave: 'atencao', rotulo: 'Atenção', tom: 'warn' },
    { chave: 'risco', rotulo: 'Risco', tom: 'bad' },
    { chave: 'critico', rotulo: 'Crítico', tom: 'bad' },
];

export const ACOES_DE_TRATATIVA = [
    { chave: 'assumir', rotulo: 'Assumir', exigeTexto: false },
    { chave: 'encaminhar', rotulo: 'Encaminhar', exigeTexto: true, exigeDestino: true },
    { chave: 'comentar', rotulo: 'Comentar', exigeTexto: true },
    { chave: 'resolver', rotulo: 'Resolver', exigeTexto: true },
];

export function rotuloDoTipo(tipo) {
    return TIPOS_DE_OCORRENCIA.find((t) => t.chave === tipo)?.rotulo ?? String(tipo ?? 'Ocorrência').replaceAll('_', ' ');
}

export function severidadeDe(chave) {
    return SEVERIDADES.find((s) => s.chave === chave) ?? { chave, rotulo: chave ?? '—', tom: 'neutro' };
}

/** Ocorrência de `/mapa/ocorrencias` em formato plano para a tabela e o detalhe. */
export function normalizarOcorrencia(o) {
    return {
        id: o?.id,
        tipo: o?.tipo,
        tipoRotulo: rotuloDoTipo(o?.tipo),
        severidade: o?.severidade ?? null,
        status: o?.status ?? 'aberta',
        descricao: o?.descricao ?? '',
        origem: o?.origem ?? null,
        manifestoId: idDe(o?.manifesto),
        manifesto: rotulo(o?.manifesto?.numero ?? o?.manifesto),
        servico: rotulo(o?.servico),
        etapa: rotulo(o?.etapa?.nome ?? o?.etapa),
        veiculo: rotulo(o?.veiculo?.placa ?? o?.veiculo),
        motorista: rotulo(o?.motorista),
        criadaEm: o?.criada_em ?? o?.created_at ?? null,
        atrasoMinutos: o?.atraso_minutos ?? null,
        tratativas: Array.isArray(o?.tratativas) ? o.tratativas : [],
        responsavel: rotulo(o?.responsavel ?? o?.assumida_por, ''),
    };
}

/** Corpo do POST /tratar; devolve `{ erro }` quando faltar texto/destino exigido pela ação. */
export function corpoDaTratativa(acao, texto, destino) {
    const regra = ACOES_DE_TRATATIVA.find((a) => a.chave === acao);
    if (!regra) return { erro: 'Ação inválida.' };
    const t = String(texto ?? '').trim();
    if (regra.exigeTexto && !t) return { erro: 'Escreva um texto para esta ação.' };
    if (regra.exigeDestino && !String(destino ?? '').trim()) return { erro: 'Informe o destino do encaminhamento.' };
    const corpo = { acao };
    if (t) corpo.texto = t;
    if (regra.exigeDestino) corpo.destino = String(destino).trim();
    return { corpo };
}

/** Acrescenta/atualiza uma ocorrência vinda do evento realtime (payload cru ou `{ocorrencia}`). */
export function aplicarEventoDeOcorrencia(lista, payload) {
    const bruta = payload?.ocorrencia ?? payload;
    if (bruta?.id === undefined || bruta?.id === null) return lista;
    const nova = normalizarOcorrencia(bruta);
    return lista.some((o) => o.id === nova.id)
        ? lista.map((o) => (o.id === nova.id ? { ...o, ...nova } : o))
        : [nova, ...lista];
}
