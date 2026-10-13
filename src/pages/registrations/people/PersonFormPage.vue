<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ArrowLeft, Bell, BriefcaseBusiness, Camera,
  Check, ChevronDown, CircleHelp, ContactRound, FileBadge, FileText, ImageOff,
  LockKeyhole, MapPin, Plus, Trash2, Truck, UploadCloud, UserRound,
  Wallet, X, GitBranch, Building2, Search as SearchIcon,
} from 'lucide-vue-next';
import {
  criarPessoa, normalizarPessoa,
  documentoVazio, enderecoVazio, contatoVazio, vinculoVazio, contaVazia, pixVazio,
} from '@/domain/people/model.js';
import { consultarPessoa, gravarPessoa, listarFiliais, configurarAcessoPessoa,
  enviarFotoPessoa, removerFotoPessoa, consultarEslCpf, estadoEslPessoa, vincularEslPessoa,
  vincularEslReferencia, sincronizarEslPessoa, desvincularEslPessoa, listarCadastro, falhaCadastro } from '@/services/api/registrations.api.js';

const route = useRoute();
const router = useRouter();
const idEdicao = computed(() => route.params.id || null);
const abaOrigem = computed(() => ['pessoas','motoristas','usuarios','clientes'].includes(route.query.origem) ? route.query.origem : 'pessoas');
const editor = ref(criarPessoa({ origem: abaOrigem.value }));
const carregando = ref(false);
const aviso = ref('');
const erro = ref('');
const semRegistro = ref(false);
const paineisAbertos = ref([]);
const fotoPreview = ref('');
const imagemInput = ref(null);
const mudancas = ref(false);
const filiaisReais = ref([]);
const prestadoresTransporte = ref([]);
const arquivoFoto = ref(null);
const removerFotoPendente = ref(false);
const persistidoId = ref(null);
const fotoServidor = ref('');
const temFotoRemota = ref(false);
const estadoEsl = ref(null);
const consultaEsl = ref(null);
const referenciaEsl = ref('');
const modoEsl = ref('parcial');
const camposEsl = ref(['nome', 'telefone']);
const processandoAux = ref(false);
const pesquisaCpf = ref('');
const acessoPersistido = ref('');
let carregamentoSerial = 0;
const filialTexto = (id) => filiaisReais.value.find(f=>f.id===Number(id))?.nome || (id ? `Filial #${id}` : 'Sem filial');

const secoesAvancadas = [
  { id: 'motorista', nome: 'Motorista', descricao: 'CNH, categoria e informações do motorista', icone: Truck },
  { id: 'contatos', nome: 'Contatos', descricao: 'Telefones, e-mails e contatos de referência', icone: ContactRound },
  { id: 'enderecos', nome: 'Endereços', descricao: 'Endereços da pessoa', icone: MapPin },
  { id: 'vinculos', nome: 'Vínculos profissionais', descricao: 'Empresa, função e período', icone: BriefcaseBusiness },
  { id: 'financeiro', nome: 'Dados bancários e PIX', descricao: 'Contas e chaves PIX', icone: Wallet },
  { id: 'fiscal', nome: 'Informações adicionais', descricao: 'Dados complementares do cadastro', icone: FileText },
  { id: 'notificacoes', nome: 'Notificações', descricao: 'Preferências de avisos', icone: Bell },
];
const perfisAcesso = ['admin', 'porteiro', 'motorista'];
function rotuloPerfil(perfil) { return ({admin:'Administrador', porteiro:'Porteiro', motorista:'Motorista'})[perfil] || perfil; }
const titulo = computed(() => idEdicao.value ? 'Editar pessoa' : 'Nova pessoa');
const cpfDocumentoPessoa = computed(() => String(editor.value.documentos.find(d => d.tipo === 'CPF')?.numero || '').replace(/\D/g, ''));
const cpfAcessoEfetivo = computed(() => String(cpfDocumentoPessoa.value || editor.value.acesso.identificador || '').replace(/\D/g, ''));
const possuiAcessoIncompleto = computed(() => editor.value.acesso.habilitado && (!cpfAcessoEfetivo.value.match(/^\d{11}$/) || !editor.value.acesso.papeis.length));
function assinaturaAcesso(acesso = {}) {
  return JSON.stringify({
    habilitado: Boolean(acesso.habilitado),
    identificador: String(acesso.identificador || '').replace(/\D/g, ''),
    papeis: [...(acesso.papeis || [])].map(String).sort(),
    filiais: [...(acesso.filiais || [])].map(Number).filter(Number.isFinite).sort((a,b)=>a-b),
    usuario_id: acesso.usuario_id ? Number(acesso.usuario_id) : null,
  });
}
const acessoAlterado = computed(() => assinaturaAcesso(editor.value.acesso) !== acessoPersistido.value);
const salvarIncluiAcesso = computed(() => acessoAlterado.value && (editor.value.acesso.habilitado || Boolean(editor.value.acesso.usuario_id)));

