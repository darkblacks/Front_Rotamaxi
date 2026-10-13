<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Activity, Bell, Boxes, ChevronDown, ChevronRight, CircleDollarSign, ClipboardList,
  Database, DoorOpen, FileText, Gauge, LayoutDashboard, Menu, Moon, Package,
  Search, Settings2, ShieldCheck, Smartphone, Sun, TriangleAlert, Truck, Users,
  Warehouse, X, ChartNoAxesColumn, Scale, Link2, UserRound, ContactRound, ArrowRightLeft,
  Building2, Map as MapaIcone, Tags, FileImage, Route as RouteIcon, MonitorCog, LogOut
} from 'lucide-vue-next';
import { menuVisivel, primeiraRotaPermitida } from '@/domain/access/roles.js';
import IndicadorTempoReal from '@/components/all/status/RealtimeIndicator.vue';
import FotoPessoaAvatar from '@/components/all/media/PersonAvatar.vue';
import { secoesCadastro, obterSecaoCadastro, obterAbaCadastro, rotaCadastro } from '@/domain/registrations/navigation.js';
import logoSimbolo from '@/assets/images/brand/rotamaxi-simbolo.png';
import { useAuthStore } from '@/stores/auth.store.js';
import { telaEstreita, useUiStore } from '@/stores/ui.store.js';
import { useTempoRealStore } from '@/stores/realtime.store.js';

const ui = useUiStore();
const auth = useAuthStore();
const tempoReal = useTempoRealStore();
const route = useRoute();
const router = useRouter();
const saindo = ref(false);
const menuUsuarioAberto = ref(false);
const buscaAberta = ref(false);
const termoBusca = ref('');
const inputBusca = ref(null);

const todosModulos = [
  { id: 'visao-geral', rotulo: 'Visão geral', icone: LayoutDashboard, rota: { name: 'visao-geral' } },
  { id: 'operacoes', rotulo: 'Operações', icone: Truck, rota: { name: 'manifestos' } },
  { id: 'cadastros', rotulo: 'Cadastros', icone: Database, rota: { name: 'cadastros-item', params: { tipo: 'pessoas' } } },
  { id: 'financeiro', rotulo: 'Financeiro', icone: CircleDollarSign, rota: { name: 'financeiro' } },
  { id: 'relatorios', rotulo: 'Relatórios', icone: ChartNoAxesColumn, rota: { name: 'relatorios' } },
  { id: 'configuracoes', rotulo: 'Configurações', icone: Settings2, rota: { name: 'configuracoes' } },
];
// Só o administrador vê as demais áreas; os outros papéis trabalham em Operações.
const modulos = computed(() => {
  const lista = auth.ehAdmin ? todosModulos : todosModulos.filter(m => m.id === 'operacoes');
  const primeira = primeiraRotaPermitida(auth.papeis);
  return lista.map(m => (m.id === 'operacoes' && primeira ? { ...m, rota: { name: primeira } } : m));
});
const contexto = computed(() => route.meta.contexto || 'operacoes');
const moduloAtivo = computed(() => modulos.value.find(m => m.id === contexto.value) || todosModulos[1]);
const tituloTela = computed(() => route.meta.titulo || moduloAtivo.value.rotulo);

const cadastros = secoesCadastro.map(item => ({
  id: item.id,
  rotulo: item.nome,
  icone: item.icone,
  rota: rotaCadastro(item.id),
}));
const cadastroAtual = computed(() => obterSecaoCadastro(route.meta.secaoCadastro || route.params.tipo));
const abaAtual = computed(() => obterAbaCadastro(cadastroAtual.value, route.query.aba || route.query.origem));
const abasCadastro = computed(() => cadastroAtual.value.abas);

