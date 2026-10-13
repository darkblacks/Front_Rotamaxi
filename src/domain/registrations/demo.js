/**
 * SÓ EXEMPLOS para a UI. Não são registros do ESL e não representam dados reais.
 * Ao integrar a API, trocar esta camada por serviços e stores do backend.
 */
const cadastro = (codigo, nome, dados = {}) => ({codigo, nome, status: 'Ativo', ...dados});
export const exemplosCadastros = {
  'pessoas:pessoas': [
    cadastro('PES-001', 'Pessoa Exemplo A', {documento: '—', categoria: 'Colaborador', telefone: '—'}),
    cadastro('PES-002', 'Pessoa Exemplo B', {documento: '—', categoria: 'Motorista', telefone: '—'}),
    cadastro('PES-003', 'Pessoa Exemplo C', {documento: '—', categoria: 'Prestador', telefone: '—', status: 'Pendente'}),
  ],
  'pessoas:motoristas': [
    cadastro('MOT-001', 'Motorista Exemplo A', {documento: '—', cnh: 'D', vinculo: 'Próprio', filial: 'SP01'}),
    cadastro('MOT-002', 'Motorista Exemplo B', {documento: '—', cnh: 'E', vinculo: 'Terceiro', filial: 'RJ01'}),
    cadastro('MOT-003', 'Motorista Exemplo C', {documento: '—', cnh: 'C', vinculo: 'Agregado', filial: 'SP01', status: 'Pendente'}),
  ],
  'pessoas:terceiros': [
    cadastro('TER-001', 'Prestador Exemplo Alfa', {documento: '—', vinculo: 'Transportadora', contato: '—'}),
    cadastro('TER-002', 'Prestador Exemplo Beta', {documento: '—', vinculo: 'Autônomo', contato: '—', status: 'Pendente'}),
  ],
  'pessoas:usuarios': [
    cadastro('USR-001', 'Usuário Exemplo Admin', {email: '—', perfil: 'Administração', filial: 'SP01'}),
    cadastro('USR-002', 'Usuário Exemplo Portaria', {email: '—', perfil: 'Portaria', filial: 'RJ01'}),
  ],
  'veiculos:placas': [
    cadastro('VEI-001', 'AAA-1A11', {classe: 'Motorizado', marca: 'Mercedes-Benz', modelo: 'Atego', tipo: 'Truck', vinculo: 'Próprio'}),
    cadastro('VEI-002', 'BBB-2B22', {classe: 'Motorizado', marca: 'Volkswagen', modelo: 'Delivery', tipo: 'VUC', vinculo: 'Próprio'}),
    cadastro('VEI-003', 'CCC-3C33', {classe: 'Reboque', marca: 'Randon', modelo: 'Semirreboque', tipo: 'Baú', vinculo: 'Terceiro'}),
    cadastro('VEI-004', 'DDD-4D44', {classe: 'Reboque', marca: 'Facchini', modelo: 'Carreta', tipo: 'Sider', vinculo: 'Agregado', status: 'Pendente'}),
  ],
  'veiculos:marcas': [
    cadastro('MAR-001', 'Mercedes-Benz', {categoria: 'Motorizados', origem: '—'}),
    cadastro('MAR-002', 'Volkswagen', {categoria: 'Motorizados', origem: '—'}),
    cadastro('MAR-003', 'Randon', {categoria: 'Reboques e implementos', origem: '—'}),
  ],
  'veiculos:modelos': [
    cadastro('MOD-001', 'Atego', {marca: 'Mercedes-Benz', tipo: 'Truck', classe: 'Motorizado'}),
    cadastro('MOD-002', 'Delivery', {marca: 'Volkswagen', tipo: 'VUC', classe: 'Motorizado'}),
    cadastro('MOD-003', 'Semirreboque', {marca: 'Randon', tipo: 'Baú', classe: 'Reboque'}),
  ],
  'veiculos:tipos': [
    cadastro('TIP-001', 'Truck', {classe: 'Motorizado', eixos: '3', capacidade: 'Variável'}),
    cadastro('TIP-002', 'VUC', {classe: 'Motorizado', eixos: '2', capacidade: 'Variável'}),
    cadastro('TIP-003', 'Semirreboque baú', {classe: 'Reboque', eixos: '3', capacidade: 'Variável'}),
  ],
  'clientes:todos': [
    cadastro('CLI-001', 'Cliente Exemplo Alfa', {documento: '—', perfil: 'Coleta e entrega', filial: 'SP01 · Matriz'}),
    cadastro('CLI-002', 'Cliente Exemplo Beta', {documento: '—', perfil: 'Coleta', filial: 'RJ01 · Rio'}),
    cadastro('CLI-003', 'Cliente Exemplo Gama', {documento: '—', perfil: 'Entrega', filial: 'SP01 · Matriz', status: 'Pendente'}),
    cadastro('CLI-004', 'Cliente Exemplo Delta', {documento: '—', perfil: 'Coleta e entrega', filial: 'SP02 · Interior', status: 'Inativo'}),
  ],
  'unidades:enderecos': [
    cadastro('LOC-001', 'Unidade Exemplo A', {endereco: 'Endereço de exemplo — não informado', cidade: 'São Paulo / SP', cliente: 'Cliente Exemplo Alfa', tipo: 'Coleta'}),
    cadastro('LOC-002', 'Unidade Exemplo B', {endereco: 'Endereço de exemplo — não informado', cidade: 'Rio de Janeiro / RJ', cliente: 'Cliente Exemplo Beta', tipo: 'Distribuição'}),
    cadastro('LOC-003', 'CT Exemplo Matriz', {endereco: 'Endereço de exemplo — não informado', cidade: 'São Paulo / SP', cliente: 'Operação interna', tipo: 'CT'}),
    cadastro('LOC-004', 'Unidade Exemplo C', {endereco: 'Endereço de exemplo — não informado', cidade: 'Guarulhos / SP', cliente: 'Cliente Exemplo Alfa', tipo: 'Coleta e distribuição', status: 'Pendente'}),
  ],
};

