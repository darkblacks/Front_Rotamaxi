import http, { extrairFalha } from '@/services/api/http.js';

const raiz = '/admin';
export const ROTAMAXI_CADASTROS = Object.freeze({
  'veiculos:placas': 'veiculos', 'veiculos:marcas': 'marcas',
  'veiculos:modelos': 'modelos', 'veiculos:tipos': 'tipos-veiculo',
  'clientes:todos': 'clientes', 'unidades:enderecos': 'unidades', 'filiais:todas': 'filiais',
  'terceiros:transporte': 'prestadores-servico', 'terceiros:gerais': 'prestadores-servico',
});
export const obterRecurso = (secao, aba) => ROTAMAXI_CADASTROS[`${secao}:${aba}`]
  || (secao === 'clientes' ? 'clientes' : secao === 'unidades' ? 'unidades' : secao === 'terceiros' ? 'prestadores-servico' : null);
export const limparOpcional = (obj) => Object.fromEntries(Object.entries(obj)
  .filter(([, v]) => v !== undefined && v !== '')
  .map(([k,v]) => [k, typeof v === 'string' ? v.trim() : v]));
export const paraNumeroOuNull = (valor) => valor === '' || valor == null ? null : Number(valor);
export const falhaCadastro = (error) => {
  if (error instanceof Error && !error.response && !error.isAxiosError) return error.message;
  const f = extrairFalha(error);
  const detalhe = Object.values(f.errors || {}).flat().filter(Boolean).slice(0,4).join(' · ');
  return detalhe || f.mensagem || 'Não foi possível concluir a operação.';
};
export async function listarCadastro(recurso, filtros = {}) {
  const { data } = await http.get(`${raiz}/cadastros/${recurso}`, { params: filtros });
  if (!Array.isArray(data?.data)) throw new Error('Resposta inesperada da listagem de cadastros.');
  return data;
}
export async function buscarCadastro(recurso, id) {
  const { data } = await http.get(`${raiz}/cadastros/${recurso}/${id}`);
  if (!data?.data?.id) throw new Error('Cadastro não encontrado na API.');
  return data.data;
}
export async function gravarCadastro(recurso, registro, id = null) {
  const { data } = await (id ? http.put(`${raiz}/cadastros/${recurso}/${id}`, registro)
    : http.post(`${raiz}/cadastros/${recurso}`, registro));
  if (!data?.data?.id) throw new Error('A API não confirmou o registro.');
  return data.data;
}
export async function listarPessoas(filtros = {}) {
  const { data } = await http.get(`${raiz}/pessoas`, { params: filtros });
  if (!Array.isArray(data?.data)) throw new Error('Resposta inesperada da listagem de pessoas.');
  return data;
}
export async function consultarPessoa(id) {
  const { data } = await http.get(`${raiz}/pessoas/${id}`);
  if (!data?.data?.id) throw new Error('A API não encontrou a pessoa.');
  return data.data;
}
export async function gravarPessoa(payload, id = null) {
  const { data } = await (id ? http.put(`${raiz}/pessoas/${id}`, payload) : http.post(`${raiz}/pessoas`, payload));
  if (!data?.data?.id) throw new Error('A API não confirmou a pessoa.');
  return data.data;
}
export async function listarFiliais() {
  const { data } = await http.get(`${raiz}/pessoas/filiais`);
  if (!Array.isArray(data?.data)) throw new Error('A API não retornou filiais.');
  return data.data;
}
export async function configurarAcessoPessoa(id, payload) {
  const { data } = await http.post(`${raiz}/pessoas/${id}/acesso`, payload);
  if (!data?.message) throw new Error('A API não confirmou a alteração de acesso.');
  if (payload?.habilitado) {
    if (!data?.usuario_id) throw new Error('A API não devolveu o usuário após habilitar o acesso.');
    const esperado = [...(payload.papeis || [])].map(String).sort();
    const recebido = [...(data.papeis || [])].map(String).sort();
    if (esperado.join('|') !== recebido.join('|')) {
      throw new Error(`A API não confirmou os papéis solicitados. Esperado: ${esperado.join(', ') || 'nenhum'}; recebido: ${recebido.join(', ') || 'nenhum'}.`);
    }
  }
  return data;
}
export async function obterFotoPessoaUrl(pessoaId) {
  const { data } = await http.get(`${raiz}/pessoas/${pessoaId}/foto/url`);
  return data?.url || '';
}
export async function consultarEslCpf(cpf) {
  const { data } = await http.get(`${raiz}/pessoas/esl/buscar`, { params: { cpf } });
  return data.data;
}
export async function estadoEslPessoa(id) {
  const { data } = await http.get(`${raiz}/pessoas/${id}/esl`);
  return data.data;
}
export async function vincularEslPessoa(id, espelhoId, modo, importarCampos = []) {
  const { data } = await http.post(`${raiz}/pessoas/${id}/esl/vincular`, {
    espelho_id: espelhoId, modo, importar_campos: importarCampos,
  });
  return data.data;
}
export async function vincularEslReferencia(id, externoId, modo) {
  const { data } = await http.post(`${raiz}/pessoas/${id}/esl/vincular-referencia`, { externo_id: externoId, modo });
  return data.data;
}
export async function sincronizarEslPessoa(id, campos) {
  const { data } = await http.post(`${raiz}/pessoas/${id}/esl/sincronizar`, { campos });
  return data.data;
}
export async function desvincularEslPessoa(id) {
  await http.delete(`${raiz}/pessoas/${id}/esl`);
}
export async function listarVinculosEsl(entidade, localId) {
  const { data } = await http.get(`${raiz}/integracoes/esl/vinculos`, { params: { entidade, local_id: localId } });
  return data.data || [];
}
export async function criarVinculoEsl(entidade, localId, externoId, modo) {
  const { data } = await http.post(`${raiz}/integracoes/esl/vinculos`, {
    entidade, local_id: localId, externo_id: externoId, modo,
  });
  return data.data;
}
export async function excluirVinculoEsl(id) {
  await http.delete(`${raiz}/integracoes/esl/vinculos/${id}`);
}
// PUT assinado: sem Bearer, sem Axios e sem interceptadores do backend.
export async function enviarFotoPessoa(pessoaId, arquivo) {
  const tipos = ['image/jpeg', 'image/png', 'image/webp'];
  if (!tipos.includes(arquivo?.type)) throw new Error('Foto deve ser JPG, PNG ou WEBP.');
  if (!arquivo.size || arquivo.size > 5 * 1024 * 1024) throw new Error('Foto deve ter até 5 MB.');
  const { data: presign } = await http.post(`${raiz}/pessoas/${pessoaId}/foto/presign`, {
    mime: arquivo.type, tamanho: arquivo.size,
  });
  if (!presign?.url || !presign?.object_key) throw new Error('R2 não devolveu URL de upload.');
  const resp = await fetch(presign.url, { method: 'PUT', headers: presign.headers || {}, body: arquivo });
  if (!resp.ok) throw new Error(`R2 recusou a foto (HTTP ${resp.status}). Confira CORS e configuração do bucket.`);
  const { data: foto } = await http.post(`${raiz}/pessoas/${pessoaId}/foto/confirmar`, { object_key: presign.object_key });
  if (!foto?.url) throw new Error('Arquivo enviado ao R2, mas a confirmação da foto falhou.');
  return foto;
}
export async function removerFotoPessoa(pessoaId) {
  await http.delete(`${raiz}/pessoas/${pessoaId}/foto`);
}