function limparNullable(v) { return v === '' || v === undefined ? null : v; }
function listaApi(itens, campos) {
  return (itens||[]).map(x=>Object.fromEntries(campos.map(k=>[k,limparNullable(x[k])])));
}
function corpoPessoa() {
  const p=editor.value;
  const chavesMotorista=['categoriaCnh','registroCnh','emissaoCnh','primeiraHabilitacao',
    'ufCnh','vinculo','prestadorServicoId','rntrc','validadeRntrc','toxValidade','moppValidade','observacoes'];
  const temDadosMotorista=Boolean(p.motorista.habilitado || p.motorista.ear ||
    chavesMotorista.some(k=>String(p.motorista[k] ?? '').trim()) || abaOrigem.value==='motoristas');
  return {
    nome: limparNullable(p.nome?.trim()), nomeSocial: limparNullable(p.nomeSocial?.trim()),
    observacoes: limparNullable(p.observacoes), ativo: Boolean(p.ativo),
    lotacao:{responsavel: p.lotacao.responsavel === '' ? null : Number(p.lotacao.responsavel)},
    documentos:(p.documentos||[]).filter(d=>String(d.numero||'').trim()).map(d=>({
      tipo:d.tipo, numero:d.numero.trim(), ...(d.tipo==='CNH'?{validade:limparNullable(d.validade)}:{})
    })),
    enderecos:listaApi(p.enderecos,['etiqueta','tipo','principal','cep','logradouro','numero','complemento','bairro','cidade','uf','latitude','longitude'])
      .map(e=>({...e,latitude:limparNullable(e.latitude),longitude:limparNullable(e.longitude),uf:limparNullable(e.uf)?.toUpperCase()})),
    contatos:listaApi(p.contatos,['nome','tipo','valor','observacao']),
    vinculos:listaApi(p.vinculos,['empresa','funcao','filial','tipo','dataInicio','dataFim']),
    ...(temDadosMotorista?{motorista:Object.fromEntries(['habilitado','categoriaCnh','registroCnh','emissaoCnh','primeiraHabilitacao',
      'ufCnh','ear','vinculo','prestadorServicoId','rntrc','validadeRntrc','toxValidade','moppValidade','observacoes']
      .map(k=>[k,typeof p.motorista[k]==='boolean'?p.motorista[k]:limparNullable(p.motorista[k])]))}:{ }),
    contas:listaApi(p.contas,['banco','tipo','agencia','conta','digito','titular','cpfCnpj','ativo']),
    pix:listaApi(p.pix,['tipo','chave','descricao']),
    preferencias:{...p.preferencias,observacoes:limparNullable(p.preferencias.observacoes)},
    fiscal:Object.fromEntries(['pisPasep','inscricaoEstadual','estrangeiro','observacaoCte','observacaoColeta']
      .map(k=>[k,limparNullable(p.fiscal[k])])),
  };
}
async function carregar() {
  const seq=++carregamentoSerial;
  erro.value=''; semRegistro.value=false; carregando.value=true;
  try {
    // Sem valores estáticos: matrizes disponíveis vêm do backend.
    const filiais=await listarFiliais();if(seq!==carregamentoSerial)return;
    filiaisReais.value=filiais;

    // Prestadores enriquecem apenas o vínculo de motoristas terceiros/agregados.
    // A indisponibilidade desse cadastro nunca pode impedir a abertura da ficha da Pessoa.
    prestadoresTransporte.value=[];
    try {
      const prestadores=await listarCadastro('prestadores-servico',{tipo_prestador:'transporte',ativo:1,por_pagina:100});
      if(seq!==carregamentoSerial)return;
      prestadoresTransporte.value=prestadores.data || [];
    } catch (_) {
      if(seq!==carregamentoSerial)return;
      prestadoresTransporte.value=[];
    }

    const pessoa=idEdicao.value?await consultarPessoa(idEdicao.value):null;
    if(seq!==carregamentoSerial)return;
    editor.value=normalizarPessoa(pessoa || criarPessoa({origem:abaOrigem.value}));
    editor.value.documentos=(editor.value.documentos||[]).map(d=>({ ...d, id:d.id||crypto.randomUUID() }));
    for(const campo of ['enderecos','contatos','vinculos','contas','pix'])
      editor.value[campo]=(editor.value[campo]||[]).map(d=>({ ...d, id:d.id||crypto.randomUUID() }));
    persistidoId.value=pessoa?.id||null;
    editor.value.acesso.identificador=pessoa?.acesso?.identificador||'';
    fotoServidor.value=pessoa?.foto_url||'';
    temFotoRemota.value=Boolean(pessoa?.foto_key);
    liberarFoto(); arquivoFoto.value=null; removerFotoPendente.value=false;
    consultaEsl.value=null; pesquisaCpf.value='';
    estadoEsl.value=pessoa?.id?await estadoEslPessoa(pessoa.id):null;
    acessoPersistido.value=assinaturaAcesso(editor.value.acesso);
    mudancas.value=false;
  }catch(e){if(seq===carregamentoSerial){erro.value=falhaCadastro(e);semRegistro.value=Boolean(idEdicao.value);}}
  finally{if(seq===carregamentoSerial)carregando.value=false;}
}
watch(()=>[route.params.id,route.query.origem],carregar,{immediate:true});
watch(editor,()=>{mudancas.value=true;},{deep:true});
watch(cpfDocumentoPessoa, (cpf) => {
  if (editor.value.acesso.habilitado && cpf && editor.value.acesso.identificador !== cpf) editor.value.acesso.identificador = cpf;
});
watch(() => editor.value.acesso.habilitado, (habilitado) => {
  if (habilitado && cpfDocumentoPessoa.value) editor.value.acesso.identificador = cpfDocumentoPessoa.value;
});
onBeforeUnmount(liberarFoto);
function liberarFoto(){if(fotoPreview.value)URL.revokeObjectURL(fotoPreview.value);fotoPreview.value='';}
function selecionarFoto(ev){const arq=ev.target.files?.[0];if(!arq)return;
  if(!['image/jpeg','image/png','image/webp'].includes(arq.type)||arq.size>5*1024*1024){
    erro.value='Foto permitida: JPG, PNG ou WEBP com até 5 MB.';ev.target.value='';return;
  }
  arquivoFoto.value=arq;removerFotoPendente.value=false;liberarFoto();fotoPreview.value=URL.createObjectURL(arq);
  editor.value.fotoNome=arq.name;aviso.value='Foto selecionada. O envio ao R2 ocorrerá após salvar o cadastro.';
}
function retirarFoto(){liberarFoto();arquivoFoto.value=null;removerFotoPendente.value=temFotoRemota.value;
  editor.value.fotoNome='';fotoServidor.value='';if(imagemInput.value)imagemInput.value.value='';}
