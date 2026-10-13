<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { ArrowLeft, Camera, Check, ChevronDown, CircleAlert, CloudDownload, FileText, ImageOff, Link2, Search, ShieldCheck, Trash2, Truck, UploadCloud, Plus, X, RefreshCw, Building2, UserRound, Wallet, History, Wrench } from 'lucide-vue-next';
import {
  buscarCadastro, gravarCadastro, listarCadastro, listarPessoas, consultarPessoa,
  catalogoAnosModeloLocal, fotosVeiculo, enviarFotoVeiculo, excluirFotoVeiculo,
  listarVinculosEsl, criarVinculoEsl, excluirVinculoEsl, falhaCadastro,
} from '@/services/api/registrations.api.js';
import { listFipeBrands, listFipeModels, resolveFipeYears, getFipeQuote } from '@/services/api/fipe.api.js';
import { anoDoCodigoFipe, versoesDoAno, resolverAnoDigitado } from '@/domain/vehicles/fipe/single-year.js';
import { resolverTipoFipeCatalogado, dadosCatalogadosValidos } from '@/domain/vehicles/catalog-linking.js';
import { validarPropriedadeVeiculo, normalizarVinculoVeiculo } from '@/domain/vehicles/ownership.js';
import { lerPrefillDaConsulta, valorFipeExibivel, TIPOS_FROTA, classificacoesDoTipo, tipoDaClassificacao, destinoVoltar, queryVoltar } from '@/domain/vehicles/fleet-model.js';
import {
  validarPlaca, validarRenavam, validarChassi, validarAnos, validarEixos, camposDaCategoria,
  depreciacaoLinhaReta, fotosPendentes, houveAlteracao, situacaoDocumento, ROTULO_SITUACAO,
} from '@/domain/vehicles/registration.js';
import VeiculoDocumentos from '@/components/registrations/vehicles/details/VehicleDocuments.vue';
import VeiculoValoracao from '@/components/registrations/vehicles/details/VehicleValuation.vue';
const route=useRoute(); const router=useRouter();
const id=computed(()=>route.params.id||null);
const edicao=computed(()=>Boolean(id.value));
const categorias=[['motorizado','Motorizado'],['reboque','Reboque / semirreboque']];
const macros=[['pesado','Veículos pesados · cavalo / carreta'],['medio','Veículos médios · truck / Accelo'],
  ['utilitario_pesado','Utilitários pesados · HR / VUC'],['utilitario','Utilitários · van / Fiorino'],
  ['leve','Utilitários leves · passeio'],['motocicleta','Motocicletas'],['reboque','Reboques / semirreboques']];
const fotosCampos=[['frontal','Frontal'],['lateral_esquerda','Lateral esquerda'],['lateral_direita','Lateral direita'],['traseira','Traseira']];
const vazio=()=>({placa:'',descricao:'',categoria:route.query.classe==='reboque'?'reboque':'motorizado',
  is_active:true, macro_categoria:'',tipo_operacional:'',categoria_cnh_referencia:'',fipe_tipo:'trucks',
  marca_id:null,modelo_id:null,marca_nome:'',modelo_nome:'',fipe_marca_codigo:'',fipe_modelo_codigo:'',ano_modelo:'',fipe_ano_codigo:'',
  renavam:'',capacidade_kg:'',cor:'',combustivel:'',numero_frota:'',ano_fabricacao:'',chassi:'',cidade_licenciamento:'',tipo_veiculo_esl:'',tipo_carroceria:'',eixos:'',tipo_proprietario_esl:'',proprietario_esl_nome:'',motorista_esl_nome:'',agregado_esl_nome:'',tabela_agregado:'',pbt_kg:'',tara_kg:'',capacidade_m3:'',capacidade_lotacao:'',numero_autorizacao_gr:'',validade_gr:'',data_compra:'',valor_compra:'',taxa_depreciacao_anual:'',data_venda:'',valor_venda:'',situacao_esl:'',lote_fechamento_ciot:'',esl_marca_original:'',esl_modelo_original:'',vinculo:'',prestador_servico_id:null,motorista_referencia_pessoa_id:null,filial_matriz_id:'',proprietario_pessoa_id:'',observacoes:''});
const prefillFipe=ref(false);
const form=ref(vazio()); const carregando=ref(false); const salvando=ref(false);
const erro=ref(''); const sucesso=ref('');
const prestadoresTransporte=ref([]);const motoristas=ref([]);
const depreciacao=computed(()=>depreciacaoLinhaReta(form.value));
const campos=computed(()=>camposDaCategoria(form.value.categoria));
// Navegação por seções (padrão Pessoas): painéis fixos + "Dados avançados" em acordeões.
const abertos=ref([]);
function expandir(sec){abertos.value=abertos.value.includes(sec)?abertos.value.filter(s=>s!==sec):[...abertos.value,sec];}
// Categoria única: só Próprio e Terceiro / Agregado. 'agregado' vindo da API é tratado como terceiro e nunca é enviado.
const normalizarVinculo=normalizarVinculoVeiculo;
const ehTerceirizado=computed(()=>form.value.vinculo==='terceiro');
const tipoFrota=ref('');
const opcoesClassificacao=computed(()=>{
  const lista=classificacoesDoTipo(tipoFrota.value);const atual=form.value.tipo_operacional;
  return atual&&!lista.includes(atual)&&(!tipoFrota.value||!tipoDaClassificacao(atual))?[...lista,atual]:lista;
});
function escolherTipoFrota(){
  if(!classificacoesDoTipo(tipoFrota.value).includes(form.value.tipo_operacional))form.value.tipo_operacional='';
  if(tipoFrota.value==='Reboque/Carreta')form.value.categoria='reboque';else if(tipoFrota.value&&form.value.categoria==='reboque')form.value.categoria='motorizado';
}
const frotaLinha=ref(null);
const fipeAtual=computed(()=>{const f=frotaLinha.value?.fipe;return valorFipeExibivel(f)?f:null;});
const compraConhecida=computed(()=>Number(String(form.value.valor_compra).replace(',','.'))>0);
const depreciacaoMercado=computed(()=>fipeAtual.value&&compraConhecida.value?Number(String(form.value.valor_compra).replace(',','.'))-Number(fipeAtual.value.valor):null);
const situacaoGr=computed(()=>situacaoDocumento(form.value.validade_gr));
const telaTerceiros=router.resolve({name:'cadastros-item',params:{tipo:'terceiros'},query:{aba:'transporte'}}).href;
const prestadorPendente=computed(()=>ehTerceirizado.value&&!form.value.prestador_servico_id);
const fmtData=v=>v?new Date(v).toLocaleString('pt-BR'):'—';
const vPlaca=computed(()=>validarPlaca(form.value.placa));
const vRenavam=computed(()=>validarRenavam(form.value.renavam));
const vChassi=computed(()=>validarChassi(form.value.chassi));
const vAnos=computed(()=>validarAnos(form.value.ano_fabricacao,form.value.ano_modelo));
const vEixos=computed(()=>validarEixos(form.value.eixos));
const placaTocada=ref(false);
let msgPendente='';
const FOTO_KEYS=['frontal','traseira','lateral_esquerda','lateral_direita'];
// Guarda de alterações não salvas: snapshot logo após carregar/salvar.
const snapshot=ref('');const salvouAgora=ref(false);
const alterado=computed(()=>!salvouAgora.value&&snapshot.value!==''&&(houveAlteracao(snapshot.value,JSON.stringify(form.value))||Object.keys(arquivos.value).length>0||removidas.value.length>0));
function marcarLimpo(){snapshot.value=JSON.stringify(form.value);}
function avisarSaida(e){if(alterado.value){e.preventDefault();e.returnValue='';}}
onMounted(()=>window.addEventListener('beforeunload',avisarSaida));
onBeforeUnmount(()=>window.removeEventListener('beforeunload',avisarSaida));
onBeforeRouteLeave(()=>{if(alterado.value&&!window.confirm('Há alterações não salvas. Sair mesmo assim?'))return false;});
const reais=v=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

const buscandoPrestadores=ref(false);const buscandoMotoristas=ref(false);
const buscaMotorista=ref('');const contatoMotorista=ref('');
let consultaContato=0;
async function carregarContatoMotorista(){
  const selecionado=Number(form.value.motorista_referencia_pessoa_id||0), consulta=++consultaContato;
  contatoMotorista.value='';
  if(!selecionado)return;
  try{
    const detalhe=await consultarPessoa(selecionado);
    if(consulta!==consultaContato)return;
    const telefone=(detalhe.contatos||[]).find(c=>/^(telefone|celular|whatsapp|contato de emergência)$/i.test(String(c.tipo||''))&&String(c.valor||'').trim());
    contatoMotorista.value=telefone?.valor||'';
  }catch{} // O motorista pode ser escolhido mesmo sem telefone registrado.
}

