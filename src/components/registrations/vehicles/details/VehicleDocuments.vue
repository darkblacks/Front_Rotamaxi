<script setup>
import { computed, ref, watch } from 'vue';
import { CircleAlert, FileText, Pencil, Plus, RefreshCw, Trash2, UploadCloud } from 'lucide-vue-next';
import { listarDocumentos, gravarDocumento, excluirDocumento, enviarArquivoDocumento, urlArquivoDocumento, indisponivel } from '@/services/api/vehicle-extra.api.js';
import { falhaFrota } from '@/services/api/fleet.api.js';
import { TIPOS_DOCUMENTO, ROTULO_SITUACAO, situacaoDocumento, validarDocumento, resumoDocumentos } from '@/domain/vehicles/registration.js';

const props = defineProps({ veiculoId: { type: [String, Number], default: null } });
const emit = defineEmits(['resumo']);

const itens = ref([]);
const diasAlerta = ref(30);
const estado = ref('carregando'); // carregando | ok | erro | indisponivel | sem_veiculo
const erro = ref('');
const aviso = ref('');
const salvando = ref(false);
const formAberto = ref(false);
const editandoId = ref(null);
const arquivo = ref(null);
const erros = ref({});
const vazio = () => ({ tipo: 'CRLV', numero: '', emissao: '', validade: '', exercicio: '', emissor: '' });
const form = ref(vazio());

const lista = computed(() => itens.value.map((d) => ({ ...d, _sit: d.situacao ?? situacaoDocumento(d.validade, new Date(), diasAlerta.value) })));

async function carregar() {
  erro.value = '';
  if (!props.veiculoId) { estado.value = 'sem_veiculo'; return; }
  estado.value = 'carregando';
  try {
    const r = await listarDocumentos(props.veiculoId);
    itens.value = r.itens; diasAlerta.value = r.diasAlerta; estado.value = 'ok';
    emit('resumo', resumoDocumentos(r.itens));
  } catch (e) {
    if (indisponivel(e)) { estado.value = 'indisponivel'; return; }
    estado.value = 'erro'; erro.value = falhaFrota(e, 'os documentos do veículo');
  }
}
watch(() => props.veiculoId, carregar, { immediate: true });

function abrir(doc = null) {
  editandoId.value = doc?.id ?? null; arquivo.value = null; erros.value = {}; erro.value = '';
  form.value = doc ? { tipo: doc.tipo, numero: doc.numero ?? '', emissao: (doc.emissao ?? '').slice(0, 10), validade: (doc.validade ?? '').slice(0, 10), exercicio: doc.exercicio ?? '', emissor: doc.emissor ?? '' } : vazio();
  formAberto.value = true;
}
function escolherArquivo(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  if (!['application/pdf', 'image/jpeg', 'image/png'].includes(f.type) || f.size > 10 * 1024 * 1024) {
    erro.value = 'Arquivo precisa ser PDF, JPG ou PNG de até 10 MB.'; e.target.value = ''; return;
  }
  erro.value = ''; arquivo.value = f;
}
async function salvar() {
  const v = validarDocumento(form.value);
  erros.value = v.erros;
  if (!v.ok) return;
  salvando.value = true; erro.value = ''; aviso.value = '';
  const payload = Object.fromEntries(Object.entries(form.value).filter(([, x]) => x !== '' && x != null));
  if (payload.exercicio) payload.exercicio = Number(payload.exercicio);
  try {
    const salvo = await gravarDocumento(props.veiculoId, payload, editandoId.value);
    if (arquivo.value) {
      try { await enviarArquivoDocumento(props.veiculoId, salvo.id, arquivo.value); }
      catch (e) { aviso.value = `Documento salvo, mas o arquivo falhou: ${falhaFrota(e, 'o envio do arquivo')}`; }
    }
    if (!aviso.value) aviso.value = 'Documento salvo.';
    formAberto.value = false;
    await carregar();
  } catch (e) {
    erro.value = falhaFrota(e, 'o cadastro de documentos');
  } finally { salvando.value = false; }
}
async function remover(doc) {
  const motivo = window.prompt('Motivo da exclusão do documento (obrigatório):');
  if (!motivo || motivo.trim().length < 3) return;
  try { await excluirDocumento(props.veiculoId, doc.id, motivo.trim()); aviso.value = 'Documento excluído.'; await carregar(); }
  catch (e) { erro.value = falhaFrota(e, 'a exclusão do documento'); }
}
async function abrirArquivo(doc) {
  try { window.open(await urlArquivoDocumento(props.veiculoId, doc.id), '_blank', 'noopener'); }
  catch (e) { erro.value = falhaFrota(e, 'o arquivo do documento'); }
}
const dataBr = (d) => (d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : '—');
const tom = { vigente: 'ok', a_vencer: 'warn', vencido: 'bad', sem_validade: 'neutro' };
</script>

