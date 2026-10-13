<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { ChevronDown, ChevronLeft, ChevronRight, CircleAlert, Eye, FilterX, Pencil, Plus, RefreshCw, Search, SlidersHorizontal, Trash2, UploadCloud, X } from 'lucide-vue-next';
import SeloFipe from '@/components/registrations/vehicles/fipe/FipeBadge.vue';
import FotoVeiculoThumb from '@/components/registrations/vehicles/VehicleThumbnail.vue';
import { listarFrota, excluirVeiculo, falhaFrota } from '@/services/api/fleet.api.js';
import { buscarCadastro } from '@/services/api/registrations.api.js';
import { resolveVehicleFipeQuote } from '@/services/api/fipe.api.js';
import {
    STATUS, STATUS_FILTRO, DOCUMENTACOES, POR_PAGINA, rotuloPropriedade,
    opcoesPropriedade, opcoesProprietarios, fonteOpcoes, construirChips, removerChip, contarFiltrosSecundarios,
    lerFiltrosDaUrl, filtrosParaQuery, filtrosParaParams, temFiltroAtivo, normalizarPaginacao, aplicarMudanca,
    opcoesTipos, opcoesClassificacoes, seloDocumentacao, naoClassificado, classificacaoAConfirmar, LIMITES, textoPendencias, resumoDocumentacao,
    rotuloPendencia, valorFipeExibivel, reais, ehCentralDeFrota, queryVoltar,
} from '@/domain/vehicles/fleet-model.js';

const route = useRoute();
const router = useRouter();

// A URL é a única fonte do estado de filtros, busca e página.
const filtros = computed(() => lerFiltrosDaUrl(route.query));
const busca = ref(filtros.value.q);

const linhas = ref([]);
const meta = ref({});
const paginacao = ref({ pagina: 1, ultimaPagina: 1, total: 0 });
const carregando = ref(true);
const falha = ref('');
const abertos = ref([]);
const fipeExpandida = ref({});
const fipeExpandidaCarregando = ref({});
const excluirAberto = ref(false);
const veiculoExcluir = ref(null);
const excluindo = ref(false);
const erroExcluir = ref('');

let controlador = null;
let sequencia = 0;
let temporizador = null;

const fonte = computed(() => fonteOpcoes(meta.value));
const tipos = computed(() => opcoesTipos(fonte.value));
const classificacoes = computed(() => opcoesClassificacoes(fonte.value, filtros.value.tipo));
const proprietarios = computed(() => opcoesProprietarios(meta.value));
const opcoesProp = computed(() => opcoesPropriedade(meta.value));
const mostraProprietario = computed(() => filtros.value.propriedade !== 'proprio');
const semFiltro = computed(() => !temFiltroAtivo(filtros.value));
const comAlertaDoc = computed(() => resumoDocumentacao(linhas.value));
const chips = computed(() => construirChips(filtros.value));
const nSecundarios = computed(() => contarFiltrosSecundarios(filtros.value));
const painelAberto = ref(false);
const rotuloOpcao = (rotulo, total) => (total === null || total === undefined ? rotulo : `${rotulo} (${numero(total)})`);
const zeroInativo = (total, atual) => total === 0 && !atual;
// v-model nos filtros: re-sincroniza o valor quando as opções chegam depois (voltar de outra tela / recarregar com filtro na URL).
const modeloFiltro = (chave) => computed({ get: () => filtros.value[chave], set: (v) => aplicar({ [chave]: v }) });
const vPropriedade = modeloFiltro('propriedade');
const vProprietario = modeloFiltro('proprietario');
const vTipo = modeloFiltro('tipo');
const vClassificacao = modeloFiltro('classificacao');
const vDocumentacao = modeloFiltro('documentacao');
const vStatus = modeloFiltro('status');
const avisoRevalidacao = ref('');
const rotaClassica = { name: 'cadastros-item', params: { tipo: 'veiculos' }, query: { aba: 'marcas' } };
const origem = computed(() => queryVoltar(route.fullPath));
const rotaCatalogos = computed(() => ({ ...rotaClassica, query: { aba: 'marcas', ...origem.value } }));

