<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowDownToLine, Building2, Check, ChevronLeft, ChevronRight, CircleAlert, FilterX, ImageOff, Link2, Pencil, Plus, RefreshCw, Search, Trash2, Truck, UploadCloud, X } from 'lucide-vue-next';
import UsuariosAcessosPage from '@/pages/settings/UserAccessPage.vue';
import FotoPessoaAvatar from '@/components/all/media/PersonAvatar.vue';
import { EMPRESA_ATUAL } from '@/domain/company/current-company.js';
import { apresentarVinculoMotorista } from '@/domain/drivers/linking.js';
import { origemSegura } from '@/domain/vehicles/fleet-model.js';
import { obterAbaCadastro, obterSecaoCadastro } from '@/domain/registrations/navigation.js';
import { CONFIG_CADASTRO, corpoCadastro, formularioVazio, valorDaColuna } from '@/domain/registrations/fields.js';
import { listarTodasMarcas, filtrarMarcas, paginarMarcas } from '@/domain/vehicles/brands/local-pagination.js';
import { obterRecurso, listarCadastro, listarPessoas, consultarPessoa, listarFiliais, gravarCadastro,
  listarVinculosEsl, criarVinculoEsl, excluirVinculoEsl, enviarLogoPrestador, removerLogoPrestador, imagensReferenciaCatalogo, vincularImagemCatalogo, falhaCadastro } from '@/services/api/registrations.api.js';

const route=useRoute(); const router=useRouter();
const secao=computed(()=>obterSecaoCadastro(route.params.tipo));
const aba=computed(()=>obterAbaCadastro(secao.value,route.query.aba));
const ehPessoas=computed(()=>secao.value.id==='pessoas');
const ehTerceiros=computed(()=>secao.value.id==='terceiros');
const ehUsuarios=computed(()=>ehPessoas.value&&aba.value.id==='usuarios');
const recurso=computed(()=>obterRecurso(secao.value.id,aba.value.id));
const config=computed(()=>CONFIG_CADASTRO[recurso.value] || null);
const classe=computed(()=>route.query.classe==='reboques'?'reboque':'motorizado');
const termo=ref(''); const filtroStatus=ref('todos'); const filtroFilial=ref('');
const pagina=ref(1); const total=ref(0); const ultimaPagina=ref(1);
const carregando=ref(false); const salvando=ref(false); const erro=ref(''); const aviso=ref(''); const registros=ref([]);
const modal=ref(false); const edicaoId=ref(null); const formulario=ref({}); const erroModal=ref('');
const referencias=ref({}); const filiaisFiltro=ref([]); const buscaPessoa=ref(''); const vinculos=ref([]); const externoId=ref('');
const modoVinculo=ref('parcial'); const carregandoVinculo=ref(false);
const imagensCatalogo=ref([]); const imagemCatalogoCarregando=ref(false); const fotoCatalogoMensagem=ref('');
const ehCatalogoImagem=computed(()=>recurso.value==='marcas');
const marcasTodas=ref([]);
const camposEslVisiveis=ref(false);const detalhesEslVisiveis=ref([]);
const camposVeiculoEsl=[
  ['cor','Cor'],['combustivel','Combustível'],['numero_frota','Nº Frota'],['ano_fabricacao','Ano fabricação'],
  ['ano_modelo','Ano modelo'],['renavam','RENAVAM'],['chassi','Chassi'],['cidade_licenciamento','Licenciamento'],
  ['tipo_veiculo_esl','Tipo veículo ESL'],['tipo_carroceria','Carroceria'],['tipo_proprietario_esl','Tipo proprietário'],
  ['proprietario_esl_nome','Proprietário no ESL'],['motorista_esl_nome','Motorista padrão ESL'],['agregado_esl_nome','Agregado'],['tabela_agregado','Tabela agregado'],
  ['pbt_kg','PBT (kg)'],['tara_kg','Tara (kg)'],['capacidade_m3','Capacidade (m³)'],
  ['capacidade_lotacao','Capacidade lotação'],['numero_autorizacao_gr','Autorização GR'],['validade_gr','Validade GR'],
  ['data_compra','Data compra'],['valor_compra','Valor compra'],['data_venda','Data venda'],['valor_venda','Valor venda'],
  ['situacao_esl','Status ESL'],['lote_fechamento_ciot','Lote CIOT'],['motorista_referencia_pessoa_id','Motorista ref.'],
];
function alternarDetalheEsl(id){detalhesEslVisiveis.value=detalhesEslVisiveis.value.includes(id)?detalhesEslVisiveis.value.filter(x=>x!==id):[...detalhesEslVisiveis.value,id];}