<template>
  <div class="vdoc" aria-live="polite">
    <p v-if="estado === 'sem_veiculo'" class="vdoc__nota">Salve o veículo primeiro; depois cadastre CRLV, seguro, ANTT/RNTRC, GR e outros documentos.</p>
    <p v-else-if="estado === 'carregando'" class="vdoc__nota" aria-busy="true">Carregando documentos…</p>
    <p v-else-if="estado === 'indisponivel'" class="vdoc__indisp" role="status"><CircleAlert :size="16" /> Recurso ainda não disponível no servidor. Documentos serão habilitados após a atualização do sistema; nada foi alterado.</p>
    <p v-else-if="estado === 'erro'" class="vdoc__erro" role="alert"><CircleAlert :size="16" /> {{ erro }} <button type="button" class="vdoc__btn" @click="carregar"><RefreshCw :size="13" /> Tentar novamente</button></p>
    <template v-else>
      <p v-if="aviso" class="vdoc__ok" role="status">{{ aviso }}</p>
      <p v-if="erro" class="vdoc__erro" role="alert"><CircleAlert :size="16" /> {{ erro }}</p>
      <div class="vdoc__topo"><span class="vdoc__nota">Alerta de vencimento: {{ diasAlerta }} dias. O sistema não atesta a regularidade legal do documento.</span>
        <button type="button" class="vdoc__btn vdoc__btn--p" @click="abrir()"><Plus :size="14" /> Adicionar documento</button></div>
      <p v-if="!lista.length" class="vdoc__vazio">Nenhum documento cadastrado. Documentos são opcionais e não impedem o cadastro.</p>
      <ul v-else class="vdoc__lista">
        <li v-for="d in lista" :key="d.id">
          <FileText :size="18" aria-hidden="true" />
          <div class="vdoc__info"><strong>{{ TIPOS_DOCUMENTO[d.tipo] ?? d.tipo }}</strong>
            <small>Nº {{ d.numero || '—' }} · emissão {{ dataBr(d.emissao) }} · validade {{ dataBr(d.validade) }}<template v-if="d.exercicio"> · exercício {{ d.exercicio }}</template><template v-if="d.emissor"> · {{ d.emissor }}</template></small></div>
          <span class="vdoc__badge" :class="`vdoc__badge--${tom[d._sit]}`">{{ ROTULO_SITUACAO[d._sit] }}</span>
          <div class="vdoc__acoes">
            <button v-if="d.tem_arquivo" type="button" class="vdoc__btn" @click="abrirArquivo(d)">Ver arquivo</button>
            <button type="button" class="vdoc__btn" :aria-label="`Editar ${TIPOS_DOCUMENTO[d.tipo] ?? d.tipo}`" @click="abrir(d)"><Pencil :size="13" /></button>
            <button type="button" class="vdoc__btn" :aria-label="`Excluir ${TIPOS_DOCUMENTO[d.tipo] ?? d.tipo}`" @click="remover(d)"><Trash2 :size="13" /></button>
          </div>
        </li>
      </ul>
      <form v-if="formAberto" class="vdoc__form" @submit.prevent="salvar">
        <label>Tipo *<select v-model="form.tipo"><option v-for="(n, k) in TIPOS_DOCUMENTO" :key="k" :value="k">{{ n }}</option></select><small v-if="erros.tipo" class="vdoc__err">{{ erros.tipo }}</small></label>
        <label>Número<input v-model="form.numero" maxlength="255" /></label>
        <label>Emissão<input v-model="form.emissao" type="date" /><small v-if="erros.emissao" class="vdoc__err">{{ erros.emissao }}</small></label>
        <label>Validade<input v-model="form.validade" type="date" /><small v-if="erros.validade" class="vdoc__err">{{ erros.validade }}</small></label>
        <label>Exercício<input v-model="form.exercicio" type="number" min="1990" /><small v-if="erros.exercicio" class="vdoc__err">{{ erros.exercicio }}</small></label>
        <label>Emissor (seguradora / órgão)<input v-model="form.emissor" maxlength="120" /></label>
        <label class="vdoc__arq"><span><UploadCloud :size="14" /> Arquivo (PDF/JPG/PNG, até 10 MB)</span><input type="file" accept="application/pdf,image/jpeg,image/png" @change="escolherArquivo" /><small v-if="arquivo">{{ arquivo.name }}</small></label>
        <div class="vdoc__fim"><button type="submit" class="vdoc__btn vdoc__btn--p" :disabled="salvando">{{ salvando ? 'Salvando…' : 'Salvar documento' }}</button><button type="button" class="vdoc__btn" @click="formAberto = false">Cancelar</button></div>
      </form>
    </template>
  </div>
</template>

<style scoped src="@/styles/components/registrations/vehicles/details/vehicle_documents.css"></style>
