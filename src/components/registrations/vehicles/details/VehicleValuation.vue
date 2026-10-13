<script setup>
import { computed, ref, watch } from 'vue';
import { CircleAlert, RefreshCw } from 'lucide-vue-next';
import SeloFipe from '@/components/registrations/vehicles/fipe/FipeBadge.vue';
import CadeiaFipe from '@/components/registrations/vehicles/fipe/FipeChain.vue';
import EstadoVazio from '@/components/all/ui/EmptyState.vue';
import {
  buscarVeiculoFrota, vincularFipe, desfazerVinculoFipe, marcarSemEquivalenteFipe, registrarAvaliacaoManual,
  listarAvaliacoes, sugestaoFipe, recalcularSugestaoFipe, falhaFrota,
} from '@/services/api/fleet.api.js';
import {
  ROTULO_AVALIACAO_MANUAL, valorFipeExibivel, reais, categoriaSemFipe, validarAvaliacaoManual, paraDecimal, CATEGORIAS_FIPE,
} from '@/domain/vehicles/fleet-model.js';

const props = defineProps({
  veiculoId: { type: [String, Number], default: null },
  veiculo: { type: Object, default: null },
});
const emit = defineEmits(['frota']);

const frota = ref(null);
const estado = ref('carregando'); // carregando | ok | erro | sem_veiculo
const erroFipe = ref('');
const aviso = ref('');
const ocupado = ref('');
const mostrarConsulta = ref(false);
const resultado = ref(null);
const sugestao = ref(null);
const motivo = ref('');
const acaoMotivo = ref('');
const avaliacoes = ref([]);
const erroAvaliacoes = ref('');
const avaliacoesIndisponivel = ref(false);
const avaliacao = ref({ valor: '', fonte: '', data: '' });
const errosAvaliacao = ref({});

const semFipe = computed(() => categoriaSemFipe(props.veiculo) || props.veiculo?.categoria === 'reboque');
const fipe = computed(() => frota.value?.fipe ?? null);
const vinculado = computed(() => frota.value?.fipe_state === 'vinculado');
const sugestaoConfirmavel = computed(() => sugestao.value && ['tipo', 'marca_id', 'modelo_id', 'fipe_ano_codigo'].every((k) => sugestao.value[k]));

async function carregarAvaliacoes() {
  erroAvaliacoes.value = ''; avaliacoesIndisponivel.value = false;
  try { avaliacoes.value = await listarAvaliacoes(props.veiculoId); }
  catch (e) {
    avaliacoes.value = [];
    if (e?.response?.status === 404) avaliacoesIndisponivel.value = true;
    else erroAvaliacoes.value = falhaFrota(e, 'o histórico de avaliações');
  }
}
async function carregar() {
  if (!props.veiculoId) { estado.value = 'sem_veiculo'; return; }
  estado.value = 'carregando'; erroFipe.value = '';
  const [f] = await Promise.allSettled([buscarVeiculoFrota(props.veiculoId), carregarAvaliacoes()]);
  if (f.status === 'fulfilled') { frota.value = f.value.linha; emit('frota', f.value.linha); }
  else { frota.value = null; erroFipe.value = falhaFrota(f.reason, 'a situação FIPE do veículo'); }
  estado.value = 'ok';
}
watch(() => props.veiculoId, carregar, { immediate: true });

async function recarregarFipe() {
  try { frota.value = (await buscarVeiculoFrota(props.veiculoId)).linha; erroFipe.value = ''; emit('frota', frota.value); }
  catch (e) { erroFipe.value = falhaFrota(e, 'a situação FIPE do veículo'); }
}
async function agir(nome, fn, sucesso) {
  ocupado.value = nome; erroFipe.value = ''; aviso.value = '';
  try { await fn(); aviso.value = sucesso; await recarregarFipe(); await carregarAvaliacoes(); return true; }
  catch (e) { erroFipe.value = falhaFrota(e, 'esta ação'); return false; }
  finally { ocupado.value = ''; }
}
const confirmarVinculo = (p) => agir('vinculo', () => vincularFipe(props.veiculoId, {
  tipo: p.tipo, marca_id: p.marcaId, modelo_id: p.modeloId, ano_codigo: p.anoCodigo,
}), 'Vínculo FIPE confirmado.').then((ok) => { if (ok) { mostrarConsulta.value = false; resultado.value = null; } });

