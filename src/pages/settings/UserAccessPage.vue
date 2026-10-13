<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Check, ChevronLeft, ChevronRight, CircleAlert, KeyRound, Link2, LockKeyhole, Plus, RefreshCw, Search, ShieldCheck, UserRound, X } from 'lucide-vue-next';
import { consultarPessoa, definirPinUsuario, falhaCadastro, listarUsuarios, vincularUsuarioPessoa } from '@/services/api/registrations.api.js';
import FotoPessoaAvatar from '@/components/all/media/PersonAvatar.vue';

const router = useRouter();
const usuarios = ref([]), pagina = ref(1), total = ref(0), ultimaPagina = ref(1);
const carregando = ref(false), erro = ref(''), sucesso = ref('');
const busca = ref(''), ativo = ref('todos'), papel = ref('todos'), vinculo = ref('todos');
const modal = ref(''), usuarioAtual = ref(null), pessoaId = ref(''), pessoaEncontrada = ref(null), pin = ref(''), pinConfirmacao = ref('');
const salvando = ref(false), erroModal = ref('');
let requisicao = 0, debounce = null;
const ativosNaPagina = computed(() => usuarios.value.filter(u => u.ativo).length);
const semFichaNaPagina = computed(() => usuarios.value.filter(u => !u.pessoa_id).length);
const pinValido = computed(() => /^\d{6}$/.test(pin.value) && pin.value === pinConfirmacao.value);

async function carregar() {
  const id = ++requisicao;
  carregando.value = true;
  erro.value = '';
  try {
    const filtros = { pagina: pagina.value, por_pagina: 20 };
    if (busca.value.trim()) filtros.busca = busca.value.trim();
    if (ativo.value !== 'todos') filtros.ativo = ativo.value === 'ativo' ? 1 : 0;
    if (papel.value !== 'todos') filtros.papel = papel.value;
    if (vinculo.value !== 'todos') filtros.vinculado = vinculo.value === 'sim' ? 1 : 0;
    const resposta = await listarUsuarios(filtros);
    if (id !== requisicao) return;
    usuarios.value = resposta.data;
    total.value = Number(resposta.total || 0);
    ultimaPagina.value = Number(resposta.last_page || 1);
  } catch (e) {
    if (id !== requisicao) return;
    erro.value = falhaCadastro(e);
    usuarios.value = [];
    total.value = 0;
    ultimaPagina.value = 1;
  } finally { if (id === requisicao) carregando.value = false; }
}
function limpar() { busca.value = ''; ativo.value = 'todos'; papel.value = 'todos'; vinculo.value = 'todos'; pagina.value = 1; carregar(); }
watch([ativo, papel, vinculo], () => { pagina.value = 1; carregar(); });
watch(pagina, carregar);
watch(busca, () => { clearTimeout(debounce); debounce = setTimeout(() => { pagina.value = 1; carregar(); }, 350); });
onBeforeUnmount(() => { ++requisicao; clearTimeout(debounce); });
function abrirModal(tipo, usuario) {
  modal.value = tipo;
  usuarioAtual.value = usuario;
  pessoaId.value = '';
  pessoaEncontrada.value = null;
  pin.value = '';
  pinConfirmacao.value = '';
  erroModal.value = '';
}
function fecharModal() { if (!salvando.value) { pin.value = ''; pinConfirmacao.value = ''; modal.value = ''; } }
async function conferirPessoa() {
  erroModal.value = '';
  pessoaEncontrada.value = null;
  if (!/^\d+$/.test(String(pessoaId.value))) { erroModal.value = 'Informe o ID numérico da Pessoa cadastrada no RotaMaxi.'; return; }
  try { pessoaEncontrada.value = await consultarPessoa(Number(pessoaId.value)); }
  catch (e) { erroModal.value = falhaCadastro(e); }
}
function cpfDaPessoa(p) {
  const doc = (p?.documentos || []).find(d => d.tipo === 'CPF');
  return String(doc?.numero || p?.documento || '').replace(/\D/g, '');
}
const cpfCompativel = computed(() => Boolean(usuarioAtual.value && pessoaEncontrada.value &&
  cpfDaPessoa(pessoaEncontrada.value) === String(usuarioAtual.value.cpf || '').replace(/\D/g, '')));
