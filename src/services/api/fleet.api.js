import http, { extrairFalha } from '@/services/api/http.js';
import { mensagemFalhaFrota } from '@/domain/vehicles/fleet-model.js';

/**
 * Chamadas da Central de Frota / Detalhe. Contrato: docs/entregas/VEICULOS-FIPE/contrato_api.md.
 * Nenhuma função devolve dado inventado: sem 2xx com o formato esperado, lança erro.
 * Os endpoints de frota/vínculo/avaliação são NOVOS e podem responder 404 até o deploy do backend.
 */
const raiz = '/admin/veiculos';

/** Texto pt-BR para qualquer erro lançado por este serviço. */
export function falhaFrota(error, contexto) {
  if (error instanceof Error && !error.response && !error.isAxiosError) return error.message;
  return mensagemFalhaFrota(extrairFalha(error), contexto);
}

/** Exclui um veículo da frota. O backend deve realizar soft-delete ou exclusão conforme sua regra de domínio. */
export async function excluirVeiculo(id) {
  try {
    const { data } = await http.delete(`/admin/cadastros/veiculos/${id}`);
    return data;
  } catch (error) {
    const status = error?.response?.status;
    if (status === 404 || status === 405) {
      const { data } = await http.delete(`${raiz}/${id}`);
      return data;
    }
    throw error;
  }
}

export async function listarFrota(params = {}, { signal } = {}) {
  const { data } = await http.get(`${raiz}/frota`, { params, signal });
  if (!Array.isArray(data?.data)) throw new Error('Resposta inesperada da listagem da frota.');
  return data;
}

export async function buscarVeiculoFrota(id) {
  const data = await listarFrota({ id, per_page: 1 });
  const linha = data.data.find((v) => String(v.id) === String(id));
  if (!linha) throw new Error('Veículo não encontrado na frota.');
  return { linha, meta: data.meta ?? {} };
}

export async function vincularFipe(id, { tipo, marca_id, modelo_id, ano_codigo }) {
  const { data } = await http.post(`${raiz}/${id}/fipe/vinculo`, { tipo, marca_id, modelo_id, ano_codigo });
  return data?.data ?? data;
}

export async function desfazerVinculoFipe(id, motivo) {
  const { data } = await http.delete(`${raiz}/${id}/fipe/vinculo`, { data: { motivo } });
  return data;
}

export async function marcarSemEquivalenteFipe(id, motivo) {
  const { data } = await http.post(`${raiz}/${id}/fipe/sem-equivalente`, { motivo });
  return data;
}

export async function registrarAvaliacaoManual(id, { valor, fonte, data: dataAvaliacao }) {
  const { data } = await http.post(`${raiz}/${id}/avaliacao-manual`, { valor, fonte, data: dataAvaliacao });
  if (!data?.data) throw new Error('A API não confirmou a avaliação manual.');
  return data.data;
}

export async function listarAvaliacoes(id) {
  const { data } = await http.get(`${raiz}/${id}/avaliacoes`);
  if (!Array.isArray(data?.data)) throw new Error('Resposta inesperada do histórico de avaliações.');
  return data.data;
}

// Já existentes no backend (routes/api.php:165-171).
export async function sugestaoFipe(id) {
  const { data } = await http.get(`${raiz}/${id}/fipe-probabilidade`);
  return data?.data ?? null;
}

export async function recalcularSugestaoFipe(id) {
  const { data } = await http.post(`${raiz}/${id}/fipe-probabilidade/recalcular`);
  return data?.data ?? null;
}
