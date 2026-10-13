/**
 * Modelo visual de lotação e empréstimos (protótipo, sem política de API).
 * Filial responsável é a autoridade sobre cadastro e movimentações do motorista.
 * Visibilidade de outras filiais pertence ao acesso do usuário; empréstimo é operação temporária distinta.
 */
export const FILIAIS_REFERENCIA = [
  { id: 'SP01', nome: 'SP01 · Matriz São Paulo' },
  { id: 'RJ01', nome: 'RJ01 · Rio de Janeiro' },
  { id: 'SP02', nome: 'SP02 · Interior de São Paulo' },
];
export const filialTexto = codigo => FILIAIS_REFERENCIA.find(f => f.id === codigo)?.nome || codigo || 'Sem filial';

const uuid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const emprestimoVazio = () => ({
  id: uuid(), origem: '', destino: '', inicio: '', fim: '',
  justificativa: '', observacoes: '', escopo: 'distribuicao', status: 'solicitado',
  solicitadoEm: new Date().toISOString(), autorizadoEm: null,
  autorizadoPor: '', encerradoEm: null,
});
export const statusEmprestimo = { solicitado:'Aguardando gestor', aprovado:'Aprovado', rejeitado:'Recusado', encerrado:'Encerrado' };

export function normalizarLotacao(pessoa) {
  const responsavel = pessoa?.lotacao?.responsavel || pessoa?.motorista?.filial || '';
  const vinculadas = Array.isArray(pessoa?.lotacao?.vinculadas) ? pessoa.lotacao.vinculadas : [];
  return { responsavel, vinculadas: [...new Set(vinculadas.filter(Boolean).filter(c => c !== responsavel))] };
}

export function situacaoEmprestimo(emprestimo, agora = new Date()) {
  if (!emprestimo) return 'nenhum';
  if (emprestimo.status !== 'aprovado') return emprestimo.status;
  const hoje = [agora.getFullYear(), String(agora.getMonth()+1).padStart(2,'0'), String(agora.getDate()).padStart(2,'0')].join('-');
  if (hoje < emprestimo.inicio) return 'programado';
  if (hoje > emprestimo.fim) return 'expirado';
  return 'vigente';
}

export function validarSolicitacao(pessoa, pedido) {
  if (!pessoa?.motorista?.habilitado) return 'Somente um perfil de motorista pode ser emprestado.';
  const lotacao = normalizarLotacao(pessoa);
  if (!lotacao.responsavel) return 'Defina a filial responsável antes de solicitar.';
  if (!pedido.destino || pedido.destino === lotacao.responsavel) return 'A filial de destino precisa ser diferente da responsável.';
  if (!pedido.inicio || !pedido.fim || pedido.fim < pedido.inicio) return 'Informe um período válido (data final igual ou posterior à inicial).';
  const conflito = (pessoa.emprestimos || []).some(e => ['solicitado','aprovado'].includes(e.status) &&
    pedido.inicio <= e.fim && pedido.fim >= e.inicio);
  if (conflito) return 'Já existe empréstimo solicitado/aprovado com período sobreposto.';
  return '';
}

export function solicitarEmprestimo(pessoa, pedido) {
  const erro = validarSolicitacao(pessoa, pedido);
  if (erro) return { erro, pessoa };
  const e = { ...emprestimoVazio(), destino: pedido.destino, inicio: pedido.inicio, fim: pedido.fim,
    origem: normalizarLotacao(pessoa).responsavel, justificativa: pedido.justificativa?.trim() || '',
    escopo: ['coleta','distribuicao','transferencia'].includes(pedido.escopo) ? pedido.escopo : 'distribuicao' };
  return { erro: '', pessoa: { ...pessoa, emprestimos: [...(pessoa.emprestimos || []), e] }, emprestimo: e };
}

/** Ações de simulação, somente front. Autorização real precisa de policy Laravel. */
export function simularDecisao(pessoa, emprestimoId, acao, contexto) {
  if (!['aprovar','rejeitar','encerrar'].includes(acao)) return { erro:'Ação desconhecida', pessoa };
  const item = (pessoa.emprestimos || []).find(e => e.id === emprestimoId);
  if (!item) return { erro:'Solicitação não encontrada.', pessoa };
  if (contexto?.filial !== item.origem || contexto?.papel !== 'gestor_origem') {
    return { erro:'A decisão cabe exclusivamente ao gestor da filial de origem.', pessoa };
  }
  if (acao === 'encerrar' && item.status !== 'aprovado') return { erro:'Somente empréstimos aprovados podem ser encerrados.', pessoa };
  if (acao !== 'encerrar' && item.status !== 'solicitado') return { erro:'Esta solicitação já foi decidida.', pessoa };
  const novoStatus = { aprovar:'aprovado', rejeitar:'rejeitado', encerrar:'encerrado' }[acao];
  const e = { ...item, status: novoStatus,
    ...(acao === 'encerrar' ? { encerradoEm: new Date().toISOString() } :
      { autorizadoEm: new Date().toISOString(), autorizadoPor: 'Gestor da origem (simulação)' }),
  };
  return { erro:'', pessoa: { ...pessoa, emprestimos: pessoa.emprestimos.map(p => p.id === e.id ? e : p) } };
}

export function podeAlocarDuranteEmprestimo(pessoa, filial, data = [new Date().getFullYear(), String(new Date().getMonth()+1).padStart(2,'0'), String(new Date().getDate()).padStart(2,'0')].join('-'), servico = 'distribuicao') {
  if (!pessoa?.motorista?.habilitado || !pessoa.ativo) return false;
  const origem = normalizarLotacao(pessoa).responsavel;
  if (filial === origem) return true; // o backend ainda precisa validar CNH/aptidão
  return (pessoa.emprestimos || []).some(e => e.status === 'aprovado' && e.destino === filial &&
    e.inicio <= data && e.fim >= data && (e.escopo || 'distribuicao') === servico);
}

export function podeGerenciarMotorista(pessoa, filial, papel) {
  return Boolean(normalizarLotacao(pessoa).responsavel && normalizarLotacao(pessoa).responsavel === filial && papel === 'gestor_origem');
}