function aplicar(novos, { substituir = false } = {}) {
    const proximo = aplicarMudanca(filtros.value, novos);
    avisoRevalidacao.value = filtros.value.classificacao && !proximo.classificacao && novos.tipo
        ? 'Classificação removida: não existe para o tipo escolhido.' : '';
    const destino = { name: route.name, params: route.params, query: filtrosParaQuery(proximo) };
    return substituir ? router.replace(destino) : router.push(destino);
}

async function carregar() {
    const minha = ++sequencia;
    controlador?.abort();
    controlador = new AbortController();
    carregando.value = true;
    falha.value = '';
    try {
        const resposta = await listarFrota(filtrosParaParams(filtros.value, POR_PAGINA), { signal: controlador.signal });
        if (minha !== sequencia) return; // resposta antiga não sobrescreve a nova
        linhas.value = resposta.data;
        meta.value = resposta.meta ?? {};
        paginacao.value = normalizarPaginacao(resposta);
        abertos.value = [];
    } catch (e) {
        if (minha !== sequencia || e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError') return;
        linhas.value = [];
        meta.value = {};
        paginacao.value = { pagina: 1, ultimaPagina: 1, total: 0 };
        falha.value = falhaFrota(e, 'a listagem da frota');
    } finally {
        if (minha === sequencia) carregando.value = false;
    }
}

watch(() => route.fullPath, () => {
    if (!ehCentralDeFrota(route.params.tipo, route.query)) return;
    busca.value = filtros.value.q;
    carregar();
}, { immediate: true });

function aoDigitar() {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
        if (busca.value.trim() !== filtros.value.q) aplicar({ q: busca.value.trim() }, { substituir: true });
    }, 350);
}

function limpar() {
    clearTimeout(temporizador);
    busca.value = '';
    router.push({ name: route.name, params: route.params, query: {} });
}

function removerFiltro(chave) {
    if (chave === 'q') { clearTimeout(temporizador); busca.value = ''; }
    aplicar(chave === 'q' ? { q: '' } : removerChip(filtros.value, chave));
    nextTick(() => document.getElementById('fc-resumo')?.focus());
}

async function carregarFipeExpandida(l) {
    const id = l?.id;
    if (!id || valorFipeExibivel(l?.fipe) || Object.hasOwn(fipeExpandida.value, id) || fipeExpandidaCarregando.value[id]) return;
    fipeExpandidaCarregando.value = { ...fipeExpandidaCarregando.value, [id]: true };
    try {
        // /frota can return fipe_state=pendente even though the canonical cadastro already
        // has marca/modelo/ano FIPE and the same quote is visible in Editar. Resolve from
        // the canonical cadastro using the exact same FIPE service used by the form.
        const cadastro = await buscarCadastro('veiculos', id);
        const quote = await resolveVehicleFipeQuote(cadastro);
        fipeExpandida.value = { ...fipeExpandida.value, [id]: quote || null };
    } catch {
        fipeExpandida.value = { ...fipeExpandida.value, [id]: null };
    } finally {
        const proximo = { ...fipeExpandidaCarregando.value };
        delete proximo[id];
        fipeExpandidaCarregando.value = proximo;
    }
}

function alternar(l) {
    const id = typeof l === 'object' ? l.id : l;
    const abrindo = !abertos.value.includes(id);
    abertos.value = abrindo ? [...abertos.value, id] : abertos.value.filter((x) => x !== id);
    if (abrindo && typeof l === 'object') carregarFipeExpandida(l);
}

function abrirExclusao(linha) {
    veiculoExcluir.value = linha;
    erroExcluir.value = '';
    excluirAberto.value = true;
}

function fecharExclusao() {
    if (excluindo.value) return;
    excluirAberto.value = false;
    veiculoExcluir.value = null;
    erroExcluir.value = '';
}

async function confirmarExclusao() {
    if (!veiculoExcluir.value?.id || excluindo.value) return;
    excluindo.value = true;
    erroExcluir.value = '';
    try {
        await excluirVeiculo(veiculoExcluir.value.id);
        excluirAberto.value = false;
        veiculoExcluir.value = null;
        await carregar();
    } catch (e) {
        erroExcluir.value = falhaFrota(e, 'a exclusão do veículo');
    } finally {
        excluindo.value = false;
    }
}