async function verSugestao() {
  ocupado.value = 'sugestao'; erroFipe.value = '';
  try { sugestao.value = (await sugestaoFipe(props.veiculoId)) ?? false; }
  catch (e) { erroFipe.value = falhaFrota(e, 'a sugestão FIPE'); } finally { ocupado.value = ''; }
}
async function recalcular() {
  ocupado.value = 'recalcular'; erroFipe.value = '';
  try {
    await recalcularSugestaoFipe(props.veiculoId);
    aviso.value = 'Sugestão recalculada. Ela é uma estimativa e não foi confirmada.';
    ocupado.value = ''; await verSugestao();
  } catch (e) { erroFipe.value = falhaFrota(e, 'o recálculo da sugestão'); } finally { ocupado.value = ''; }
}
const confirmarSugestao = () => confirmarVinculo({
  tipo: sugestao.value.tipo, marcaId: sugestao.value.marca_id, modeloId: sugestao.value.modelo_id, anoCodigo: sugestao.value.fipe_ano_codigo,
});
function abrirMotivo(acao) { acaoMotivo.value = acao; motivo.value = ''; }
async function enviarMotivo() {
  const texto = motivo.value.trim();
  if (texto.length < 3) { erroFipe.value = 'Informe o motivo (mínimo 3 caracteres).'; return; }
  const desfazer = acaoMotivo.value === 'desfazer';
  if (desfazer && !window.confirm('Desfazer o vínculo FIPE deste veículo? O histórico é preservado.')) return;
  const ok = await agir(desfazer ? 'desfazer' : 'sem', () => (desfazer ? desfazerVinculoFipe(props.veiculoId, texto) : marcarSemEquivalenteFipe(props.veiculoId, texto)),
    desfazer ? 'Vínculo FIPE desfeito.' : 'Marcado como sem equivalente FIPE.');
  if (ok) acaoMotivo.value = '';
}
async function salvarAvaliacao() {
  const v = validarAvaliacaoManual({ ...avaliacao.value });
  errosAvaliacao.value = v.erros;
  if (!v.ok) return;
  ocupado.value = 'avaliacao'; erroAvaliacoes.value = '';
  try {
    await registrarAvaliacaoManual(props.veiculoId, { valor: paraDecimal(avaliacao.value.valor), fonte: avaliacao.value.fonte.trim(), data: avaliacao.value.data });
    aviso.value = 'Avaliação manual registrada (não é FIPE).';
    avaliacao.value = { valor: '', fonte: '', data: '' };
    await carregarAvaliacoes();
  } catch (e) { erroAvaliacoes.value = falhaFrota(e, 'a avaliação manual'); } finally { ocupado.value = ''; }
}
const dataBr = (d) => (d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : '—');
const v = (x) => (x === undefined || x === null || x === '' ? '—' : x);
</script>