const ICONES_OPERACOES = {
  'mapa-operacional': MapaIcone, manifestos: FileText, planejamento: ClipboardList, 'fila-portaria': DoorOpen,
  conferencia: Package, recebimentos: Warehouse, ocorrencias: TriangleAlert, 'meu-manifesto': RouteIcon,
  'emprestimos-operacionais': ArrowRightLeft, 'saldo-pallets': Boxes, divergencias: Scale,
};
// Menu Operações filtrado pelo(s) papel(is) do usuário (ver domain/access/roles.js).
const operacoes = computed(() => menuVisivel(auth.papeis).map(item => ({
  id: item.id, rotulo: item.rotulo, icone: ICONES_OPERACOES[item.id], rota: { name: item.rota },
})));
const laterais = computed(() => ({
  'visao-geral': [
    { id: 'visao-geral', rotulo: 'Painel executivo', icone: Gauge, rota: { name: 'visao-geral' } },
    ...operacoes.value.slice(0, 3),
  ],
  operacoes: operacoes.value,
  cadastros,
  financeiro: [{ id: 'financeiro', rotulo: 'Visão financeira', icone: CircleDollarSign, rota: { name: 'financeiro' } }],
  relatorios: [{ id: 'relatorios', rotulo: 'Central de relatórios', icone: ChartNoAxesColumn, rota: { name: 'relatorios' } }],
  configuracoes: [
    { id: 'configuracoes', rotulo: 'Preferências', icone: Settings2, rota: { name: 'configuracoes' } },
    { id: 'dispositivos', rotulo: 'Dispositivos', icone: Smartphone, rota: { name: 'dispositivos' } },
    { id: 'design-system', rotulo: 'Componentes de UI', icone: MonitorCog, rota: { name: 'design-system' } },
  ],
}));
const itensLaterais = computed(() => laterais.value[contexto.value] ?? operacoes.value);
const menuAtivo = computed(() => (route.name === 'cadastros-item' || route.meta.secaoCadastro) ? cadastroAtual.value.id : (route.meta.menu || route.name));
const letraUsuario = computed(() => (auth.nome || 'Usuário').split(/\s+/).slice(0,2).map(n => n[0]).join('').toUpperCase());
const atalhos = computed(() => {
  const termo = termoBusca.value.trim().toLowerCase();
  const todos = [...modulos.value, ...(auth.ehAdmin ? cadastros : []), ...(auth.ehAdmin ? secoesCadastro.flatMap(secao => secao.abas.map(aba => ({ id: `${secao.id}/${aba.id}`, rotulo: `${secao.nome} · ${aba.nome}`, icone: secao.icone, rota: rotaCadastro(secao.id, aba.id) }))) : []), ...operacoes.value];
  return (termo ? todos.filter(i => i.rotulo.toLowerCase().includes(termo)) : todos.slice(0, 8)).slice(0, 10);
});

onMounted(() => {
  tempoReal.conectar(auth.token);
  void auth.carregarPessoaVinculada();
  window.addEventListener('keydown', atalhoTeclado);
});
watch(() => auth.token, token => tempoReal.conectar(token));
watch(() => route.fullPath, () => {
  buscaAberta.value = false;
  menuUsuarioAberto.value = false;
  if (telaEstreita()) ui.recolherAside();
});
onUnmounted(() => {
  tempoReal.desconectar();
  window.removeEventListener('keydown', atalhoTeclado);
});

function atalhoTeclado(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    abrirBusca();
  }
  if (e.key === 'Escape') { buscaAberta.value = false; menuUsuarioAberto.value = false; }
}
function abrirBusca() {
  buscaAberta.value = true;
  setTimeout(() => inputBusca.value?.focus(), 0);
}
function navegar(rota) {
  buscaAberta.value = false;
  termoBusca.value = '';
  router.push(rota);
}
async function sair() {
  if (saindo.value) return;
  saindo.value = true;
  tempoReal.desconectar();
  try { await auth.sair(); }
  finally { saindo.value = false; }
  router.replace({ name: 'login' });
}
</script>