export async function enviarLogoPrestador(prestadorId, arquivo) {
  const tipos = ['image/jpeg', 'image/png', 'image/webp'];
  if (!tipos.includes(arquivo?.type)) throw new Error('A logo deve ser JPG, PNG ou WEBP.');
  if (!arquivo.size || arquivo.size > 5 * 1024 * 1024) throw new Error('A logo deve ter até 5 MB.');
  const { data: presign } = await http.post(`${raiz}/prestadores/${prestadorId}/logo/presign`, {
    mime: arquivo.type, tamanho: arquivo.size,
  });
  if (!presign?.url || !presign?.object_key) throw new Error('Não foi possível preparar o envio da logo.');
  const resp = await fetch(presign.url, { method: 'PUT', headers: presign.headers || {}, body: arquivo });
  if (!resp.ok) throw new Error(`Não foi possível enviar a logo (HTTP ${resp.status}).`);
  const { data: logo } = await http.post(`${raiz}/prestadores/${prestadorId}/logo/confirmar`, { object_key: presign.object_key });
  if (!logo?.url) throw new Error('A logo foi enviada, mas não foi confirmada.');
  return logo;
}
export async function removerLogoPrestador(prestadorId) {
  await http.delete(`${raiz}/prestadores/${prestadorId}/logo`);
}

// Acessos são registros de users, não um filtro de pessoas (que pode não existir no legado).
export async function listarUsuarios(filtros = {}) {
  const { data } = await http.get(`${raiz}/usuarios`, { params: filtros });
  if (!Array.isArray(data?.data)) throw new Error('A API não retornou a lista de usuários. Verifique se o patch de acessos foi implantado no backend.');
  return data;
}
export async function vincularUsuarioPessoa(usuarioId, pessoaId) {
  const { data } = await http.post(`${raiz}/usuarios/${usuarioId}/vincular-pessoa`, { pessoa_id: Number(pessoaId) });
  if (!data?.data?.pessoa_id) throw new Error('A API não confirmou o vínculo do usuário com a Pessoa.');
  return data.data;
}
export async function definirPinUsuario(usuarioId, pin) {
  const { data } = await http.post(`${raiz}/usuarios/${usuarioId}/pin`, { pin });
  if (!data?.message) throw new Error('A API não confirmou a definição de PIN.');
  return data;
}

