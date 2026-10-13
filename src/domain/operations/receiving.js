/** Equipe CT: normalização da lista de recebimentos e validação do aceite. */
import { idDe, rotulo } from './text.js';
import { divergenciaDaCadeia, quantidadeDe, temDivergencia } from '../pallets/chain.js';

export const STATUS_DE_RECEBIMENTO = [
    { chave: 'aguardando', rotulo: 'Aguardando' },
    { chave: 'divergente', rotulo: 'Divergentes' },
    { chave: 'aceito', rotulo: 'Aceitos' },
];

export function normalizarRecebimento(r) {
    const pallets = r?.pallets ?? {};
    return {
        manifestoId: idDe(r?.manifesto),
        manifesto: rotulo(r?.manifesto?.numero ?? r?.manifesto),
        placa: rotulo(r?.veiculo?.placa ?? r?.veiculo),
        motorista: rotulo(r?.motorista),
        servicos: rotulo(r?.servicos),
        pallets,
        divergencia: divergenciaDaCadeia(pallets),
        divergente: temDivergencia(pallets),
        aceito: quantidadeDe(pallets.aceito_ct) !== null,
        ocorrenciasAbertas: Number(r?.ocorrencias_abertas ?? 0),
    };
}

/**
 * Valida o formulário de recebimento. Divergência NÃO bloqueia; só exige o motivo
 * (regra de negócio: "informa motivo e gera ocorrência").
 *
 * @returns {{ erros: Record<string,string>, divergente: boolean, diferenca: number|null }}
 */
export function validarRecebimento({ recebido, motivo, esperado }) {
    const erros = {};
    const vazio = recebido === null || recebido === undefined || String(recebido).trim() === '';
    const n = vazio ? NaN : Number(recebido);
    if (!Number.isInteger(n) || n < 0) erros.recebido = 'Informe a quantidade recebida (inteiro, 0 ou mais).';
    const ref = quantidadeDe(esperado);
    const diferenca = Number.isInteger(n) && ref !== null ? n - ref : null;
    const divergente = diferenca !== null && diferenca !== 0;
    if (divergente && !String(motivo ?? '').trim()) erros.motivo = 'Informe o motivo da divergência.';
    return { erros, divergente, diferenca };
}

export function corpoDoRecebimento({ recebido, observacao, motivo }) {
    const corpo = { recebido: Number(recebido) };
    if (String(observacao ?? '').trim()) corpo.observacao = String(observacao).trim();
    if (String(motivo ?? '').trim()) corpo.motivo_divergencia = String(motivo).trim();
    return corpo;
}