async function confirmarVinculo() {
  if (salvando.value || !cpfCompativel.value) return;
  if (!window.confirm(`Vincular o login de ${usuarioAtual.value.nome} à Pessoa #${pessoaEncontrada.value.id}? O PIN e as permissões serão preservados.`)) return;
  salvando.value = true; erroModal.value = '';
  try {
    await vincularUsuarioPessoa(usuarioAtual.value.id, pessoaEncontrada.value.id);
    modal.value = '';
    sucesso.value = 'Pessoa vinculada ao login existente. PIN, papel e situação foram preservados.';
    await carregar();
  } catch (e) { erroModal.value = falhaCadastro(e); }
  finally { salvando.value = false; }
}
async function confirmarPin() {
  if (salvando.value || !pinValido.value) return;
  if (!window.confirm(`Definir novo PIN para ${usuarioAtual.value.nome}? Um PIN anterior, se existir, será substituído.`)) return;
  salvando.value = true; erroModal.value = '';
  try {
    await definirPinUsuario(usuarioAtual.value.id, pin.value);
    pin.value = ''; pinConfirmacao.value = '';
    modal.value = '';
    sucesso.value = 'PIN atualizado. Informe o novo PIN ao titular por canal seguro.';
    await carregar();
  } catch (e) { erroModal.value = falhaCadastro(e); }
  finally { salvando.value = false; }
}
function gerenciar(u) { if (u.pessoa_id) router.push({ name: 'pessoa-editar', params: { id: u.pessoa_id }, query: { origem: 'usuarios' } }); }
carregar();
</script>