function expandir(id) {
  paineisAbertos.value = paineisAbertos.value.includes(id) ? paineisAbertos.value.filter(s => s !== id) : [...paineisAbertos.value, id];
}
function alternarPerfil(papel) {
  const lista = editor.value.acesso.papeis;
  editor.value.acesso.papeis = lista.includes(papel) ? lista.filter(p => p !== papel) : [...lista, papel];
}
function adicionar(campo, factory) { editor.value[campo].push(factory()); }
function retirar(campo, id) { editor.value[campo] = editor.value[campo].filter(item => item.id !== id); }
function alternarFilialVisivel(codigo) {
  const lista = editor.value.acesso.filiais;
  editor.value.acesso.filiais = lista.includes(codigo) ? lista.filter(x => x !== codigo) : [...lista, codigo];
}
function mudarMatriz() {
  // Matriz não concede visibilidade nem autoriza empenho em outra filial.
  editor.value.acesso.filiais = editor.value.acesso.filiais.filter(x => x !== editor.value.lotacao.responsavel);
}
const cnhDocumento = computed(() => editor.value.documentos.find(d => d.tipo === 'CNH') || null);
const exigePrestadoraTransporte = computed(() => ['Terceiro','Agregado'].includes(editor.value.motorista.vinculo));
function adicionarCnh() {
  if (!cnhDocumento.value) {
    editor.value.documentos.push({ ...documentoVazio(), tipo: 'CNH' });
  }
  // CNH é editada nos Dados básicos; motorista somente consulta.
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function voltar() { router.push({ name: 'cadastros-item', params: { tipo: abaOrigem.value==='clientes'?'clientes':'pessoas' }, query: { aba: abaOrigem.value==='clientes'?'todos':abaOrigem.value } }); }
function corpoAcesso() {
  const a=editor.value.acesso;
  return { habilitado:Boolean(a.habilitado), ...(a.habilitado?{
    cpf:cpfAcessoEfetivo.value,
    papeis:[...(a.papeis||[])],
    filiais_visiveis:(a.filiais||[]).map(Number).filter(Number.isFinite),
  }:{}) };
}
async function persistirAcesso(id) {
  if(editor.value.acesso.habilitado && possuiAcessoIncompleto.value){
    throw new Error('Adicione um CPF válido em Documentos e selecione ao menos um perfil de acesso.');
  }
  const payload=corpoAcesso();
  const resposta=await configurarAcessoPessoa(id,payload);
  const pessoaAtualizada=await consultarPessoa(id);
  const acessoApi={...editor.value.acesso,...(pessoaAtualizada.acesso||{}),
    identificador:pessoaAtualizada.acesso?.identificador||'',filiais:pessoaAtualizada.acesso?.filiais||[]};
  if(payload.habilitado){
    const esperado=[...(payload.papeis||[])].map(String).sort().join('|');
    const recebido=[...(acessoApi.papeis||[])].map(String).sort().join('|');
    if(esperado!==recebido) throw new Error('Não foi possível confirmar os perfis de acesso salvos. Atualize a ficha e tente novamente.');
  }
  editor.value.acesso=acessoApi;
  acessoPersistido.value=assinaturaAcesso(acessoApi);
  return resposta;
}
async function salvar(){
  if(carregando.value)return;
  if(editor.value.motorista.habilitado && exigePrestadoraTransporte.value && !editor.value.motorista.prestadorServicoId){
    erro.value='Selecione a empresa de transporte responsável por este motorista.';
    return;
  }
  if(salvarIncluiAcesso.value && editor.value.acesso.habilitado && possuiAcessoIncompleto.value){
    erro.value='Para liberar o acesso, adicione um CPF válido em Documentos e selecione ao menos um perfil.';
    return;
  }
  if(salvarIncluiAcesso.value && editor.value.acesso.usuario_id && !editor.value.acesso.habilitado){
    if(!window.confirm('Salvar também vai desativar este acesso e revogar as sessões atuais. Continuar?'))return;
  }
  carregando.value=true;erro.value='';aviso.value='';
  try{
    const devePersistirAcesso=salvarIncluiAcesso.value;
    const pessoa=await gravarPessoa(corpoPessoa(),persistidoId.value);
    persistidoId.value=pessoa.id;editor.value.id=pessoa.id;
    const falhas=[];

    // Acesso é independente da foto: uma falha de CORS/R2 nunca pode impedir papéis como "motorista" de serem gravados.
    if(devePersistirAcesso){
      try{
        const resposta=await persistirAcesso(pessoa.id);
        aviso.value='Pessoa e acesso salvos.';
      }catch(e){
        falhas.push(`acesso NÃO atualizado: ${falhaCadastro(e)}`);
      }
    }

    // Foto é independente: se falhar, Pessoa e eventual acesso já permanecem salvos.
    if(arquivoFoto.value){
      try{const r=await enviarFotoPessoa(pessoa.id,arquivoFoto.value);arquivoFoto.value=null;
        fotoServidor.value=r.url;temFotoRemota.value=true;liberarFoto();removerFotoPendente.value=false;
        window.dispatchEvent(new CustomEvent('rotamaxi:pessoa-foto-atualizada',{detail:{pessoaId:pessoa.id,url:r.url}}));
      }catch(e){falhas.push(`foto NÃO confirmada no R2: ${falhaCadastro(e)}`);}
    } else if(removerFotoPendente.value){
      try{await removerFotoPessoa(pessoa.id);removerFotoPendente.value=false;temFotoRemota.value=false;fotoServidor.value='';
        window.dispatchEvent(new CustomEvent('rotamaxi:pessoa-foto-atualizada',{detail:{pessoaId:pessoa.id,url:''}}));}
      catch(e){falhas.push(`remoção da foto falhou: ${falhaCadastro(e)}`);}
    }

    if(falhas.length){
      erro.value=`Pessoa #${pessoa.id} salva. ${falhas.join(' · ')}. Os itens que deram certo foram mantidos; corrija apenas o pendente e salve novamente.`;
      return;
    }
    mudancas.value=false;
    await router.push({name:'cadastros-item',params:{tipo:abaOrigem.value==='clientes'?'clientes':'pessoas'},query:{aba:abaOrigem.value==='clientes'?'todos':abaOrigem.value,salvo:'1'}});
  }catch(e){erro.value=falhaCadastro(e);}finally{carregando.value=false;}
}
function cpfAtual(){return String(pesquisaCpf.value||editor.value.documentos.find(d=>d.tipo==='CPF')?.numero||'').replace(/\D/g,'');}
async function buscarEsl(){erro.value='';processandoAux.value=true;consultaEsl.value=null;
  try{consultaEsl.value=await consultarEslCpf(cpfAtual());}
  catch(e){erro.value=falhaCadastro(e);}finally{processandoAux.value=false;}
}
async function acaoEsl(operacao,espelhoId=null){
  const id=persistidoId.value;if(!id){erro.value='Primeiro salve o cadastro da pessoa.';return;}
  erro.value='';aviso.value='';processandoAux.value=true;
  try{
    let resultado;
    if(operacao==='espelho')resultado=await vincularEslPessoa(id,espelhoId,modoEsl.value,camposEsl.value);
    if(operacao==='referencia')resultado=await vincularEslReferencia(id,referenciaEsl.value,modoEsl.value);
    if(operacao==='sincronizar')resultado=await sincronizarEslPessoa(id,camposEsl.value);
    if(operacao==='desvincular'){
      if(!window.confirm('Desvincular do ESL?'))return;
      await desvincularEslPessoa(id);
    }
    estadoEsl.value=await estadoEslPessoa(id);
    if(['espelho','sincronizar'].includes(operacao)){
      const pessoa=await consultarPessoa(id);
      // Campos trazidos pelo ESL preenchem SOMENTE vazios no backend.
      if(!editor.value.nome)editor.value.nome=pessoa.nome||'';
    }
    aviso.value=resultado?.sem_dados?'Espelho ESL ainda não possui dados; cadastro local mantido.':
      `Operação ESL confirmada. ${resultado?.preenchimento?.preenchidos?.length||resultado?.preenchidos?.length||0} campo(s) local(is) preenchido(s).`;
  }catch(e){erro.value=falhaCadastro(e);}finally{processandoAux.value=false;}
}
</script>

<template>
  <section class="pf" aria-label="Ficha cadastral de pessoa">
    <div class="pf__topo">
      <div>
        <button class="pf__voltar" type="button" @click="voltar"><ArrowLeft :size="17"/> Voltar para Pessoas</button>
        <div class="pf__etiqueta"><UserRound :size="15"/> PESSOAS <span>·</span> FICHA CADASTRAL</div>
        <h1>{{ titulo }}</h1>
      </div>
      <div class="pf__topo-acoes">
        <button type="button" class="pf__botao pf__botao--claro" @click="voltar">Cancelar</button>
        <button type="button" class="pf__botao pf__botao--salvar" :disabled="carregando || semRegistro" @click="salvar"><Check :size="17"/> {{ carregando ? 'Salvando...' : 'Salvar cadastro' }}</button>
      </div>
    </div>
    <div v-if="semRegistro" class="pf__aviso pf__aviso--erro"><CircleHelp :size="19"/> Não foi possível carregar este cadastro. <button type="button" @click="carregar">Tentar novamente</button><button type="button" @click="voltar">Voltar</button></div>
    <template v-else>
      <div v-if="erro" class="pf__aviso pf__aviso--erro" role="alert">{{ erro }}</div>
      <div v-if="aviso" class="pf__aviso pf__aviso--ok" role="status">{{ aviso }} <button type="button" aria-label="Fechar aviso" @click="aviso = ''"><X :size="16"/></button></div>
      <section class="pf__painel" aria-labelledby="titulo-basico">
            <div class="pf__cabecalho"><div class="pf__icone"><UserRound :size="20"/></div><div><h2 id="titulo-basico">1. Dados básicos</h2><p>Identificação, foto e documentos.</p></div></div>
            <div class="pf__conteudo">
              <div class="pf__basicos">
                <div class="pf__avatar-area">
                  <div class="pf__avatar" aria-label="Foto da pessoa"><img v-if="fotoPreview || fotoServidor" :src="fotoPreview || fotoServidor" alt="Prévia da fotografia"/><Camera v-else :size="31"/></div>
                  <input ref="imagemInput" class="pf__oculto" type="file" accept="image/*" @change="selecionarFoto"/>
                  <button type="button" class="pf__botao pf__botao--claro" @click="imagemInput?.click()"><UploadCloud :size="15"/> Escolher foto</button>
                  <button v-if="(arquivoFoto || fotoServidor || temFotoRemota)" type="button" class="pf__foto-remover" @click="retirarFoto"><ImageOff :size="14"/> Remover</button>
                  <small v-if="editor.fotoNome" :title="editor.fotoNome">{{ editor.fotoNome }}</small>
                  <small v-else>Sem foto</small>
                </div>
                <div class="pf__grid pf__grid--2">
                  <label class="pf__campo pf__campo--full">Nome completo<input v-model="editor.nome" type="text" placeholder="Nome da pessoa" autocomplete="name"/></label>
                  <label class="pf__campo">Situação cadastral<select v-model="editor.ativo"><option :value="true">Ativo</option><option :value="false">Inativo</option></select></label>

                </div>
              </div>
              <div class="pf__subtitulo"><div><FileBadge :size="18"/> <strong>Documentos</strong><small>CPF, RG, CNH, passaporte e outros</small></div><button type="button" class="pf__link-btn" @click="adicionar('documentos', documentoVazio)"><Plus :size="16"/> Documento</button></div>
              <div v-if="!editor.documentos.length" class="pf__sem-itens">Nenhum documento adicionado.</div>
              <div v-for="(doc, indice) in editor.documentos" :key="doc.id" class="pf__repetivel">
                <div class="pf__repetivel-topo"><span>Documento {{ indice + 1 }}</span><button type="button" class="pf__lixeira" :aria-label="`Remover documento ${indice + 1}`" @click="retirar('documentos', doc.id)"><Trash2 :size="16"/></button></div>
                <div class="pf__grid pf__grid--4">
                  <label class="pf__campo">Tipo<select v-model="doc.tipo"><option v-for="tipo in ['CPF','CNPJ','RG','CNH','Passaporte','RNE/RNM','PIS/PASEP','Outro']" :key="tipo">{{ tipo }}</option></select></label>
                  <label class="pf__campo pf__campo--2">Número<input v-model="doc.numero" type="text" placeholder="Número do documento"/></label>
                  <label v-if="doc.tipo === 'CNH'" class="pf__campo">Validade da CNH<input v-model="doc.validade" type="date"/></label>
                </div>
              </div>
            </div>
          </section>
      <section class="pf__painel" aria-labelledby="titulo-filial">
  <div class="pf__cabecalho">
    <div class="pf__icone pf__icone--azul"><Building2 :size="20"/></div>
    <div><h2 id="titulo-filial">2. Matriz e visibilidade</h2><p>Defina a filial principal e as demais filiais que esta pessoa poderá visualizar.</p></div>
  </div>
  <div class="pf__conteudo">
    <label class="pf__campo">Filial principal
      <select v-model="editor.lotacao.responsavel" @change="mudarMatriz">
        <option value="">Não definida</option>
        <option v-for="filial in filiaisReais" :key="filial.id" :value="filial.id">{{ filial.codigo }} · {{ filial.nome }}</option>
      </select>
    </label>
    <div class="pf__rotulo-grupo">Filiais com visibilidade</div>
    <div class="pf__perfis">
      <label v-for="filial in filiaisReais.filter(f => f.id !== editor.lotacao.responsavel)" :key="filial.id" class="pf__chip" :class="{'pf__chip--ativo':editor.acesso.filiais.includes(filial.id)}">
        <input type="checkbox" :checked="editor.acesso.filiais.includes(filial.id)" @change="alternarFilialVisivel(filial.id)"/>
        {{ filial.codigo }} · {{ filial.nome }}
      </label>
    </div>
    <div v-if="filiaisReais.length <= 1" class="pf__sem-itens">Nenhuma outra filial disponível para seleção.</div>
  </div>
</section>
      <div class="pf__avancado-titulo"><div><h2>3. Dados avançados</h2><p>Informações complementares da pessoa.</p></div></div>
      <div class="pf__acordioes">
        <section v-for="secao in secoesAvancadas" :key="secao.id" class="pf__painel pf__accordion">
          <button type="button" class="pf__accordion-btn" :aria-expanded="paineisAbertos.includes(secao.id)" @click="expandir(secao.id)"><span class="pf__icone"><component :is="secao.icone" :size="20"/></span><span class="pf__accordion-texto"><strong>{{ secao.nome }}</strong><small>{{ secao.descricao }}</small></span><span v-if="secao.id === 'motorista'" class="pf__mini-status">{{ editor.motorista.habilitado ? 'Habilitado' : 'Desativado' }}</span><ChevronDown :size="18" :class="{'pf__girado':paineisAbertos.includes(secao.id)}"/></button>
          <div v-if="paineisAbertos.includes(secao.id)" class="pf__accordion-conteudo">
            <template v-if="secao.id === 'enderecos'">
              <div class="pf__grupo-acoes"><p>Endereços cadastrados.</p><button type="button" class="pf__link-btn" @click="adicionar('enderecos', enderecoVazio)"><Plus :size="16"/> Endereço</button></div>
              <div v-if="!editor.enderecos.length" class="pf__sem-itens">Nenhum endereço adicionado.</div>
              <div v-for="(end, i) in editor.enderecos" :key="end.id" class="pf__repetivel"><div class="pf__repetivel-topo"><span>Endereço {{ i + 1 }}</span><label class="pf__check"><input v-model="end.principal" type="checkbox" @change="end.principal && editor.enderecos.filter(e => e.id !== end.id).forEach(e => e.principal = false)"/> Principal</label><button type="button" class="pf__lixeira" @click="retirar('enderecos', end.id)"><Trash2 :size="16"/></button></div>
              <div class="pf__grid pf__grid--4">
                <label class="pf__campo">Identificação<input v-model="end.etiqueta" placeholder="Casa, trabalho, outro"/></label><label class="pf__campo">Tipo<select v-model="end.tipo"><option>Residencial</option><option>Comercial</option><option>Outro</option></select></label><label class="pf__campo">CEP<input v-model="end.cep" inputmode="numeric" placeholder="00000-000"/></label><label class="pf__campo">UF<input v-model="end.uf" maxlength="2" placeholder="SP"/></label>
                <label class="pf__campo pf__campo--2">Logradouro<input v-model="end.logradouro" placeholder="Rua, avenida..."/></label><label class="pf__campo">Número<input v-model="end.numero"/></label><label class="pf__campo">Complemento<input v-model="end.complemento"/></label>
                <label class="pf__campo">Bairro<input v-model="end.bairro"/></label><label class="pf__campo pf__campo--2">Cidade<input v-model="end.cidade"/></label><label class="pf__campo">Latitude<input v-model="end.latitude" placeholder="Opcional"/></label><label class="pf__campo">Longitude<input v-model="end.longitude" placeholder="Opcional"/></label>
              </div></div>
            </template>
            <template v-else-if="secao.id === 'contatos'">
              <div class="pf__grupo-acoes"><p>Contatos cadastrados.</p><button type="button" class="pf__link-btn" @click="adicionar('contatos', contatoVazio)"><Plus :size="16"/> Contato</button></div>
              <div v-if="!editor.contatos.length" class="pf__sem-itens">Nenhum contato adicionado.</div>
              <div v-for="(cont, i) in editor.contatos" :key="cont.id" class="pf__repetivel"><div class="pf__repetivel-topo"><span>Contato {{ i+1 }}</span><button type="button" class="pf__lixeira" @click="retirar('contatos',cont.id)"><Trash2 :size="16"/></button></div><div class="pf__grid pf__grid--4"><label class="pf__campo">Tipo<select v-model="cont.tipo"><option>Telefone</option><option>Celular</option><option>WhatsApp</option><option>E-mail</option><option>Contato de emergência</option><option>Outro</option></select></label><label class="pf__campo">Nome / referência<input v-model="cont.nome"/></label><label class="pf__campo">Contato<input v-model="cont.valor"/></label><label class="pf__campo">Observação<input v-model="cont.observacao"/></label></div></div>
            </template>
            <template v-else-if="secao.id === 'motorista'">
              <div class="pf__habilitar"><div><strong>É motorista?</strong></div><label class="pf__switch"><input v-model="editor.motorista.habilitado" type="checkbox"/><span/><b>{{ editor.motorista.habilitado ? 'Sim' : 'Não' }}</b></label></div>
              <div v-if="editor.motorista.habilitado" class="pf__cnh-resumo"><span><strong>CNH</strong><template v-if="cnhDocumento"> · {{ cnhDocumento.numero || 'Número não informado' }} · validade {{ cnhDocumento.validade || 'não informada' }}</template></span><button v-if="!cnhDocumento" type="button" class="pf__link-btn" @click="adicionarCnh"><Plus :size="15"/> Adicionar CNH em Documentos</button></div>
              <div v-if="editor.motorista.habilitado" class="pf__grid pf__grid--4">
                <label class="pf__campo">Categoria da CNH<select v-model="editor.motorista.categoriaCnh"><option value="">Não informada</option><option v-for="cat in ['A','B','AB','C','AC','D','AD','E','AE']" :key="cat">{{ cat }}</option></select></label>
                <label class="pf__campo">Vínculo<select v-model="editor.motorista.vinculo" @change="!exigePrestadoraTransporte && (editor.motorista.prestadorServicoId='')"><option value="">Não informado</option><option v-for="v in ['Próprio','Terceiro','Agregado','Freelancer','Temporário']" :key="v">{{ v }}</option></select></label>
                <label v-if="exigePrestadoraTransporte" class="pf__campo">Empresa de transporte<select v-model="editor.motorista.prestadorServicoId" required><option value="">Selecionar empresa</option><option v-for="empresa in prestadoresTransporte" :key="empresa.id" :value="empresa.id">{{ empresa.nome }}</option></select></label>
                <label class="pf__campo">RNTRC<input v-model="editor.motorista.rntrc" placeholder="Opcional"/></label>
                <label class="pf__campo pf__campo--2">Observações do motorista<input v-model="editor.motorista.observacoes" placeholder="Restrições, certificados, aptidão..."/></label>
                <label class="pf__check pf__campo--full"><input v-model="editor.motorista.ear" type="checkbox"/> EAR — Exerce atividade remunerada</label>
              </div>
            </template>
            <template v-else-if="secao.id === 'vinculos'">
              <div class="pf__grupo-acoes"><p>Histórico profissional.</p><button type="button" class="pf__link-btn" @click="adicionar('vinculos', vinculoVazio)"><Plus :size="16"/> Vínculo</button></div>
              <div v-if="!editor.vinculos.length" class="pf__sem-itens">Nenhum vínculo profissional cadastrado.</div>
              <div v-for="(v, i) in editor.vinculos" :key="v.id" class="pf__repetivel"><div class="pf__repetivel-topo"><span>Vínculo {{ i+1 }}</span><button type="button" class="pf__lixeira" @click="retirar('vinculos',v.id)"><Trash2 :size="16"/></button></div><div class="pf__grid pf__grid--4"><label class="pf__campo">Empresa<input v-model="v.empresa"/></label><label class="pf__campo">Filial no período (histórico)<input v-model="v.filial"/></label><label class="pf__campo">Função<input v-model="v.funcao"/></label><label class="pf__campo">Tipo<select v-model="v.tipo"><option value="">Selecionar</option><option v-for="t in ['Próprio','Terceiro','Agregado','Autônomo','Freelancer','Temporário','Prestador']" :key="t">{{ t }}</option></select></label><label class="pf__campo">Início<input v-model="v.dataInicio" type="date"/></label><label class="pf__campo">Fim<input v-model="v.dataFim" type="date"/></label></div></div>
            </template>
            <template v-else-if="secao.id === 'financeiro'">
              <div class="pf__grupo-acoes"><p>Dados bancários.</p><button type="button" class="pf__link-btn" @click="adicionar('contas', contaVazia)"><Plus :size="16"/> Conta bancária</button></div><div v-if="!editor.contas.length" class="pf__sem-itens">Nenhuma conta cadastrada.</div>
              <div v-for="(c,i) in editor.contas" :key="c.id" class="pf__repetivel"><div class="pf__repetivel-topo"><span>Conta {{ i+1 }}</span><button type="button" class="pf__lixeira" @click="retirar('contas',c.id)"><Trash2 :size="16"/></button></div><div class="pf__grid pf__grid--4"><label class="pf__campo">Banco<input v-model="c.banco"/></label><label class="pf__campo">Tipo<select v-model="c.tipo"><option value="">Selecionar</option><option>Corrente</option><option>Poupança</option><option>Pagamento</option></select></label><label class="pf__campo">Agência<input v-model="c.agencia"/></label><label class="pf__campo">Conta<input v-model="c.conta"/></label><label class="pf__campo">Dígito<input v-model="c.digito"/></label><label class="pf__campo">Nome titular<input v-model="c.titular"/></label><label class="pf__campo">CPF/CNPJ titular<input v-model="c.cpfCnpj"/></label><label class="pf__check"><input v-model="c.ativo" type="checkbox"/> Conta ativa</label></div></div>
              <div class="pf__grupo-acoes pf__grupo-acoes--distante"><p><strong>Chaves PIX</strong></p><button type="button" class="pf__link-btn" @click="adicionar('pix', pixVazio)"><Plus :size="16"/> Chave PIX</button></div><div v-if="!editor.pix.length" class="pf__sem-itens">Nenhuma chave PIX cadastrada.</div>
              <div v-for="(p,i) in editor.pix" :key="p.id" class="pf__repetivel"><div class="pf__repetivel-topo"><span>Chave PIX {{ i+1 }}</span><button type="button" class="pf__lixeira" @click="retirar('pix',p.id)"><Trash2 :size="16"/></button></div><div class="pf__grid pf__grid--4"><label class="pf__campo">Tipo<select v-model="p.tipo"><option>CPF</option><option>CNPJ</option><option>E-mail</option><option>Telefone</option><option>Aleatória</option></select></label><label class="pf__campo pf__campo--2">Chave<input v-model="p.chave"/></label><label class="pf__campo">Descrição<input v-model="p.descricao"/></label></div></div>
            </template>
            <template v-else-if="secao.id === 'notificacoes'"><div class="pf__grid pf__grid--2"><label class="pf__check"><input v-model="editor.preferencias.receberOcorrencias" type="checkbox"/> Receber avisos de ocorrências</label><label class="pf__check"><input v-model="editor.preferencias.porEmail" type="checkbox"/> Avisos por e-mail</label><label class="pf__check"><input v-model="editor.preferencias.porAplicativo" type="checkbox"/> Avisos no aplicativo</label><label class="pf__campo pf__campo--full">Preferências e observações<textarea v-model="editor.preferencias.observacoes" rows="2"/></label></div></template>
            <template v-else-if="secao.id === 'fiscal'"><div class="pf__grid pf__grid--4"><label class="pf__campo pf__campo--2">Nome social / conhecido como<input v-model="editor.nomeSocial" placeholder="Opcional"/></label><label class="pf__campo pf__campo--2">Observações gerais<textarea v-model="editor.observacoes" rows="2"/></label><label class="pf__campo">PIS / PASEP<input v-model="editor.fiscal.pisPasep"/></label><label class="pf__campo">Inscrição estadual<input v-model="editor.fiscal.inscricaoEstadual"/></label><label class="pf__campo">Documento estrangeiro<input v-model="editor.fiscal.estrangeiro"/></label><label class="pf__campo pf__campo--2">Observação automática CT-e<textarea v-model="editor.fiscal.observacaoCte" rows="2"/></label><label class="pf__campo pf__campo--2">Observação automática de coleta<textarea v-model="editor.fiscal.observacaoColeta" rows="2"/></label></div></template>
          </div>
        </section>
      </div>
      <section class="pf__painel" aria-labelledby="titulo-acesso">
  <div class="pf__cabecalho">
    <div class="pf__icone pf__icone--azul"><LockKeyhole :size="20"/></div>
    <div><h2 id="titulo-acesso">4. Acesso ao sistema</h2><p>Defina se a pessoa poderá entrar no sistema e quais perfis terá.</p></div>
    <label class="pf__switch"><input v-model="editor.acesso.habilitado" type="checkbox"/><span/><b>{{ editor.acesso.habilitado ? 'Sim' : 'Não' }}</b></label>
  </div>
  <div v-if="editor.acesso.habilitado" class="pf__conteudo">
    <div class="pf__rotulo-grupo">Perfis de acesso</div>
    <div class="pf__perfis">
      <label v-for="perfil in perfisAcesso" :key="perfil" class="pf__chip" :class="{ 'pf__chip--ativo': editor.acesso.papeis.includes(perfil) }">
        <input type="checkbox" :checked="editor.acesso.papeis.includes(perfil)" @change="alternarPerfil(perfil)"/>
        {{ rotuloPerfil(perfil) }}
      </label>
    </div>
    <div v-if="!cpfAcessoEfetivo" class="pf__pendencia"><CircleHelp :size="16"/> Adicione o CPF da pessoa em Documentos para liberar o acesso.</div>
    <div v-else class="pf__acesso-cpf"><span>CPF de acesso</span><strong>{{ cpfAcessoEfetivo }}</strong></div>
    <div v-if="possuiAcessoIncompleto && cpfAcessoEfetivo" class="pf__pendencia"><CircleHelp :size="16"/> Selecione ao menos um perfil de acesso.</div>
  </div>
</section>
      <section class="pf__painel pf__esl-painel">
        <div class="pf__cabecalho"><div class="pf__icone pf__icone--azul"><GitBranch :size="20"/></div><div><h2>5. Vínculo ESL</h2><p>Localize e vincule o cadastro correspondente no ESL.</p></div></div>
        <div class="pf__conteudo">
          <p v-if="estadoEsl?.vinculado" class="pf__pendencia">Vínculo ativo: {{ estadoEsl.vinculo?.externo_id }} · {{ estadoEsl.vinculo?.modo }}</p>
          <div class="pf__grid pf__grid--2"><label class="pf__campo">CPF a pesquisar<input v-model="pesquisaCpf" placeholder="CPF ou use documento cadastrado"/></label><button type="button" class="pf__botao pf__botao--claro" :disabled="processandoAux" @click="buscarEsl"><SearchIcon :size="15"/> Buscar no ESL</button></div>
          <div v-if="consultaEsl" class="pf__esl-resultados">
            <p><b>{{ consultaEsl.fontes_esl?.length||0 }}</b> registro(s) encontrado(s) no ESL; <b>{{ consultaEsl.pessoas_rotamaxi?.length||0 }}</b> cadastro(s) com esse CPF.</p>
            <div v-for="f in consultaEsl.fontes_esl" :key="f.espelho_id" class="pf__esl-resultado"><span>{{ f.nome||'Sem nome' }} · ESL #{{ f.id_esl||'sem ID' }} · espelho #{{ f.espelho_id }}</span>
              <button type="button" class="pf__botao pf__botao--claro" :disabled="!persistidoId||processandoAux||estadoEsl?.vinculado" @click="acaoEsl('espelho',f.espelho_id)">Vincular e preencher vazios</button></div>
            <p v-if="!consultaEsl.fontes_esl?.length">Nenhum cadastro localizado para este CPF.</p>
          </div>
          <div class="pf__perfis"><label v-for="campo in ['nome','telefone','endereco','bairro','cidade','uf','cep','latitude','longitude']" :key="campo" class="pf__chip"><input type="checkbox" :checked="camposEsl.includes(campo)" @change="camposEsl=camposEsl.includes(campo)?camposEsl.filter(c=>c!==campo):[...camposEsl,campo]"/> {{ campo }}</label></div>
          <div class="pf__grid pf__grid--2"><label class="pf__campo">Tipo de vínculo<select v-model="modoEsl"><option value="parcial">Parcial</option><option value="completo">Completo</option></select></label><label class="pf__campo">ID ESL / referência<input v-model="referenciaEsl" placeholder="Informe a referência ESL"/></label></div>
          <div class="pf__esl-acoes">
            <button type="button" class="pf__botao pf__botao--claro" :disabled="!persistidoId||!referenciaEsl.trim()||estadoEsl?.vinculado||processandoAux" @click="acaoEsl('referencia')">Vincular referência</button>
            <button type="button" class="pf__botao pf__botao--claro" :disabled="!persistidoId||!estadoEsl?.vinculado||!camposEsl.length||processandoAux" @click="acaoEsl('sincronizar')">Preencher campos vazios</button>
            <button type="button" class="pf__botao pf__botao--claro" :disabled="!persistidoId||!estadoEsl?.vinculado||processandoAux" @click="acaoEsl('desvincular')">Desvincular ESL</button>
          </div>
        </div>
      </section>
      <footer class="pf__rodape">
  <div></div>
  <div>
    <button type="button" class="pf__botao pf__botao--claro" @click="voltar">Cancelar</button>
    <button type="button" class="pf__botao pf__botao--salvar" :disabled="carregando || semRegistro" @click="salvar"><Check :size="18"/> {{ carregando ? 'Salvando...' : 'Salvar cadastro' }}</button>
  </div>
</footer>
    </template>
  </section>
</template>

<style scoped src="@/styles/pages/registrations/people/person_form_page.css"></style>
