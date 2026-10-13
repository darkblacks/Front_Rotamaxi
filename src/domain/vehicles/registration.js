/**
 * Lógica pura do cadastro completo de veículo (sem Vue, sem rede).
 * Regras: docs/entregas/VEICULOS-FIPE/regras_cad_cadastro_completo.tsv (CAD-*).
 * Só placa válida + categoria bloqueiam o salvamento (CAD-G01); o resto é aviso/pendência.
 */
export const FOTO_POSICOES = Object.freeze([
  ['frontal', 'Frontal'], ['traseira', 'Traseira'], ['lateral_esquerda', 'Lateral esquerda'], ['lateral_direita', 'Lateral direita'],
]);
export const TIPOS_DOCUMENTO = Object.freeze({
  CRLV: 'CRLV / licenciamento', SEGURO: 'Seguro', RNTRC_ANTT: 'ANTT / RNTRC', GR: 'GR (gerenciamento de risco)',
  LAUDO_INSPECAO: 'Laudo de inspeção', LAUDO_APARELHO_FRIO: 'Laudo do aparelho de frio', OUTRO: 'Outro',
});
export const MARCAS_REFRIGERACAO = Object.freeze({ thermo_king: 'Thermo King', carrier: 'Carrier', outra: 'Outra' });
export const ALERTA_VENCIMENTO_DIAS = 30;

export const normalizarPlaca = (p) => String(p ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

/** CAD-I02: formato antigo AAA9999 ou Mercosul AAA9A99. */
export function validarPlaca(entrada) {
  const placa = normalizarPlaca(entrada);
  if (!placa) return { ok: false, vazio: true, placa, formato: null, mensagem: 'Informe a placa.' };
  if (/^[A-Z]{3}[0-9]{4}$/.test(placa)) return { ok: true, placa, formato: 'antiga', mensagem: '' };
  if (/^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(placa)) return { ok: true, placa, formato: 'mercosul', mensagem: '' };
  return { ok: false, placa, formato: null, mensagem: 'Formato inválido. Use ABC1234 (antiga) ou ABC1D23 (Mercosul).' };
}

/** CAD-I07/I08: só dígitos, 11; 9-10 dígitos são completados com zeros (aviso, nunca bloqueio). */
export function validarRenavam(entrada) {
  const bruto = String(entrada ?? '').trim();
  if (!bruto) return { ok: true, vazio: true, valor: '', mensagem: '' };
  if (!/^[0-9]+$/.test(bruto)) return { ok: false, valor: bruto, mensagem: 'O RENAVAM deve ter apenas dígitos.' };
  if (bruto.length === 11) return { ok: true, valor: bruto, mensagem: '' };
  if (bruto.length >= 9 && bruto.length < 11) return { ok: true, valor: bruto.padStart(11, '0'), completado: true, mensagem: 'Menos de 11 dígitos: será completado com zeros à esquerda.' };
  return { ok: false, valor: bruto, mensagem: 'O RENAVAM deve ter 11 dígitos.' };
}

/** CAD-I10: 17 caracteres [A-HJ-NPR-Z0-9], sem I, O, Q. */
export function validarChassi(entrada) {
  const valor = String(entrada ?? '').replace(/\s/g, '').toUpperCase();
  if (!valor) return { ok: true, vazio: true, valor, mensagem: '' };
  if (/[IOQ]/.test(valor)) return { ok: false, valor, mensagem: 'O chassi não pode conter as letras I, O ou Q.' };
  if (!/^[A-Z0-9]+$/.test(valor)) return { ok: false, valor, mensagem: 'O chassi deve ter apenas letras e números.' };
  if (valor.length !== 17) return { ok: false, valor, mensagem: `O chassi deve ter 17 caracteres (tem ${valor.length}).` };
  return { ok: true, valor, mensagem: '' };
}

/** CAD-I14/I15: 1950..ano+1; modelo entre fabricação e fabricação+1 (aviso). */
export function validarAnos(fabricacao, modelo, hoje = new Date()) {
  const max = hoje.getFullYear() + 1;
  const num = (v) => (v === '' || v == null ? null : Number(v));
  const fab = num(fabricacao);
  const mod = num(modelo);
  const avisos = {};
  const fora = (n) => !Number.isInteger(n) || n < 1950 || n > max;
  if (fab !== null && fora(fab)) avisos.fabricacao = `Ano de fabricação deve estar entre 1950 e ${max}.`;
  if (mod !== null && fora(mod)) avisos.modelo = `Ano do modelo deve estar entre 1950 e ${max}.`;
  if (!avisos.fabricacao && !avisos.modelo && fab !== null && mod !== null && (mod < fab || mod > fab + 1)) {
    avisos.modelo = 'O ano do modelo costuma ser igual ou 1 ano após a fabricação.';
  }
  return { ok: Object.keys(avisos).length === 0, avisos };
}

/** CAD-R05: eixos inteiro 1..9, opcional. */
export function validarEixos(v) {
  if (v === '' || v == null) return { ok: true, mensagem: '' };
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 9 ? { ok: true, mensagem: '' } : { ok: false, mensagem: 'Eixos: número inteiro de 1 a 9.' };
}

/** Campos exibidos por categoria (CAD-M01 / CAD-R01). */
export function camposDaCategoria(categoria) {
  const reboque = categoria === 'reboque';
  return { reboque, combustivel: !reboque, motorista: !reboque, eixos: reboque, carroceria: reboque, fipe: !reboque, refrigeracao: reboque };
}

const dataIso = (d) => (d ? String(d).slice(0, 10) : '');
const paraData = (iso) => new Date(`${dataIso(iso)}T12:00:00`);
const dataValida = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(dataIso(iso)) && !Number.isNaN(paraData(iso).getTime());
const arredonda = (n) => Math.round(n * 100) / 100;

/**
 * Espelho cliente da depreciação linha reta (contrato_api.md): max(0, compra*(1 - taxa/100*dias/365)),
 * para em data_venda, só Próprio. Taxa nula/vazia => 'pendente' (nunca assume 20).
 * Valor contábil gerencial: NÃO é FIPE nem avaliação manual.
 */
export function depreciacaoLinhaReta({ vinculo, valor_compra, data_compra, taxa_depreciacao_anual, data_venda }, hoje = new Date()) {
  if (vinculo !== 'proprio') return { estado: 'nao_aplicavel', motivo: 'Depreciação só se aplica a veículo Próprio.' };
  const vazio = (v) => v === '' || v == null;
  if (vazio(valor_compra) || !(Number(valor_compra) > 0)) return { estado: 'pendente', motivo: 'Informe o valor de compra.' };
  if (!dataValida(data_compra)) return { estado: 'pendente', motivo: 'Informe a data de compra.' };
  if (vazio(taxa_depreciacao_anual)) return { estado: 'pendente', motivo: 'Informe a taxa anual de depreciação (não há taxa padrão).' };
  const taxa = Number(String(taxa_depreciacao_anual).replace(',', '.'));
  const compra = Number(String(valor_compra).replace(',', '.'));
  if (!Number.isFinite(taxa) || taxa < 0 || taxa > 100 || !Number.isFinite(compra)) return { estado: 'pendente', motivo: 'Taxa ou valor inválidos.' };
  const inicio = paraData(data_compra);
  let fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 12);
  let parouNaVenda = false;
  if (dataValida(data_venda)) { const v = paraData(data_venda); if (v <= fim) { fim = v; parouNaVenda = true; } }
  const dias = Math.max(0, Math.round((fim - inicio) / 86400000));
  const valorContabil = arredonda(Math.max(0, compra * (1 - (taxa / 100) * (dias / 365))));
  return { estado: 'calculado', dias, valor_contabil: valorContabil, depreciado: arredonda(compra - valorContabil), parouNaVenda, motivo: '' };
}

