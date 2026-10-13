/**
 * Navegação de três níveis: módulo (topbar) -> seção (sidebar) -> cadastro (barra inferior).
 * Este arquivo concentra os rótulos e links para a sidebar e para o workspace.
 */
import { Building2, ContactRound, Truck, Users, BriefcaseBusiness } from 'lucide-vue-next';

export const secoesCadastro = [
  {
    id: 'pessoas', nome: 'Pessoas', icone: ContactRound,
    descricao: 'Pessoas, motoristas e acessos do sistema.',
    abas: [
      { id: 'pessoas', nome: 'Pessoas cadastradas', nomeCurto: 'Pessoas', descricao: 'Cadastro-base de pessoas físicas com identificação, documentos e vínculo.' },
      { id: 'motoristas', nome: 'Motoristas', descricao: 'Motoristas cadastrados e dados de habilitação.' },
      { id: 'usuarios', nome: 'Usuários e acessos', nomeCurto: 'Usuários', descricao: 'Usuários que possuem acesso ao sistema.' },
    ],
  },
  {
    id: 'veiculos', nome: 'Veículos', icone: Truck,
    descricao: 'Placas, implementos, marcas, modelos e classificação da frota.',
    abas: [
      { id: 'placas', nome: 'Placas cadastradas', nomeCurto: 'Placas', descricao: 'Veículos motorizados, reboques e semirreboques.' },
      { id: 'marcas', nome: 'Marcas cadastradas', nomeCurto: 'Marcas', descricao: 'Fabricantes e marcas vinculados aos veículos.' },
      { id: 'modelos', nome: 'Modelos de veículos', nomeCurto: 'Modelos', descricao: 'Modelos associados às marcas.' },
    ],
  },
  {
    id: 'terceiros', nome: 'Terceiros', icone: BriefcaseBusiness,
    descricao: 'Empresas prestadoras de serviço vinculadas à operação.',
    abas: [
      { id: 'transporte', nome: 'Serviços de Transporte', nomeCurto: 'Transporte', descricao: 'Transportadoras, agregados e empresas que prestam serviços de transporte.' },
      { id: 'gerais', nome: 'Serviços Gerais', nomeCurto: 'Serviços Gerais', descricao: 'Empresas terceiras de apoio, manutenção e demais serviços.' },
    ],
  },
  { id: 'filiais', nome: 'Filiais', icone: Building2,
    descricao: 'Filiais e bases da operação.',
    abas: [{ id: 'todas', nome: 'Filiais cadastradas', descricao: 'Matrizes, filiais e bases cadastradas.' }],
  },
  {
    id: 'clientes', nome: 'Clientes', icone: Users,
    descricao: 'Clientes e os papéis que exercem nas operações de transporte.',
    abas: [
      { id: 'todos', nome: 'Clientes cadastrados', nomeCurto: 'Todos os clientes', descricao: 'Cadastro mestre de clientes.' },
      { id: 'coleta', nome: 'Clientes de coleta', nomeCurto: 'Coleta', descricao: 'Clientes que solicitam ou originam serviços de coleta.' },
      { id: 'entrega', nome: 'Clientes de entrega', nomeCurto: 'Entrega', descricao: 'Clientes que recebem ou destinam mercadorias.' },
    ],
  },
  {
    id: 'unidades', nome: 'Unidades', icone: Building2,
    descricao: 'Endereços operacionais, locais de atendimento e centros de distribuição.',
    abas: [
      { id: 'enderecos', nome: 'Todos os endereços', nomeCurto: 'Endereços', descricao: 'Locais físicos vinculados aos clientes.' },
      { id: 'coleta', nome: 'Locais de coleta', nomeCurto: 'Coleta', descricao: 'Endereços de origem e retirada de cargas.' },
      { id: 'distribuicao', nome: 'Locais de distribuição', nomeCurto: 'Distribuição', descricao: 'Endereços de descarga e entrega.' },
      { id: 'ct', nome: 'CT · Centro de distribuição', nomeCurto: 'CT / CDs', descricao: 'Centros de distribuição, transferência e apoio operacional.' },
    ],
  },
];

export function obterSecaoCadastro(id) {
  return secoesCadastro.find(item => item.id === id) || secoesCadastro.find(item => item.id === 'pessoas');
}
export function obterAbaCadastro(secao, id) {
  return secao.abas.find(item => item.id === id) || secao.abas[0];
}
export function rotaCadastro(secaoId, abaId, query = {}) {
  const secao = obterSecaoCadastro(secaoId);
  const aba = obterAbaCadastro(secao, abaId);
  return { name: 'cadastros-item', params: { tipo: secao.id }, query: { aba: aba.id, ...query } };
}

export const redirecionamentosCadastroAntigo = {
  motoristas: ['pessoas', 'motoristas'],
  usuarios: ['pessoas', 'usuarios'],
  perfis: ['pessoas', 'usuarios'],
  'tipos-veiculo': ['veiculos', 'placas'],
  'tipos-servico': ['terceiros', 'gerais'],
  'tipos-anexo': ['unidades', 'enderecos'],
  integracoes: ['clientes', 'todos'],
};