<template>
<section class="ua">
  <header class="ua__cabecalho">
    <div><small>CADASTROS · ACESSOS</small><h1>Usuários e acessos</h1>
      <p>Gerencie logins, perfis e vínculos com fichas de Pessoa.</p></div>
    <button class="ua__principal" type="button" @click="router.push({name:'pessoa-nova',query:{origem:'usuarios'}})"><Plus :size="17"/> Nova pessoa / acesso</button>
  </header>

  <div v-if="erro" class="ua__mensagem ua__erro" role="alert"><CircleAlert :size="18"/> {{ erro }} <button type="button" @click="carregar">Tentar novamente</button></div>
  <div v-if="sucesso" class="ua__mensagem" role="status"><Check :size="17"/>{{ sucesso }}<button type="button" aria-label="Fechar" @click="sucesso=''"><X :size="15"/></button></div>

  <section class="ua__painel">
    <div class="ua__filtros ua__filtros--topo">
      <label class="ua__pesquisa"><Search :size="17"/><input v-model="busca" placeholder="Buscar por nome ou CPF" type="search"/></label>
      <label>Situação<select v-model="ativo"><option value="todos">Todos</option><option value="ativo">Ativos</option><option value="inativo">Inativos</option></select></label>
      <label>Perfil<select v-model="papel"><option value="todos">Todos</option><option value="admin">Admin</option><option value="motorista">Motorista</option><option value="porteiro">Porteiro</option></select></label>
      <label>Ficha Pessoa<select v-model="vinculo"><option value="todos">Todos</option><option value="sim">Vinculados</option><option value="nao">Sem vínculo</option></select></label>
      <button type="button" @click="limpar">Limpar</button>
      <button type="button" @click="carregar" :disabled="carregando"><RefreshCw :size="15"/> Atualizar</button>
    </div>
    <div class="ua__resumo"><span><b>{{ total }}</b> {{ total===1?'usuário':'usuários' }}</span><span>·</span><span><b>{{ ativosNaPagina }}</b> ativos nesta página</span><span v-if="semFichaNaPagina">· <b>{{ semFichaNaPagina }}</b> sem ficha de Pessoa</span></div>
    <div class="ua__scroll"><table><thead><tr><th>ID</th><th>Nome / CPF</th><th>Perfis</th><th>Situação</th><th>Ficha Pessoa</th><th>PIN</th><th>Ações</th></tr></thead>
      <tbody>
        <tr v-for="u in usuarios" :key="u.id">
          <td class="ua__numero">#{{ u.id }}</td>
          <td><span class="ua__identidade"><FotoPessoaAvatar :pessoa-id="u.pessoa_id" :nome="u.nome" :tamanho="34" quadrado/><span><b>{{ u.nome }}</b><small>{{ u.cpf }}</small></span></span></td>
          <td><span v-if="!u.papeis.length" class="ua__fraco">Sem perfil</span><span v-for="r in u.papeis" v-else :key="r" class="ua__papel">{{ r }}</span></td>
          <td><span class="ua__tag" :class="u.ativo?'ua__tag--ativo':'ua__tag--inativo'">{{ u.ativo?'Ativo':'Inativo' }}</span></td>
          <td><span v-if="u.pessoa_id" class="ua__comficha">Pessoa #{{ u.pessoa_id }}</span><span v-else class="ua__pendente">Sem vínculo</span></td>
          <td><span :class="u.precisa_definir_pin?'ua__pendente':'ua__fraco'">{{ u.precisa_definir_pin?'Pendente':'Configurado' }}</span></td>
          <td class="ua__acoes"><button v-if="u.pessoa_id" type="button" @click="gerenciar(u)">Editar</button><button v-else type="button" @click="abrirModal('vincular',u)"><Link2 :size="14"/> Vincular Pessoa</button><button v-if="u.papeis.length" type="button" @click="abrirModal('pin',u)"><KeyRound :size="14"/> PIN</button></td>
        </tr>
        <tr v-if="carregando"><td colspan="7" class="ua__vazio"><RefreshCw :size="19"/> Carregando...</td></tr>
        <tr v-else-if="!usuarios.length&&!erro"><td colspan="7" class="ua__vazio"><Search :size="22"/> Nenhum usuário corresponde aos filtros.</td></tr>
      </tbody></table></div>
    <footer class="ua__rodape"><span>Página {{ pagina }} de {{ ultimaPagina }}</span><div><button type="button" :disabled="pagina<=1||carregando" @click="pagina--"><ChevronLeft :size="17"/></button><span>{{ pagina }} / {{ ultimaPagina }}</span><button type="button" :disabled="pagina>=ultimaPagina||carregando" @click="pagina++"><ChevronRight :size="17"/></button></div></footer>
  </section>

  <div v-if="modal" class="ua__cortina" @click.self="fecharModal">
    <section class="ua__modal" role="dialog" aria-modal="true" :aria-label="modal==='pin'?'Definir PIN':'Vincular Pessoa'">
      <header><div><small>CONTA #{{ usuarioAtual.id }}</small><h2>{{ modal==='pin'?'Definir PIN':'Vincular ficha de Pessoa' }}</h2></div><button type="button" :disabled="salvando" aria-label="Fechar" @click="fecharModal"><X :size="19"/></button></header>
      <p class="ua__pessoa"><FotoPessoaAvatar :pessoa-id="usuarioAtual.pessoa_id" :nome="usuarioAtual.nome" :tamanho="34" quadrado/> <span><b>{{ usuarioAtual.nome }}</b><br/>CPF {{ usuarioAtual.cpf }}</span></p>
      <div v-if="erroModal" role="alert" class="ua__mensagem ua__erro">{{ erroModal }}</div>
      <template v-if="modal==='vincular'">
        <p>Informe o ID da Pessoa já cadastrada. <b>Os CPFs precisam ser iguais.</b></p>
        <label class="ua__campo">ID da Pessoa <input v-model="pessoaId" type="number" min="1" placeholder="Ex.: 15" @input="pessoaEncontrada=null"/></label>
        <button type="button" class="ua__secundario" :disabled="salvando" @click="conferirPessoa"><Search :size="16"/> Conferir Pessoa</button>
        <div v-if="pessoaEncontrada" class="ua__resultado"><b>{{ pessoaEncontrada.nome||'Sem nome' }} · #{{ pessoaEncontrada.id }}</b><small>CPF: {{ cpfDaPessoa(pessoaEncontrada)||'não cadastrado' }}</small><span :class="cpfCompativel?'ua__ok':'ua__pendente'">{{ cpfCompativel?'CPF compatível':'CPF divergente: vínculo bloqueado' }}</span></div>
        <div class="ua__modalrodape"><button type="button" @click="router.push({name:'pessoa-nova',query:{origem:'usuarios'}})">Criar ficha de Pessoa</button><button type="button" class="ua__principal" :disabled="!cpfCompativel||salvando" @click="confirmarVinculo"><Link2 :size="16"/> {{ salvando?'Vinculando...':'Confirmar vínculo' }}</button></div>
      </template>
      <template v-else>
        <p>Defina um PIN de <b>6 números</b>. Ele não será exibido depois de salvar.</p>
        <label class="ua__campo">Novo PIN<input v-model="pin" inputmode="numeric" type="password" autocomplete="new-password" maxlength="6" placeholder="6 dígitos"/></label>
        <label class="ua__campo">Confirmar PIN<input v-model="pinConfirmacao" inputmode="numeric" type="password" autocomplete="new-password" maxlength="6" placeholder="Repetir PIN"/></label>
        <div class="ua__modalrodape"><button type="button" @click="fecharModal">Cancelar</button><button type="button" class="ua__principal" :disabled="!pinValido||salvando" @click="confirmarPin"><LockKeyhole :size="16"/> {{ salvando?'Salvando...':'Salvar PIN' }}</button></div>
      </template>
    </section>
  </div>
</section>
</template>

<style scoped src="@/styles/pages/settings/user_access_page.css"></style>
