<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { UserRound } from 'lucide-vue-next';
import { obterFotoPessoaUrl } from '@/services/api/registrations.api.js';

const props = defineProps({
  pessoaId: { type: [Number, String], default: null },
  fotoUrl: { type: String, default: '' },
  nome: { type: String, default: '' },
  tamanho: { type: Number, default: 36 },
  quadrado: { type: Boolean, default: false },
  borda: { type: Boolean, default: true },
});

// URLs do R2 são temporárias. O cache curto evita várias consultas da mesma Pessoa na
// mesma tela, mas renova antes do prazo normal de 10 minutos do backend.
const CACHE_MS = 8 * 60 * 1000;
const cache = globalThis.__rotamaxiFotoPessoaCache || new Map();
if (!globalThis.__rotamaxiFotoPessoaCache) globalThis.__rotamaxiFotoPessoaCache = cache;
const pendentes = globalThis.__rotamaxiFotoPessoaPendentes || new Map();
if (!globalThis.__rotamaxiFotoPessoaPendentes) globalThis.__rotamaxiFotoPessoaPendentes = pendentes;

const src = ref(props.fotoUrl || '');
const tentandoRenovar = ref(false);
let ciclo = 0;

const idNumerico = computed(() => {
  const id = Number(props.pessoaId);
  return Number.isFinite(id) && id > 0 ? id : null;
});
const iniciais = computed(() => String(props.nome || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase());
const estilo = computed(() => ({ '--foto-pessoa-tamanho': `${Math.max(24, props.tamanho)}px` }));

async function consultarUrl(id, forcar = false) {
  const agora = Date.now();
  const salvo = cache.get(id);
  if (!forcar && salvo && salvo.expiraEm > agora) return salvo.url;

  if (!forcar && pendentes.has(id)) return pendentes.get(id);

  const promessa = obterFotoPessoaUrl(id)
    .then(url => {
      cache.set(id, { url: url || '', expiraEm: Date.now() + CACHE_MS });
      return url || '';
    })
    .finally(() => pendentes.delete(id));
  pendentes.set(id, promessa);
  return promessa;
}

async function carregar(forcar = false) {
  const meuCiclo = ++ciclo;
  if (props.fotoUrl && !forcar) {
    src.value = props.fotoUrl;
    if (idNumerico.value) cache.set(idNumerico.value, { url: props.fotoUrl, expiraEm: Date.now() + CACHE_MS });
    return;
  }
  if (!idNumerico.value) {
    src.value = '';
    return;
  }
  try {
    const url = await consultarUrl(idNumerico.value, forcar);
    if (meuCiclo === ciclo) src.value = url;
  } catch {
    if (meuCiclo === ciclo) src.value = '';
  }
}

function fotoFalhou() {
  if (!idNumerico.value || tentandoRenovar.value) {
    src.value = '';
    return;
  }
  tentandoRenovar.value = true;
  cache.delete(idNumerico.value);
  carregar(true).finally(() => { tentandoRenovar.value = false; });
}

function fotoAtualizada(evento) {
  const detalhe = evento?.detail || {};
  if (!idNumerico.value || Number(detalhe.pessoaId) !== idNumerico.value) return;
  const url = detalhe.url || '';
  cache.set(idNumerico.value, { url, expiraEm: Date.now() + CACHE_MS });
  src.value = url;
}

watch(() => [props.pessoaId, props.fotoUrl], () => carregar());
onMounted(() => {
  window.addEventListener('rotamaxi:pessoa-foto-atualizada', fotoAtualizada);
  carregar();
});
onBeforeUnmount(() => window.removeEventListener('rotamaxi:pessoa-foto-atualizada', fotoAtualizada));
</script>

<template>
  <span
    class="foto-pessoa"
    :class="{ 'foto-pessoa--quadrada': quadrado, 'foto-pessoa--sem-borda': !borda }"
    :style="estilo"
    :title="nome || 'Pessoa'"
    aria-hidden="true"
  >
    <img v-if="src" :src="src" alt="" @error="fotoFalhou" />
    <span v-else-if="iniciais" class="foto-pessoa__iniciais">{{ iniciais }}</span>
    <UserRound v-else :size="Math.max(15, Math.round(tamanho * .46))" :stroke-width="1.8" />
  </span>
</template>

<style scoped src="@/styles/components/all/media/person_avatar.css"></style>
