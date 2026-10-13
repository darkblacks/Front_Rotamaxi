/** Parseia exportação ESL com cabeçalhos brasileiros, aspas, ; e formatos Excel. */
function camposCsv(texto, delimitador) {
  const linhas=[];let atual=[],celula='',aspas=false;
  for(let i=0;i<texto.length;i++){
    const c=texto[i],proximo=texto[i+1];
    if(c==='"'){if(aspas&&proximo==='"'){celula+='"';i++;}else aspas=!aspas;}
    else if(c===delimitador&&!aspas){atual.push(celula);celula='';}
    else if((c==='\n'||c==='\r')&&!aspas){if(c==='\r'&&proximo==='\n')i++;atual.push(celula);celula='';if(atual.some(x=>x.trim()))linhas.push(atual);atual=[];}
    else celula+=c;
  }
  atual.push(celula);if(atual.some(x=>x.trim()))linhas.push(atual);
  return linhas;
}
const chave=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
export const COLUNAS_ESL={
  placa:['placa'],marca_nome:['marca'],modelo_nome:['modelo'],cor:['cor'],combustivel:['combustivel'],
  numero_frota:['nfrota','numerofrota'],ano_fabricacao:['anofabricacao'],ano_modelo:['anomodelo'],
  renavam:['renavam'],chassi:['chassi'],cidade_licenciamento:['cidadelicenciamento'],
  tipo_veiculo_esl:['tipoveiculo'],tipo_carroceria:['tipocarroceria'],tipo_proprietario_esl:['tipoproprietario'],
  proprietario_esl_nome:['proprietario'],agregado_esl_nome:['agregado'],tabela_agregado:['tabeladeagregado'],
  motorista_padrao:['motoristapadrao'],data_compra:['datacompra'],valor_compra:['valorcompra'],
  data_venda:['datavenda'],valor_venda:['valorvenda'],pbt_kg:['pbtpesobrutototal','pbtkg'],
  tara_kg:['tarakg'],capacidade_m3:['capacidadem3'],capacidade_lotacao:['capacidadelotacao'],
  numero_autorizacao_gr:['numeroautorizacaogr'],validade_gr:['validadegr'],
  situacao_esl:['statusdoveiculo','situacaodoveiculo'],lote_fechamento_ciot:['loteparafechamentodociot'],
  externo_id:['idesl','idveiculoesl','externoid'],descricao:['descricao'],
};
export function lerExportacaoEsl(texto,{limite=2000}={}){
  const semBom=texto.replace(/^\uFEFF/,'');
  const cabecalho=semBom.split(/\r?\n/,1)[0];const separador=(cabecalho.match(/;/g)||[]).length>=(cabecalho.match(/,/g)||[]).length?';':',';
  const [header,...linhas]=camposCsv(semBom,separador);
  const nomes=header.map(chave),indices=Object.fromEntries(Object.entries(COLUNAS_ESL).map(([key,apelidos])=>[key,nomes.findIndex(c=>apelidos.includes(c))]));
  if(indices.placa<0)throw new Error('CSV sem coluna Placa. Exporte a relação de veículos do ESL.');
  if(linhas.length>limite)throw new Error(`O limite por arquivo é ${limite} linhas. Divida o CSV em partes.`);
  const ja=new Set();
  const itens=linhas.map((celulas,i)=>{
    const r={};for(const [key,indice] of Object.entries(indices))if(indice>=0){const v=String(celulas[indice]??'').trim();if(v)r[key]=v;}
    r.placa=String(r.placa||'').replace(/[^a-z0-9]/gi,'').toUpperCase();
    if(!r.placa)return null;
    if(ja.has(r.placa))throw new Error(`Placa duplicada no arquivo: ${r.placa}, linha ${i+2}`);
    ja.add(r.placa);
    for(const nome of ['ano_fabricacao','ano_modelo'])if(r[nome])r[nome]=Number(r[nome]);
    for(const nome of ['renavam','numero_autorizacao_gr'])if(/^="[0-9]+"$/.test(r[nome]||''))r[nome]=r[nome].slice(2,-1);
    return r;
  }).filter(Boolean);
  if(!itens.length)throw new Error('Nenhuma placa válida encontrada no arquivo.');
  return itens;
}
export const descricaoAcao=x=>({criar:'Criar',criado:'Criado',existente:'Existente — preservado',revisar:'Confirmar catálogo',invalida:'Inválido',duplicada:'Duplicado',conflito:'Conflito de ID ESL',vincular:'Vincular ID ESL',completar:'Completar campos vazios',vincular_e_completar:'Completar e vincular',sem_cadastro:'Placa não cadastrada',vinculado:'Vinculado',completado:'Completado'})[x]||x;
export function resultadoImportacao(linhas){return linhas.reduce((o,x)=>(o[x.acao]=(o[x.acao]||0)+1,o),{});}