// Se houver arquivo de logo oficial, configure VITE_TRANSMASSA_LOGO no .env do frontend.
const logoTransmassa=String(import.meta.env.VITE_TRANSMASSA_LOGO || (String(import.meta.env.VITE_EMPRESA_NOME||'').toLowerCase().includes('transmassa') ? import.meta.env.VITE_EMPRESA_LOGO : '') || '').trim();
const falhaLogoTransmassa=ref(false);const falhaLogoPrestador=ref(false);
const prestadorSelecionado=computed(()=>prestadoresTransporte.value.find(p=>Number(p.id)===Number(form.value.prestador_servico_id))||null);
watch(()=>prestadorSelecionado.value?.logo_url,()=>{falhaLogoPrestador.value=false;});
const nomeMotorista=computed(()=>motoristas.value.find(m=>Number(m.id)===Number(form.value.motorista_referencia_pessoa_id))?.nome||'');
function escolherPropriedade(tipo){
  form.value.vinculo=tipo;
  if(tipo==='proprio')form.value.prestador_servico_id=null;
  erro.value='';
}
async function carregarPrestadores(){
  buscandoPrestadores.value=true;
  try{
    const itens=[];let pagina=1;
    while(pagina<=30){
      const dados=await listarCadastro('prestadores-servico',{tipo_prestador:'transporte',ativo:1,por_pagina:100,page:pagina});
      itens.push(...(dados.data||[]));
      if(pagina>=Number(dados.last_page||1))break;
      pagina++;
    }
    prestadoresTransporte.value=itens;
    const atual=Number(form.value.prestador_servico_id);
    if(atual&&!itens.some(v=>Number(v.id)===atual)){
      try{const antigo=await buscarCadastro('prestadores-servico',atual);
        if(antigo?.tipo_prestador==='transporte')prestadoresTransporte.value=[antigo,...itens];
      }catch{} // Prestador excluído: backend validará na gravação.
    }
  }catch(e){erro.value='Não foi possível carregar as transportadoras: '+falhaCadastro(e);}
  finally{buscandoPrestadores.value=false;}
}
async function carregarMotoristas(busca=''){
  buscandoMotoristas.value=true;
  try{
    const resultado=await listarPessoas({motorista:1,ativo:1,busca:busca.trim()||undefined,por_pagina:100});
    const recebidos=resultado.data||[];
    const selecionado=Number(form.value.motorista_referencia_pessoa_id);
    const anterior=motoristas.value.find(v=>Number(v.id)===selecionado);
    motoristas.value=anterior&&!recebidos.some(v=>Number(v.id)===selecionado)
      ?[anterior,...recebidos]:recebidos;
    if(selecionado&&!motoristas.value.some(v=>Number(v.id)===selecionado)){
      try{const atual=await consultarPessoa(selecionado);if(atual?.motorista?.habilitado)motoristas.value=[atual,...motoristas.value];}catch{}
    }
  }catch(e){erro.value='Não foi possível consultar motoristas: '+falhaCadastro(e);}
  finally{buscandoMotoristas.value=false;}
}
 const marcas=ref([]); const modelos=ref([]); const catalogoErro=ref('');
const buscandoMarcas=ref(false); const buscandoModelos=ref(false);
const marcaBusca=ref('');const modeloBusca=ref('');
const irCatalogo=(aba)=>router.push({name:'cadastros-item',params:{tipo:'veiculos'},query:{aba,novo:'1',...queryVoltar(route.fullPath)}}); // mesma aba; volta a ESTE formulário
const atualizandoCatalogo=ref(false);
async function atualizarCatalogo(){
  if(atualizandoCatalogo.value)return;
  atualizandoCatalogo.value=true;
  try{
    await carregarMarcas(false);
    if(form.value.marca_id)await carregarModelos(false);
  }finally{atualizandoCatalogo.value=false;}
}

const marcaSelecionada=computed(()=>marcas.value.find(m=>m.id===Number(form.value.marca_id))||null);
const logoFalha=ref(false);
watch(()=>marcaSelecionada.value?.foto_url,()=>{logoFalha.value=false;});
const modeloSelecionado=computed(()=>modelos.value.find(m=>m.id===Number(form.value.modelo_id))||null);
const marcasFiltradas=computed(()=>marcas.value.filter(m=>m.nome.toLowerCase().includes(marcaBusca.value.toLowerCase())||m.id===Number(form.value.marca_id)).slice(0,300));
const modelosFiltrados=computed(()=>modelos.value.filter(m=>m.nome.toLowerCase().includes(modeloBusca.value.toLowerCase())||m.id===Number(form.value.modelo_id)).slice(0,600));
// A cotação depende da versão FIPE exata (ano + combustível), nunca apenas do ano digitado.
const anosFipe=ref([]); const anosLocais=ref([]); const anoEscolha=ref(''); const cotacaoFipe=ref(null); const cotacaoErro=ref('');
const carregandoAnos=ref(false); const carregandoCotacao=ref(false);
const modoAnoNovo=ref(false); const anoDigitado=ref(''); const anoAviso=ref('');
const anoAntesDeNovo=ref(null);
const filtroAnoSugerido=ref(null);
const modeloTemFipe=computed(()=>Boolean(form.value.modelo_id && form.value.marca_id && form.value.fipe_tipo));
const anosVisiveis=computed(()=>{
  const fipe=anosFipe.value.map(v=>({...v,valor:`fipe:${v.codigo}`}));
  const manuais=anosLocais.value.filter(ano=>!versoesDoAno(anosFipe.value,ano).length)
    .map(ano=>({nome:`${ano} · já cadastrado (sem FIPE)`,valor:`local:${ano}`,codigo:null}));
  const opcoes=[...fipe,...manuais];
  return filtroAnoSugerido.value===null ? opcoes
    : opcoes.filter(v=>anoDoCodigoFipe(v.codigo)===filtroAnoSugerido.value || v.valor===`local:${filtroAnoSugerido.value}`);
});
const semFipePorAnoManual=computed(()=>Boolean(form.value.ano_modelo && !form.value.fipe_ano_codigo)
  && (modoAnoNovo.value || anoEscolha.value.startsWith('local:')));

