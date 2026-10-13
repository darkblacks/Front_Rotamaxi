/** Auxiliares puros da importação ESL: soma de contagens por lote, rótulos e CSV seguro. */
export const CHAVES_CONTAGEM = ['criar', 'atualizar', 'inalterados', 'revisar', 'invalidas', 'duplicadas', 'conflito',
  'vincular', 'sem_cadastro', 'prestadores_existentes', 'prestadores_novos_candidatos', 'prestadores_ambiguos',
  'prestadores_revisar', 'prestadores_criados'];

/** Soma `contagens` de vários lotes. Ausente/não numérico conta 0; prestadores_criados null em todos -> null. */
export function somarContagens(lotes) {
  const total = Object.fromEntries(CHAVES_CONTAGEM.map(k => [k, 0]));
  let criadosInformado = false;
  for (const c of lotes || []) {
    if (!c || typeof c !== 'object') continue;
    for (const k of CHAVES_CONTAGEM) {
      const v = c[k];
      if (v === null || v === undefined) continue;
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      total[k] += n;
      if (k === 'prestadores_criados') criadosInformado = true;
    }
  }
  if (!criadosInformado) total.prestadores_criados = null;
  return total;
}

/** Contagem derivada das linhas (fallback quando a prévia foi alterada após a simulação). */
export function contarLinhas(linhas) {
  const c = Object.fromEntries(CHAVES_CONTAGEM.map(k => [k, 0]));
  c.prestadores_criados = null;
  for (const r of linhas || []) {
    const a = r.acao;
    if (a === 'criar') c.criar++;
    else if (['completar', 'vincular', 'vincular_e_completar'].includes(a)) c.atualizar++;
    else if (a === 'existente') c.inalterados++;
    else if (a === 'revisar') c.revisar++;
    else if (a === 'invalida') c.invalidas++;
    else if (a === 'duplicada') c.duplicadas++;
    else if (a === 'conflito') c.conflito++;
    else if (a === 'sem_cadastro') c.sem_cadastro++;
    const cl = r.prestador_classe;
    if (cl === 'exato_existente' || cl === 'normalizado_existente') c.prestadores_existentes++;
    else if (cl === 'novo_empresa') c.prestadores_novos_candidatos++;
    else if (cl === 'possivel_duplicado') c.prestadores_ambiguos++;
    if (r.prestador_acao === 'revisar') c.prestadores_revisar++;
  }
  return c;
}

export const rotuloClassePrestador = x => ({
  exato_existente: 'Já cadastrado (exato)',
  normalizado_existente: 'Já cadastrado (nome normalizado)',
  possivel_duplicado: 'Possível duplicado — escolha',
  novo_empresa: 'Empresa nova',
  novo_pessoa_fisica_provavel: 'Pessoa física provável (não será cadastrada)',
  invalido: 'Nome inválido',
  sem_agregado: 'Sem agregado',
})[x] || (x ? String(x) : '—');

export const rotuloAcaoPrestador = x => ({
  vinculado: 'Vinculado', criado: 'Cadastrado', revisar: 'Revisar', nenhum: 'Nenhuma',
})[x] || (x ? String(x) : '—');

/** Neutraliza injeção de fórmula (=,+,-,@, tab/CR iniciais) e escapa para ';' separador. */
export function celulaCsvSegura(valor) {
  let t = valor === null || valor === undefined ? '' : String(valor);
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
  if (/[";\r\n]/.test(t)) t = '"' + t.replace(/"/g, '""') + '"';
  return t;
}

export const CABECALHO_RELATORIO = ['Linha', 'Placa', 'Resultado', 'Motivo', 'Prestador no ESL', 'Classe do prestador',
  'Ação no prestador', 'Prestador criado (ID)'];

/** CSV com BOM, separador ';' e CRLF. */
export function gerarCsvRelatorio(linhas, { rotuloAcao = x => x } = {}) {
  const corpo = (linhas || []).map(r => [r.linha, r.placa, rotuloAcao(r.acao), r.motivo, r.prestador_nome_origem,
    rotuloClassePrestador(r.prestador_classe), rotuloAcaoPrestador(r.prestador_acao), r.prestador_criado_id]
    .map(celulaCsvSegura).join(';'));
  return '﻿' + [CABECALHO_RELATORIO.map(celulaCsvSegura).join(';'), ...corpo].join('\r\n') + '\r\n';
}