const ehListaMarcas=computed(()=>recurso.value==='marcas');
function atualizarListaMarcas(){
  if(!ehListaMarcas.value)return;
  const selecionadas=filtrarMarcas(marcasTodas.value,{busca:termo.value,status:filtroStatus.value});
  const dados=paginarMarcas(selecionadas,pagina.value);
  if(pagina.value!==dados.pagina)pagina.value=dados.pagina;
  registros.value=dados.registros;total.value=dados.total;ultimaPagina.value=dados.ultimaPagina;
}
const logosNaoCarregadas=ref({});
function iniciaisMarca(nome){return (String(nome||'').trim().match(/[\p{L}\p{N}]+/gu)||['?']).slice(0,2).map(t=>t[0]?.toUpperCase()).join('');}
const logoArquivo=ref(null); const logoPreview=ref(''); const logoAtual=ref(''); const removerLogoPendente=ref(false); const logoInput=ref(null);
let sequencia=0; let buscaTemporizador=null;
const colunas=computed(()=>ehPessoas.value
  ? (aba.value.id==='motoristas' ? [['nome','Nome'],['documento','Documento'],['vinculo','Vínculo'],['filial','Matriz'],['status','Situação']]
    : [['nome','Nome'],['documento','Documento'],['filial','Matriz'],['status','Situação']])
  : (recurso.value==='veiculos'&&camposEslVisiveis.value?[...(config.value?.columns||[]),...camposVeiculoEsl]:(config.value?.columns || [])));
const totalAtivos=computed(()=>registros.value.filter(r=>r.is_active===true||r.ativo===true).length);
const filtroPessoasDetalhadas=computed(()=>['usuarios'].includes(aba.value.id));
const entidadeVinculo=computed(()=>({clientes:'cliente',unidades:'unidade',veiculos:'veiculo',filiais:'filial'})[recurso.value]||null);
const ativoVinculo=computed(()=>vinculos.value.find(v=>v.estado==='ativo')||null);
const totalExibido=computed(()=>filtroPessoasDetalhadas.value?registros.value.length:total.value);
const rotuloQuantidade=computed(()=>ehPessoas.value?(totalExibido.value===1?'pessoa':'pessoas'):ehTerceiros.value?(totalExibido.value===1?'prestadora':'prestadoras'):(totalExibido.value===1?'registro':'registros'));
const placeholderBusca=computed(()=>ehPessoas.value?'Buscar por nome ou documento':ehTerceiros.value?'Buscar prestadora':'Buscar');

function avisoDaFalha(err){return falhaCadastro(err);}
function vinculoMotorista(registro){return apresentarVinculoMotorista(registro?.motorista,registro?.prestador_vinculado,EMPRESA_ATUAL);}
function selecaoDeAba(){const f={pagina:pagina.value,por_pagina:20};
  if (termo.value.trim()) f.busca=termo.value.trim();
  if (filtroStatus.value!=='todos') f.ativo=filtroStatus.value==='ativo'?1:0;
  if (ehPessoas.value){if(filtroFilial.value) f.filial_matriz_id=filtroFilial.value;
    if (aba.value.id==='motoristas')f.motorista=1;}
  if (recurso.value==='veiculos')f.categoria=classe.value;
  if (recurso.value==='prestadores-servico')f.tipo_prestador=aba.value.id==='gerais'?'geral':'transporte';
  if (recurso.value==='unidades'&&['coleta','distribuicao','ct'].includes(aba.value.id))
    f.tipo_local=aba.value.id==='distribuicao'?'entrega':aba.value.id;
  return f;}