<template>
  <div class="shell" :class="{ 'shell--fechado': ui.asideRecolhido }">
    <header class="shell__topbar">
      <div class="shell__marca" @click="navegar({name:'visao-geral'})" role="link" tabindex="0" @keydown.enter="navegar({name:'visao-geral'})">
        <img :src="logoSimbolo" alt="" class="shell__marca-icon" />
        <div class="shell__marca-texto"><div><b>ROTA</b><b>MAXI</b></div><small>T M S</small></div>
      </div>
      <nav class="shell__modulos" aria-label="Áreas de trabalho">
        <RouterLink v-for="modulo in modulos" :key="modulo.id" :to="modulo.rota" class="shell__modulo" :class="{'shell__modulo--ativo': contexto === modulo.id}" :aria-current="contexto === modulo.id ? 'page' : undefined">
          <component :is="modulo.icone" :size="19" :stroke-width="2" />
          <span>{{ modulo.rotulo }}</span>
        </RouterLink>
      </nav>
      <div class="shell__acoes">
        <button type="button" class="shell__pesquisa" aria-label="Pesquisar áreas do sistema" @click="abrirBusca"><Search :size="17"/><span>Buscar no sistema...</span><kbd>Ctrl K</kbd></button>
        <button class="shell__icone-acao" type="button" :aria-label="ui.tema === 'escuro' ? 'Tema claro' : 'Tema escuro'" @click="ui.alternarTema()"><Sun v-if="ui.tema === 'escuro'" :size="19"/><Moon v-else :size="19"/></button>
        <div class="shell__usuario-area">
          <button type="button" class="shell__usuario-botao" :aria-expanded="menuUsuarioAberto" aria-label="Menu do usuário" @click="menuUsuarioAberto = !menuUsuarioAberto">
            <FotoPessoaAvatar :pessoa-id="auth.pessoaId" :nome="auth.nome" :tamanho="36" :borda="false" />
            <span class="shell__usuario-label"><b>{{ auth.nome || 'Administrador' }}</b><small>Painel administrativo</small></span>
            <ChevronDown :size="15"/>
          </button>
          <div v-if="menuUsuarioAberto" class="shell__usuario-menu">
            <div class="shell__usuario-menu-perfil">
              <FotoPessoaAvatar :pessoa-id="auth.pessoaId" :nome="auth.nome" :tamanho="52" />
              <span><b>{{ auth.nome || 'Administrador' }}</b><small>{{ auth.pessoaId ? `Pessoa #${auth.pessoaId}` : 'Sem ficha de Pessoa vinculada' }}</small></span>
            </div>
            <button v-if="auth.pessoaId" type="button" @click="navegar({name:'pessoa-editar',params:{id:auth.pessoaId},query:{origem:'usuarios'}})"><UserRound :size="17"/> Meu perfil</button>
            <button type="button" @click="ui.alternarTema();menuUsuarioAberto=false"><Moon :size="17"/> Alternar tema</button>
            <button type="button" :disabled="saindo" @click="sair"><LogOut :size="17"/> {{ saindo ? 'Saindo...' : 'Sair da conta' }}</button>
          </div>
        </div>
      </div>
    </header>

    <div class="shell__miolo">
      <aside class="shell__sidebar" :aria-hidden="telaEstreita() && ui.asideRecolhido ? 'true' : undefined">
        <div class="shell__sidebar-intro">
          <span class="shell__contexto-icone"><component :is="moduloAtivo.icone" :size="21" /></span>
          <div><h2>{{ moduloAtivo.rotulo }}</h2><p>{{ contexto === 'cadastros' ? 'Gestão de informações' : contexto === 'operacoes' ? 'Controle da operação' : 'Área de trabalho' }}</p></div>
        </div>
        <div class="shell__sidebar-caption">NAVEGAÇÃO</div>
        <nav class="shell__links" :aria-label="'Menu de ' + moduloAtivo.rotulo">
          <RouterLink v-for="item in itensLaterais" :key="item.id" class="shell__link" :class="{ 'shell__link--ativo': menuAtivo === item.id }" :to="item.rota" @click="telaEstreita() && ui.recolherAside()">
            <component :is="item.icone" :size="19" :stroke-width="1.9"/><span>{{ item.rotulo }}</span><ChevronRight v-if="menuAtivo === item.id" class="shell__link-chev" :size="15" />
          </RouterLink>
        </nav>
        <div class="shell__sidebar-bottom">
          <div class="shell__help"><ShieldCheck :size="18"/><span><b>RotaMaxi TMS</b><small>Ambiente administrativo</small></span></div>
          <span class="shell__version">Interface · V7.6.1</span>
        </div>
      </aside>
      <div v-if="!ui.asideRecolhido" class="shell__cortina" @click="ui.recolherAside()"></div>
      <div class="shell__workspace">
        <div class="shell__subtopo">
          <div class="shell__trilha">
            <button type="button" class="shell__menu" :aria-expanded="!ui.asideRecolhido" aria-label="Abrir ou fechar menu lateral" @click="ui.alternarAside()"><Menu :size="20"/></button>
            <template v-if="contexto === 'cadastros'">
              <span class="shell__abas-titulo">{{ cadastroAtual.nome }}</span>
              <nav class="shell__abas" :aria-label="`Cadastros de ${cadastroAtual.nome}`">
                <RouterLink v-for="aba in abasCadastro" :key="aba.id" :to="rotaCadastro(cadastroAtual.id, aba.id)"
                  class="shell__aba" :class="{ 'shell__aba--ativa': abaAtual.id === aba.id }"
                  :aria-current="abaAtual.id === aba.id ? 'page' : undefined">{{ aba.nome }}</RouterLink>
              </nav>
            </template>
            <template v-else>
              <span class="shell__breadcrumb-home">{{ moduloAtivo.rotulo }}</span><ChevronRight :size="15" class="shell__breadcrumb-chevron"/><strong>{{ tituloTela }}</strong>
            </template>
          </div>
          <div class="shell__subtopo-direita"><IndicadorTempoReal/><span class="shell__subtopo-date">Ambiente online</span></div>
        </div>
        <main class="shell__main"><RouterView /></main>
      </div>
    </div>

    <div v-if="buscaAberta" class="shell__busca-backdrop" @click.self="buscaAberta=false">
      <section class="shell__busca-modal" role="dialog" aria-modal="true" aria-label="Buscar no sistema">
        <div class="shell__busca-input"><Search :size="20"/><input ref="inputBusca" v-model="termoBusca" placeholder="Pesquise uma área ou funcionalidade..." @keydown.enter="atalhos.length && navegar(atalhos[0].rota)" /><button type="button" @click="buscaAberta=false"><X :size="18"/></button></div>
        <div class="shell__busca-lista"><button v-for="(item,i) in atalhos" :key="i" type="button" @click="navegar(item.rota)"><component :is="item.icone" :size="18"/><span>{{ item.rotulo }}</span><ChevronRight :size="15" /></button><p v-if="!atalhos.length">Nenhuma área encontrada.</p></div>
        <footer>Atalho de navegação · Ctrl + K</footer>
      </section>
    </div>
  </div>
</template>

<style scoped src="@/styles/app/layouts/main_layout.css"></style>