// Ficha de frota V7.7: FIPE sempre consultada pelo backend, não pelo browser.
export async function catalogoFipeMarcas(tipo) {
  const { data } = await http.get(`${raiz}/veiculos/catalogo/marcas`, { params:{ tipo } });
  return data.data || [];
}
export async function catalogoFipeModelos(tipo, marcaCodigo) {
  const { data } = await http.get(`${raiz}/veiculos/catalogo/modelos`, { params:{ tipo, marca_codigo:marcaCodigo } });
  return data.data || [];
}
// V7.8: o banco local agora é a fonte de marca/modelo; FIPE é sincronizada em lote no backend.
export async function catalogoLocalMarcas(tipo) {
  const { data } = await http.get(`${raiz}/veiculos/catalogo-local/marcas`, { params:{ tipo } });
  return data.data || [];
}
export async function catalogoLocalModelos(marcaId) {
  const { data } = await http.get(`${raiz}/veiculos/catalogo-local/modelos`, { params:{ marca_id:marcaId } });
  return data.data || [];
}
// V7.9.3: anos manuais já utilizados nesse modelo, sem inventar cotação FIPE.
export async function catalogoAnosModeloLocal(marcaId,modeloId) {
  const { data } = await http.get(`${raiz}/veiculos/catalogo-local/anos-locais`, {
    params:{marca_id:marcaId,modelo_id:modeloId},
  });
  return data.data || [];
}
// V7.9.2: preços FIPE sob demanda. IDs locais impedem consulta de marca/modelo não correspondente.
export async function catalogoFipeAnosLocais(tipo, marcaId, modeloId) {
  const { data } = await http.get(`${raiz}/veiculos/catalogo-local/fipe/anos`, {
    params:{ tipo, marca_id:marcaId, modelo_id:modeloId },
  });
  return data.data || [];
}
export async function catalogoFipeCotacaoLocal(tipo, marcaId, modeloId, anoCodigo) {
  const { data } = await http.get(`${raiz}/veiculos/catalogo-local/fipe/cotacao`, {
    params:{ tipo, marca_id:marcaId, modelo_id:modeloId, ano_codigo:anoCodigo },
  });
  return data.data;
}
export async function imagensReferenciaCatalogo(marcaId, modeloId=null) {
  const { data } = await http.get(`${raiz}/veiculos/catalogo-local/imagens`, { params:{marca_id:marcaId,...(modeloId?{modelo_id:modeloId}:{})} });
  return data.data || [];
}
export async function vincularImagemCatalogo(marcaId, modeloId, indice) {
  const { data } = await http.post(`${raiz}/veiculos/catalogo-local/imagens`, { marca_id:marcaId,...(modeloId?{modelo_id:modeloId}:{}),indice });
  return data.data;
}
export async function fotosVeiculo(id) {
  const { data } = await http.get(`${raiz}/veiculos/${id}/fotos`);
  return data.data || {};
}
export async function enviarFotoVeiculo(id, posicao, arquivo) {
  const { data:presign } = await http.post(`${raiz}/veiculos/${id}/fotos/${posicao}/presign`, {
    mime:arquivo.type, tamanho:arquivo.size,
  });
  if (!presign?.url || !presign?.object_key) throw new Error('Não foi possível preparar o envio da foto.');
  const resposta = await fetch(presign.url, { method:'PUT', headers:presign.headers || {}, body:arquivo });
  if (!resposta.ok) throw new Error(`Falha no armazenamento da foto (${resposta.status}).`);
  const { data } = await http.post(`${raiz}/veiculos/${id}/fotos/${posicao}/confirmar`, { object_key:presign.object_key });
  return data.url;
}
export async function excluirFotoVeiculo(id, posicao) {
  await http.delete(`${raiz}/veiculos/${id}/fotos/${posicao}`);
}
export async function importarVeiculosEsl(itens, { simular=true, modo='importar', completarExistentes=false, cadastrarPrestadoresNovos=false }={}) {
  const { data } = await http.post(`${raiz}/veiculos/importacao-esl`, { itens, simular, modo, completar_existentes:completarExistentes, cadastrar_prestadores_novos:Boolean(cadastrarPrestadoresNovos) });
  const linhas = Array.isArray(data.data) ? data.data : [];
  // Mantém o retorno como lista (compatível) e expõe os metadados do lote como propriedades.
  linhas.contagens = data.contagens || null;
  linhas.aplicado = Boolean(data.aplicado);
  return linhas;
}