async function carregar(){const id=++sequencia; if(ehUsuarios.value){carregando.value=false;return;} carregando.value=true;erro.value='';
  try {
    if(ehListaMarcas.value){
      // Busca de todas as páginas apenas ao entrar/atualizar ou depois de salvar.
      // O termo e as setas atuam sobre o conjunto completo sem novas requisições.
      const marcas=await listarTodasMarcas(listarCadastro);
      if(id!==sequencia)return;
      marcasTodas.value=marcas;logosNaoCarregadas.value={};
      atualizarListaMarcas();
      return;
    }
    const resposta=ehPessoas.value?await listarPessoas(selecaoDeAba()):await listarCadastro(recurso.value,selecaoDeAba());
    if(id!==sequencia)return;
    let itens=resposta.data;
    if(ehPessoas.value&&aba.value.id==='motoristas'&&itens.length){
      const detalhes=await Promise.all(itens.map(p=>consultarPessoa(p.id)));
      if(id!==sequencia)return;
      const idsPrestadores=[...new Set(detalhes.map(p=>Number(p.motorista?.prestadorServicoId||0)).filter(Boolean))];
      let prestadoresPorId=new Map();
      if(idsPrestadores.length){
        // A logo/nome da prestadora é um enriquecimento da tabela.
        // Se o módulo de Terceiros estiver indisponível, a lista de Motoristas continua abrindo.
        try {
          const prestadores=await listarCadastro('prestadores-servico',{tipo_prestador:'transporte',por_pagina:100});
          prestadoresPorId=new Map((prestadores.data||[]).map(p=>[Number(p.id),p]));
        } catch (_) {
          prestadoresPorId=new Map();
        }
      }
      const detalhesPorId=new Map(detalhes.map(p=>[Number(p.id),p]));
      itens=itens.map(r=>{
        const d=detalhesPorId.get(Number(r.id));
        const motorista=d?.motorista||{};
        const prestador=prestadoresPorId.get(Number(motorista.prestadorServicoId||0))||null;
        return {...r,motorista,prestador_vinculado:prestador};
      });
    }
    // API não tem filtro de usuário/terceiro no índice; detalhes são checados nesta página.
    if(ehPessoas.value&&filtroPessoasDetalhadas.value){
      const completos=await Promise.all(itens.map(p=>consultarPessoa(p.id)));
      if(id!==sequencia)return;
      const ids=new Set(completos.filter(p=>aba.value.id==='usuarios' ? p.acesso?.habilitado
        : p.vinculos?.some(v=>/terceiro|prestador|agregado|aut[oô]nomo/i.test(v.tipo||''))).map(p=>p.id));
      itens=itens.filter(p=>ids.has(p.id));
    }
    if(id!==sequencia)return;
    // A API de clientes ainda não filtra permite_coleta/permite_entrega.
    // Exibimos somente correspondências reais da página recebida, sem inventar totais globais.
    if(recurso.value==='clientes' && aba.value.id==='coleta') itens=itens.filter(c=>c.permite_coleta===true);
    if(recurso.value==='clientes' && aba.value.id==='entrega') itens=itens.filter(c=>c.permite_entrega===true);
    if(ehPessoas.value && !filiaisFiltro.value.length){
      try{filiaisFiltro.value=await listarFiliais();}catch(e){ /* Listagem segue funcional; filtro indisponível sem inventar filiais. */ }
    }
    logosNaoCarregadas.value={};registros.value=itens;total.value=resposta.total||0;ultimaPagina.value=resposta.last_page||1;
  }catch(e){if(id!==sequencia)return;registros.value=[];total.value=0;ultimaPagina.value=1;erro.value=avisoDaFalha(e);}
  finally{if(id===sequencia)carregando.value=false;}
}
function liberarLogoPreview(){if(logoPreview.value)URL.revokeObjectURL(logoPreview.value);logoPreview.value='';}
function selecionarLogo(ev){const arq=ev.target.files?.[0];if(!arq)return;
  if(!['image/jpeg','image/png','image/webp'].includes(arq.type)||arq.size>5*1024*1024){erroModal.value='A logo deve ser JPG, PNG ou WEBP com até 5 MB.';ev.target.value='';return;}
  liberarLogoPreview();logoArquivo.value=arq;logoPreview.value=URL.createObjectURL(arq);removerLogoPendente.value=false;erroModal.value='';}
function retirarLogo(){liberarLogoPreview();logoArquivo.value=null;removerLogoPendente.value=Boolean(logoAtual.value);logoAtual.value='';if(logoInput.value)logoInput.value.value='';}
function fecharFormulario(){liberarLogoPreview();modal.value=false;}
onBeforeUnmount(()=>{liberarLogoPreview();clearTimeout(buscaTemporizador);});
function mudarAba(){++sequencia;pagina.value=1;termo.value='';filtroFilial.value='';filtroStatus.value='todos';aviso.value='';erro.value='';fecharFormulario();carregar();}
watch([()=>route.params.tipo,()=>route.query.aba,()=>route.query.classe],mudarAba,{immediate:true});
watch([pagina,filtroStatus,filtroFilial],()=>{
  if(ehListaMarcas.value)atualizarListaMarcas();else carregar();
});
watch(termo,()=>{
  pagina.value=1;clearTimeout(buscaTemporizador);
  if(ehListaMarcas.value){atualizarListaMarcas();return;}
  buscaTemporizador=setTimeout(carregar,360);
});
function mudarClasse(v){router.push({name:'cadastros-item',params:{tipo:'veiculos'},query:{aba:'placas',classe:v==='reboque'?'reboques':'motorizados'}});}
function limpar(){
  termo.value='';filtroStatus.value='todos';filtroFilial.value='';pagina.value=1;
  if(ehListaMarcas.value)atualizarListaMarcas();else carregar();
}
function abrirPessoa(p){router.push(p?{name:'pessoa-editar',params:{id:p.id},query:{origem:aba.value.id}}
  :{name:'pessoa-nova',query:{origem:aba.value.id}});}