/** CAD-DMN2: vigente | a_vencer (<= N dias) | vencido | sem_validade. */
export function situacaoDocumento(validade, hoje = new Date(), dias = ALERTA_VENCIMENTO_DIAS) {
  if (!dataValida(validade)) return 'sem_validade';
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 12);
  const falta = Math.round((paraData(validade) - base) / 86400000);
  if (falta < 0) return 'vencido';
  return falta <= dias ? 'a_vencer' : 'vigente';
}
export const ROTULO_SITUACAO = Object.freeze({ vigente: 'Vigente', a_vencer: 'Vence em até 30 dias', vencido: 'Vencido', sem_validade: 'Sem validade' });

/** CAD-DOC04/DOC15: tipo obrigatório; validade >= emissão; exercício 1990..ano+1. */
export function validarDocumento(doc, hoje = new Date()) {
  const erros = {};
  if (!Object.hasOwn(TIPOS_DOCUMENTO, doc?.tipo)) erros.tipo = 'Escolha o tipo do documento.';
  if (doc?.emissao && !dataValida(doc.emissao)) erros.emissao = 'Data de emissão inválida.';
  if (doc?.validade && !dataValida(doc.validade)) erros.validade = 'Data de validade inválida.';
  if (!erros.emissao && !erros.validade && doc?.emissao && doc?.validade && dataIso(doc.validade) < dataIso(doc.emissao)) erros.validade = 'A validade não pode ser anterior à emissão.';
  if (doc?.exercicio !== '' && doc?.exercicio != null) {
    const e = Number(doc.exercicio);
    if (!Number.isInteger(e) || e < 1990 || e > hoje.getFullYear() + 1) erros.exercicio = `Exercício entre 1990 e ${hoje.getFullYear() + 1}.`;
  }
  return { ok: Object.keys(erros).length === 0, erros };
}

export function resumoDocumentos(lista, hoje = new Date()) {
  const r = { vencidos: 0, a_vencer: 0 };
  for (const d of lista ?? []) {
    const s = d.situacao ?? situacaoDocumento(d.validade, hoje);
    if (s === 'vencido') r.vencidos++;
    else if (s === 'a_vencer') r.a_vencer++;
  }
  return r;
}

/** CAD-REF02: tudo opcional; "outra" pede o nome; horímetro inteiro >= 0. */
export function validarRefrigeracao(f) {
  const erros = {};
  if (f?.marca && !Object.hasOwn(MARCAS_REFRIGERACAO, f.marca)) erros.marca = 'Marca inválida.';
  if (f?.marca === 'outra' && !String(f.marca_outra ?? '').trim()) erros.marca_outra = 'Informe o nome da marca.';
  if (f?.horimetro_horas !== '' && f?.horimetro_horas != null) {
    const h = Number(f.horimetro_horas);
    if (!Number.isInteger(h) || h < 0) erros.horimetro_horas = 'Horímetro: número inteiro de horas, 0 ou mais.';
  }
  return { ok: Object.keys(erros).length === 0, erros };
}

/** Fotos pendentes: informativo, nunca bloqueia (CAD: fotos não exigidas). Aceita {pos:url|{url}}. */
export function fotosPendentes(fotos) {
  const tem = (v) => Boolean(typeof v === 'string' ? v : v?.url);
  return FOTO_POSICOES.filter(([pos]) => !tem(fotos?.[pos])).map(([pos, nome]) => ({ pos, nome }));
}

/** Compara snapshots para o guarda de alterações não salvas. */
export const houveAlteracao = (a, b) => JSON.stringify(a) !== JSON.stringify(b);