let consultaAnosId=0; let consultaCotacaoId=0;
function invalidarCotacao(limparAno=true){
  consultaAnosId++; consultaCotacaoId++;
  anosFipe.value=[];anosLocais.value=[];anoEscolha.value='';cotacaoFipe.value=null; cotacaoErro.value='';
  carregandoAnos.value=false;carregandoCotacao.value=false;
  if(limparAno)form.value.fipe_ano_codigo='';
}
async function carregarAnosFipe(){
  invalidarCotacao(false);
  if(!form.value.modelo_id || !form.value.marca_id) return;
  const consulta=++consultaAnosId;
  const tipo=form.value.fipe_tipo, marca=form.value.marca_id, modelo=form.value.modelo_id;
  carregandoAnos.value=true;
  const resultado=await Promise.allSettled([
    catalogoAnosModeloLocal(marca,modelo),
    tipo ? resolveFipeYears({ preferredType:tipo, brandId:marca, modelId:modelo, brand:marcaSelecionada.value, model:modeloSelecionado.value }) : Promise.resolve({type:'',years:[]}),
  ]);
  if(consulta!==consultaAnosId)return;
  anosLocais.value=resultado[0].status==='fulfilled'?resultado[0].value.map(Number):[];
  const resolucaoFipe=resultado[1].status==='fulfilled'?resultado[1].value:{type:'',years:[]};
  anosFipe.value=resolucaoFipe.years||[];
  if(resolucaoFipe.type && anosFipe.value.length && resolucaoFipe.type!==form.value.fipe_tipo){
    form.value.fipe_tipo=resolucaoFipe.type;
    form.value.fipe_marca_codigo=marcaSelecionada.value?.fipe_codigos?.[resolucaoFipe.type]||form.value.fipe_marca_codigo||null;
    form.value.fipe_modelo_codigo=modeloSelecionado.value?.fipe_codigos?.[resolucaoFipe.type]||form.value.fipe_modelo_codigo||null;
  }
  if(resultado[0].status==='rejected')catalogoErro.value=falhaCadastro(resultado[0].reason);
  if(resultado[1].status==='rejected')cotacaoErro.value=falhaCadastro(resultado[1].reason);
  // Sempre priorizar a versão FIPE exata, depois um ano cadastrado localmente.
  const anoAtual=Number(form.value.ano_modelo);
  const versoes=versoesDoAno(anosFipe.value,anoAtual);
  if(anosFipe.value.some(v=>v.codigo===form.value.fipe_ano_codigo)){
    anoEscolha.value=`fipe:${form.value.fipe_ano_codigo}`;
    await consultarCotacaoFipe();
  } else if(versoes.length===1){
    form.value.fipe_ano_codigo=versoes[0].codigo;
    anoEscolha.value=`fipe:${versoes[0].codigo}`;
    await consultarCotacaoFipe();
  } else if(versoes.length>1){
    form.value.fipe_ano_codigo='';
    filtroAnoSugerido.value=anoAtual;
    anoAviso.value='O ano já existe com versões diferentes. Selecione o combustível para consultar a FIPE.';
  } else if(anoAtual>=1950 && anoAtual<=2100 && anosLocais.value.includes(anoAtual)){
    form.value.fipe_ano_codigo='';anoEscolha.value=`local:${anoAtual}`;
    anoAviso.value='Ano já usado neste modelo, sem versão FIPE vinculada.';
  } else if(anoAtual>=1950 && anoAtual<=2100){
    form.value.fipe_ano_codigo='';
    modoAnoNovo.value=true;anoDigitado.value=String(anoAtual);
    anoAviso.value='Ano fora do catálogo FIPE e ainda não cadastrado neste modelo. Sem cotação FIPE.';
  }
  carregandoAnos.value=false;
}
async function consultarCotacaoFipe(){
  cotacaoFipe.value=null;cotacaoErro.value='';
  const consulta=++consultaCotacaoId;
  const tipo=form.value.fipe_tipo,marca=form.value.marca_id,modelo=form.value.modelo_id,ano=form.value.fipe_ano_codigo;
  if(!tipo||!marca||!modelo||!ano)return;
  carregandoCotacao.value=true;
  try{
    const resposta=await getFipeQuote(tipo,marca,modelo,ano);
    if(consulta===consultaCotacaoId)cotacaoFipe.value=resposta;
  }catch(e){if(consulta===consultaCotacaoId)cotacaoErro.value=falhaCadastro(e);}
  finally{if(consulta===consultaCotacaoId)carregandoCotacao.value=false;}
}
function escolherAnoFipe(){
  modoAnoNovo.value=false;anoAviso.value='';filtroAnoSugerido.value=null;anoAntesDeNovo.value=null;
  if(anoEscolha.value.startsWith('local:')){
    form.value.ano_modelo=Number(anoEscolha.value.slice(6));
    limparCotacaoAno();
    anoAviso.value='Ano já cadastrado neste modelo, sem cotação FIPE.';
    return;
  }
  const codigo=anoEscolha.value.startsWith('fipe:')?anoEscolha.value.slice(5):'';
  form.value.fipe_ano_codigo=codigo;
  form.value.ano_modelo=anoDoCodigoFipe(codigo) ?? '';
  if(codigo)consultarCotacaoFipe();
  else limparCotacaoAno();
}
function limparCotacaoAno(){
  form.value.fipe_ano_codigo='';consultaCotacaoId++;
  cotacaoFipe.value=null;cotacaoErro.value='';carregandoCotacao.value=false;
}
function alternarNovoAno(){
  if(modoAnoNovo.value){
    modoAnoNovo.value=false;anoDigitado.value='';anoAviso.value='';filtroAnoSugerido.value=null;
    // Cancelar a edição restaura a versão selecionada antes de clicar no +.
    if(anoAntesDeNovo.value){
      form.value.ano_modelo=anoAntesDeNovo.value.ano;
      form.value.fipe_ano_codigo=anoAntesDeNovo.value.codigo;
      anoEscolha.value=anoAntesDeNovo.value.escolha;
      if(form.value.fipe_ano_codigo)consultarCotacaoFipe();
    }
    anoAntesDeNovo.value=null;
    return;
  }
  anoAntesDeNovo.value={ano:form.value.ano_modelo,codigo:form.value.fipe_ano_codigo,escolha:anoEscolha.value};
  modoAnoNovo.value=true;anoDigitado.value=String(form.value.ano_modelo || '');
  anoAviso.value='';filtroAnoSugerido.value=null;
  // Não deixar visível a cotação da versão anterior enquanto edita outra data.
  limparCotacaoAno();anoEscolha.value='';form.value.ano_modelo='';
}
function aplicarAnoNovo(){
  const r=resolverAnoDigitado(anoDigitado.value,anosFipe.value);
  if(r.tipo==='invalido'){anoAviso.value=r.mensagem;return false;}
  if(modeloTemFipe.value && carregandoAnos.value){
    anoAviso.value='Aguarde a consulta dos anos FIPE antes de continuar.';return false;
  }
  if(r.tipo==='personalizado' && anosLocais.value.includes(r.ano)){
    form.value.ano_modelo=r.ano;limparCotacaoAno();
    anoEscolha.value=`local:${r.ano}`;
    modoAnoNovo.value=false;filtroAnoSugerido.value=null;anoAntesDeNovo.value=null;
    anoAviso.value=`${r.ano} já foi cadastrado neste modelo. Ano reutilizado, sem cotação FIPE.`;
    return true;
  }
  // Não permitir criar "novo ano" enquanto a disponibilidade da FIPE não puder ser verificada.
  if(modeloTemFipe.value && cotacaoErro.value && !anosFipe.value.length){
    anoAviso.value='Não foi possível verificar os anos FIPE. Tente novamente antes de cadastrar um ano personalizado.';return false;
  }
  if(r.tipo==='existente'){
    form.value.ano_modelo=r.ano;
    form.value.fipe_ano_codigo=r.codigo;anoEscolha.value=`fipe:${r.codigo}`;
    modoAnoNovo.value=false;filtroAnoSugerido.value=null;anoAntesDeNovo.value=null;
    anoAviso.value=`${r.ano} já existe na FIPE: versão encontrada e selecionada automaticamente.`;
    consultarCotacaoFipe();return true;
  }
  if(r.tipo==='ambiguo'){
    form.value.ano_modelo=r.ano;
    limparCotacaoAno();
    anoEscolha.value='';modoAnoNovo.value=false;filtroAnoSugerido.value=r.ano;anoAntesDeNovo.value=null;
    anoAviso.value=`${r.ano} já existe na FIPE em ${r.versoes.length} versões. Escolha uma delas no seletor.`;
    return false;
  }
  form.value.ano_modelo=r.ano;
  limparCotacaoAno();anoEscolha.value='';modoAnoNovo.value=true;anoAntesDeNovo.value=null;
  anoAviso.value=`Ano ${r.ano} fora das versões FIPE deste modelo. Salvará sem cotação FIPE.`;
  return true;
}
function alterarAnoManualSemCatalogo(){
  limparCotacaoAno();
  anoAviso.value='Ano manual: sem cotação FIPE.';
}

const fotos=ref({}); const arquivos=ref({}); const previews=ref({}); const removidas=ref([]);
const externoId=ref(''); const vinculos=ref([]); const vinculando=ref(false);
const vinculoAtual=computed(()=>vinculos.value.find(v=>v.estado==='ativo')||null);