<template>
  <div class="vv">
    <p v-if="estado === 'sem_veiculo'" class="vv__nota">Salve o veículo para consultar FIPE ou registrar avaliação manual.</p>
    <p v-else-if="estado === 'carregando'" class="vv__nota" aria-busy="true">Carregando valoração…</p>
    <template v-else>
      <p v-if="aviso" class="vv__ok" role="status">{{ aviso }}</p>
      <section id="fipe" class="vv__bloco" aria-live="polite" aria-label="Valoração FIPE">
        <h3>Valoração FIPE</h3>
        <p v-if="erroFipe" class="vv__erro" role="alert"><CircleAlert :size="16" /> {{ erroFipe }} <button type="button" class="vv__btn vv__btn--mini" @click="recarregarFipe"><RefreshCw :size="12" /> Tentar novamente</button></p>
        <div v-if="semFipe" class="vv__linha">
          <SeloFipe estado="sem_cobertura" />
          <span>FIPE indisponível para esta categoria. Use a avaliação manual abaixo.</span>
        </div>
        <template v-else>
          <div v-if="frota" class="vv__linha"><SeloFipe :estado="frota.fipe_state" /><small v-if="frota.motivo_cobertura" class="vv__nota">{{ frota.motivo_cobertura }}</small></div>
          <dl v-if="valorFipeExibivel(fipe)" class="vv__dl">
            <dt>Valor FIPE</dt><dd><strong>{{ reais(fipe.valor) }}</strong></dd>
            <dt>Código FIPE</dt><dd>{{ v(fipe.codigo_fipe) }}</dd>
            <dt>Mês de referência</dt><dd>{{ fipe.mes_referencia }}</dd>
            <dt>Consultado em</dt><dd>{{ fipe.consultado_em ? new Date(fipe.consultado_em).toLocaleString('pt-BR') : '—' }}</dd>
            <dt>Fonte</dt><dd>{{ v(fipe.fonte) }}</dd>
          </dl>
          <p v-else-if="frota" class="vv__nota">Valor não disponível.</p>
          <div class="vv__acoes">
            <button type="button" class="vv__btn vv__btn--p" @click="mostrarConsulta = !mostrarConsulta">Consultar FIPE</button>
            <button type="button" class="vv__btn" :disabled="ocupado === 'sugestao'" @click="verSugestao">Ver sugestão provável</button>
            <button type="button" class="vv__btn" :disabled="ocupado === 'recalcular'" @click="recalcular"><RefreshCw :size="14" /> Recalcular sugestão</button>
            <button type="button" class="vv__btn" :disabled="!!ocupado" @click="abrirMotivo('sem-equivalente')">Sem equivalente</button>
            <button type="button" class="vv__btn" :disabled="!vinculado || !!ocupado" :title="vinculado ? '' : 'Não há vínculo confirmado para desfazer'" @click="abrirMotivo('desfazer')">Desfazer vínculo</button>
          </div>
          <small v-if="!vinculado" class="vv__nota">“Desfazer vínculo” fica ativo quando existe vínculo confirmado. Histórico mensal FIPE ainda não está disponível no servidor.</small>
          <form v-if="acaoMotivo" class="vv__form" @submit.prevent="enviarMotivo">
            <label>Motivo ({{ acaoMotivo === 'desfazer' ? 'desfazer vínculo' : 'sem equivalente FIPE' }})<input v-model="motivo" type="text" maxlength="300" required /></label>
            <button type="submit" class="vv__btn vv__btn--p" :disabled="!!ocupado">Confirmar</button>
            <button type="button" class="vv__btn" @click="acaoMotivo = ''">Cancelar</button>
          </form>
          <div v-if="sugestao !== null" class="vv__caixa">
            <template v-if="sugestao">
              <strong>FIPE provável - não confirmada</strong>
              <span v-if="Number(sugestao.valor) > 0">{{ reais(sugestao.valor) }} · ref. {{ sugestao.mes_referencia }} <template v-if="sugestao.codigo_fipe">· cód. {{ sugestao.codigo_fipe }}</template></span>
              <span v-else>Valor não disponível.</span>
              <small v-if="sugestao.motivo" class="vv__nota">{{ sugestao.motivo }}</small>
              <small class="vv__nota">Categoria da sugestão: {{ CATEGORIAS_FIPE[sugestao.tipo] ?? 'não informada' }}</small>
              <button type="button" class="vv__btn vv__btn--p" :disabled="!sugestaoConfirmavel || !!ocupado" :title="sugestaoConfirmavel ? '' : 'Sugestão incompleta: use Consultar FIPE'" @click="confirmarSugestao">Confirmar vínculo desta sugestão</button>
            </template>
            <span v-else>Ainda não há sugestão para este veículo.</span>
          </div>
          <div v-if="mostrarConsulta" class="vv__caixa">
            <CadeiaFipe @resultado="resultado = $event" />
            <button type="button" class="vv__btn vv__btn--p" :disabled="!resultado || !!ocupado" @click="confirmarVinculo(resultado)">Confirmar vínculo</button>
            <small v-if="!resultado" class="vv__nota">Escolha categoria, marca, modelo e ano para habilitar o vínculo.</small>
          </div>
        </template>
      </section>

      <section id="avaliacao" class="vv__manual" aria-label="Avaliação manual">
        <span class="vv__selo">{{ ROTULO_AVALIACAO_MANUAL }}</span>
        <p class="vv__nota">Nunca substitui nem sobrescreve o valor FIPE.</p>
        <p v-if="avaliacoesIndisponivel" class="vv__indisp" role="status"><CircleAlert :size="16" /> Recurso ainda não disponível no servidor. Avaliações manuais serão habilitadas após a atualização do sistema; nada foi alterado.</p>
        <template v-else>
          <p v-if="erroAvaliacoes" class="vv__erro" role="alert"><CircleAlert :size="16" /> {{ erroAvaliacoes }}</p>
          <form class="vv__form" @submit.prevent="salvarAvaliacao">
            <label>Valor (R$)<input v-model="avaliacao.valor" inputmode="decimal" placeholder="0,00" /><small v-if="errosAvaliacao.valor" class="vv__err">{{ errosAvaliacao.valor }}</small></label>
            <label>Fonte<input v-model="avaliacao.fonte" maxlength="150" /><small v-if="errosAvaliacao.fonte" class="vv__err">{{ errosAvaliacao.fonte }}</small></label>
            <label>Data<input v-model="avaliacao.data" type="date" /><small v-if="errosAvaliacao.data" class="vv__err">{{ errosAvaliacao.data }}</small></label>
            <button type="submit" class="vv__btn vv__btn--p" :disabled="ocupado === 'avaliacao'">Registrar avaliação manual</button>
          </form>
          <ul v-if="avaliacoes.length" class="vv__hist">
            <li v-for="a in avaliacoes" :key="a.id"><span class="vv__selo">{{ a.kind && a.kind !== 'manual' ? 'FIPE' : ROTULO_AVALIACAO_MANUAL }}</span> {{ reais(a.valor) }} · {{ dataBr(a.data) }}<template v-if="a.fonte"> · fonte: {{ a.fonte }}</template><template v-if="a.status && a.status !== 'ativo'"> · {{ a.status }}</template><template v-if="a.autor"> · {{ a.autor }}</template></li>
          </ul>
          <EstadoVazio v-else-if="!erroAvaliacoes" mensagem="Nenhuma avaliação registrada." tracejado />
        </template>
      </section>
    </template>
  </div>
</template>

<style scoped src="@/styles/components/registrations/vehicles/details/vehicle_valuation.css"></style>