const fipeDaLinha = (l) => valorFipeExibivel(l?.fipe) ? l.fipe : (fipeExpandida.value[l?.id] || null);
const estadoFipe = (l) => valorFipeExibivel(l?.fipe) ? l.fipe_state : (fipeExpandida.value[l?.id] ? 'encontrado' : l.fipe_state);
const valorFipe = (l) => { const f = fipeDaLinha(l); return valorFipeExibivel(f) ? `${reais(f.valor)} · ref. ${f.mes_referencia}` : null; };
const marcaModelo = (l) => [[l.marca_nome, l.modelo_nome].filter(Boolean).join(' '), l.ano_modelo].filter(Boolean).join(' · ') || '—';
const numero = (v) => (v === undefined || v === null ? '—' : Number(v).toLocaleString('pt-BR'));
const vazio = (v) => (v === undefined || v === null || v === '' ? '—' : v);
const donoLinha = (l) => (l.propriedade === 'proprio' ? 'Patrimônio da empresa' : (l.prestador_nome || l.proprietario_nome || 'Sem proprietário informado'));
const classeBadgeDoc = (t) => ({ ok: 'cad__badge--ativo', warn: 'cad__badge--pendente', bad: 'fc__badge--bad', neutro: 'cad__badge--neutro' })[t];

onBeforeUnmount(() => {
    clearTimeout(temporizador);
    controlador?.abort();
});
</script>