async function carregarReferencias(){
  const fontes=[...new Set((config.value?.fields||[]).filter(f=>f.type==='reference').map(f=>f.source))];
  try {await Promise.all(fontes.map(async fonte=>{
    const r=fonte==='pessoas' ? await listarPessoas({busca:buscaPessoa.value.trim()||undefined,por_pagina:100}) :
      await listarCadastro(fonte,{por_pagina:100, ...(fonte==='modelos'&&formulario.value.marca_id?{marca_id:formulario.value.marca_id}:{})});
    referencias.value[fonte]=r.data;
  }));}
  catch(e){erroModal.value=`Não foi possível carregar as opções relacionadas: ${avisoDaFalha(e)}`;}
}
async function abrirFormulario(item=null){
  if(recurso.value==='veiculos'){router.push(item?{name:'veiculo-editar',params:{id:item.id}}:{name:'veiculo-novo',query:{classe:classe.value}});return;}
  if(ehPessoas.value){abrirPessoa(item);return;}
  edicaoId.value=item?.id||null; formulario.value=item?{...item}:formularioVazio(recurso.value,classe.value);
  imagensCatalogo.value=[];fotoCatalogoMensagem.value='';
  vinculos.value=[];externoId.value='';buscaPessoa.value='';erroModal.value='';
  liberarLogoPreview();logoArquivo.value=null;logoAtual.value=ehTerceiros.value?(item?.logo_url||''):'';removerLogoPendente.value=false;
  modal.value=true;
  await carregarReferencias();
  if(item?.id && entidadeVinculo.value){try{vinculos.value=await listarVinculosEsl(entidadeVinculo.value,item.id);}
    catch(e){erroModal.value=avisoDaFalha(e);}}
}
// Atalho da ficha de veículo: abre a tela própria já no formulário de nova marca/modelo.
watch(()=>route.query.novo,async (novo)=>{
  if(novo!=='1' || route.params.tipo!=='veiculos' || !['marcas','modelos'].includes(route.query.aba))return;
  await abrirFormulario();
  // Consome a ação de criar, sem perder o modal se houver atualização da página.
  await router.replace({name:'cadastros-item',params:{tipo:'veiculos'},query:{aba:route.query.aba,...(origemSegura(route.query.voltar)?{voltar:origemSegura(route.query.voltar)}:{})}});
},{immediate:true});
const voltarAoVeiculo=computed(()=>route.params.tipo==='veiculos'?origemSegura(route.query.voltar):'');
async function consultarImagemMarcaModelo(){
  if(!edicaoId.value||!ehCatalogoImagem.value)return;
  const marcaId=recurso.value==='marcas'?edicaoId.value:formulario.value.marca_id;
  const modeloId=recurso.value==='modelos'?edicaoId.value:null;
  imagemCatalogoCarregando.value=true;fotoCatalogoMensagem.value='';imagensCatalogo.value=[];
  try{imagensCatalogo.value=await imagensReferenciaCatalogo(marcaId,modeloId);
    if(!imagensCatalogo.value.length)fotoCatalogoMensagem.value='Sem sugestões com licença identificada nesta pesquisa.';
  }catch(e){fotoCatalogoMensagem.value=avisoDaFalha(e);}finally{imagemCatalogoCarregando.value=false;}
}
async function aplicarImagemMarcaModelo(i){
  const marcaId=recurso.value==='marcas'?edicaoId.value:formulario.value.marca_id;
  const modeloId=recurso.value==='modelos'?edicaoId.value:null;
  imagemCatalogoCarregando.value=true;
  try{const r=await vincularImagemCatalogo(marcaId,modeloId,i);formulario.value={...formulario.value,...r};
    imagensCatalogo.value=[];fotoCatalogoMensagem.value='Imagem salva no cadastro. Confira licença e autoria na origem.';
    await carregar();
  }catch(e){fotoCatalogoMensagem.value=avisoDaFalha(e);}finally{imagemCatalogoCarregando.value=false;}
}
async function salvar(){if(salvando.value)return;erroModal.value='';salvando.value=true;
  try{
    const corpo=corpoCadastro(recurso.value,formulario.value);
    if(ehTerceiros.value)corpo.categoria=aba.value.id==='gerais'?'geral':'transporte';
    const eraEdicao=Boolean(edicaoId.value);
    const salvo=await gravarCadastro(recurso.value,corpo,edicaoId.value);
    edicaoId.value=salvo.id;
    if(ehTerceiros.value){
      try{
        if(logoArquivo.value){const logo=await enviarLogoPrestador(salvo.id,logoArquivo.value);logoAtual.value=logo.url||'';logoArquivo.value=null;liberarLogoPreview();}
        else if(removerLogoPendente.value){await removerLogoPrestador(salvo.id);logoAtual.value='';removerLogoPendente.value=false;}
      }catch(e){await carregar();erroModal.value=`Prestadora salva, mas a logo não foi atualizada: ${avisoDaFalha(e)}`;return;}
    }
    fecharFormulario();aviso.value=`${config.value.singular} ${eraEdicao?'atualizada':'cadastrada'} com sucesso.`;await carregar();
  }catch(e){erroModal.value=avisoDaFalha(e);}finally{salvando.value=false;}
}
async function vincular(){if(!entidadeVinculo.value||!edicaoId.value)return;
  carregandoVinculo.value=true;erroModal.value='';
  try{await criarVinculoEsl(entidadeVinculo.value,edicaoId.value,externoId.value,modoVinculo.value);
    vinculos.value=await listarVinculosEsl(entidadeVinculo.value,edicaoId.value);externoId.value='';aviso.value='Vínculo ESL registrado. Os dados locais foram preservados.';}
  catch(e){erroModal.value=avisoDaFalha(e);}finally{carregandoVinculo.value=false;}
}
async function desvincular(){if(!ativoVinculo.value||!confirm('Desvincular do ESL? O registro RotaMaxi será preservado.'))return;
  carregandoVinculo.value=true;erroModal.value='';try{await excluirVinculoEsl(ativoVinculo.value.id);
    vinculos.value=await listarVinculosEsl(entidadeVinculo.value,edicaoId.value);aviso.value='Vínculo desfeito. Cadastro local preservado.';}
  catch(e){erroModal.value=avisoDaFalha(e);}finally{carregandoVinculo.value=false;}}
