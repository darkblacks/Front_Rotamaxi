import http from '@/services/api/http.js';

/**
 * Endpoints do cadastro completo (contrato_api.md, seção "Cadastro completo").
 * PENDENTES no servidor: 404 vira estado "recurso ainda não disponível" na tela (nunca dado falso).
 */
const raiz = '/admin/veiculos';

export const indisponivel = (error) => error?.response?.status === 404;

export async function listarDocumentos(id) {
  const { data } = await http.get(`${raiz}/${id}/documentos`);
  if (!Array.isArray(data?.data)) throw new Error('Resposta inesperada da lista de documentos.');
  return { itens: data.data, diasAlerta: Number(data.meta?.alerta_vencimento_dias) || 30 };
}
export async function gravarDocumento(id, doc, docId = null) {
  const { data } = await (docId ? http.put(`${raiz}/${id}/documentos/${docId}`, doc) : http.post(`${raiz}/${id}/documentos`, doc));
  if (!data?.data?.id) throw new Error('A API não confirmou o documento.');
  return data.data;
}
export async function excluirDocumento(id, docId, motivo) {
  await http.delete(`${raiz}/${id}/documentos/${docId}`, { data: { motivo } });
}
export async function enviarArquivoDocumento(id, docId, arquivo) {
  const { data: p } = await http.post(`${raiz}/${id}/documentos/${docId}/arquivo/presign`, {
    mime: arquivo.type === 'application/pdf' ? 'pdf' : arquivo.type === 'image/png' ? 'png' : 'jpeg', tamanho: arquivo.size,
  });
  if (!p?.url || !p?.object_key) throw new Error('Não foi possível preparar o envio do arquivo.');
  const r = await fetch(p.url, { method: p.metodo || 'PUT', headers: p.headers || {}, body: arquivo });
  if (!r.ok) throw new Error(`Falha no armazenamento do arquivo (${r.status}).`);
  const { data } = await http.post(`${raiz}/${id}/documentos/${docId}/arquivo/confirmar`, { object_key: p.object_key, nome: arquivo.name });
  return data?.data ?? null;
}
export async function urlArquivoDocumento(id, docId) {
  const { data } = await http.get(`${raiz}/${id}/documentos/${docId}/arquivo/url`);
  if (!data?.url) throw new Error('Arquivo indisponível.');
  return data.url;
}

export async function buscarRefrigeracao(id) {
  const { data } = await http.get(`${raiz}/${id}/refrigeracao`);
  return data?.data ?? null;
}
export async function gravarRefrigeracao(id, payload) {
  const { data } = await http.put(`${raiz}/${id}/refrigeracao`, payload);
  return { dados: data?.data ?? null, avisos: data?.avisos ?? [] };
}
export async function removerRefrigeracao(id) {
  await http.delete(`${raiz}/${id}/refrigeracao`);
}

export async function resumoFinanceiro(id) {
  const { data } = await http.get(`${raiz}/${id}/resumo-financeiro`);
  return data?.data ?? null;
}
