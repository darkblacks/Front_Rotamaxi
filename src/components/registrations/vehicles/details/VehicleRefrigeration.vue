<script setup>
import { ref, watch } from 'vue';
import { CircleAlert, RefreshCw } from 'lucide-vue-next';
import { buscarRefrigeracao, gravarRefrigeracao, indisponivel } from '@/services/api/vehicle-extra.api.js';
import { falhaFrota } from '@/services/api/fleet.api.js';
import { MARCAS_REFRIGERACAO, validarRefrigeracao } from '@/domain/vehicles/registration.js';

const props = defineProps({ veiculoId: { type: [String, Number], default: null } });

const vazio = () => ({ marca: '', marca_outra: '', modelo: '', id_aparelho: '', numero_serie: '', horimetro_horas: '', instalado_em: '' });
const form = ref(vazio());
const estado = ref('carregando'); // carregando | ok | erro | indisponivel | sem_veiculo
const erro = ref('');
const aviso = ref('');
const erros = ref({});
const salvando = ref(false);

async function carregar() {
  erro.value = ''; aviso.value = '';
  if (!props.veiculoId) { estado.value = 'sem_veiculo'; return; }
  estado.value = 'carregando';
  try {
    const d = await buscarRefrigeracao(props.veiculoId);
    form.value = d ? { ...vazio(), ...Object.fromEntries(Object.entries(d).filter(([k]) => k in vazio()).map(([k, v]) => [k, v ?? ''])), instalado_em: String(d.instalado_em ?? '').slice(0, 10) } : vazio();
    estado.value = 'ok';
  } catch (e) {
    if (indisponivel(e)) { estado.value = 'indisponivel'; return; }
    estado.value = 'erro'; erro.value = falhaFrota(e, 'o equipamento de refrigeração');
  }
}
watch(() => props.veiculoId, carregar, { immediate: true });

async function salvar() {
  const v = validarRefrigeracao(form.value);
  erros.value = v.erros;
  if (!v.ok) return;
  salvando.value = true; erro.value = ''; aviso.value = '';
  const payload = Object.fromEntries(Object.entries(form.value).map(([k, x]) => [k, x === '' ? null : x]));
  if (payload.horimetro_horas !== null) payload.horimetro_horas = Number(payload.horimetro_horas);
  if (payload.marca !== 'outra') payload.marca_outra = null;
  try {
    const r = await gravarRefrigeracao(props.veiculoId, payload);
    aviso.value = r.avisos.includes('horimetro_menor_que_anterior')
      ? 'Salvo, mas o horímetro é menor que a leitura anterior. Confira o valor.' : 'Refrigeração salva.';
  } catch (e) {
    erro.value = e?.response?.status === 409
      ? 'Este ID de aparelho já está ativo em outro veículo.' : falhaFrota(e, 'o equipamento de refrigeração');
  } finally { salvando.value = false; }
}
</script>

<template>
  <div class="vref" aria-live="polite">
    <p v-if="estado === 'sem_veiculo'" class="vref__nota">Salve o veículo primeiro; depois informe o aparelho de refrigeração (opcional).</p>
    <p v-else-if="estado === 'carregando'" class="vref__nota" aria-busy="true">Carregando refrigeração…</p>
    <p v-else-if="estado === 'indisponivel'" class="vref__indisp" role="status"><CircleAlert :size="16" /> Recurso ainda não disponível no servidor. Nada foi alterado.</p>
    <p v-else-if="estado === 'erro'" class="vref__erro" role="alert"><CircleAlert :size="16" /> {{ erro }} <button type="button" class="vref__btn" @click="carregar"><RefreshCw :size="13" /> Tentar novamente</button></p>
    <form v-else class="vref__form" @submit.prevent="salvar">
      <p v-if="aviso" class="vref__ok vref__full" role="status">{{ aviso }}</p>
      <p v-if="erro" class="vref__erro vref__full" role="alert"><CircleAlert :size="16" /> {{ erro }}</p>
      <label>Marca do aparelho<select v-model="form.marca"><option value="">Não informada</option><option v-for="(n, k) in MARCAS_REFRIGERACAO" :key="k" :value="k">{{ n }}</option></select><small v-if="erros.marca" class="vref__err">{{ erros.marca }}</small></label>
      <label v-if="form.marca === 'outra'">Nome da marca *<input v-model="form.marca_outra" maxlength="80" /><small v-if="erros.marca_outra" class="vref__err">{{ erros.marca_outra }}</small></label>
      <label>Modelo<input v-model="form.modelo" maxlength="120" /></label>
      <label>ID do aparelho<input v-model="form.id_aparelho" maxlength="80" /></label>
      <label>Nº de série<input v-model="form.numero_serie" maxlength="120" /></label>
      <label>Horímetro (horas, opcional)<input v-model="form.horimetro_horas" type="number" min="0" step="1" /><small v-if="erros.horimetro_horas" class="vref__err">{{ erros.horimetro_horas }}</small></label>
      <label>Instalado em<input v-model="form.instalado_em" type="date" /></label>
      <div class="vref__full"><button type="submit" class="vref__btn vref__btn--p" :disabled="salvando">{{ salvando ? 'Salvando…' : 'Salvar refrigeração' }}</button>
        <small class="vref__nota"> Todos os campos são opcionais.</small></div>
    </form>
  </div>
</template>

<style scoped src="@/styles/components/registrations/vehicles/details/vehicle_refrigeration.css"></style>