<template>
  <section class="cad">
    <header class="cad__cabecalho">
      <div class="cad__cabecalho-texto">
        <div class="cad__etiqueta">CADASTROS · VEÍCULOS</div>
        <h1>Frota</h1>
        <p>Veículos da operação por propriedade, tipo e documentação</p>
        <div class="fc__links">
          <RouterLink :to="rotaCatalogos">Marcas, modelos e tipos</RouterLink>
          <RouterLink :to="{ name: 'veiculo-consulta-fipe', query: origem }">Consulta FIPE avulsa</RouterLink>
        </div>
      </div>
      <div class="cad__topo-acoes">
        <RouterLink class="cad__outline" :to="{ name: 'veiculo-importar-esl', query: origem }"><UploadCloud :size="17" /> Importar do ESL</RouterLink>
        <RouterLink class="cad__primary" :to="{ name: 'veiculo-novo', query: origem }"><Plus :size="18" /> Novo veículo</RouterLink>
      </div>
    </header>

    <div v-if="falha" class="cad__feedback cad__feedback--pagina cad__feedback--erro" role="alert">
      <CircleAlert :size="17" /> {{ falha }}
      <button class="cad__outline" type="button" @click="carregar">Tentar novamente</button>
    </div>

    <section class="cad__painel">
      <div class="cad__filtros cad__filtros--topo fc__linha1" :aria-busy="carregando ? 'true' : 'false'">
        <label class="cad__status fc__propriedade"><b>Propriedade</b>
          <select v-model="vPropriedade">
            <option v-for="o in opcoesProp" :key="o.valor || 'todos'" :value="o.valor">{{ rotuloOpcao(o.rotulo, o.total) }}</option>
          </select>
        </label>
        <label class="cad__busca"><Search :size="18" /><input v-model="busca" type="search" :maxlength="LIMITES.q" aria-label="Buscar veículos" placeholder="Placa, chassi, renavam, frota ou proprietário" @input="aoDigitar" @keydown.enter.prevent="aplicar({ q: busca.trim() }, { substituir: true })" @keydown.esc="busca = ''; aoDigitar()" /></label>
        <button type="button" class="cad__outline fc__filtros-toggle" aria-controls="fc-linha2" :aria-expanded="painelAberto ? 'true' : 'false'" @click="painelAberto = !painelAberto" @keydown.esc="painelAberto = false"><SlidersHorizontal :size="16" /> Filtros ({{ nSecundarios }})</button>
        <button type="button" class="cad__outline fc__so-desktop" :disabled="semFiltro && !busca" @click="limpar"><FilterX :size="16" /> Limpar</button>
        <button type="button" class="cad__outline fc__so-desktop" :disabled="carregando" title="Atualizar" @click="carregar"><RefreshCw :size="16" /> Atualizar</button>
      </div>
      <div id="fc-linha2" class="cad__filtros cad__filtros--topo fc__filtros-linha2" :class="{ 'fc__linha2--aberta': painelAberto }" @keydown.esc="painelAberto = false">
        <label v-if="mostraProprietario" class="cad__status">Proprietário / Transportadora
          <select v-model="vProprietario">
            <option value="">Todos os terceiros</option>
            <option v-if="filtros.proprietario && !proprietarios.some((p) => p.valor === filtros.proprietario)" :value="filtros.proprietario">{{ filtros.proprietario }}</option>
            <option v-for="p in proprietarios" :key="p.valor" :value="p.valor" :aria-disabled="zeroInativo(p.total, p.valor === filtros.proprietario) ? 'true' : null" :disabled="zeroInativo(p.total, p.valor === filtros.proprietario)" :class="{ 'fc__opcao-zero': p.total === 0 }">{{ rotuloOpcao(p.valor, p.total) }}</option>
          </select>
        </label>
        <label class="cad__status">Tipo
          <select v-model="vTipo">
            <option value="">Todos</option>
            <option v-if="filtros.tipo && !tipos.some((t) => t.valor === filtros.tipo)" :value="filtros.tipo">{{ filtros.tipo }}</option>
            <option v-for="t in tipos" :key="t.valor" :value="t.valor" :aria-disabled="zeroInativo(t.total, t.valor === filtros.tipo) ? 'true' : null" :disabled="zeroInativo(t.total, t.valor === filtros.tipo)" :class="{ 'fc__opcao-zero': t.total === 0 }">{{ rotuloOpcao(t.valor, t.total) }}</option>
          </select>
        </label>
        <label class="cad__status">Classificação
          <select v-model="vClassificacao" :disabled="!filtros.tipo" :aria-describedby="filtros.tipo ? null : 'fc-classif-aviso'">
            <option value="">{{ filtros.tipo ? 'Todas' : 'Escolha um tipo' }}</option>
            <option v-if="filtros.classificacao && !classificacoes.some((c) => c.valor === filtros.classificacao)" :value="filtros.classificacao">{{ filtros.classificacao }}</option>
            <option v-for="c in classificacoes" :key="c.valor" :value="c.valor" :aria-disabled="zeroInativo(c.total, c.valor === filtros.classificacao) ? 'true' : null" :disabled="zeroInativo(c.total, c.valor === filtros.classificacao)" :class="{ 'fc__opcao-zero': c.total === 0 }">{{ rotuloOpcao(c.valor, c.total) }}</option>
          </select>
          <span v-if="!filtros.tipo" id="fc-classif-aviso" class="fc__oculto">Escolha um tipo primeiro para habilitar a classificação.</span>
        </label>
        <label class="cad__status" title="Verifica a validade da GR">Documentação
          <select v-model="vDocumentacao">
            <option value="">Todas</option>
            <option v-for="(rotulo, chave) in DOCUMENTACOES" :key="chave" :value="chave">{{ rotulo }}</option>
          </select>
        </label>
        <label class="cad__status">Situação
          <select v-model="vStatus">
            <option v-for="(rotulo, chave) in STATUS_FILTRO" :key="chave" :value="chave">{{ rotulo }}</option>
          </select>
        </label>
        <button type="button" class="cad__outline fc__so-mobile" :disabled="semFiltro && !busca" @click="limpar"><FilterX :size="16" /> Limpar</button>
        <button type="button" class="cad__outline fc__so-mobile" :disabled="carregando" @click="carregar"><RefreshCw :size="16" /> Atualizar</button>
      </div>

      <div id="fc-resumo" class="cad__resumo" aria-live="polite" tabindex="-1">
        <span><b>{{ numero(paginacao.total) }}</b> {{ paginacao.total === 1 ? 'veículo' : 'veículos' }}</span>
        <span class="cad__resumo-separador">·</span>
        <span><b>{{ comAlertaDoc }}</b> com GR a vencer ou vencida nesta página</span>
        <span v-if="avisoRevalidacao" class="fc__aviso">{{ avisoRevalidacao }}</span>
      </div>
      <ul v-if="chips.length" class="fc__chips" aria-label="Filtros ativos">
        <li v-for="c in chips" :key="c.chave" class="cad__badge cad__badge--neutro fc__chip">{{ c.rotulo }}
          <button type="button" :aria-label="`Remover filtro ${c.rotulo}`" @click="removerFiltro(c.chave)"><X :size="13" /></button></li>
        <li v-if="chips.length >= 2"><button type="button" class="fc__limpar-link" @click="limpar">Limpar filtros</button></li>
      </ul>

      <div v-if="carregando && !falha" class="fc__esqueleto" aria-label="Carregando veículos" aria-busy="true"><span v-for="n in 6" :key="n" /></div>

      <div v-else-if="!falha && !linhas.length" class="cad__vazio">
        <Search :size="26" />
        <template v-if="semFiltro">
          <strong>Nenhum veículo cadastrado</strong>
          <p>Cadastre um veículo ou importe do ESL.</p>
          <div class="fc__acoes"><RouterLink class="cad__primary" :to="{ name: 'veiculo-novo', query: origem }">Novo veículo</RouterLink><RouterLink class="cad__outline" :to="{ name: 'veiculo-importar-esl', query: origem }">Importar do ESL</RouterLink></div>
        </template>
        <template v-else>
          <strong>{{ filtros.propriedade === 'proprio' ? 'Nenhum veículo próprio com esses filtros.' : 'Nenhum veículo corresponde aos filtros.' }}</strong>
          <p>Remova um filtro ou limpe tudo.</p>
          <button type="button" class="cad__outline" @click="limpar"><FilterX :size="16" /> Limpar filtros</button>
        </template>
      </div>

      <template v-else-if="!falha">
        <div class="cad__tabela-rolagem fc__tabela">
          <table>
            <thead><tr><th>Veículo</th><th>Tipo / classificação</th><th>Marca / modelo / ano</th><th>Propriedade</th><th>Status</th><th>Documentação</th><th>Pendências</th><th>Ações</th></tr></thead>
            <tbody>
              <template v-for="l in linhas" :key="l.id">
                <tr>
                  <td data-rotulo="Veículo"><span class="cad__nome">
                    <FotoVeiculoThumb :veiculo-id="l.id" :tem-foto="!!l.has_foto_frontal" :nome="l.placa" :tamanho="40" />
                    <span class="fc__id"><button type="button" class="fc__placa" :aria-expanded="abertos.includes(l.id) ? 'true' : 'false'" @click="alternar(l)"><b>{{ l.placa }}</b></button><small v-if="l.numero_frota">Frota {{ l.numero_frota }}</small></span>
                  </span></td>
                  <td data-rotulo="Tipo">
                    <span>{{ vazio(l.tipo) }}</span>
                    <small v-if="naoClassificado(l)" class="cad__badge cad__badge--pendente" title="Classificação a confirmar">Não classificado</small>
                    <small v-else class="fc__sub">{{ vazio(l.classificacao) }}<em v-if="classificacaoAConfirmar(l)" class="fc__confirmar" title="Mapeamento proposto: a operação ainda precisa confirmar"> · a confirmar</em></small>
                  </td>
                  <td data-rotulo="Marca / modelo">{{ marcaModelo(l) }}</td>
                  <td data-rotulo="Propriedade">
                    <span class="cad__badge" :class="l.propriedade === 'proprio' ? 'cad__badge--ativo' : 'cad__badge--neutro'">{{ rotuloPropriedade(l.propriedade) }}</span>
                    <small class="fc__sub">{{ donoLinha(l) }}</small>
                  </td>
                  <td data-rotulo="Status"><span class="cad__badge" :class="l.status === 'ativo' ? 'cad__badge--ativo' : 'cad__badge--neutro'">{{ STATUS[l.status] ?? '—' }}</span></td>
                  <td data-rotulo="Documentação">
                    <span class="cad__badge" :class="classeBadgeDoc(seloDocumentacao(l).tom)" :title="seloDocumentacao(l).dica">{{ seloDocumentacao(l).texto }}</span>
                  </td>
                  <td data-rotulo="Pendências">
                    <span v-if="textoPendencias(l)" class="cad__badge cad__badge--pendente" :title="l.pendencias.map(rotuloPendencia).join(', ')">{{ textoPendencias(l) }}</span>
                    <span v-else>—</span>
                  </td>
                  <td class="fc__acoes-celula">
                    <RouterLink class="cad__editar-pessoa" :to="{ name: 'veiculo-detalhe', params: { id: l.id }, query: origem }"><Eye :size="15" /> Ver</RouterLink>
                    <RouterLink class="cad__editar-pessoa" :to="{ name: 'veiculo-editar', params: { id: l.id }, query: origem }"><Pencil :size="15" /> Editar</RouterLink>
                    <button type="button" class="cad__editar-pessoa" :aria-expanded="abertos.includes(l.id) ? 'true' : 'false'" @click="alternar(l)"><ChevronDown :size="15" /> {{ abertos.includes(l.id) ? 'Ocultar' : 'Detalhes' }}</button>
                    <button type="button" class="cad__editar-pessoa fc__excluir" @click="abrirExclusao(l)"><Trash2 :size="15" /> Excluir</button>
                  </td>
                </tr>
                <tr v-if="abertos.includes(l.id)" class="cad__detalhes-esl" @keydown.esc="alternar(l)">
                  <td colspan="8">
                    <div class="cad__detalhes-grade">
                      <div><small>Chassi</small><strong>{{ vazio(l.chassi) }}</strong></div>
                      <div><small>Renavam</small><strong>{{ vazio(l.renavam) }}</strong></div>
                      <div><small>Cor</small><strong>{{ vazio(l.cor) }}</strong></div>
                      <div><small>Carroceria</small><strong>{{ vazio(l.carroceria) }}</strong></div>
                      <div><small>Motorista ESL</small><strong>{{ vazio(l.motorista_nome) }}</strong></div>
                      <div><small>Situação ESL</small><strong>{{ vazio(l.situacao_esl) }}</strong></div>
                      <div><small>Validade da GR</small><strong>{{ vazio(l.validade_gr) }}</strong></div>
                      <div><small>Origem do dado</small><strong>{{ l.origem_dado === 'esl' ? 'Importado do ESL' : l.origem_dado === 'manual' ? 'Cadastro manual' : vazio(l.origem_dado) }}</strong></div>
                      <div><small>FIPE</small><strong><span v-if="fipeExpandidaCarregando[l.id]" class="fc__quieto">Consultando FIPE…</span><template v-else><SeloFipe :estado="estadoFipe(l)" /> <span v-if="valorFipe(l)" class="fc__quieto">{{ valorFipe(l) }}</span></template></strong></div>
                      <div v-if="l.pendencias?.length"><small>Pendências</small><strong>{{ l.pendencias.map(rotuloPendencia).join(', ') }}</strong></div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <footer class="cad__rodape"><span>Página {{ paginacao.pagina }} de {{ paginacao.ultimaPagina }}</span><div>
          <button type="button" aria-label="Anterior" :disabled="paginacao.pagina <= 1 || carregando" @click="aplicar({ page: paginacao.pagina - 1 })"><ChevronLeft :size="17" /></button><span>{{ paginacao.pagina }} / {{ paginacao.ultimaPagina }}</span>
          <button type="button" aria-label="Próxima" :disabled="paginacao.pagina >= paginacao.ultimaPagina || carregando" @click="aplicar({ page: paginacao.pagina + 1 })"><ChevronRight :size="17" /></button></div></footer>
      </template>
    </section>
  </section>

  <Teleport to="body">
    <div v-if="excluirAberto" class="fc__modal-fundo" @click.self="fecharExclusao" @keydown.esc="fecharExclusao">
      <section class="fc__modal-excluir" role="dialog" aria-modal="true" aria-labelledby="fc-excluir-titulo">
        <header>
          <div>
            <small>EXCLUSÃO DE VEÍCULO</small>
            <h2 id="fc-excluir-titulo">Excluir {{ veiculoExcluir?.placa || 'veículo' }}?</h2>
          </div>
          <button type="button" aria-label="Fechar" :disabled="excluindo" @click="fecharExclusao"><X :size="19" /></button>
        </header>
        <p>O veículo deixará de aparecer na frota. Use esta ação somente para cadastro indevido, teste ou duplicidade.</p>
        <div class="fc__excluir-resumo">
          <b>{{ veiculoExcluir?.placa || '—' }}</b>
          <span>{{ veiculoExcluir ? marcaModelo(veiculoExcluir) : '—' }}</span>
        </div>
        <div v-if="erroExcluir" class="cad__feedback cad__feedback--erro" role="alert">{{ erroExcluir }}</div>
        <footer>
          <button type="button" class="cad__outline" :disabled="excluindo" @click="fecharExclusao">Cancelar</button>
          <button type="button" class="fc__danger" :disabled="excluindo" @click="confirmarExclusao">
            <Trash2 :size="16" /> {{ excluindo ? 'Excluindo...' : 'Excluir veículo' }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>

</template>

<style scoped src="@/styles/pages/registrations/vehicles/fleet_page.css"></style>
