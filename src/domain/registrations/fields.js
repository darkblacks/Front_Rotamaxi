/** Campos aceitos pelo CadastrosAuxiliaresController V2, sem dados simulados. */
const t = (key, label, required=false, extra={}) => ({ key, label, required, type:'text', ...extra });
const sel = (key, label, options, required=false) => ({ key, label, type:'select', options, required });
const bool = (key, label) => ({ key, label, type:'boolean' });
const ref = (key, label, source, required=false) => ({ key, label, type:'reference', source, required });
const num = (key, label) => ({ key, label, type:'number' });
const notes = (key, label) => ({ key, label, type:'textarea' });

export const CONFIG_CADASTRO = {
  'prestadores-servico': {
    singular:'Prestadora de serviço', columns:[['nome','Prestadora']],
    fields:[t('nome','Nome da prestadora',true)],
  },
  filiais: {
    singular: 'Filial', columns: [['codigo','Código'],['nome','Nome'],['cidade','Cidade'],['uf','UF']],
    fields: [t('codigo','Código',true),t('nome','Nome',true),t('documento','CNPJ/documento'),t('endereco','Endereço'),t('cidade','Cidade'),t('uf','UF')],
  },
  marcas: { singular:'Marca', columns:[['nome','Marca']], fields:[t('nome','Nome da marca',true)] },
  modelos: {
    singular:'Modelo', columns:[['nome','Modelo'],['marca_id','Marca']],
    fields:[t('nome','Modelo',true),ref('marca_id','Marca','marcas',true)],
  },
  'tipos-veiculo': {
    singular:'Tipo de veículo',columns:[['nome','Tipo'],['categoria','Categoria']],
    fields:[t('nome','Tipo/carretaria',true),sel('categoria','Categoria',[['motorizado','Motorizado'],['reboque','Reboque']],true)],
  },
  veiculos: {
    singular:'Veículo',columns:[['placa','Placa'],['macro_categoria','Macro categoria'],['tipo_operacional','Tipo operacional'],['marca_nome','Marca'],['modelo_nome','Modelo'],['vinculo','Vínculo']],
    fields:[
      t('placa','Placa',true),sel('categoria','Categoria',[['motorizado','Motorizado'],['reboque','Reboque']]),
      t('descricao','Descrição'),ref('marca_id','Marca','marcas'),ref('modelo_id','Modelo','modelos'),ref('tipo_id','Tipo de veículo','tipos-veiculo'),
      ref('filial_matriz_id','Filial matriz','filiais'),ref('proprietario_pessoa_id','Proprietário','pessoas'),
      t('renavam','RENAVAM'), num('capacidade_kg','Capacidade (kg)'),
      sel('vinculo','Vínculo',[['proprio','Próprio'],['terceiro','Terceiro'],['agregado','Agregado']]),notes('observacoes','Observações'),
    ],
  },
  clientes: {
    singular:'Cliente',columns:[['pessoa.nome','Pessoa / Razão social'],['pessoa.documento','Documento'],['permite_coleta','Coleta'],['permite_entrega','Entrega']],
    fields:[ref('pessoa_id','Pessoa cadastrada','pessoas',true),bool('permite_coleta','Permite coleta'),bool('permite_entrega','Permite entrega'),notes('observacoes','Observações')],
  },
  unidades: {
    singular:'Unidade',columns:[['nome','Local'],['cidade','Cidade'],['uf','UF'],['logradouro','Endereço'],['cliente_pessoa_id','Pessoa cliente']],
    fields:[
      t('nome','Identificação do local'),ref('cliente_pessoa_id','Pessoa cliente','pessoas'),ref('filial_id','Filial','filiais'),
      bool('local_coleta','Local de coleta'),bool('local_entrega','Local de entrega'),bool('centro_distribuicao','Centro de distribuição'),
      t('cep','CEP'),t('logradouro','Logradouro'),t('numero','Número'),t('complemento','Complemento'),
      t('bairro','Bairro'),t('cidade','Cidade'),t('uf','UF'),num('latitude','Latitude'),num('longitude','Longitude'),
    ],
  },
};

export function valorDaColuna(registro, key, referencias={}) {
  let valor = key.split('.').reduce((obj, parte) => obj?.[parte], registro);
  if (key.endsWith('_id') && valor != null) {
    const recurso = {marca_id:'marcas',modelo_id:'modelos',tipo_id:'tipos-veiculo',
      filial_id:'filiais',filial_matriz_id:'filiais',cliente_pessoa_id:'pessoas',proprietario_pessoa_id:'pessoas'}[key];
    const encontrado = (referencias[recurso] || []).find(item => item.id === Number(valor));
    if (encontrado) valor = encontrado.nome || encontrado.placa || encontrado.codigo;
  }
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  return valor === null || valor === undefined || valor === '' ? '—' : String(valor);
}
export function formularioVazio(recurso, categoria='motorizado') {
  const config=CONFIG_CADASTRO[recurso];
  const valores=Object.fromEntries(config.fields.map(f=>[f.key,f.type==='boolean'?false:'']));
  if (recurso==='veiculos' || recurso==='tipos-veiculo') valores.categoria=categoria;
  return { ...valores, is_active:true };
}
export function corpoCadastro(recurso, dados) {
  const config=CONFIG_CADASTRO[recurso];
  const corpo={ is_active: Boolean(dados.is_active) };
  for (const campo of config.fields) {
    let valor=dados[campo.key];
    if (campo.type==='boolean') { corpo[campo.key]=Boolean(valor); continue; }
    if (campo.type==='reference') { corpo[campo.key]=valor === '' || valor==null ? null : Number(valor); continue; }
    if (campo.type==='number') { corpo[campo.key]=valor === '' || valor==null ? null : Number(valor); continue; }
    if (typeof valor==='string') valor=valor.trim();
    if (valor === '' || valor == null) {
      if (campo.required) continue; // backend confirma erro; não enviamos falsos preenchimentos
      if (recurso==='veiculos' && campo.key==='vinculo') { corpo[campo.key]=null; continue; }
      corpo[campo.key]=null;
    } else corpo[campo.key]=campo.key==='uf' ? String(valor).toUpperCase() : valor;
  }
  if (recurso==='veiculos') corpo.placa=String(dados.placa||'').toUpperCase().replace(/\s/g,'');
  return corpo;
}