const pendentesFoto=computed(()=>fotosPendentes(Object.fromEntries(FOTO_KEYS.map(k=>[k,previews.value[k]||fotos.value[k]]))));
const idsNulos=['filial_matriz_id','proprietario_pessoa_id','prestador_servico_id','motorista_referencia_pessoa_id'];
function limparPreviews(){Object.values(previews.value).forEach(u=>{if(u)URL.revokeObjectURL(u)});previews.value={};}
const destinoCentral={name:'cadastros-item',params:{tipo:'veiculos'},query:{aba:'placas'}};
function voltar(){router.push(destinoVoltar(route.query,destinoCentral));}
onBeforeUnmount(limparPreviews);
async function carregar(){invalidarCotacao();anoAntesDeNovo.value=null;modoAnoNovo.value=false;anoDigitado.value='';anoAviso.value='';filtroAnoSugerido.value=null;carregando.value=true;erro.value='';sucesso.value='';form.value=vazio();tipoFrota.value='';frotaLinha.value=null;fotos.value={};arquivos.value={};removidas.value=[];limparPreviews();
  try {
    // Propriedade é da transportadora (própria/terceira), não de Pessoa/Filial.
    if(id.value){const r=await buscarCadastro('veiculos',id.value);form.value={...vazio(),...r,vinculo:normalizarVinculo(r.vinculo)};tipoFrota.value=tipoDaClassificacao(r.tipo_operacional);
      const [fs,vs]=await Promise.allSettled([fotosVeiculo(id.value),listarVinculosEsl('veiculo',id.value)]);
      fotos.value=fs.status==='fulfilled'?fs.value:{};vinculos.value=vs.status==='fulfilled'?vs.value:[];
    } else {
      vinculos.value=[];
      // Vindo da Consulta FIPE: marca/modelo/ano entram como PROPOSTA, editáveis; nada é gravado até salvar.
      const pre=lerPrefillDaConsulta(route.query);
      if(pre){prefillFipe.value=true;Object.assign(form.value,{fipe_tipo:pre.fipe_tipo||form.value.fipe_tipo,marca_id:pre.marca_id,modelo_id:pre.modelo_id,
        ano_modelo:pre.ano_modelo??'',fipe_ano_codigo:pre.fipe_ano_codigo});}
    }
    await Promise.all([carregarPrestadores(),carregarMotoristas()]);
    await carregarContatoMotorista();
    await carregarMarcas(false);
    if(form.value.marca_id)await carregarModelos(false);
    if(!id.value&&prefillFipe.value&&form.value.modelo_id)await carregarAnosFipe();
  } catch(e){erro.value=falhaCadastro(e);} finally{carregando.value=false;salvouAgora.value=false;marcarLimpo();if(msgPendente){sucesso.value=msgPendente;msgPendente='';}}
}
watch(()=>route.params.id,carregar,{immediate:true});
function definirCodigosCatalogados(preferirMacro=false){
  const marca=marcaSelecionada.value;
  const modelo=modeloSelecionado.value;
  form.value.marca_nome=marca?.nome||'';
  form.value.modelo_nome=modelo?.nome||'';
  const resolvido=resolverTipoFipeCatalogado(marca,modelo,form.value.macro_categoria,preferirMacro?'':form.value.fipe_tipo);
  // Metadados locais incompletos não podem apagar uma categoria FIPE já conhecida do veículo.
  const tipo=resolvido || form.value.fipe_tipo || '';
  form.value.fipe_tipo=tipo;
  form.value.fipe_marca_codigo=marca?.fipe_codigos?.[tipo]||form.value.fipe_marca_codigo||null;
  form.value.fipe_modelo_codigo=modelo?.fipe_codigos?.[tipo]||form.value.fipe_modelo_codigo||null;
}
function escolherMacro(){
  form.value.categoria=form.value.macro_categoria==='reboque'?'reboque':'motorizado';
  const anterior=form.value.fipe_tipo;
  definirCodigosCatalogados(true);
  // A classificação operacional não apaga marca/modelo selecionados.
  if(anterior!==form.value.fipe_tipo && form.value.modelo_id){
    form.value.ano_modelo='';modoAnoNovo.value=false;filtroAnoSugerido.value=null;anoAviso.value='';
    invalidarCotacao();carregarAnosFipe();
  }
}
async function carregarMarcas(limpar){
  if(limpar){
    modoAnoNovo.value=false;filtroAnoSugerido.value=null;anoAviso.value='';form.value.ano_modelo='';invalidarCotacao();
    form.value.marca_id=null;form.value.modelo_id=null;form.value.marca_nome='';form.value.modelo_nome='';
  }
  buscandoMarcas.value=true;catalogoErro.value='';
  try{
    // Sem categoria FIPE no formulário: exibe todas as marcas locais, de qualquer tipo.
    marcas.value=await listFipeBrands();
    if(!marcas.value.length)catalogoErro.value='Nenhuma marca cadastrada. Acesse Marcas cadastradas.';
  }catch(e){catalogoErro.value=falhaCadastro(e);marcas.value=[];}
  finally{buscandoMarcas.value=false;}
}
async function carregarModelos(limpar){
  invalidarCotacao(!(!limpar && form.value.fipe_ano_codigo));
  if(limpar){
    modoAnoNovo.value=false;filtroAnoSugerido.value=null;anoAviso.value='';form.value.ano_modelo='';
    form.value.modelo_id=null;form.value.modelo_nome='';form.value.fipe_modelo_codigo='';
  }
  modelos.value=[];
  definirCodigosCatalogados(limpar);
  if(!form.value.marca_id)return;
  buscandoModelos.value=true;catalogoErro.value='';
  const marcaConsultada=Number(form.value.marca_id);
  try{
    const registros=await listFipeModels(marcaConsultada);
    if(Number(form.value.marca_id)!==marcaConsultada)return;
    modelos.value=registros;
    definirCodigosCatalogados();
    if(form.value.modelo_id)await carregarAnosFipe();
  }catch(e){if(Number(form.value.marca_id)===marcaConsultada)catalogoErro.value=falhaCadastro(e);}
  finally{buscandoModelos.value=false;}
}
function escolherModelo(){
  definirCodigosCatalogados(true);
  form.value.ano_modelo='';modoAnoNovo.value=false;filtroAnoSugerido.value=null;anoAviso.value='';
  invalidarCotacao();carregarAnosFipe();
}
function carregarArquivo(posicao,event){const file=event.target.files?.[0];if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){erro.value='Foto precisa ser JPG, PNG ou WEBP até 5 MB.';event.target.value='';return;}
  if(previews.value[posicao])URL.revokeObjectURL(previews.value[posicao]);
  arquivos.value={...arquivos.value,[posicao]:file};previews.value={...previews.value,[posicao]:URL.createObjectURL(file)};
  removidas.value=removidas.value.filter(p=>p!==posicao);erro.value='';
}
function removerFoto(posicao){if(previews.value[posicao])URL.revokeObjectURL(previews.value[posicao]);
  const x={...previews.value};delete x[posicao];previews.value=x;
  const a={...arquivos.value};delete a[posicao];arquivos.value=a;
  fotos.value={...fotos.value,[posicao]:''};if(!removidas.value.includes(posicao))removidas.value.push(posicao);
}
async function salvar(continuar=false){if(salvando.value)return;erro.value='';sucesso.value='';placaTocada.value=true;
  // Único bloqueio local: placa válida + categoria (CAD-G01). Todo o resto vira pendência.
  if(!vPlaca.value.ok){erro.value=vPlaca.value.mensagem;document.getElementById('sec-basicos')?.scrollIntoView({behavior:'smooth'});return;}
  salvando.value=true;
  try{
    if(modoAnoNovo.value && form.value.modelo_id){
      if(!aplicarAnoNovo())throw new Error(anoAviso.value || 'Selecione uma versão FIPE válida.');
    }
    if(modeloTemFipe.value && !modoAnoNovo.value && form.value.ano_modelo && !form.value.fipe_ano_codigo
       && versoesDoAno(anosFipe.value,form.value.ano_modelo).length){
      throw new Error('O ano informado já existe na FIPE. Selecione uma versão do seletor para evitar inconsistências.');
    }
    // Propriedade e catálogo só são validados quando informados; ausência é pendência, não bloqueio.
    if(form.value.vinculo==='proprio'||(ehTerceirizado.value&&form.value.prestador_servico_id)||form.value.motorista_referencia_pessoa_id){
      const validoPropriedade=validarPropriedadeVeiculo(form.value,prestadoresTransporte.value,motoristas.value);
      if(!validoPropriedade.ok)throw new Error(validoPropriedade.mensagem);
    }
    if(form.value.marca_id||form.value.modelo_id){
      const validacao=dadosCatalogadosValidos(form.value,marcaSelecionada.value,modeloSelecionado.value);
      if(!validacao.ok)throw new Error(validacao.mensagem);
    }
    definirCodigosCatalogados();
    const d={...form.value};d.placa=vPlaca.value.placa;
    d.renavam=vRenavam.value.vazio?'':vRenavam.value.valor;d.chassi=vChassi.value.valor;
    for(const k of [...idsNulos,'marca_id','modelo_id'])d[k]=d[k]?Number(d[k]):null;
    for(const k of ['macro_categoria','tipo_operacional','categoria_cnh_referencia','fipe_tipo','marca_nome','modelo_nome','fipe_marca_codigo','fipe_modelo_codigo','fipe_ano_codigo','renavam','vinculo','observacoes','descricao'])d[k]=d[k]||null;
    d.ano_modelo=d.ano_modelo?Number(d.ano_modelo):null;d.capacidade_kg=d.capacidade_kg===''||d.capacidade_kg===null?null:Number(d.capacidade_kg);
    d.ano_fabricacao=d.ano_fabricacao?Number(d.ano_fabricacao):null;
    for(const k of ['pbt_kg','tara_kg','capacidade_m3','capacidade_lotacao','valor_compra','valor_venda','taxa_depreciacao_anual'])d[k]=d[k]===''||d[k]==null?null:Number(String(d[k]).replace(',','.'));
    for(const k of ['data_compra','data_venda','validade_gr'])d[k]=d[k]?String(d[k]).slice(0,10):null;
    // CAD-P06: dados de aquisição NÃO são zerados ao mudar o vínculo (a depreciação só é calculada para Próprio).
    d.chassi=d.chassi||null;d.eixos=d.eixos===''||d.eixos==null?null:Number(d.eixos);

    const keys=['placa','descricao','categoria','is_active','marca_id','modelo_id','macro_categoria','tipo_operacional','categoria_cnh_referencia','fipe_tipo',
      'marca_nome','modelo_nome','fipe_marca_codigo','fipe_modelo_codigo','ano_modelo','fipe_ano_codigo','renavam','capacidade_kg','vinculo','prestador_servico_id','motorista_referencia_pessoa_id','filial_matriz_id','proprietario_pessoa_id','observacoes',
      'cor','combustivel','numero_frota','ano_fabricacao','chassi','cidade_licenciamento','tipo_veiculo_esl','tipo_carroceria',
      'tipo_proprietario_esl','proprietario_esl_nome','motorista_esl_nome','agregado_esl_nome','tabela_agregado','pbt_kg','tara_kg','capacidade_m3','capacidade_lotacao',
      'numero_autorizacao_gr','validade_gr','data_compra','valor_compra','taxa_depreciacao_anual','data_venda','valor_venda',
      'situacao_esl','lote_fechamento_ciot','esl_marca_original','esl_modelo_original'];
    if(d.eixos!==null&&campos.value.eixos)keys.push('eixos'); // coluna nova: só enviada quando preenchida
    const payload=Object.fromEntries(keys.map(k=>[k,d[k]]));
    const salvo=await gravarCadastro('veiculos',payload,id.value);let falhas=[];
    salvouAgora.value=true;
    for(const posicao of removidas.value){try{await excluirFotoVeiculo(salvo.id,posicao);}catch(e){falhas.push(`Remover ${posicao}: ${falhaCadastro(e)}`);}}
    for(const [posicao,arquivo] of Object.entries(arquivos.value)){try{await enviarFotoVeiculo(salvo.id,posicao,arquivo);}catch(e){falhas.push(`Foto ${posicao}: ${falhaCadastro(e)}`);}}
    if(falhas.length){erro.value=`Veículo salvo (#${salvo.id}), porém algumas fotos falharam: ${falhas.join(' · ')}`;
      if(!id.value)await router.replace({name:'veiculo-editar',params:{id:salvo.id},query:queryVoltar(route.query.voltar)});else await carregar();return;}
    if(continuar&&!id.value){msgPendente='Veículo salvo. Agora você pode adicionar documentos e valoração.';await router.replace({name:'veiculo-editar',params:{id:salvo.id},query:queryVoltar(route.query.voltar)});return;}
    if(continuar){msgPendente='Veículo salvo.';await carregar();return;}
    {const origem=destinoVoltar(route.query,'');const proprioDetalhe=origem&&origem.startsWith(`/painel/cadastros/veiculos/${salvo.id}`);
      const alvo=proprioDetalhe?origem:{name:'veiculo-detalhe',params:{id:salvo.id},query:origem?{voltar:origem}:{}};
      if(id.value)router.push(alvo);else router.replace(alvo);}
  }catch(e){erro.value=falhaCadastro(e);}finally{salvando.value=false;}
}
async function vincular(){if(!id.value||!externoId.value.trim())return;erro.value='';vinculando.value=true;
  try{await criarVinculoEsl('veiculo',id.value,externoId.value.trim(),'parcial');vinculos.value=await listarVinculosEsl('veiculo',id.value);externoId.value='';sucesso.value='ID do ESL vinculado. Dados locais preservados.';}
  catch(e){erro.value=falhaCadastro(e);}finally{vinculando.value=false;}}