function opcoes(f){let arr=referencias.value[f.source]||[];
  if(f.source==='modelos'&&formulario.value.marca_id)arr=arr.filter(a=>a.marca_id===Number(formulario.value.marca_id));
  if(f.source==='tipos-veiculo'&&formulario.value.categoria)arr=arr.filter(a=>a.categoria===formulario.value.categoria);
  return arr;}
function valorLinha(item,campo){if(ehPessoas.value){if(campo==='status')return item.ativo?'Ativo':'Inativo';if(campo==='filial')return item.filial||'—';return item[campo]||'—';}
  return valorDaColuna(item,campo,referencias.value);}
function exportar(){if(!registros.value.length)return;
  const linhas=[colunas.value.map(c=>c[1]),...registros.value.map(r=>colunas.value.map(c=>valorLinha(r,c[0])))];
  const csv='\uFEFF'+linhas.map(l=>l.map(v=>`"${String(v).replaceAll('"','""')}"`).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=`rotamaxi_${secao.value.id}_${aba.value.id}_pagina_${pagina.value}.csv`;a.click();URL.revokeObjectURL(url);
  aviso.value='Exportação concluída.';
}
</script>

<template>
<UsuariosAcessosPage v-if="ehUsuarios"/>
<section v-else class="cad">
  <header class="cad__cabecalho"><div class="cad__cabecalho-texto">
    <div class="cad__etiqueta">CADASTROS · {{ secao.nome.toUpperCase() }}</div>
    <a v-if="voltarAoVeiculo" class="cad__outline" :href="voltarAoVeiculo" @click.prevent="router.push(voltarAoVeiculo)">&larr; Voltar ao cadastro do veículo</a>
    <h1>{{ aba.nome }}</h1><p>{{ aba.descricao }}</p></div>
    <div class="cad__topo-acoes"><button v-if="recurso==='veiculos'" class="cad__outline" type="button" @click="router.push({name:'veiculo-importar-esl'})"><UploadCloud :size="17"/> Importar do ESL</button><button class="cad__primary" type="button" @click="abrirFormulario()"><Plus :size="18"/> {{ recurso==='veiculos'?'Novo veículo':ehPessoas?'Nova pessoa':ehTerceiros?'Nova prestadora':`Novo cadastro` }}</button></div>
  </header>

  <div v-if="secao.id==='veiculos'&&aba.id==='placas'" class="cad__classe-area"><div class="cad__classe-titulo"><Truck :size="19"/><strong>Categoria</strong></div><div class="cad__classe-controle"><button type="button" :class="{'cad__classe-ativo':classe==='motorizado'}" @click="mudarClasse('motorizado')">Motorizados</button><button type="button" :class="{'cad__classe-ativo':classe==='reboque'}" @click="mudarClasse('reboque')">Reboques / semirreboques</button></div></div>

  <div v-if="route.query.salvo==='1'" class="cad__feedback cad__feedback--pagina" role="status"><Check :size="17"/> Cadastro salvo com sucesso.</div>
  <div v-if="erro" class="cad__feedback cad__feedback--pagina cad__feedback--erro" role="alert"><CircleAlert :size="17"/> {{ erro }} <button class="cad__outline" type="button" @click="carregar">Tentar novamente</button></div>
  <div v-if="aviso" class="cad__feedback cad__feedback--pagina" role="status"><Check :size="16"/> {{ aviso }}<button type="button" @click="aviso=''" aria-label="Fechar mensagem"><X :size="16"/></button></div>

  <section class="cad__painel">
    <div class="cad__filtros cad__filtros--topo">
      <label class="cad__busca"><Search :size="18"/><input v-model="termo" type="search" :placeholder="placeholderBusca"/></label>
      <label v-if="ehPessoas" class="cad__status">Matriz<select v-model="filtroFilial"><option value="">Todas</option><option v-for="f in filiaisFiltro" :key="f.id" :value="f.id">{{ f.codigo }} · {{ f.nome }}</option></select></label>
      <label class="cad__status">Situação<select v-model="filtroStatus"><option value="todos">Todas</option><option value="ativo">Ativos</option><option value="inativo">Inativos</option></select></label>
      <button type="button" class="cad__outline" @click="limpar"><FilterX :size="16"/> Limpar</button>
      <button type="button" class="cad__outline" @click="carregar" :disabled="carregando" title="Atualizar"><RefreshCw :size="16"/> Atualizar</button>
      <button v-if="recurso==='veiculos'" type="button" class="cad__outline" @click="camposEslVisiveis=!camposEslVisiveis">{{ camposEslVisiveis?'Ocultar colunas ESL':'Mostrar colunas ESL' }}</button><button type="button" class="cad__outline" @click="exportar"><ArrowDownToLine :size="16"/> CSV</button>
    </div>

    <div class="cad__resumo">
      <span><b>{{ totalExibido }}</b> {{ rotuloQuantidade }}</span>
      <span class="cad__resumo-separador">·</span>
      <span><b>{{ totalAtivos }}</b> {{ totalAtivos===1?'ativo nesta página':'ativos nesta página' }}</span>
      <div v-if="ehListaMarcas" class="cad__resumo-paginacao" aria-label="Navegação entre páginas das marcas">
        <span>Página {{ pagina }} de {{ ultimaPagina }}</span>
        <button type="button" aria-label="Página anterior de marcas" title="Anterior" :disabled="pagina<=1||carregando" @click="pagina=Math.max(1,pagina-1)"><ChevronLeft :size="16"/></button>
        <button type="button" aria-label="Próxima página de marcas" title="Próxima" :disabled="pagina>=ultimaPagina||carregando" @click="pagina=Math.min(ultimaPagina,pagina+1)"><ChevronRight :size="16"/></button>
      </div>
    </div>

    <div class="cad__tabela-rolagem"><table><thead><tr><th>#</th><th v-for="c in colunas" :key="c[0]">{{ c[1] }}</th><th>Ações</th></tr></thead>
      <tbody><template v-for="r in registros" :key="r.id"><tr><td class="cad__codigo">{{ r.id }}</td>
        <td v-for="c in colunas" :key="c[0]">
          <span v-if="ehPessoas&&c[0]==='nome'" class="cad__nome"><FotoPessoaAvatar :pessoa-id="r.id" :foto-url="r.foto_url" :nome="r.nome" :tamanho="40"/><b>{{ r.nome||'Pessoa sem nome' }}</b></span>
          <span v-else-if="recurso==='marcas'&&c[0]==='nome'" class="cad__nome"><span class="cad__logo-lista"><img v-if="r.foto_url && !logosNaoCarregadas[r.id]" :src="r.foto_url" :alt="`Logo de ${r.nome}`" @error="logosNaoCarregadas[r.id]=true"/><span v-else class="cad__logo-iniciais" :title="`Sem logo verificada para ${r.nome}`">{{ iniciaisMarca(r.nome) }}</span></span><b>{{ r.nome }}</b></span>
          <span v-else-if="ehTerceiros&&c[0]==='nome'" class="cad__nome"><span class="cad__logo-lista"><img v-if="r.logo_url" :src="r.logo_url" :alt="`Logo ${r.nome}`"/><Building2 v-else :size="18"/></span><b>{{ r.nome||'Prestadora sem nome' }}</b></span>
          <span v-else-if="ehPessoas&&aba.id==='motoristas'&&c[0]==='vinculo'" class="cad__vinculo-motorista">
            <span class="cad__vinculo-logo"><img v-if="vinculoMotorista(r).logo" :src="vinculoMotorista(r).logo" :alt="`Logo ${vinculoMotorista(r).nome}`"/><Building2 v-else :size="16"/></span>
            <span class="cad__vinculo-texto"><b>{{ vinculoMotorista(r).tipo }}</b><small v-if="vinculoMotorista(r).nome">{{ vinculoMotorista(r).nome }}</small></span>
          </span>
          <span v-else-if="c[0]==='status'" class="cad__badge" :class="r.ativo?'cad__badge--ativo':'cad__badge--neutro'">{{ valorLinha(r,c[0]) }}</span>
          <span v-else>{{ valorLinha(r,c[0]) }}</span>
        </td><td><button type="button" class="cad__editar-pessoa" @click="abrirFormulario(r)"><Pencil :size="15"/> Editar</button>
        <button v-if="recurso==='veiculos'" type="button" class="cad__editar-pessoa" @click="alternarDetalheEsl(r.id)">{{ detalhesEslVisiveis.includes(r.id)?'Ocultar':'Dados ESL' }}</button>
      </td></tr>
      <tr v-if="recurso==='veiculos'&&detalhesEslVisiveis.includes(r.id)" class="cad__detalhes-esl"><td :colspan="colunas.length+2">
        <div class="cad__detalhes-grade"><div v-for="[chave,rotulo] in camposVeiculoEsl" :key="chave"><small>{{ rotulo }}</small><strong>{{ valorLinha(r,chave) }}</strong></div></div>
      </td></tr></template><tr v-if="!registros.length&&!carregando"><td :colspan="colunas.length+2"><div class="cad__vazio"><Search :size="26"/><strong>Nenhum registro encontrado.</strong><p>Altere os filtros ou cadastre um novo registro.</p></div></td></tr>
      <tr v-if="carregando"><td :colspan="colunas.length+2"><div class="cad__vazio"><RefreshCw :size="21"/> Carregando...</div></td></tr>
      </tbody></table></div>
    <footer class="cad__rodape"><span>Página {{ pagina }} de {{ ultimaPagina }}</span><div>
      <button type="button" aria-label="Anterior" :disabled="pagina<=1||carregando" @click="pagina--"><ChevronLeft :size="17"/></button><span>{{ pagina }} / {{ ultimaPagina }}</span>
      <button type="button" aria-label="Próxima" :disabled="pagina>=ultimaPagina||carregando" @click="pagina++"><ChevronRight :size="17"/></button></div></footer>
  </section>

  <div v-if="modal&&config" class="cad__modal-fundo" @click.self="fecharFormulario">
    <form class="cad__modal" @submit.prevent="salvar"><header><div><small>CADASTRO</small><h2>{{ edicaoId?`Editar ${config.singular}`:`Cadastrar ${config.singular}` }}</h2></div><button type="button" @click="fecharFormulario" aria-label="Fechar"><X :size="19"/></button></header>
      <div v-if="erroModal" class="cad__feedback cad__feedback--erro" role="alert">{{ erroModal }}</div>
      <div v-if="ehTerceiros" class="cad__logo-editor">
        <span class="cad__logo-preview"><img v-if="logoPreview||logoAtual" :src="logoPreview||logoAtual" alt="Prévia da logo"/><Building2 v-else :size="28"/></span>
        <div><strong>Logo da empresa</strong><small>JPG, PNG ou WEBP · até 5 MB</small><div class="cad__logo-acoes"><label class="cad__outline"><UploadCloud :size="16"/> Escolher logo<input ref="logoInput" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="selecionarLogo"/></label><button v-if="logoPreview||logoAtual" type="button" class="cad__outline" @click="retirarLogo"><ImageOff :size="16"/> Remover</button></div></div>
      </div>
      <div v-if="ehCatalogoImagem" class="cad__logo-editor">
        <span class="cad__logo-preview"><img v-if="formulario.foto_url" :src="formulario.foto_url" :alt="formulario.nome"/><span v-else class="cad__logo-iniciais cad__logo-iniciais--grande" title="Sem logo verificada">{{ iniciaisMarca(formulario.nome) }}</span></span>
        <div><strong>Logo da marca</strong>
          <small>Logo do fabricante vinculado ao banco; utilizado por todos os modelos da marca.</small>
          <a v-if="formulario.foto_pagina" :href="formulario.foto_pagina" rel="noopener noreferrer" target="_blank" style="font-size:.7rem">Ver imagem, autoria e licença</a>
<small v-if="!formulario.foto_url">Sem logo catalogada. O administrador pode sincronizar as logos verificadas no backend.</small>
        </div>
      </div>


      <div class="cad__form"><template v-for="f in config.fields" :key="f.key">
        <label v-if="f.type==='boolean'" class="cad__check"><input type="checkbox" v-model="formulario[f.key]"/> {{ f.label }}</label>
        <label v-else>{{ f.label }} <span v-if="f.required">*</span>
          <select v-if="f.type==='select'" v-model="formulario[f.key]" :required="f.required"><option value="">Selecione</option><option v-for="op in f.options" :key="op[0]" :value="op[0]">{{ op[1] }}</option></select>
          <select v-else-if="f.type==='reference'" v-model="formulario[f.key]" :required="f.required"><option value="">Selecione {{ f.label.toLowerCase() }}</option><option v-for="op in opcoes(f)" :key="op.id" :value="op.id">{{ op.nome||op.placa||op.codigo||`#${op.id}` }}</option></select>
          <textarea v-else-if="f.type==='textarea'" v-model="formulario[f.key]" rows="3"></textarea>
          <input v-else v-model="formulario[f.key]" :type="f.type==='number'?'number':'text'" :step="f.type==='number'?'any':undefined" :required="f.required" :maxlength="f.key==='uf'?2:undefined"/>
        </label>
      </template><label v-if="!ehTerceiros" class="cad__check"><input type="checkbox" v-model="formulario.is_active"/> Cadastro ativo</label></div>
      <div v-if="config.fields.some(f=>f.source==='pessoas')" class="cad__referencias"><label>Localizar pessoa pelo nome ou CPF<input v-model="buscaPessoa" type="search" placeholder="Nome ou CPF" @keyup.enter.prevent="carregarReferencias"/></label><button type="button" class="cad__outline" @click="carregarReferencias"><Search :size="16"/> Pesquisar</button><button type="button" class="cad__outline" @click="router.push({name:'pessoa-nova',query:{origem:'clientes'}})">Cadastrar pessoa</button></div>
      <div v-if="edicaoId&&entidadeVinculo" class="cad__vinculos"><div class="cad__vinculos-titulo"><Link2 :size="17"/> <b>Vínculo ESL</b></div>
        <p v-if="ativoVinculo">Vinculado a <b>{{ ativoVinculo.externo_id }}</b>. <button type="button" class="cad__outline" :disabled="carregandoVinculo" @click="desvincular"><Trash2 :size="15"/> Desvincular</button></p>
        <div v-else class="cad__referencias"><input v-model="externoId" placeholder="ID no ESL"/><select v-model="modoVinculo"><option value="parcial">Parcial</option><option value="completo">Completo</option></select><button type="button" class="cad__outline" :disabled="!externoId.trim()||carregandoVinculo" @click="vincular">Vincular</button></div>
      </div>
      <footer><button type="button" class="cad__outline" @click="fecharFormulario">Cancelar</button><button class="cad__primary" type="submit" :disabled="salvando"><Check :size="16"/> {{ salvando?'Salvando...':'Salvar' }}</button></footer>
    </form>
  </div>
</section>
</template>

<style scoped src="@/styles/pages/registrations/registrations_workspace_page.css"></style>
