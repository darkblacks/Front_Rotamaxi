/** Conferente (Coleta): normalização da fila e regras de aceite. */
import { idDe, rotulo } from './text.js';

export const STATUS_DA_FILA = [
    { chave: 'aguardando', rotulo: 'Aguardando' },
    { chave: 'em_andamento', rotulo: 'Em andamento' },
    { chave: 'concluida', rotulo: 'Concluídas' },
];

export const CAMPOS_DE_TEMPO = [
    { chave: 'conferencia_inicio', rotulo: 'Início da conferência' },
    { chave: 'conferencia_fim', rotulo: 'Fim da conferência' },
    { chave: 'carregamento_inicio', rotulo: 'Início do carregamento' },
    { chave: 'carregamento_fim', rotulo: 'Fim do carregamento' },
];

/** Item da fila (`GET /mapa/conferencia/fila`) em formato plano para a tela. */
export function normalizarItemDaFila(item) {
    const conferencia = item?.conferencia ?? {};
    return {
        etapaId: idDe(item?.etapa),
        etapaNome: rotulo(item?.etapa?.nome ?? item?.etapa?.snapshot_nome, ''),
        manifestoId: idDe(item?.manifesto),
        manifesto: rotulo(item?.manifesto?.numero ?? item?.manifesto),
        servico: rotulo(item?.servico),
        cliente: rotulo(item?.cliente),
        placa: rotulo(item?.veiculo?.placa ?? item?.veiculo),
        motorista: rotulo(item?.motorista),
        chegadaReal: item?.chegada_real ?? null,
        conferencia: {
            equipe: conferencia.equipe ?? '',
            pallets: conferencia.pallets ?? null,
            conferencia_inicio: conferencia.conferencia_inicio ?? null,
            conferencia_fim: conferencia.conferencia_fim ?? null,
            carregamento_inicio: conferencia.carregamento_inicio ?? null,
            carregamento_fim: conferencia.carregamento_fim ?? null,
            observacoes: conferencia.observacoes ?? '',
            aceite_em: conferencia.aceite_em ?? null,
            aceite_por: conferencia.aceite_por ?? null,
        },
    };
}

/** Motivos pelos quais ainda não dá para aceitar (lista vazia = pode aceitar). */
export function pendenciasDoAceite(c) {
    if (c.aceite_em) return ['Carga já aceita.'];
    const motivos = [];
    if (!c.conferencia_inicio || !c.conferencia_fim) motivos.push('Finalize a conferência (início e fim).');
    if (!c.carregamento_inicio || !c.carregamento_fim) motivos.push('Finalize o carregamento (início e fim).');
    const vazio = c.pallets === '' || c.pallets === null || c.pallets === undefined;
    const pallets = vazio ? NaN : Number(c.pallets);
    if (!Number.isInteger(pallets) || pallets < 0) motivos.push('Informe a quantidade de pallets.');
    return motivos;
}

/** Erros de coerência de horários: o fim não pode vir antes do início. */
export function errosDeHorario(c) {
    const erros = [];
    const par = (ini, fim, nome) => {
        if (c[ini] && c[fim] && new Date(c[fim]) < new Date(c[ini])) erros.push(`${nome}: o fim está antes do início.`);
    };
    par('conferencia_inicio', 'conferencia_fim', 'Conferência');
    par('carregamento_inicio', 'carregamento_fim', 'Carregamento');
    return erros;
}

/** Corpo do POST /conferencia: só campos preenchidos (parcial), pallets como inteiro. */
export function corpoDaConferencia(c) {
    const corpo = {};
    ['equipe', 'observacoes', ...CAMPOS_DE_TEMPO.map((t) => t.chave)].forEach((k) => {
        if (c[k] !== null && c[k] !== undefined && String(c[k]).trim() !== '') corpo[k] = c[k];
    });
    if (c.pallets !== null && c.pallets !== undefined && String(c.pallets).trim() !== '') corpo.pallets = Number(c.pallets);
    return corpo;
}