async function desvincular(){if(!vinculoAtual.value||!confirm('Desvincular do ESL? A ficha e as fotos serão preservadas.'))return;
  try{await excluirVinculoEsl(vinculoAtual.value.id);vinculos.value=await listarVinculosEsl('veiculo',id.value);sucesso.value='Vínculo removido.';}catch(e){erro.value=falhaCadastro(e);}}
</script>

<template>
<section class="vf" aria-label="Ficha cadastral de veículo">
  <header class="vf__topo"><div>
    <button class="vf__voltar" type="button" @click="voltar"><ArrowLeft :size="17"/> Voltar para Veículos</button>
    <div class="vf__etiqueta"><Truck :size="15"/> VEÍCULOS <span>·</span> FICHA CADASTRAL</div><h1>{{ edicao?'Editar veículo':'Novo veículo' }}</h1></div>
    <div class="vf__acoes"><button type="button" class="vf__botao" @click="voltar">Cancelar</button><button type="button" class="vf__botao" :disabled="salvando||carregando" @click="salvar(true)">Salvar e continuar</button><button type="button" class="vf__botao vf__botao--vermelho" :disabled="salvando||carregando" @click="salvar(false)"><Check :size="17"/> {{ salvando?'Salvando…':'Salvar cadastro' }}</button></div>
  </header>
  <p v-if="prefillFipe&&!edicao" class="vf__alerta" role="status">Dados pré-preenchidos da Consulta FIPE: são uma proposta, não um vínculo confirmado. Informe a placa e confira antes de salvar.</p>
  <p v-if="erro" class="vf__alerta vf__alerta--erro" role="alert"><CircleAlert :size="17"/> {{ erro }}</p>
  <p v-if="sucesso" class="vf__alerta" role="status"><Check :size="17"/> {{ sucesso }}</p>
  <p v-if="carregando" class="vf__alerta" role="status">Carregando ficha…</p>
  <p v-if="alterado" class="vf__alerta vf__alerta--aviso" role="status">Há alterações não salvas.</p>
  <p class="vf__nota">Obrigatório para salvar: placa válida e categoria. O restante pode ficar pendente.</p>

  <section id="sec-basicos" class="vf__painel" aria-labelledby="t-basicos"><header class="vf__secao"><div class="vf__icone"><Truck :size="20"/></div><div><h2 id="t-basicos">1. Dados básicos</h2><small>Placa, número de frota, marca, modelo e descrição</small></div></header>
    <div class="vf__conteudo">
      <div class="vf__grid vf__grid--3">
        <label>Placa *<input v-model.trim="form.placa" placeholder="ABC1D23" maxlength="10" style="text-transform:uppercase" :aria-invalid="placaTocada&&!vPlaca.ok" aria-describedby="msg-placa" @blur="placaTocada=true"/><small id="msg-placa" :class="vPlaca.ok?'vf__ok':'vf__aviso'">{{ vPlaca.ok?('Placa '+(vPlaca.formato==='mercosul'?'Mercosul':'formato antigo')+' válida'):(placaTocada||form.placa?vPlaca.mensagem:'') }}</small></label>
        <label>Número de frota<input v-model="form.numero_frota" placeholder="Identificação interna"/></label>
        <label class="vf__ativo"><input v-model="form.is_active" type="checkbox"/> Cadastro ativo</label>
        <label class="vf__duplo">Descrição<input v-model="form.descricao" placeholder="Ex.: Cavalo mecânico, 6x2" maxlength="255"/></label>
      </div>
    <div class="vf__conteudo">
    <div class="vf__catalogo-atalhos">
      <span>Não encontrou? Cadastre no catálogo:</span>
      <a href="#" @click.prevent="irCatalogo('marcas')"><Plus :size="14"/> Nova marca</a>
      <a href="#" @click.prevent="irCatalogo('modelos')"><Plus :size="14"/> Novo modelo</a>
      <button type="button" class="vf__atualizar-catalogo" :disabled="atualizandoCatalogo||buscandoMarcas||buscandoModelos" @click="atualizarCatalogo"><RefreshCw :size="14"/> {{ atualizandoCatalogo?'Atualizando…':'Atualizar listas' }}</button>
    </div>
    <div class="vf__grid vf__grid--3">
      <label>Marca *<input v-model="marcaBusca" type="search" placeholder="Pesquisar marca"/><select v-model="form.marca_id" :disabled="buscandoMarcas" @change="modeloBusca='';carregarModelos(true)"><option :value="null">{{ buscandoMarcas?'Carregando…':'Selecione uma marca cadastrada' }}</option><option v-for="m in marcasFiltradas" :key="m.id" :value="m.id">{{ m.nome }}</option></select></label>
      <label>Modelo *<input v-model="modeloBusca" type="search" placeholder="Pesquisar modelo" :disabled="!form.marca_id"/><select v-model="form.modelo_id" :disabled="!form.marca_id||buscandoModelos" @change="escolherModelo"><option :value="null">{{ buscandoModelos?'Carregando…':'Selecione um modelo cadastrado' }}</option><option v-for="m in modelosFiltrados" :key="m.id" :value="m.id">{{ m.nome }}</option></select></label>
      <div class="vf__campo-ano">
        <div class="vf__campo-ano-topo">
          <span>Ano do modelo <small v-if="form.modelo_id">{{ modeloTemFipe ? '· FIPE' : '· cadastro local' }}</small></span>
          <button v-if="form.modelo_id" class="vf__ano-adicionar" type="button" @click="alternarNovoAno">
            <X v-if="modoAnoNovo" :size="13"/><Plus v-else :size="13"/>
            {{ modoAnoNovo ? 'Cancelar' : 'Novo ano' }}
          </button>
        </div>
        <div v-if="modoAnoNovo && form.modelo_id" class="vf__ano-linha">
          <input v-model="anoDigitado" aria-label="Informar novo ano do modelo" inputmode="numeric" type="number" min="1950" max="2100" placeholder="Ex.: 1999" @keyup.enter.prevent="aplicarAnoNovo"/>
          <button type="button" class="vf__botao vf__botao--mini" @click="aplicarAnoNovo">Aplicar</button>
        </div>
        <select v-else-if="form.modelo_id" v-model="anoEscolha" :disabled="carregandoAnos || !anosVisiveis.length" @change="escolherAnoFipe">
          <option value="">{{ carregandoAnos ? 'Consultando anos disponíveis…' : anosVisiveis.length ? 'Selecione o ano / combustível' : 'Clique em + Novo ano' }}</option>
          <option v-for="ano in anosVisiveis" :key="ano.valor" :value="ano.valor">{{ ano.nome }}</option>
        </select>
        <input v-else v-model="form.ano_modelo" aria-label="Ano do modelo sem FIPE" type="number" min="1950" max="2100" placeholder="Ex.: 2026" @input="alterarAnoManualSemCatalogo"/>
        <small v-if="anoAviso" class="vf__ano-aviso" role="status">{{ anoAviso }}</small>
        <small v-else-if="form.modelo_id && !modoAnoNovo" class="vf__ano-ajuda">Anos FIPE indicam combustível; anos locais sem FIPE não exibem cotação.</small>
      </div>
    </div>
    <div class="vf__catalogo-fotos" v-if="marcaSelecionada">
      <div class="vf__referencia vf__referencia--marca">
        <a v-if="marcaSelecionada.foto_url && marcaSelecionada.foto_pagina && !logoFalha" class="vf__logo-link" :href="marcaSelecionada.foto_pagina" target="_blank" rel="noopener noreferrer" title="Clique para ver a origem da logo" :aria-label="`Ver origem da logo da ${marcaSelecionada.nome}`">
          <img :src="marcaSelecionada.foto_url" :alt="`Logo da marca ${marcaSelecionada.nome}`" @error="logoFalha=true"/>
        </a>
        <img v-else-if="marcaSelecionada.foto_url && !logoFalha" :src="marcaSelecionada.foto_url" :alt="`Logo da marca ${marcaSelecionada.nome}`" @error="logoFalha=true"/>
        <span v-else class="vf__logo-letras" title="Logo do fabricante ainda não encontrada">{{ (marcaSelecionada.nome || "?").slice(0,2).toUpperCase() }}</span>
        <div><b>{{ marcaSelecionada.nome }}</b><small>{{ marcaSelecionada.foto_url && !logoFalha ? 'Fabricante' : 'Logo indisponível' }}</small></div>
      </div>
      <div v-if="form.vinculo==='proprio'" class="vf__cotacao" aria-live="polite">
        <div class="vf__cotacao-icone"><span>R$</span></div>
        <div class="vf__cotacao-info">
          <small>Valor de referência FIPE</small>
          <strong v-if="cotacaoFipe">{{ cotacaoFipe.valor }}</strong>
          <strong v-else-if="carregandoCotacao">Consultando FIPE…</strong>
          <strong v-else>—</strong>
          <small v-if="cotacaoFipe">{{ cotacaoFipe.mes_referencia }} <template v-if="cotacaoFipe.codigo_fipe">· cód. {{ cotacaoFipe.codigo_fipe }}</template></small>
          <small v-else-if="semFipePorAnoManual">Ano cadastrado sem versão FIPE · valor indisponível</small>
          <small v-else-if="cotacaoErro" class="vf__cotacao-erro">{{ cotacaoErro }}</small>
          <small v-else>Selecione modelo e ano/combustível FIPE</small>
        </div>
        <button v-if="cotacaoErro && form.fipe_ano_codigo" class="vf__botao vf__botao--mini" type="button" @click="consultarCotacaoFipe">Tentar novamente</button>
      </div>
    </div>
    <p v-if="catalogoErro" class="vf__nota vf__nota--erro">{{ catalogoErro }}</p></div>
      <label class="vf__campo-obs">Observações<textarea v-model="form.observacoes" rows="2" placeholder="Observações da frota…"></textarea></label>
    </div>
  </section>

  <section class="vf__painel" aria-labelledby="t-classe"><header class="vf__secao"><div class="vf__icone vf__icone--azul"><Wrench :size="20"/></div><div><h2 id="t-classe">2. Classificação operacional</h2><small>Tipo, classificação, categoria e capacidade</small></div></header>
    <div class="vf__conteudo">
      <div class="vf__escolhas" role="group" aria-label="Categoria do veículo"><button v-for="c in categorias" :key="c[0]" type="button" class="vf__escolha" :class="{'vf__escolha--ativa':form.categoria===c[0]}" :aria-pressed="form.categoria===c[0]" @click="form.categoria=c[0]"><span class="vf__escolha-titulo"><strong>{{ c[1] }}</strong><small>{{ c[0]==='reboque'?'Eixos e tipo de carroceria; sem combustível/FIPE':'Combustível, motorista de referência e FIPE' }}</small></span><span class="vf__radio" aria-hidden="true"></span></button></div>
      <div class="vf__grid vf__grid--3">
        <label>Tipo<select v-model="tipoFrota" @change="escolherTipoFrota"><option value="">Selecione</option><option v-for="t in TIPOS_FROTA" :key="t" :value="t">{{ t }}</option></select></label>
        <label>Classificação<select v-model="form.tipo_operacional" :disabled="!tipoFrota&&!form.tipo_operacional"><option value="">{{ tipoFrota?'Selecione':'Escolha o tipo primeiro' }}</option><option v-for="c in opcoesClassificacao" :key="c" :value="c">{{ c }}</option></select></label>
        <label>Macro categoria (FIPE)<select v-model="form.macro_categoria" @change="escolherMacro"><option value="">Selecione</option><option v-for="m in macros" :key="m[0]" :value="m[0]">{{ m[1] }}</option></select></label>
        <label>Referência de CNH (informativa)<select v-model="form.categoria_cnh_referencia"><option value="">Não informada</option><option v-for="c in ['A','B','C','D','E']" :key="c">{{ c }}</option></select></label>
        <label>Capacidade (kg)<input v-model="form.capacidade_kg" type="number" min="0" step="0.01" placeholder="Ex.: 3500"/></label>
      </div>
      <p class="vf__nota">A referência de CNH não é determinada automaticamente: a habilitação depende das características legais do veículo e da composição.</p>
    </div>
  </section>

  <section class="vf__painel" aria-labelledby="t-prop"><header class="vf__secao"><div class="vf__icone vf__icone--azul"><ShieldCheck :size="20"/></div><div><h2 id="t-prop">3. Propriedade e vínculo</h2><small>Próprio ou Terceiro / Agregado e responsável</small></div></header>
    <div class="vf__conteudo">
      <div class="vf__escolhas vf__escolhas--2" role="group" aria-label="Vínculo do veículo">
        <button type="button" class="vf__escolha" :class="{'vf__escolha--ativa':form.vinculo==='proprio'}" :aria-pressed="form.vinculo==='proprio'" @click="escolherPropriedade('proprio')">
          <span class="vf__escolha-marca"><img v-if="logoTransmassa&&!falhaLogoTransmassa" :src="logoTransmassa" alt="Logo Transmassa" @error="falhaLogoTransmassa=true"/><span v-else class="vf__marca-transmassa">TRANSMASSA</span></span>
          <span class="vf__escolha-titulo"><strong>Próprio</strong><small>Transmassa · patrimônio</small></span><span class="vf__radio" aria-hidden="true"></span></button>
        <button type="button" class="vf__escolha" :class="{'vf__escolha--ativa':form.vinculo==='terceiro'}" :aria-pressed="form.vinculo==='terceiro'" @click="escolherPropriedade('terceiro')">
          <span class="vf__escolha-marca"><Building2 :size="24"/></span><span class="vf__escolha-titulo"><strong>Terceiro / Agregado</strong><small>Transportadora cadastrada · sem patrimônio</small></span><span class="vf__radio" aria-hidden="true"></span></button>
      </div>
      <template v-if="ehTerceirizado">
        <div class="vf__grid vf__grid--2 vf__propriedade-detalhes">
          <label>Terceiro de Transporte
            <select v-model="form.prestador_servico_id" :disabled="buscandoPrestadores"><option :value="null">{{ buscandoPrestadores?'Carregando…':'Selecione o terceiro cadastrado' }}</option><option v-for="p in prestadoresTransporte" :key="p.id" :value="p.id">{{ p.nome }}{{ p.is_active===false?' (inativo)':'' }}</option></select>
          </label>
          <div v-if="prestadorSelecionado" class="vf__prestador-logo"><img v-if="prestadorSelecionado.logo_url&&!falhaLogoPrestador" :src="prestadorSelecionado.logo_url" :alt="`Logo ${prestadorSelecionado.nome}`" @error="falhaLogoPrestador=true"/><Building2 v-else :size="27"/><strong>{{ prestadorSelecionado.nome }}</strong></div>
        </div>
        <div class="vf__catalogo-atalhos"><span>Não encontrou o terceiro?</span><a :href="telaTerceiros" target="_blank" rel="noopener noreferrer"><Plus :size="14"/> Cadastrar terceiro <span aria-hidden="true">↗</span></a><button type="button" class="vf__atualizar-catalogo" :disabled="buscandoPrestadores" @click="carregarPrestadores"><RefreshCw :size="14"/> Atualizar lista</button></div>
        <p v-if="prestadorPendente" class="vf__pendencia" role="status">Pendente: terceiro de transporte não vinculado. O cadastro pode ser salvo assim.</p>
        <div class="vf__grid vf__grid--2">
          <label>Informado no ESL: proprietário<input :value="form.proprietario_esl_nome||'—'" readonly/></label>
          <label>Informado no ESL: agregado (somente leitura)<input :value="form.agregado_esl_nome||'—'" readonly/></label>
        </div>
      </template>
      <p v-else-if="!form.vinculo" class="vf__nota">Selecione o vínculo. Sem vínculo o veículo fica com pendência.</p>
      <div v-if="campos.motorista" class="vf__motorista-referencia">
        <label class="vf__motorista-select">Motorista de referência <span class="vf__opcional">(opcional)</span>
          <select v-model="form.motorista_referencia_pessoa_id" :disabled="buscandoMotoristas" @change="carregarContatoMotorista"><option :value="null">Sem motorista de referência</option><option v-for="p in motoristas" :key="p.id" :value="p.id">{{ p.nome }}{{ p.documento ? ' · '+p.documento : '' }}</option></select></label>
        <div class="vf__busca-motorista"><input v-model="buscaMotorista" aria-label="Buscar motorista" placeholder="Buscar motorista pelo nome ou CPF" @keyup.enter.prevent="carregarMotoristas(buscaMotorista)"/><button class="vf__botao" type="button" :disabled="buscandoMotoristas" @click="carregarMotoristas(buscaMotorista)"><Search :size="16"/> Buscar</button></div>
        <small v-if="nomeMotorista" class="vf__motorista-info"><UserRound :size="14"/> {{ nomeMotorista }} <a v-if="contatoMotorista" :href="`tel:${contatoMotorista.replace(/[^+0-9]/g,'')}`">Ligar: {{ contatoMotorista }}</a></small>
      </div>
    </div>
  </section>

  <div class="vf__avancado-titulo"><div><h2>4. Dados avançados</h2><p>Documentação, dados técnicos, avaliação, fotos e origem.</p></div></div>
  <div class="vf__acordioes">
    <section class="vf__painel">
      <button type="button" class="vf__accordion-btn" id="b-doc" :aria-expanded="abertos.includes('doc')" aria-controls="p-doc" @click="expandir('doc')"><span class="vf__icone"><FileText :size="20"/></span><span class="vf__accordion-texto"><strong>Documentação e regularidade</strong><small>Autorização GR e documentos do veículo</small></span><span class="vf__mini-status">{{ ROTULO_SITUACAO[situacaoGr] }}</span><ChevronDown :size="18" :class="{'vf__girado':abertos.includes('doc')}"/></button>
      <div v-if="abertos.includes('doc')" id="p-doc" class="vf__accordion-conteudo" role="region" aria-labelledby="b-doc">
        <div class="vf__grid vf__grid--3"><label>Nº autorização GR<input v-model="form.numero_autorizacao_gr"/></label><label>Validade GR<input v-model="form.validade_gr" type="date"/></label></div>
        <p v-if="!form.validade_gr" class="vf__nota">Sem dados de validade da GR.</p>
        <VeiculoDocumentos :veiculo-id="id"/>
      </div>
    </section>
    <section class="vf__painel">
      <button type="button" class="vf__accordion-btn" id="b-tec" :aria-expanded="abertos.includes('tec')" aria-controls="p-tec" @click="expandir('tec')"><span class="vf__icone vf__icone--azul"><Wrench :size="20"/></span><span class="vf__accordion-texto"><strong>Dados técnicos</strong><small>Anos, combustível, cor, RENAVAM, chassi, pesos e capacidades</small></span><ChevronDown :size="18" :class="{'vf__girado':abertos.includes('tec')}"/></button>
      <div v-if="abertos.includes('tec')" id="p-tec" class="vf__accordion-conteudo" role="region" aria-labelledby="b-tec">
        <div class="vf__grid vf__grid--3">
          <label>Ano de fabricação<input v-model="form.ano_fabricacao" type="number" min="1950" max="2100" placeholder="Ex.: 2022"/><small v-if="vAnos.avisos.fabricacao" class="vf__aviso">{{ vAnos.avisos.fabricacao }}</small></label>
          <label>Ano do modelo<input :value="form.ano_modelo||'—'" readonly aria-describedby="msg-ano"/><small id="msg-ano" class="vf__nota">Definido em Dados básicos.</small><small v-if="vAnos.avisos.modelo" class="vf__aviso">{{ vAnos.avisos.modelo }}</small></label>
          <label v-if="campos.combustivel">Combustível<input v-model="form.combustivel" placeholder="Ex.: Diesel S10, Flex"/></label>
          <label>Cor<input v-model="form.cor" placeholder="Ex.: Branca"/></label>
          <label v-if="campos.carroceria">Tipo de carroceria<input v-model="form.tipo_carroceria" placeholder="Ex.: Baú, sider, frigorífico"/></label>
          <label v-if="campos.eixos">Eixos<input v-model="form.eixos" type="number" min="1" max="9"/><small v-if="!vEixos.ok" class="vf__aviso">{{ vEixos.mensagem }}</small></label>
          <label>RENAVAM<input v-model="form.renavam" inputmode="numeric" placeholder="11 dígitos" maxlength="40"/><small v-if="vRenavam.mensagem" class="vf__aviso">{{ vRenavam.mensagem }} (não bloqueia o salvamento)</small></label>
          <label>Chassi<input v-model.trim="form.chassi" placeholder="17 caracteres, sem I, O, Q" maxlength="30" style="text-transform:uppercase"/><small v-if="vChassi.mensagem" class="vf__aviso">{{ vChassi.mensagem }} (não bloqueia o salvamento)</small></label>
          <label>Cidade de licenciamento<input v-model="form.cidade_licenciamento" placeholder="Cidade / UF"/></label>
          <label>PBT (kg)<input v-model="form.pbt_kg" type="number" step="0.01" min="0"/></label>
          <label>Tara (kg)<input v-model="form.tara_kg" type="number" step="0.01" min="0"/></label>
          <label>Capacidade (m³)<input v-model="form.capacidade_m3" type="number" step="0.01" min="0"/></label>
          <label>Capacidade de lotação<input v-model="form.capacidade_lotacao" type="number" step="0.01" min="0"/></label>
        </div>
      </div>
    </section>
    <section class="vf__painel">
      <button type="button" class="vf__accordion-btn" id="b-aval" :aria-expanded="abertos.includes('aval')" aria-controls="p-aval" @click="expandir('aval')"><span class="vf__icone"><Wallet :size="20"/></span><span class="vf__accordion-texto"><strong>Avaliação patrimonial</strong><small>Compra, FIPE atual e depreciação (apenas frota própria)</small></span><ChevronDown :size="18" :class="{'vf__girado':abertos.includes('aval')}"/></button>
      <div v-if="abertos.includes('aval')" id="p-aval" class="vf__accordion-conteudo" role="region" aria-labelledby="b-aval">
        <p v-if="ehTerceirizado" class="vf__nota">Avaliação patrimonial não se aplica a veículos terceiros / agregados.</p>
        <p v-else-if="form.vinculo!=='proprio'" class="vf__nota">Selecione o vínculo Próprio em Propriedade para informar a avaliação patrimonial.</p>
        <template v-else>
          <div class="vf__grid vf__grid--3">
            <label>Data de compra<input v-model="form.data_compra" type="date"/></label>
            <label>Valor de compra (R$)<input v-model="form.valor_compra" type="number" step="0.01" min="0"/><small v-if="form.valor_compra!==''&&form.valor_compra!=null&&!compraConhecida" class="vf__aviso">Valor 0 ou inválido é tratado como desconhecido.</small></label>
            <label>Taxa de depreciação anual (%)<input v-model="form.taxa_depreciacao_anual" type="number" step="0.1" min="0" max="100"/></label>
            <label>Data de venda<input v-model="form.data_venda" type="date"/></label>
            <label>Valor de venda (R$)<input v-model="form.valor_venda" type="number" step="0.01" min="0"/></label>
          </div>
          <dl class="vf__metricas" aria-label="Métricas calculadas">
            <div><dt>Valor de compra</dt><dd>{{ compraConhecida?reais(String(form.valor_compra).replace(',','.')):'Não informado' }}</dd></div>
            <div><dt>FIPE atual</dt><dd>{{ fipeAtual?reais(fipeAtual.valor):'Sem dados' }}<small v-if="fipeAtual?.mes_referencia">Ref. {{ fipeAtual.mes_referencia }}</small></dd></div>
            <div><dt>Depreciação de mercado (compra − FIPE)</dt><dd>{{ depreciacaoMercado===null?'Indisponível':reais(depreciacaoMercado) }}</dd></div>
            <div><dt>Valor contábil linear (gerencial)</dt><dd>{{ depreciacao.estado==='calculado'?reais(depreciacao.valor_contabil):'Pendente' }}<small v-if="depreciacao.estado!=='calculado'">{{ depreciacao.motivo }}</small><small v-else>Não é laudo nem depreciação fiscal.</small></dd></div>
          </dl>
          <VeiculoValoracao :veiculo-id="id" :veiculo="form" @frota="frotaLinha=$event"/>
        </template>
      </div>
    </section>
    <section class="vf__painel">
      <button type="button" class="vf__accordion-btn" id="b-fotos" :aria-expanded="abertos.includes('fotos')" aria-controls="p-fotos" @click="expandir('fotos')"><span class="vf__icone vf__icone--azul"><Camera :size="20"/></span><span class="vf__accordion-texto"><strong>Fotos e anexos</strong><small>Até quatro imagens, JPG/PNG/WEBP, 5 MB cada</small></span><span class="vf__mini-status">{{ pendentesFoto.length?pendentesFoto.length+' pendente(s)':'Completo' }}</span><ChevronDown :size="18" :class="{'vf__girado':abertos.includes('fotos')}"/></button>
      <div v-if="abertos.includes('fotos')" id="p-fotos" class="vf__accordion-conteudo" role="region" aria-labelledby="b-fotos">
        <div class="vf__fotos"><div v-for="[posicao,nome] in fotosCampos" :key="posicao" class="vf__foto">
          <div class="vf__foto-preview"><img v-if="previews[posicao]||fotos[posicao]" :src="previews[posicao]||fotos[posicao]" :alt="nome"/><Camera v-else :size="32"/></div>
          <strong>{{ nome }}</strong><div class="vf__foto-acoes"><label class="vf__botao vf__botao--mini"><UploadCloud :size="15"/> {{ previews[posicao]||fotos[posicao]?'Trocar':'Adicionar' }}<input hidden type="file" accept="image/jpeg,image/png,image/webp" @change="carregarArquivo(posicao,$event)"/></label>
          <button v-if="previews[posicao]||fotos[posicao]" type="button" class="vf__botao vf__botao--mini" @click="removerFoto(posicao)"><ImageOff :size="15"/> Remover</button></div></div></div>
        <p class="vf__nota">As fotos são opcionais e enviadas ao armazenamento após salvar o cadastro.</p>
      </div>
    </section>
    <section v-if="edicao" class="vf__painel">
      <button type="button" class="vf__accordion-btn" id="b-orig" :aria-expanded="abertos.includes('orig')" aria-controls="p-orig" @click="expandir('orig')"><span class="vf__icone"><History :size="20"/></span><span class="vf__accordion-texto"><strong>Origem e histórico</strong><small>Somente leitura: origem do cadastro e valores originais do ESL</small></span><span class="vf__mini-status">{{ form.origem==='esl'?'ESL':'Manual' }}</span><ChevronDown :size="18" :class="{'vf__girado':abertos.includes('orig')}"/></button>
      <div v-if="abertos.includes('orig')" id="p-orig" class="vf__accordion-conteudo" role="region" aria-labelledby="b-orig">
        <dl class="vf__metricas">
          <div><dt>Origem</dt><dd>{{ form.origem==='esl'?'Importado do ESL':form.origem==='manual'?'Cadastro manual':'Não informada' }}</dd></div>
          <div><dt>Importado em</dt><dd>{{ fmtData(form.esl_importado_em) }}</dd></div>
          <div><dt>Marca original (ESL)</dt><dd>{{ form.esl_marca_original||'—' }}</dd></div>
          <div><dt>Modelo original (ESL)</dt><dd>{{ form.esl_modelo_original||'—' }}</dd></div>
          <div><dt>Tipo (ESL)</dt><dd>{{ form.tipo_veiculo_esl||'—' }}</dd></div>
          <div><dt>Situação no ESL</dt><dd>{{ form.situacao_esl||'—' }}</dd></div>
          <div><dt>Motorista padrão (ESL)</dt><dd>{{ form.motorista_esl_nome||'—' }}</dd></div>
          <div><dt>Tipo de proprietário (ESL)</dt><dd>{{ form.tipo_proprietario_esl||'—' }}</dd></div>
          <div><dt>Tabela de agregado</dt><dd>{{ form.tabela_agregado||'—' }}</dd></div>
          <div><dt>Lote de fechamento CIOT</dt><dd>{{ form.lote_fechamento_ciot||'—' }}</dd></div>
        </dl>
        <p v-if="vinculoAtual">Vinculado ao registro ESL <b>#{{ vinculoAtual.externo_id }}</b>. <button class="vf__botao" type="button" @click="desvincular"><Trash2 :size="15"/> Desvincular</button></p>
        <div v-else class="vf__busca"><input v-model="externoId" aria-label="ID deste veículo no ESL" placeholder="ID deste veículo no ESL"/><button type="button" class="vf__botao" :disabled="!externoId.trim()||vinculando" @click="vincular"><Link2 :size="16"/> Vincular ESL</button></div>
        <button class="vf__botao" type="button" @click="router.push({name:'veiculo-importar-esl',query:queryVoltar(route.fullPath)})"><CloudDownload :size="17"/> Importar veículos do ESL</button>
      </div>
    </section>
  </div>
  <footer class="vf__rodape"><div><strong>{{ edicao?'Veículo existente':'Novo cadastro RotaMaxi' }}</strong><small>Dados locais preservados independentemente do ESL.</small></div><button type="button" class="vf__botao vf__botao--vermelho" :disabled="salvando||carregando" @click="salvar(false)"><Check :size="17"/> {{ salvando?'Salvando…':'Salvar cadastro' }}</button></footer>
</section>
</template>

<style scoped src="@/styles/pages/registrations/vehicles/vehicle_form_page.css"></style>
