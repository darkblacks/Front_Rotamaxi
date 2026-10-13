/** Estrutura de formulário sem armazenamento local e sem fallback de API. */
const idItem = () => globalThis.crypto?.randomUUID?.() || `new-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const documentoVazio = () => ({ id: idItem(), tipo: 'CPF', numero: '', validade: '' });
export const enderecoVazio = () => ({ id: idItem(), etiqueta: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', tipo: 'Residencial', principal: false, latitude: '', longitude: '' });
export const contatoVazio = () => ({ id: idItem(), nome: '', tipo: 'Telefone', valor: '', observacao: '' });
export const vinculoVazio = () => ({ id: idItem(), empresa: '', funcao: '', filial: '', tipo: '', dataInicio: '', dataFim: '' });
export const contaVazia = () => ({ id: idItem(), banco: '', tipo: '', agencia: '', conta: '', digito: '', titular: '', cpfCnpj: '', ativo: true });
export const pixVazio = () => ({ id: idItem(), tipo: 'CPF', chave: '', descricao: '' });

export function criarPessoa({ origem = 'pessoas' } = {}) {
  return {
    id: null, nome: '', nomeSocial: '', fotoNome: '', fotoMiniatura: '', observacoes: '', ativo: true,
    documentos: [{ ...documentoVazio(), tipo: origem === 'clientes' ? 'CNPJ' : 'CPF' }], enderecos: [], contatos: [],
    vinculos: origem === 'terceiros' ? [{ ...vinculoVazio(), tipo: 'Terceiro' }] : [], contas: [], pix: [],
    lotacao: { responsavel: '', vinculadas: [] }, emprestimos: [],
    acesso: { habilitado: origem === 'usuarios', identificadorTipo: 'CPF', identificador: '', papeis: [], filiais: [], observacoes: '' },
    motorista: { habilitado: origem === 'motoristas', categoriaCnh: '', numeroCnh: '', registroCnh: '', validadeCnh: '', emissaoCnh: '', primeiraHabilitacao: '', ufCnh: '', ear: false, vinculo: '', prestadorServicoId: '', rntrc: '', validadeRntrc: '', toxValidade: '', moppValidade: '', filial: '', observacoes: '' },
    preferencias: { receberOcorrencias: false, porEmail: false, porAplicativo: false, observacoes: '' },
    fiscal: { rgEmissor: '', pisPasep: '', inscricaoEstadual: '', estrangeiro: '', observacaoCte: '', observacaoColeta: '' },
    criadoEm: null, atualizadoEm: null,
  };
}

export function normalizarPessoa(p) {
  const base = criarPessoa();
  const origem = p || {};
  const documentos = Array.isArray(origem.documentos) ? origem.documentos.map(d => ({ ...d })) : base.documentos;
  // Migração local V5: CNH estava duplicada no cadastro de motorista.
  // Documento CNH passa a ser a única referência para número e validade.
  const cnh = documentos.find(d => d.tipo === 'CNH');
  if (cnh && !origem.versaoModelo) {
    cnh.numero ||= origem.motorista?.numeroCnh || '';
    cnh.validade ||= origem.motorista?.validadeCnh || '';
  } else if (!cnh && !origem.versaoModelo && (origem.motorista?.numeroCnh || origem.motorista?.validadeCnh)) {
    documentos.push({ ...documentoVazio(), tipo:'CNH', numero: origem.motorista.numeroCnh || '', validade: origem.motorista.validadeCnh || '' });
  }
  const documentoCnh = documentos.find(d => d.tipo === 'CNH');
  return {
    ...base, ...origem,
    documentos,
    enderecos: Array.isArray(origem.enderecos) ? origem.enderecos : [],
    contatos: Array.isArray(origem.contatos) ? origem.contatos : [],
    vinculos: Array.isArray(origem.vinculos) ? origem.vinculos : [],
    contas: Array.isArray(origem.contas) ? origem.contas : [],
    pix: Array.isArray(origem.pix) ? origem.pix : [],
    emprestimos: Array.isArray(origem.emprestimos) ? origem.emprestimos : [],
    lotacao: { responsavel: origem.lotacao?.responsavel ?? '', vinculadas: origem.lotacao?.vinculadas || [] },
    acesso: { ...base.acesso, ...origem.acesso },
    motorista: { ...base.motorista, ...origem.motorista,
      numeroCnh: documentoCnh?.numero || '', validadeCnh: documentoCnh?.validade || '' },
    preferencias: { ...base.preferencias, ...origem.preferencias },
    fiscal: { ...base.fiscal, ...origem.fiscal },
  };
}

