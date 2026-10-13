<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { Truck } from 'lucide-vue-next';
import { fotosVeiculo } from '@/services/api/registrations.api.js';

const props = defineProps({
  veiculoId: { type: [Number, String], default: null },
  temFoto: { type: Boolean, default: false },
  nome: { type: String, default: '' },
  tamanho: { type: Number, default: 40 },
});

// URLs assinadas são temporárias: cache curto por id, compartilhado na aba.
const CACHE_MS = 8 * 60 * 1000;
const cache = globalThis.__rotamaxiFotoVeiculoCache || new Map();
if (!globalThis.__rotamaxiFotoVeiculoCache) globalThis.__rotamaxiFotoVeiculoCache = cache;
const pendentes = globalThis.__rotamaxiFotoVeiculoPendentes || new Map();
if (!globalThis.__rotamaxiFotoVeiculoPendentes) globalThis.__rotamaxiFotoVeiculoPendentes = pendentes;

const src = ref('');
let ciclo = 0;
const idNumerico = computed(() => { const n = Number(props.veiculoId); return Number.isFinite(n) && n > 0 ? n : null; });
const estilo = computed(() => ({ '--foto-veiculo-tamanho': `${Math.max(24, props.tamanho)}px` }));

function consultar(id, forcar = false) {
  const salvo = cache.get(id);
  if (!forcar && salvo && salvo.expiraEm > Date.now()) return Promise.resolve(salvo.url);
  if (!forcar && pendentes.has(id)) return pendentes.get(id);
  const p = fotosVeiculo(id)
    .then((fotos) => {
      const v = fotos?.frontal;
      const url = (typeof v === 'string' ? v : v?.url) || '';
      cache.set(id, { url, expiraEm: Date.now() + CACHE_MS });
      return url;
    })
    .finally(() => pendentes.delete(id));
  pendentes.set(id, p);
  return p;
}

async function carregar() {
  const meu = ++ciclo;
  if (!props.temFoto || !idNumerico.value) { src.value = ''; return; }
  try {
    const url = await consultar(idNumerico.value);
    if (meu === ciclo) src.value = url;
  } catch {
    if (meu === ciclo) src.value = ''; // falha silenciosa: placeholder
  }
}

function fotoFalhou() { src.value = ''; if (idNumerico.value) cache.delete(idNumerico.value); }

watch(() => [props.veiculoId, props.temFoto], carregar);
onMounted(carregar);
</script>

<template>
  <span class="foto-veiculo" :style="estilo" :title="nome || 'Veículo'" aria-hidden="true">
    <img v-if="src" :src="src" alt="" loading="lazy" @error="fotoFalhou" />
    <Truck v-else :size="Math.max(15, Math.round(tamanho * 0.46))" :stroke-width="1.8" />
  </span>
</template>

<style scoped src="@/styles/components/registrations/vehicles/vehicle_thumbnail.css"></style>