export const definicoesCadastros = {
  'pessoas:pessoas': { item: 'pessoa', campos: [['foto','Foto'],['nome','Nome completo'],['documento','Documento'],['filial','Matriz'],['status','Status']] },
  'pessoas:motoristas': { item: 'motorista', campos: [['foto','Foto'],['nome','Nome completo'],['documento','Documento'],['filial','Matriz'],['status','Status']] },
  'pessoas:terceiros': { item: 'prestador', campos: [['foto','Foto'],['nome','Nome completo'],['documento','Documento'],['filial','Matriz'],['status','Status']] },
  'pessoas:usuarios': { item: 'usuário', campos: [['foto','Foto'],['nome','Nome completo'],['documento','Documento'],['filial','Matriz'],['status','Status']] },
  'veiculos:placas': { item: 'placa', campos: [['codigo','Código'],['nome','Placa'],['classe','Classe'],['marca','Marca'],['modelo','Modelo'],['tipo','Tipo / Carroceria'],['vinculo','Vínculo'],['status','Status']] },
  'veiculos:marcas': { item: 'marca', campos: [['codigo','Código'],['nome','Marca'],['categoria','Aplicação'],['origem','Origem'],['status','Status']] },
  'veiculos:modelos': { item: 'modelo', campos: [['codigo','Código'],['nome','Modelo'],['marca','Marca'],['tipo','Tipo'],['classe','Classe'],['status','Status']] },
  'veiculos:tipos': { item: 'tipo de veículo', campos: [['codigo','Código'],['nome','Tipo'],['classe','Classe'],['eixos','Eixos'],['capacidade','Capacidade referência'],['status','Status']] },
  'clientes:todos': { item: 'cliente', campos: [['codigo','Código'],['nome','Cliente / Razão social'],['documento','CNPJ'],['perfil','Operação'],['filial','Filial principal'],['status','Status']] },
  'unidades:enderecos': { item: 'unidade', campos: [['codigo','Código'],['nome','Local / Unidade'],['endereco','Endereço'],['cidade','Cidade / UF'],['cliente','Cliente relacionado'],['tipo','Finalidade'],['status','Status']] },
};

export function chaveBaseCadastro(secaoId, abaId) {
  if (secaoId === 'pessoas' && abaId === 'emprestimos') return 'pessoas:pessoas';
  if (secaoId === 'clientes') return 'clientes:todos';
  if (secaoId === 'unidades') return 'unidades:enderecos';
  return `${secaoId}:${abaId}`;
}

export function filtrarPorAba(secaoId, abaId, registros, classePlaca = 'motorizados') {
  if (secaoId === 'clientes' && abaId === 'coleta') return registros.filter(r => /coleta/i.test(r.perfil || ''));
  if (secaoId === 'clientes' && abaId === 'entrega') return registros.filter(r => /entrega/i.test(r.perfil || ''));
  if (secaoId === 'unidades' && abaId !== 'enderecos') {
    const criterio = { coleta: 'coleta', distribuicao: 'distribui', ct: 'ct' }[abaId];
    return registros.filter(r => (r.tipo || '').toLocaleLowerCase('pt-BR').includes(criterio));
  }
  if (secaoId === 'veiculos' && abaId === 'placas') {
    return registros.filter(r => r.classe === (classePlaca === 'reboques' ? 'Reboque' : 'Motorizado'));
  }
  return registros;
}
