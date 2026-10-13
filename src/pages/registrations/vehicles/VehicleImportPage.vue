<script setup>
import { computed, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { ArrowLeft, Check, CircleAlert, FileSpreadsheet, UploadCloud, Search, RefreshCw } from 'lucide-vue-next';
import { importarVeiculosEsl, listarCadastro, falhaCadastro } from '@/services/api/registrations.api.js';
import { listFipeBrands, listFipeModels, resolveFipeYears } from '@/services/api/fipe.api.js';
import { lerExportacaoEsl, descricaoAcao, resultadoImportacao } from '@/domain/vehicles/esl/vehicle-csv.js';
import { simularEslTolerante } from '@/domain/vehicles/esl/tolerant-simulation.js';
import { recomendarModelosEsl, atualizarPreviaEsl } from '@/domain/vehicles/esl/smart-models.js';
import { placasPendentesParaIgnorar, adicionarPlacasIgnoradas, desfazerIgnoradasEmLote } from '@/domain/vehicles/esl/ignore-pending.js';
import { placasDuplicadasNoArquivo, mensagemDuplicadas, destinoVoltar } from '@/domain/vehicles/fleet-model.js';
import { somarContagens, contarLinhas, rotuloClassePrestador, rotuloAcaoPrestador, gerarCsvRelatorio } from '@/domain/vehicles/esl/import-summary.js';
import EslRevisaoModal from '@/components/registrations/vehicles/esl/EslReviewModal.vue';
import { montarFila, precisaRevisao, proximoIndice } from '@/domain/vehicles/esl/review-queue.js';
import { anoValido, anoDaVersao, identificarMarca, sugerirModelos, sugerirFabricacao, tiposFipeDisponiveis, versoesValidadas } from '@/domain/vehicles/esl/year-suggestions.js';
const router=useRouter();const route=useRoute();
const arquivo=ref(''),linhas=ref([]),preview=ref([]),erro=ref(''),aviso=ref('');
const lendo=ref(false),simulando=ref(false),executando=ref(false),validandoAnos=ref(false),progresso=ref('');
const modo=ref('importar'),completarExistentes=ref(false),exigirFipe=ref(false),somentePendentes=ref(false);
const cadastrarPrestadoresNovos=ref(false),somentePrestador=ref(false),lotesContagem=ref([]),previaEditada=ref(false),resultado=ref(null);
const marcas=ref([]),modelosPorMarca=ref({}),versoesPorModelo=ref({}),prestadores=ref([]);
const pagina=ref(1),porPagina=25;
const ignoradas=ref([]),ignoradasPorLote=ref([]),edicaoAno=ref(null),origensAnos=ref({});
const selecoesModelo=ref({}),mostrarTodosModelos=ref({});
const revalidando=ref(0),configuracaoDesatualizada=ref(false);
const versaoLinha=new Map(),cacheRanking=new Map();
function revelarModelos(r){mostrarTodosModelos.value={...mostrarTodosModelos.value,[r.linha]:true};}
function opcoesModeloLinha(r){
 const linha=itemLinha(r);const marca=Number(linha.marca_id||r.marca_id);
 const listagem=modelosPorMarca.value[marca]||[];
 const lista=listagem.length?listagem:(r.sugestoes||[]);
 const chaveRanking=`${marca}|${linha.modelo_nome||''}`;
 const cache=cacheRanking.get(chaveRanking);
 if(cache?.lista===lista)return cache.resultado;
 const resultado=recomendarModelosEsl(linha.modelo_nome,lista);
 cacheRanking.set(chaveRanking,{lista,resultado});
 return resultado;
}
async function prepararSugestoesLinha(r){
 const marca=Number(itemLinha(r).marca_id||r.marca_id);
 if(!marca)return;
 await listarModelosDaMarca(marca);
 const sugestao=opcoesModeloLinha(r).preSelecionado;
 if(sugestao && !itemLinha(r).modelo_id && !selecoesModelo.value[r.linha]){
  selecoesModelo.value={...selecoesModelo.value,[r.linha]:String(sugestao.id)};
 }
}
/** Ressimula somente as placas afetadas, mantendo as 687 linhas abertas.
 * Respostas antigas são descartadas se o usuário alterar a escolha novamente. */
async function revalidarLinhas(indices){
 const numeros=[...new Set(indices.map(Number))].filter(n=>n>0&&n<=linhas.value.length);
 if(!numeros.length)return;
 const tokens=new Map(numeros.map(n=>{const t=(versaoLinha.get(n)||0)+1;versaoLinha.set(n,t);return[n,t];}));
 revalidando.value++;previaEditada.value=true;
 try{
  const itens=numeros.map(n=>linhas.value[n-1]);
  const respostas=await simularEslTolerante(itens,
   bloco=>importarVeiculosEsl(bloco,{simular:true,modo:modo.value,completarExistentes:completarExistentes.value,cadastrarPrestadoresNovos:cadastrarPrestadoresNovos.value}),
   {tamanhoLote:100});
  const atuais=respostas.filter(x=>versaoLinha.get(numeros[x.linha-1])===tokens.get(numeros[x.linha-1]))
    .map(x=>({...x,linha:numeros[x.linha-1]}));
  preview.value=atualizarPreviaEsl(preview.value,atuais);
  if(atuais.length)aviso.value=`${atuais.length} placa(s) conferida(s). A revisão continua aberta.`;
 }catch(e){
  const texto=falhaCadastro(e);
  const falhas=numeros.filter(n=>versaoLinha.get(n)===tokens.get(n)).map(n=>({
   linha:n,acao:'revisar',motivo:`Não foi possível conferir esta placa: ${texto}. Tente novamente antes de importar.`
  }));
  preview.value=atualizarPreviaEsl(preview.value,falhas);
  erro.value=`A revisão permaneceu aberta, mas houve uma falha ao conferir ${falhas.length} placa(s): ${texto}`;
 }finally{revalidando.value--;}
}

const ignorada = r => ignoradas.value.includes(String(r.placa));
function acaoVisivel(r){return ignorada(r)?'ignorada':r.acao;}
function alternarIgnorada(r){
 const placa=String(r.placa);previaEditada.value=true;
 ignoradas.value=ignorada(r)?ignoradas.value.filter(p=>p!==placa):[...ignoradas.value,placa];
 // Se a pessoa reativar uma placa ignorada em lote, não desfazer sua escolha posteriormente.
 if(!ignorada(r))ignoradasPorLote.value=ignoradasPorLote.value.filter(p=>p!==placa);
 if(edicaoAno.value?.linha===r.linha)edicaoAno.value=null;
 aviso.value=ignorada(r)?`Placa ${placa} ignorada: não será enviada na importação.`:`Placa ${placa} voltou para a revisão.`;
}
function anoComErro(r){
 const l=itemLinha(r);
 return r.acao==='invalida' && ((l.ano_modelo!=null&&!anoValido(l.ano_modelo))||(l.ano_fabricacao!=null&&!anoValido(l.ano_fabricacao)));
}
const modelosParaAno=computed(()=>modelosPorMarca.value[Number(edicaoAno.value?.marcaId)]||[]);
const demaisModelosAno=computed(()=>{
 const ids=new Set((edicaoAno.value?.modelosSugeridos||[]).map(m=>Number(m.id)));
 return modelosParaAno.value.filter(m=>!ids.has(Number(m.id)));
});
const totais=computed(()=>preview.value.reduce((o,r)=>(o[acaoVisivel(r)]=(o[acaoVisivel(r)]||0)+1,o),{}));
const pendentes=computed(()=>preview.value.filter(r=>!ignorada(r)&&['revisar','conflito','invalida','duplicada','sem_cadastro'].includes(r.acao)));
const placasPendentesIgnoraveis=computed(()=>placasPendentesParaIgnorar(preview.value,linhas.value,ignoradas.value,exigirFipe.value));
function ignorarTodasAsPendentes(){
 const placas=[...placasPendentesIgnoraveis.value];
 if(!placas.length||simulando.value||executando.value||validandoAnos.value||revalidando.value||configuracaoDesatualizada.value)return;
 if(!confirm(`Ignorar ${placas.length} placa(s) pendente(s) desta simulação? Elas não serão importadas. As placas já aptas continuam disponíveis para importar.`))return;
 previaEditada.value=true;ignoradas.value=adicionarPlacasIgnoradas(ignoradas.value,placas);
 ignoradasPorLote.value=placas;
 if(edicaoAno.value&&placas.includes(String(preview.value.find(r=>r.linha===edicaoAno.value.linha)?.placa)))edicaoAno.value=null;
 erro.value='';
 aviso.value=`${placas.length} pendência(s) ignorada(s). A simulação continua aberta; nenhuma placa foi importada. Você pode desfazer esta ação.`;
}
function desfazerIgnorarLote(){
 const placas=[...ignoradasPorLote.value];
 if(!placas.length||executando.value||simulando.value||revalidando.value||validandoAnos.value)return;
 previaEditada.value=true;ignoradas.value=desfazerIgnoradasEmLote(ignoradas.value,placas);
 ignoradasPorLote.value=[];
 erro.value='';
 aviso.value=`${placas.length} placa(s) voltaram para a revisão. Nenhum dado foi gravado.`;
}

const fipePendente=computed(()=>preview.value.filter(r=>!ignorada(r)&&r.acao==='criar'&&r.fipe_tipo&&r.ano_modelo&&!linhas.value[r.linha-1]?.fipe_ano_codigo));
const comRevisaoPrestador=r=>r.prestador_acao==='revisar'||r.prestador_classe==='possivel_duplicado';
const filtradosBase=computed(()=>somentePendentes.value?preview.value.filter(r=>ignorada(r)||['revisar','conflito','invalida','duplicada','sem_cadastro'].includes(r.acao)||Boolean(r.acao==='criar'&&r.fipe_tipo&&!linhas.value[r.linha-1]?.fipe_ano_codigo)):preview.value);
const filtrados=computed(()=>somentePrestador.value?filtradosBase.value.filter(comRevisaoPrestador):filtradosBase.value);
const contagensPreview=computed(()=>previaEditada.value||!lotesContagem.value.length?contarLinhas(preview.value.filter(r=>!ignorada(r))):somarContagens(lotesContagem.value));
const nomePrestador=id=>prestadores.value.find(p=>Number(p.id)===Number(id))?.nome||`#${id}`;
const paginaMax=computed(()=>Math.max(1,Math.ceil(filtrados.value.length/porPagina)));
const exibidos=computed(()=>filtrados.value.slice((pagina.value-1)*porPagina,pagina.value*porPagina));
watch([somentePendentes,somentePrestador],()=>{pagina.value=1;});
watch([modo,completarExistentes,cadastrarPrestadoresNovos],()=>{
 if(preview.value.length)configuracaoDesatualizada.value=true;
 // A prévia permanece visível, mas deve ser ressimulada antes da gravação.
});
watch(paginaMax,max=>{if(pagina.value>max)pagina.value=max;});
const chave=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
function itemLinha(r){return linhas.value[r.linha-1]||{};}
async function escolherArquivo(event){
 const file=event.target.files?.[0];if(!file)return;
 arquivo.value=file.name;resultado.value=null;lotesContagem.value=[];previaEditada.value=false;erro.value='';aviso.value='';preview.value=[];linhas.value=[];ignoradas.value=[];ignoradasPorLote.value=[];origensAnos.value={};edicaoAno.value=null;pagina.value=1;lendo.value=true;selecoesModelo.value={};mostrarTodosModelos.value={};versaoLinha.clear();cacheRanking.clear();configuracaoDesatualizada.value=false;
 try{
  const buffer=await file.arrayBuffer();let texto;
  try{texto=new TextDecoder('utf-8',{fatal:true}).decode(buffer);}catch{texto=new TextDecoder('windows-1252').decode(buffer);}
  linhas.value=lerExportacaoEsl(texto,{limite:2000});
  aviso.value=`${linhas.value.length} placas lidas de ${file.name}. Faça a simulação antes de confirmar.`;
 }catch(e){erro.value=e.message;}
 finally{lendo.value=false;}
}
async function carregarListas(){
 try{
  if(!marcas.value.length)marcas.value=await listFipeBrands();
  if(!prestadores.value.length){let pagina=1,resultado=[];
   while(pagina<=30){const r=await listarCadastro('prestadores-servico',{tipo_prestador:'transporte',ativo:1,por_pagina:100,page:pagina});resultado.push(...r.data);if(pagina>=Number(r.last_page||1))break;pagina++;}
   prestadores.value=resultado;
  }
 }catch(e){erro.value='Não foi possível carregar as listas: '+falhaCadastro(e);}
}
async function listarModelosDaMarca(id){
 if(!id||modelosPorMarca.value[id])return;
 try{const lista=await listFipeModels(Number(id));modelosPorMarca.value={...modelosPorMarca.value,[id]:lista};}
 catch(e){erro.value=falhaCadastro(e);}
}
async function simular(){
 if(!linhas.value.length)return;
 const dup=placasDuplicadasNoArquivo(linhas.value);
 if(dup.length){erro.value=mensagemDuplicadas(dup);return;}
 simulando.value=true;erro.value='';aviso.value='';pagina.value=1;resultado.value=null;
 const lotes=[];
 try{
  await carregarListas();
  // O ESL pode conter anos absurdos. Eles entram na prévia como pendências,
  // mas não são enviados à API. Outros erros 422 são isolados por placa.
  const resultados=await simularEslTolerante(linhas.value,
   bloco=>importarVeiculosEsl(bloco,{simular:true,modo:modo.value,completarExistentes:completarExistentes.value,cadastrarPrestadoresNovos:cadastrarPrestadoresNovos.value}),
   {tamanhoLote:100,aoLote:c=>{if(c)lotes.push(c);},progresso:(n,total)=>{progresso.value=`Simulando ${n} de ${total} registros enviados à API…`;}});
  preview.value=resultados;lotesContagem.value=lotes;previaEditada.value=false;
  configuracaoDesatualizada.value=false;
  const invalidos=resultados.filter(x=>x.acao==='invalida').length;
  const revisar=resultados.filter(x=>x.acao==='revisar').length;
  aviso.value=`Prévia de ${resultados.length} placas pronta: ${invalidos} inválida(s), ${revisar} modelo(s) para revisar. As demais continuam disponíveis para conferência.`;
 }catch(e){
  // O trabalho parcial nunca vira opção para gravar após erro de API/infra.
  erro.value=falhaCadastro(e);
  // Se já havia uma prévia, não apagá-la em caso de falha de rede.
  configuracaoDesatualizada.value=true;
 }finally{simulando.value=false;progresso.value='';}
}
/** Correção assistida de anos: só grava quando o usuário escolhe modelo/versão e confirma. */
async function abrirSugestaoAno(r){
 if(!anoComErro(r)||ignorada(r))return;
 erro.value='';
 if(edicaoAno.value?.linha===r.linha){edicaoAno.value=null;return;}
 const item=itemLinha(r);
 if(!origensAnos.value[r.placa])origensAnos.value={...origensAnos.value,[r.placa]:{fabricacao:item.ano_fabricacao??null,modelo:item.ano_modelo??null}};
 edicaoAno.value={linha:r.linha,marcaId:'',modeloId:'',modelosSugeridos:[],tipos:[],tipo:'',versoes:[],codigo:'',
   anoManual:'',fabricacao:'',carregando:true,erro:'',nota:'Buscando o fabricante no catálogo...'};
 await carregarListas();
 if(edicaoAno.value?.linha!==r.linha)return;
 const marca=identificarMarca(item.marca_nome,marcas.value);
 edicaoAno.value.carregando=false;
 if(!marca){edicaoAno.value.nota='Marca não localizada automaticamente. Escolha o fabricante cadastrado.';return;}
 edicaoAno.value.marcaId=String(marca.id);
 await prepararModelosParaAno(r);
}
async function prepararModelosParaAno(r){
 const ed=edicaoAno.value;if(!ed||ed.linha!==r.linha)return;
 ed.modeloId='';ed.modelosSugeridos=[];ed.versoes=[];ed.codigo='';ed.anoManual='';ed.fabricacao='';ed.tipos=[];ed.tipo='';ed.erro='';
 if(!ed.marcaId)return;
 ed.carregando=true;
 await listarModelosDaMarca(Number(ed.marcaId));
 if(edicaoAno.value!==ed)return;
 ed.carregando=false;
 const lista=modelosPorMarca.value[Number(ed.marcaId)]||[];
 ed.modelosSugeridos=sugerirModelos(itemLinha(r).modelo_nome,lista);
 const provavel=recomendarModelosEsl(itemLinha(r).modelo_nome,lista).preSelecionado;
 if(provavel){ed.modeloId=String(provavel.id);await prepararAnosParaModelo(r);}
 else ed.nota=lista.length?'Selecione qual modelo cadastrado corresponde ao nome do ESL.':'Essa marca não tem modelos cadastrados.';
}
async function prepararAnosParaModelo(r){
 const ed=edicaoAno.value;if(!ed||ed.linha!==r.linha)return;
 ed.versoes=[];ed.codigo='';ed.anoManual='';ed.fabricacao='';ed.tipos=[];ed.tipo='';ed.erro='';ed.nota='';
 const marca=marcas.value.find(m=>Number(m.id)===Number(ed.marcaId));
 const modelo=modelosParaAno.value.find(m=>Number(m.id)===Number(ed.modeloId));
 if(!marca||!modelo){ed.nota='Escolha a marca e o modelo.';return;}
 const item=itemLinha(r);
 ed.tipos=tiposFipeDisponiveis(marca,modelo,item.tipo_veiculo_esl||item.modelo_nome);
 ed.tipo=ed.tipos[0]||'';
 if(!ed.tipo){ed.nota='Modelo local sem código FIPE: informe o ano correto manualmente ou ignore a placa.';return;}
 await consultarAnosParaEdicao(r);
}
async function consultarAnosParaEdicao(r){
 const ed=edicaoAno.value;if(!ed||ed.linha!==r.linha)return;
 ed.versoes=[];ed.codigo='';ed.fabricacao='';ed.erro='';
 if(!ed.tipo)return;
 ed.carregando=true;ed.nota='Consultando anos e combustíveis do modelo na FIPE…';
 try{
  const {type,years:codigos}=await resolveFipeYears({preferredType:ed.tipo,brandId:Number(ed.marcaId),modelId:Number(ed.modeloId),brand:marcas.value.find(m=>Number(m.id)===Number(ed.marcaId)),model:(modelosPorMarca.value[ed.marcaId]||[]).find(m=>Number(m.id)===Number(ed.modeloId))});
  if(type&&codigos.length)ed.tipo=type;
  if(edicaoAno.value!==ed)return;
  ed.versoes=versoesValidadas(codigos).sort((a,b)=>anoDaVersao(b.codigo)-anoDaVersao(a.codigo));
  if(ed.versoes.length){
   ed.nota=`${ed.versoes.length} versão(ões) disponíveis. Selecione o ano e combustível reais do veículo.`;
   const original=String(itemLinha(r).ano_modelo??'');
   const doAno=ed.versoes.filter(v=>String(anoDaVersao(v.codigo))===original);
   if(doAno.length===1){ed.codigo=doAno[0].codigo;ed.fabricacao=sugerirFabricacao(itemLinha(r).ano_fabricacao,anoDaVersao(ed.codigo));}
  }else ed.nota='A FIPE não retornou anos para este modelo. Informe o ano manualmente, sem cotação.';
 }catch(e){ed.erro='Não foi possível buscar os anos FIPE: '+falhaCadastro(e)+'. Tente novamente ou ignore a placa.';}
 finally{ed.carregando=false;}
}
function aoSelecionarVersaoAno(r){
 const ed=edicaoAno.value;if(!ed)return;
 const ano=anoDaVersao(ed.codigo);
 ed.fabricacao=anoValido(ano)?sugerirFabricacao(itemLinha(r).ano_fabricacao,ano):'';
}
async function aplicarAnoSugerido(r){
 const ed=edicaoAno.value;if(!ed||ed.linha!==r.linha||ed.carregando)return;
 ed.erro='';
 const marca=marcas.value.find(m=>Number(m.id)===Number(ed.marcaId));
 const modelo=modelosParaAno.value.find(m=>Number(m.id)===Number(ed.modeloId));
 if(!marca||!modelo){ed.erro='Escolha uma marca e um modelo cadastrados.';return;}
 let anoModelo, codigo=null;
 if(ed.versoes.length){
  const versao=ed.versoes.find(v=>String(v.codigo)===String(ed.codigo));
  if(!versao){ed.erro='Escolha uma versão real da FIPE (ano e combustível).';return;}
  codigo=versao.codigo;anoModelo=anoDaVersao(codigo);
 }else{
  if(ed.tipo&&ed.erro){return;}
  if(!anoValido(ed.anoManual)){ed.erro='Informe um ano válido (1950 a 2100), sem FIPE.';return;}
  anoModelo=Number(ed.anoManual);
 }
 if(ed.fabricacao!=='' && (!anoValido(ed.fabricacao)||Number(ed.fabricacao)>anoModelo)){
  ed.erro='A fabricação precisa ser um ano válido, não posterior ao ano do modelo. Ou deixe sem informação.';return;
 }
 const item=itemLinha(r);const anterior={...item};
 Object.assign(item,{marca_id:Number(marca.id),modelo_id:Number(modelo.id),ano_modelo:anoModelo,
   ano_fabricacao:ed.fabricacao===''?null:Number(ed.fabricacao),fipe_ano_codigo:codigo});
 ed.carregando=true;
 try{
  // Só a placa corrigida é simulada novamente, sem gravar nenhuma alteração na API.
  const resultado=await importarVeiculosEsl([item],{simular:true,modo:modo.value,completarExistentes:completarExistentes.value,cadastrarPrestadoresNovos:cadastrarPrestadoresNovos.value});
  const nova=resultado[0];
  if(!nova)throw new Error('API não devolveu a revisão da placa.');
  previaEditada.value=true;preview.value=preview.value.map(p=>p.linha===r.linha?{...nova,linha:r.linha,ano_modelo:anoModelo}:p);
  if(nova.acao==='invalida'){
   ed.erro='A placa ainda precisa de revisão: '+(nova.motivo||'dados inválidos');
  }else{
   edicaoAno.value=null;
   aviso.value=`${r.placa}: ano ${anoModelo} revisado, sem alterar o banco. ${nova.acao==='criar'?'Apta para próxima conferência.':'Confira a nova situação na tabela.'}`;
  }
 }catch(e){Object.assign(item,anterior);ed.erro='Não foi possível revisar a placa: '+falhaCadastro(e);}
 finally{ed.carregando=false;}
}
function aplicarAoGrupo(r,campos){
 const origem=itemLinha(r),k=chave(origem.marca_nome)+'|'+chave(origem.modelo_nome);
 const indices=[];
 for(let i=0;i<linhas.value.length;i++){
  const linha=linhas.value[i];
  if(!chave(origem.modelo_nome) ? i+1!==r.linha : chave(linha.marca_nome)+'|'+chave(linha.modelo_nome)!==k)continue;
  Object.assign(linha,campos);indices.push(i+1);versaoLinha.set(i+1,(versaoLinha.get(i+1)||0)+1);
 }
 // A prévia NUNCA é esvaziada. Enquanto aguarda a simulação, estas linhas
 // continuam pendentes e não podem ser enviadas ao banco.
 previaEditada.value=true;preview.value=preview.value.map(x=>indices.includes(x.linha)?{
  ...x,acao:'revisar',motivo:'Correspondência alterada. Conferindo no servidor…'
 }:x);
 aviso.value=`${indices.length} veículo(s) do mesmo modelo ESL receberam a escolha; conferindo sem fechar a prévia.`;
 return indices;
}
async function selecionarMarca(r,event){
 const marcaId=Number(event.target.value)||null;
 const indices=aplicarAoGrupo(r,{marca_id:marcaId,modelo_id:null,fipe_ano_codigo:null});
 selecoesModelo.value={};mostrarTodosModelos.value={};
 if(marcaId)await prepararSugestoesLinha(r);
 if(!marcaId){aviso.value='Escolha uma marca cadastrada para prosseguir.';return;}
 // Não ressimula até selecionar o modelo — a marca sozinha é insuficiente.
}
async function selecionarModelo(r,event){
 const id=Number(event?.target?.value||event)||null;
 if(!id){
  const marcaId=Number(itemLinha(r).marca_id||r.marca_id);
  aplicarAoGrupo(r,{marca_id:marcaId||null,modelo_id:null,fipe_ano_codigo:null});
  return;
 }
 const marcaId=Number(itemLinha(r).marca_id||r.marca_id);
 if(marcaId)await listarModelosDaMarca(marcaId);
 const candidato=(modelosPorMarca.value[marcaId]||[]).find(m=>Number(m.id)===id);
 if(!marcaId||!candidato){erro.value='Escolha um modelo existente da marca selecionada.';return;}
 const indices=aplicarAoGrupo(r,{marca_id:marcaId,modelo_id:id,fipe_ano_codigo:null});
 // mantém a escolha visível e volta apenas as linhas equivalentes à API
 selecoesModelo.value={...selecoesModelo.value,[r.linha]:String(id)};
 await revalidarLinhas(indices);
}
async function conferirFipe(){
 if(!preview.value.length)return;
 validandoAnos.value=true;erro.value='';let consultas=0;
 const grupos=new Map();const alteradas=new Set();
 for(const r of preview.value){
  if(!['criar','revisar'].includes(r.acao))continue;
  const linha=itemLinha(r),marca=linha.marca_id||r.marca_id,modelo=linha.modelo_id||r.modelo_id,tipo=r.fipe_tipo;
  if(marca&&modelo&&tipo&&!linha.fipe_ano_codigo)grupos.set(`${tipo}:${marca}:${modelo}`,{tipo,marca,modelo});
 }
 const tarefas=[...grupos.values()];let cursor=0,erros=0;
 async function trabalhar(){while(cursor<tarefas.length){const i=cursor++,g=tarefas[i],key=`${g.tipo}:${g.marca}:${g.modelo}`;
   try{const {years:versoes}=await resolveFipeYears({preferredType:g.tipo,brandId:g.marca,modelId:g.modelo,brand:marcas.value.find(m=>Number(m.id)===Number(g.marca)),model:(modelosPorMarca.value[g.marca]||[]).find(m=>Number(m.id)===Number(g.modelo))});
    versoesPorModelo.value={...versoesPorModelo.value,[key]:versoes};
    for(const r of preview.value){const linha=itemLinha(r);
      if(Number(linha.marca_id||r.marca_id)!==Number(g.marca)||Number(linha.modelo_id||r.modelo_id)!==Number(g.modelo))continue;
      const ano=String(linha.ano_modelo||'');const candidatas=versoes.filter(v=>String(v.codigo).startsWith(`${ano}-`));
      // Combustível deve bater; se a exportação for incoerente, exigir seleção manual.
      const comb=chave(linha.combustivel);
      const tipoComb=comb.includes('diesel')?'diesel':comb.includes('etanol')?'alcool':comb.includes('gasolina')?'gasolina':comb.includes('flex')?'flex':'';
      const seguras=candidatas.filter(v=>{const n=chave(v.nome);return !tipoComb||n.includes(tipoComb)||(tipoComb==='alcool'&&n.includes('etanol'));});
      const escolha=seguras.length===1?seguras[0]:candidatas.length===1&&(!tipoComb||seguras.length===1)?candidatas[0]:null;
      if(escolha && linha.fipe_ano_codigo!==escolha.codigo){linha.fipe_ano_codigo=escolha.codigo;alteradas.add(r.linha);}
    }
   }catch{erros++;}
   consultas++;progresso.value=`Versões FIPE consultadas: ${consultas}/${tarefas.length}`;
 }}
 await Promise.all(Array.from({length:Math.min(3,tarefas.length)},()=>trabalhar()));
 validandoAnos.value=false;progresso.value='';aviso.value=`Consulta de ${consultas} modelos concluída. ${erros} falha(s) na API. A revisão permanece aberta.`;
 if(alteradas.size)await revalidarLinhas([...alteradas]);
}
function opcoesAno(r){const item=itemLinha(r),tipo=r.fipe_tipo,marca=item.marca_id||r.marca_id,modelo=item.modelo_id||r.modelo_id;
 return (versoesPorModelo.value[`${tipo}:${marca}:${modelo}`]||[]).filter(v=>String(v.codigo).startsWith(`${item.ano_modelo}-`));
}
async function definirAno(r,codigo){itemLinha(r).fipe_ano_codigo=codigo||null;await revalidarLinhas([r.linha]);}
function atribuirPrestador(r,id){const item=itemLinha(r),k=chave(item.agregado_esl_nome||item.proprietario_esl_nome);
 let total=0;for(let i=0;i<linhas.value.length;i++){const l=linhas.value[i];if(k?chave(l.agregado_esl_nome||l.proprietario_esl_nome)===k:i+1===r.linha){l.prestador_servico_id=Number(id)||null;total++;}}
 aviso.value=`Transportadora atribuída a ${total} placa(s); a revisão continua aberta.`;
}

// ---- Revisão em modal (placa a placa). Reaproveita selecionarModelo/atribuirPrestador/alternarIgnorada. ----
const modalAberto=ref(false),filaRevisao=ref([]),indiceRevisao=ref(0),ocupadoRevisao=ref(false);
const linhaPreview=l=>preview.value.find(x=>x.linha===l);
const pendenteModal=l=>{const r=linhaPreview(l);return Boolean(r)&&precisaRevisao(r,itemLinha(r),ignorada(r));};
const filaAtual=computed(()=>montarFila(preview.value,itemLinha,ignorada));
const revisaoAtual=computed(()=>modalAberto.value?linhaPreview(filaRevisao.value[indiceRevisao.value]):null);
const podeAbrirRevisao=computed(()=>!simulando.value&&!executando.value&&!validandoAnos.value&&!configuracaoDesatualizada.value);
function abrirRevisao(linhaInicial){
 const fila=filaAtual.value;if(!fila.length||!podeAbrirRevisao.value)return;
 filaRevisao.value=fila;const i=fila.indexOf(linhaInicial);indiceRevisao.value=i>=0?i:0;modalAberto.value=true;
}
function fecharRevisao(){modalAberto.value=false;}
function avancarRevisao(){
 const prox=proximoIndice(filaRevisao.value,indiceRevisao.value,pendenteModal);
 if(prox===null){modalAberto.value=false;aviso.value='Revisão de pendências concluída. Nenhum dado foi gravado; confira a prévia antes de importar.';return;}
 indiceRevisao.value=prox;
}
async function okRevisao(p){
 const r=revisaoAtual.value;if(!r||ocupadoRevisao.value)return;
 ocupadoRevisao.value=true;
 try{
  if(p.prestadorId!==undefined)atribuirPrestador(r,p.prestadorId);
  if(p.marcaId)aplicarAoGrupo(r,{marca_id:p.marcaId,modelo_id:null,fipe_ano_codigo:null});
  if(p.modeloId)await selecionarModelo(r,p.modeloId);
 }finally{ocupadoRevisao.value=false;}
 avancarRevisao();
}
function ignorarRevisao(){
 const r=revisaoAtual.value;if(!r||ocupadoRevisao.value)return;
 if(!ignorada(r))alternarIgnorada(r);
 avancarRevisao();
}
const exportaveis=computed(()=>preview.value.filter(r=>!ignorada(r)&&['criar','completar','vincular','vincular_e_completar'].includes(r.acao)));
const bloqueadosFipe=computed(()=>exigirFipe.value?exportaveis.value.filter(r=>r.acao==='criar'&&r.fipe_tipo&&r.ano_modelo&&!itemLinha(r).fipe_ano_codigo):[]);
const faltaResolver=computed(()=>pendentes.value.length+bloqueadosFipe.value.length);
const podeImportar=computed(()=>preview.value.length>0&&exportaveis.value.length>0&&faltaResolver.value===0&&revalidando.value===0&&!configuracaoDesatualizada.value&&!simulando.value&&!executando.value&&!validandoAnos.value);

const origemImport=()=>destinoVoltar(route.query,{name:'cadastros-item',params:{tipo:'veiculos'},query:{aba:'placas'}});
let saiuConfirmado=false;
onBeforeRouteLeave(()=>{if(saiuConfirmado||!preview.value.length||executando.value)return true;return confirm('Há uma prévia de importação não gravada. Sair e descartar?');});
function cancelar(){router.push(origemImport());}
async function importar(){
 if(!preview.value.length||executando.value)return;
 if(configuracaoDesatualizada.value){erro.value='Configuração alterada: atualize a simulação antes de importar.';return;}
 if(revalidando.value>0||validandoAnos.value){erro.value='Aguarde a conclusão das conferências.';return;}
 if(pendentes.value.length){erro.value=`Ainda há ${pendentes.value.length} placa(s) pendente(s). Resolva ou use Ignorar todas as placas pendentes antes de importar.`;return;}
 if(exigirFipe.value&&bloqueadosFipe.value.length){erro.value=`Existem ${bloqueadosFipe.value.length} veículos sem versão FIPE conferida. Use “Conferir anos FIPE” ou desmarque a exigência conscientemente.`;return;}
 const aptosLinhas=exportaveis.value.map(r=>({linha:r.linha,placa:r.placa}));
 const criarN=exportaveis.value.filter(r=>r.acao==='criar').length,atualizarN=exportaveis.value.length-criarN;
 const nomesNovos=new Set(cadastrarPrestadoresNovos.value?exportaveis.value.filter(r=>r.prestador_acao==='criado').map(r=>chave(r.prestador_nome_origem)):[]);
 if(!confirm(`ATENÇÃO: os dados serão GRAVADOS em PRODUÇÃO.\n\nVeículos a criar: ${criarN}\nVeículos a atualizar/completar/vincular: ${atualizarN}\nTerceiros de Transporte a criar: ${nomesNovos.size}${cadastrarPrestadoresNovos.value?'':' (cadastro automático desligado)'}\nPlacas ignoradas (não enviadas): ${ignoradas.value.length}\n\nConfirmar a gravação?`))return;
 const aptos=exportaveis.value.map(itemLinha);
 const dupGrav=placasDuplicadasNoArquivo(linhas.value);
 if(dupGrav.length){erro.value=mensagemDuplicadas(dupGrav);return;}
 if(!aptos.length){erro.value='Nenhum registro apto a importar.';return;}
 executando.value=true;erro.value='';const feitos=[],lotes=[];
 const montarResultado=parcial=>({parcial,linhas:feitos.map((r,i)=>({...r,linha:aptosLinhas[i]?.linha??r.linha,placa:r.placa||aptosLinhas[i]?.placa})),contagens:somarContagens(lotes)});
 try{
  for(let i=0;i<aptos.length;i+=100){progresso.value=`Gravando ${Math.min(i+100,aptos.length)}/${aptos.length}…`;
   const atual=await importarVeiculosEsl(aptos.slice(i,i+100),{simular:false,modo:modo.value,completarExistentes:completarExistentes.value,cadastrarPrestadoresNovos:cadastrarPrestadoresNovos.value});
   feitos.push(...atual);if(atual.contagens)lotes.push(atual.contagens);
  }
  resultado.value=montarResultado(false);
  aviso.value=`Aplicado: ${feitos.filter(r=>['criado','criado_e_vinculado','completado','vinculado'].includes(r.acao)).length} registro(s) processado(s). Confira o resultado abaixo.`;
  preview.value=[];saiuConfirmado=true;
 }catch(e){
  if(feitos.length)resultado.value=montarResultado(true);
  erro.value=`Interrompido após ${feitos.length} itens. ${falhaCadastro(e)} Confira as placas antes de repetir.`;
 }
 finally{executando.value=false;progresso.value='';}
}
const irParaFrota=()=>router.push({name:'cadastros-item',params:{tipo:'veiculos'},query:{aba:'placas'}});
const chipsContagem=c=>[['Criar',c.criar],['Atualizar (completar)',c.atualizar],['Inalterados',c.inalterados],['Revisar',c.revisar],['Inválidas',c.invalidas],['Duplicadas',c.duplicadas],['Conflitos',c.conflito]];
const chipsPrestador=c=>[['Prestadores já cadastrados (exato + normalizado)',c.prestadores_existentes],['Empresas novas candidatas',c.prestadores_novos_candidatos],['Ambíguos (possível duplicado)',c.prestadores_ambiguos],['Para revisar',c.prestadores_revisar]];
const pessoasFisicas=computed(()=>preview.value.filter(r=>!ignorada(r)&&r.prestador_classe==='novo_pessoa_fisica_provavel').length);
const semAgregado=computed(()=>preview.value.filter(r=>!ignorada(r)&&r.prestador_classe==='sem_agregado').length);
function baixarRelatorio(){
 if(!resultado.value)return;
 const blob=new Blob([gerarCsvRelatorio(resultado.value.linhas,{rotuloAcao:descricaoAcao})],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=`importacao-esl-${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
</script>
<template>
<div class="ie">
  <button class="ie__link" @click="router.push(destinoVoltar(route.query,{name:'cadastros-item',params:{tipo:'veiculos'},query:{aba:'placas'}}))"><ArrowLeft :size="17"/> Voltar aos veículos</button>
  <button v-if="preview.length" class="ie__link" type="button" @click="cancelar">Cancelar</button>
  <header class="ie__cabecalho"><div><div class="ie__etiqueta">CADASTROS · FROTA</div><h1>Importar veículos do ESL</h1><p>Reconcilie placas, modelos, anos FIPE e dados operacionais antes de gravar.</p></div><FileSpreadsheet :size="34"/></header>
  <div v-if="erro" class="ie__alerta ie__erro"><CircleAlert :size="17"/> {{ erro }}</div>
  <div v-if="aviso" class="ie__alerta">{{ aviso }}</div>
  <div v-if="progresso" class="ie__alerta"><RefreshCw :size="15"/> {{ progresso }}</div>
  <section class="ie__painel"><h2>1. Exportação de veículos</h2><p>CSV original do ESL, inclusive Windows-1252, com separador ponto e vírgula. São aceitas até 2.000 placas por arquivo; registros existentes são reconhecidos pela placa.</p>
    <div class="ie__acoes"><label class="ie__botao"><UploadCloud :size="17"/> {{ arquivo||'Escolher CSV do ESL' }}<input hidden type="file" accept=".csv,text/csv" @change="escolherArquivo"/></label>
      <select v-model="modo"><option value="importar">Criar novos e identificar existentes</option><option value="vincular">Somente vincular IDs ESL existentes</option></select>
      <button class="ie__botao ie__principal" :disabled="!linhas.length||simulando||lendo||revalidando>0||validandoAnos" @click="simular">{{ simulando?'Simulando…':'2. Simular importação' }}</button></div>
    <label class="ie__check"><input v-model="completarExistentes" type="checkbox"/> Completar SOMENTE os campos vazios das placas já cadastradas (sem sobrescrever valores existentes)</label>
    <label class="ie__check"><input v-model="cadastrarPrestadoresNovos" type="checkbox"/> Cadastrar automaticamente as empresas novas como Terceiros de Transporte</label>
    <p class="ie__dica">Somente empresas. Pessoas físicas e possíveis duplicados nunca são cadastrados automaticamente. Documento (CNPJ/CPF) é opcional e não obrigatório.</p>
    <p class="ie__dica">Simular não grava nada. Se alterar as opções, simule novamente. Se o CSV não trouxer ID do ESL, a placa serve para identificar duplicidade; nenhum ID externo será inventado.</p>
  </section>
  <section v-if="resultado" class="ie__painel ie__resultado"><div class="ie__titulo"><div><h2>{{ resultado.parcial?'RESULTADO PARCIAL — gravação interrompida':'APLICADO — dados gravados em produção' }}</h2><p>Resultado real da gravação. Baixe o relatório antes de sair desta página.</p></div></div>
    <div class="ie__resumo"><span v-for="[t,v] in chipsContagem(resultado.contagens)" :key="t"><b>{{ v }}</b> {{ t }}</span><span><b>{{ resultado.contagens.prestadores_criados??0 }}</b> Terceiros de Transporte criados</span></div>
    <div class="ie__tabela"><table><thead><tr><th>Linha / placa</th><th>Resultado</th><th>Prestador</th></tr></thead>
      <tbody><tr v-for="r in resultado.linhas" :key="r.linha"><td><small>#{{ r.linha }}</small><strong>{{ r.placa }}</strong></td>
        <td><strong>{{ descricaoAcao(r.acao) }}</strong><small>{{ r.motivo||'' }}</small></td>
        <td><strong>{{ r.prestador_nome_origem||'—' }}</strong><small>{{ rotuloAcaoPrestador(r.prestador_acao) }}<template v-if="r.prestador_criado_id"> · ID {{ r.prestador_criado_id }}</template></small></td></tr></tbody></table></div>
    <div class="ie__acoes"><button class="ie__botao" type="button" @click="baixarRelatorio">Baixar relatório (CSV)</button><button class="ie__botao ie__principal" type="button" @click="irParaFrota">Ir para a frota</button></div>
  </section>
  <section v-if="preview.length" class="ie__painel"><div class="ie__titulo"><div><h2>3. Conferência dos registros</h2><p>Se o modelo do ESL não foi localizado exatamente, escolha a marca e o modelo cadastrados. Uma escolha vale para as linhas com o mesmo nome no CSV.</p></div></div>
    <p class="ie__alerta ie__proposto"><b>PROPOSTO – nada foi gravado.</b>&nbsp;Os números abaixo são uma previsão da simulação.</p>
    <div class="ie__resumo"><span v-for="[t,v] in chipsContagem(contagensPreview)" :key="t"><b>{{ v }}</b> {{ t }}</span></div>
    <div class="ie__resumo"><span v-for="[t,v] in chipsPrestador(contagensPreview)" :key="t"><b>{{ v }}</b> {{ t }}</span><span><b>{{ pessoasFisicas }}</b> Pessoas físicas prováveis (não serão cadastradas)</span><span><b>{{ semAgregado }}</b> Sem agregado</span></div>
    <div class="ie__resumo"><span v-for="[k,v] in Object.entries(totais)":key="k"><b>{{ v }}</b> {{ descricaoAcao(k) }}</span>
      <span><b>{{ pendentes.length }}</b> pendência(s) não ignorada(s)</span>
      <span v-if="revalidando"><b>{{ revalidando }}</b> conferência(s) em andamento</span>
    </div>
    <p v-if="configuracaoDesatualizada" class="ie__alerta ie__erro">Você alterou as opções de importação. A revisão foi preservada; clique em Simular importação para atualizar a prévia antes de gravar.</p>
    <div class="ie__acoes">
      <button class="ie__botao ie__mini-skip" type="button" :disabled="!placasPendentesIgnoraveis.length||simulando||executando||validandoAnos||revalidando>0||configuracaoDesatualizada" @click="ignorarTodasAsPendentes">Ignorar todas as placas pendentes ({{ placasPendentesIgnoraveis.length }})</button>
      <button v-if="ignoradasPorLote.length" class="ie__botao" type="button" :disabled="simulando||executando||validandoAnos||revalidando>0" @click="desfazerIgnorarLote"><RefreshCw :size="15"/> Desfazer ignorar em lote</button>
      <button v-if="filaAtual.length" class="ie__botao ie__principal" type="button" :disabled="!podeAbrirRevisao" @click="abrirRevisao()">Revisar pendências ({{ filaAtual.length }})</button>
      <button class="ie__botao" :disabled="validandoAnos" @click="conferirFipe"><Search :size="15"/> {{ validandoAnos?'Conferindo…':'Conferir anos e combustíveis FIPE' }}</button>
      <label class="ie__check"><input v-model="somentePendentes" type="checkbox"/> Mostrar apenas pendências</label>
      <label class="ie__check"><input v-model="somentePrestador" type="checkbox"/> Somente com revisão de prestador</label>
      <span class="ie__flex"/><span>{{ filtrados.length }} registros · página {{ pagina }}/{{ paginaMax }}</span>
      <button class="ie__botao" :disabled="pagina===1" @click="pagina--">←</button><button class="ie__botao" :disabled="pagina>=paginaMax" @click="pagina++">→</button>
    </div>
    <div class="ie__tabela"><table><thead><tr><th>Linha / placa</th><th>Veículo no ESL</th><th>Correspondência RotaMaxi</th><th>Ano / FIPE</th><th>Prestador</th><th>Situação</th></tr></thead>
      <tbody><tr v-for="r in exibidos" :key="r.linha" :class="{'ie__pendencia':r.acao==='revisar'}"><td><small>#{{ r.linha }}</small><strong>{{ r.placa }}</strong></td>
        <td><strong>{{ itemLinha(r).marca_nome||'—' }}</strong><div>{{ itemLinha(r).modelo_nome||'Sem modelo' }}</div><small>{{ itemLinha(r).tipo_veiculo_esl||'' }} · {{ itemLinha(r).tipo_proprietario_esl||'' }}</small></td>
        <td v-if="r.acao==='revisar'" class="ie__revisar">
          <select :value="itemLinha(r).marca_id||r.marca_id||''" @focus="carregarListas" @change="selecionarMarca(r,$event)"><option value="">Escolha marca</option><option v-for="m in marcas" :key="m.id" :value="m.id">{{ m.nome }}</option></select>
          <select :value="selecoesModelo[r.linha]||itemLinha(r).modelo_id||''" @focus="prepararSugestoesLinha(r)" @change="selecionarModelo(r,$event)">
            <option value="">Selecione o modelo do catálogo</option>
            <optgroup v-if="opcoesModeloLinha(r).principais.length" label="Modelos mais prováveis — pelo nome do ESL">
              <option v-for="m in opcoesModeloLinha(r).principais" :key="'p'+m.id" :value="m.id">{{ m.nome }}{{ m.id==opcoesModeloLinha(r).preSelecionado?.id?' ★':'' }}</option>
            </optgroup>
            <optgroup v-if="mostrarTodosModelos[r.linha]" label="Demais modelos da marca">
              <option v-for="m in opcoesModeloLinha(r).demais" :key="'d'+m.id" :value="m.id">{{ m.nome }}</option>
            </optgroup>
          </select>
          <div class="ie__ano-botoes">
            <button v-if="opcoesModeloLinha(r).demais.length && !mostrarTodosModelos[r.linha]" class="ie__mini" @click="revelarModelos(r)">Ver outros modelos da marca</button>
            <button v-if="opcoesModeloLinha(r).preSelecionado && !itemLinha(r).modelo_id" class="ie__mini ie__mini-confirmar" @click="selecionarModelo(r,selecoesModelo[r.linha]||opcoesModeloLinha(r).preSelecionado.id)">Confirmar modelo sugerido</button>
          </div>
          <small>{{ r.motivo }} · <a href="/painel/cadastros/veiculos?aba=modelos" target="_blank">Cadastrar modelo ↗</a></small>
        </td>
        <td v-else>{{ r.marca_nome||'—' }}<div>{{ r.modelo_nome||'—' }}</div></td>
        <td class="ie__ano-celula">
          <div v-if="anoComErro(r)" class="ie__ano-invalido">
            <small>ESL: fabricação {{ origensAnos[r.placa]?.fabricacao??itemLinha(r).ano_fabricacao??'—' }} / modelo {{ origensAnos[r.placa]?.modelo??itemLinha(r).ano_modelo??'—' }}</small>
            <div class="ie__ano-botoes">
              <button class="ie__mini" :disabled="ignorada(r)" @click="abrirSugestaoAno(r)">{{ edicaoAno?.linha===r.linha?'Fechar':'Sugerir ano' }}</button>
              <button class="ie__mini ie__mini-skip" @click="alternarIgnorada(r)">{{ ignorada(r)?'Revisar novamente':'Ignorar placa' }}</button>
            </div>
            <div v-if="edicaoAno?.linha===r.linha" class="ie__editor-ano">
              <b>Conferir no catálogo</b>
              <small>{{ edicaoAno.nota }}</small>
              <label>Marca cadastrada</label>
              <select v-model="edicaoAno.marcaId" :disabled="edicaoAno.carregando" @change="prepararModelosParaAno(r)"><option value="">Selecione a marca</option><option v-for="m in marcas" :key="m.id" :value="String(m.id)">{{ m.nome }}</option></select>
              <label>Este veículo é qual modelo?</label>
              <select v-model="edicaoAno.modeloId" :disabled="!edicaoAno.marcaId||edicaoAno.carregando" @change="prepararAnosParaModelo(r)">
                <option value="">Selecione o modelo</option>
                <optgroup v-if="edicaoAno.modelosSugeridos.length" label="Modelos mais parecidos">
                  <option v-for="m in edicaoAno.modelosSugeridos" :key="'s'+m.id" :value="String(m.id)">{{ m.nome }}</option>
                </optgroup>
                <optgroup label="Outros modelos da marca"><option v-for="m in demaisModelosAno" :key="m.id" :value="String(m.id)">{{ m.nome }}</option></optgroup>
              </select>
              <template v-if="edicaoAno.tipos.length>1">
                <label>Catálogo FIPE</label>
                <select v-model="edicaoAno.tipo" @change="consultarAnosParaEdicao(r)"><option v-for="t in edicaoAno.tipos" :key="t" :value="t">{{ {cars:'Carros',trucks:'Caminhões',motorcycles:'Motos'}[t] }}</option></select>
              </template>
              <template v-if="edicaoAno.modeloId&&edicaoAno.versoes.length">
                <label>Ano modelo e combustível FIPE</label>
                <select v-model="edicaoAno.codigo" @change="aoSelecionarVersaoAno(r)"><option value="">Escolha ano e combustível</option><option v-for="v in edicaoAno.versoes" :key="v.codigo" :value="v.codigo">{{ v.nome }}</option></select>
              </template>
              <template v-else-if="edicaoAno.modeloId&&!edicaoAno.carregando&&!edicaoAno.erro&&!edicaoAno.versoes.length">
                <label>Ano modelo (sem FIPE)</label><input v-model="edicaoAno.anoManual" maxlength="4" placeholder="Ex.: 2006" inputmode="numeric"/>
              </template>
              <label>Ano fabricação (opcional)</label>
              <input v-model="edicaoAno.fabricacao" maxlength="4" placeholder="Informe ano ou deixe vazio" inputmode="numeric"/>
              <button class="ie__mini" :disabled="!(edicaoAno.codigo||anoValido(edicaoAno.anoManual))" @click="edicaoAno.fabricacao=String(edicaoAno.codigo?anoDaVersao(edicaoAno.codigo):edicaoAno.anoManual)">Usar o mesmo ano do modelo</button>
              <small>Confirme a fabricação pelo documento. Correção proposta, nunca automática. Sem ano FIPE real, nenhuma cotação será atribuída.</small>
              <small v-if="edicaoAno.erro" class="ie__editor-erro">{{ edicaoAno.erro }}</small>
              <button v-if="edicaoAno.erro&&edicaoAno.tipo" class="ie__mini" :disabled="edicaoAno.carregando" @click="consultarAnosParaEdicao(r)">Tentar consultar FIPE novamente</button>
              <button class="ie__mini ie__mini-confirmar" :disabled="edicaoAno.carregando||!edicaoAno.modeloId" @click="aplicarAnoSugerido(r)">{{ edicaoAno.carregando?'Consultando…':'Aplicar e rever placa' }}</button>
            </div>
          </div>
          <template v-else>{{ itemLinha(r).ano_modelo||'—' }}</template>
          <div v-if="!anoComErro(r)&&itemLinha(r).fipe_ano_codigo" class="ie__fipe-ok">FIPE {{ itemLinha(r).fipe_ano_codigo }}</div>
          <select v-else-if="!anoComErro(r)&&opcoesAno(r).length" :value="itemLinha(r).fipe_ano_codigo||''" @change="definirAno(r,$event.target.value)"><option value="">Confirmar versão FIPE</option><option v-for="a in opcoesAno(r)" :key="a.codigo" :value="a.codigo">{{ a.nome }}</option></select>
          <small v-else-if="!anoComErro(r)&&r.fipe_tipo">Versão ainda não conferida</small><small v-else-if="!anoComErro(r)">Sem FIPE</small>
        </td>
        <td class="ie__prestador"><strong>{{ r.prestador_nome_origem||'—' }}</strong><small>{{ rotuloClassePrestador(r.prestador_classe) }}<template v-if="r.prestador_acao"> · previsto: {{ rotuloAcaoPrestador(r.prestador_acao) }}</template></small>
          <small v-if="r.prestador_sugerido_id">Sugerido: {{ nomePrestador(r.prestador_sugerido_id) }}</small>
          <select v-if="r.prestador_classe==='possivel_duplicado'&&(r.prestador_ambiguos||[]).length" :value="itemLinha(r).prestador_servico_id||''" @change="atribuirPrestador(r,$event.target.value)">
            <option value="">Não vincular</option><option v-for="p in r.prestador_ambiguos" :key="p.id" :value="p.id">{{ p.nome }}</option></select></td>
        <td><strong>{{ ignorada(r)?'Ignorado':descricaoAcao(r.acao) }}</strong><small>{{ r.motivo||'' }}</small>
          <button v-if="!ignorada(r)&&filaAtual.includes(r.linha)&&podeAbrirRevisao" class="ie__mini" type="button" @click="abrirRevisao(r.linha)">Revisar</button>
          <button v-if="(ignorada(r)||['revisar','conflito','invalida','duplicada','sem_cadastro'].includes(r.acao)) && !anoComErro(r)" class="ie__mini" @click="alternarIgnorada(r)">{{ ignorada(r)?'Revisar novamente':'Ignorar placa' }}</button>
          <select v-if="r.acao==='criar'&&['Agregado','Terceiro'].includes(itemLinha(r).tipo_proprietario_esl)" :value="itemLinha(r).prestador_servico_id||''" @change="atribuirPrestador(r,$event.target.value)">
            <option value="">Transportadora ainda não vinculada</option><option v-for="p in prestadores" :key="p.id" :value="p.id">{{ p.nome }}</option>
          </select>
        </td>
      </tr></tbody></table></div>
    <div class="ie__rodape"><label class="ie__check"><input v-model="exigirFipe" type="checkbox"/> Exigir versão FIPE conferida para modelos que têm FIPE <small>({{ bloqueadosFipe.length }} pendentes)</small></label>
      <button class="ie__botao ie__principal" :disabled="!podeImportar" @click="importar"><Check :size="17"/> {{ executando?'Salvando…':faltaResolver?`Resolva ${faltaResolver} pendência(s) para importar`:`Importar ${exportaveis.length} registros conferidos` }}</button>
    </div>
    <p class="ie__dica">A importação só é liberada depois de todas as pendências serem corrigidas ou ignoradas (individualmente ou em lote). Alterações na marca, modelo, FIPE e transportadora não fecham a revisão.</p>
  </section>
  <EslRevisaoModal v-if="revisaoAtual" :row="revisaoAtual" :item="itemLinha(revisaoAtual)" :indice="indiceRevisao" :total="filaRevisao.length"
    :marcas="marcas" :modelos-por-marca="modelosPorMarca" :ocupado="ocupadoRevisao"
    @ok="okRevisao" @ignorar="ignorarRevisao" @fechar="fecharRevisao" @carregar-modelos="listarModelosDaMarca"/>
</div>
</template>

<style scoped src="@/styles/pages/registrations/vehicles/vehicle_import_page.css"></style>
