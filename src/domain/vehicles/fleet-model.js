/**
 * Lógica pura da Central de Frota / Detalhe / Consulta FIPE (sem Vue, sem rede).
 * Contrato de API: docs/entregas/VEICULOS-FIPE/contrato_api.md
 */
/** Categoria única: só 'proprio' e 'terceiro' ('agregado' legado = terceiro). */
export const PROPRIEDADES = Object.freeze({ proprio: 'Próprio', terceiro: 'Terceiro / Agregado' });
export const normalizarPropriedade = (p) => {
  const t = String(p ?? '').trim().toLowerCase();
  return t === 'próprio' ? 'proprio' : t === 'agregado' ? 'terceiro' : t;
};
export const STATUS = Object.freeze({ ativo: 'Ativo', inativo: 'Inativo / baixado', vendido: 'Vendido' });
export const COBERTURAS = Object.freeze({
  vinculado: 'Confirmada', provavel: 'Provável (não confirmada)', pendente: 'Sem FIPE',
  sem_cobertura: 'Indisponível (categoria)', desatualizado: 'Desatualizada',
});
export const PENDENCIAS = Object.freeze({ ambiguo: 'FIPE ambígua', anomalo: 'Valor anômalo', faltando: 'Informação ausente' });
export const CATEGORIAS_FIPE = Object.freeze({ cars: 'Carros', trucks: 'Caminhões', motorcycles: 'Motos' });
export const POR_PAGINA = 25;
export const ROTULO_AVALIACAO_MANUAL = 'AVALIAÇÃO MANUAL - NÃO É FIPE';

export const DOCUMENTACOES = Object.freeze({ vencida: 'Vencida', a_vencer: 'A vencer', em_dia: 'Em dia', sem_dados: 'Sem dados' });
export const STATUS_PADRAO = 'ativo';
/** Filtro de situação: 'todas' é explícito na URL; ausência = Ativo (padrão). */
export const STATUS_FILTRO = Object.freeze({ ativo: 'Ativo', inativo: 'Inativo / baixado', vendido: 'Vendido', todas: 'Todas' });
const CHAVES_ENUM = { propriedade: PROPRIEDADES, status: STATUS_FILTRO, documentacao: DOCUMENTACOES };
const CHAVES_TEXTO = ['tipo', 'classificacao', 'proprietario'];

/** Tetos iguais aos do backend (FrotaVeiculosController::index) para nunca provocar 422. */
export const LIMITES = { q: 80, tipo: 40, classificacao: 60, proprietario: 120 };

export const filtrosVazios = () => ({ q: '', propriedade: '', status: STATUS_PADRAO, tipo: '', classificacao: '', proprietario: '', documentacao: '', page: 1 });

const primeiro = (v) => (Array.isArray(v) ? v[0] : v);

/** Lê a query da URL; enums desconhecidos são descartados (a API devolveria 422). Classificação só existe com tipo. */
export function lerFiltrosDaUrl(query = {}) {
  const f = filtrosVazios();
  f.q = String(primeiro(query.q) ?? '').trim().slice(0, LIMITES.q);
  for (const [chave, validos] of Object.entries(CHAVES_ENUM)) {
    let v = String(primeiro(query[chave]) ?? '');
    if (chave === 'propriedade') v = normalizarPropriedade(v);
    if (Object.hasOwn(validos, v)) f[chave] = v;
  }
  for (const chave of CHAVES_TEXTO) f[chave] = String(primeiro(query[chave]) ?? '').trim().slice(0, LIMITES[chave] ?? 40);
  if (!f.tipo) f.tipo = classeParaFiltros(primeiro(query.classe)).tipo ?? '';
  if (!f.tipo) f.classificacao = '';
  if (f.propriedade === 'proprio') f.proprietario = '';
  const pagina = Number.parseInt(primeiro(query.page), 10);
  f.page = Number.isInteger(pagina) && pagina > 0 ? pagina : 1;
  return f;
}

/** Query de URL: só o que difere do padrão. Trocar o tipo zera a classificação. */
export function filtrosParaQuery(f) {
  const q = {};
  if (f.q?.trim()) q.q = f.q.trim();
  for (const chave of [...Object.keys(CHAVES_ENUM), ...CHAVES_TEXTO]) if (f[chave]) q[chave] = f[chave];
  if (q.status === STATUS_PADRAO) delete q.status;
  if (q.propriedade === 'proprio') delete q.proprietario;
  if (!q.tipo) delete q.classificacao;
  if (f.page > 1) q.page = String(f.page);
  return q;
}

/** Parâmetros da API: status=ativo vai explícito por padrão; 'todas' omite o parâmetro. */
export function filtrosParaParams(f, porPagina = POR_PAGINA) {
  const p = { ...filtrosParaQuery(f), page: f.page || 1, per_page: porPagina };
  const status = f.status || STATUS_PADRAO;
  if (status === 'todas') delete p.status; else p.status = status;
  return p;
}
export const temFiltroAtivo = (f) => Boolean(f.q?.trim() || f.propriedade || (f.status && f.status !== STATUS_PADRAO) || f.tipo || f.classificacao || f.proprietario || f.documentacao);

/** Aplica mudança de filtros: volta à página 1 e zera classificação quando o tipo muda. */
export function aplicarMudanca(atual, novos) {
  const proximo = { ...atual, ...novos };
  if ('tipo' in novos && novos.tipo !== atual.tipo) proximo.classificacao = '';
  if (!proximo.tipo) proximo.classificacao = '';
  if (proximo.propriedade === 'proprio') proximo.proprietario = '';
  if (!('page' in novos)) proximo.page = 1;
  return proximo;
}

/** Fonte das contagens: meta.facetas (preferida) ou meta.opcoes (legado). */
export const fonteOpcoes = (meta) => (meta?.facetas?.tipos ? meta.facetas : meta?.opcoes ?? null);

/** Opções de Propriedade com total: meta.facetas.propriedade; senão meta.totais. 'agregado' soma em terceiro. */
export function opcoesPropriedade(meta) {
  const soma = { proprio: 0, terceiro: 0 };
  let conhecido = false;
  const fac = meta?.facetas?.propriedade;
  if (Array.isArray(fac)) {
    conhecido = true;
    for (const x of fac) { const k = normalizarPropriedade(x.valor); if (k in soma) soma[k] += Number(x.total ?? 0); }
  } else if (meta?.totais) {
    const t = meta.totais;
    conhecido = true;
    soma.proprio = Number(t.proprio ?? 0);
    soma.terceiro = Number(t.terceiro ?? 0) + Number(t.agregado ?? 0);
  }
  const n = (v) => (conhecido ? v : null);
  return [
    { valor: '', rotulo: 'Todos', total: n(soma.proprio + soma.terceiro) },
    { valor: 'proprio', rotulo: PROPRIEDADES.proprio, total: n(soma.proprio) },
    { valor: 'terceiro', rotulo: PROPRIEDADES.terceiro, total: n(soma.terceiro) },
  ];
}

/** Proprietários: aceita strings ou {valor,total}. */
export const opcoesProprietarios = (meta) => (meta?.facetas?.proprietarios ?? meta?.opcoes?.proprietarios ?? [])
  .map((p) => (typeof p === 'string' ? { valor: p, total: null } : { valor: p.valor, total: p.total ?? null }))
  .filter((p) => p.valor);

/** Chips dos filtros ativos (Situação=Ativo é padrão e não gera chip). */
export function construirChips(f) {
  const chips = [];
  if (f.propriedade) chips.push({ chave: 'propriedade', rotulo: `Propriedade: ${PROPRIEDADES[f.propriedade] ?? f.propriedade}` });
  if (f.q?.trim()) chips.push({ chave: 'q', rotulo: `Busca: ${f.q.trim()}` });
  if (f.proprietario) chips.push({ chave: 'proprietario', rotulo: `Proprietário: ${f.proprietario}` });
  if (f.tipo) chips.push({ chave: 'tipo', rotulo: `Tipo: ${f.tipo}` });
  if (f.classificacao) chips.push({ chave: 'classificacao', rotulo: `Classificação: ${f.classificacao}` });
  if (f.documentacao) chips.push({ chave: 'documentacao', rotulo: `Documentação: ${DOCUMENTACOES[f.documentacao] ?? f.documentacao}` });
  if (f.status && f.status !== STATUS_PADRAO) chips.push({ chave: 'status', rotulo: `Situação: ${STATUS_FILTRO[f.status] ?? f.status}` });
  return chips;
}
/** Remover chip = voltar ao padrão do filtro, com efeitos dependentes (aplicarMudanca). */
export const removerChip = (f, chave) => aplicarMudanca(f, { [chave]: chave === 'status' ? STATUS_PADRAO : '' });
/** Filtros secundários ativos (painel mobile): tudo menos Propriedade e busca. */
export const contarFiltrosSecundarios = (f) => construirChips(f).filter((c) => !['propriedade', 'q'].includes(c.chave)).length;

/** Opções dependentes a partir de meta.facetas / meta.opcoes. */
export function opcoesTipos(opcoes) {
  return (opcoes?.tipos ?? []).map((t) => ({ valor: t.tipo, total: t.total ?? 0 }));
}
export function opcoesClassificacoes(opcoes, tipo) {
  if (!tipo) return [];
  const t = (opcoes?.tipos ?? []).find((x) => x.tipo === tipo);
  return (t?.classificacoes ?? []).map((c) => ({ valor: c.classificacao, total: c.total ?? 0 }));
}

/** Documentação: apenas Validade da GR. sem_dados nunca vira "Regular". */
export function seloDocumentacao(linha) {
  const gr = linha?.documentos?.gr ?? {};
  const validade = gr.validade ?? linha?.validade_gr ?? null;
  const dataBr = validade ? String(validade).slice(0, 10).split('-').reverse().join('/') : '';
  const estado = linha?.documentacao;
  const dica = 'Verifica apenas a validade da GR (gerenciamento de risco).';
  if (estado === 'vencida') return { texto: dataBr ? `GR vencida em ${dataBr}` : 'GR vencida', tom: 'bad', dica };
  if (estado === 'a_vencer') {
    const d = gr.dias ?? linha?.documentos?.gr?.dias;
    return { texto: Number.isInteger(d) ? `GR vence em ${d} dia${d === 1 ? '' : 's'}` : 'GR a vencer', tom: 'warn', dica };
  }
  if (estado === 'em_dia') return { texto: 'GR em dia', tom: 'ok', dica };
  return { texto: 'Sem dados', tom: 'neutro', dica: 'Sem validade da GR informada. ' + dica };
}

export const naoClassificado = (l) => l?.classificacao === 'Não classificado' || l?.tipo === 'Não classificado';
/** Classificação existe, mas a operação ainda precisa confirmar (ex.: HR, Toco). Marcador separado de "Não classificado". */
export const classificacaoAConfirmar = (l) => Boolean(l?.classificacao_a_confirmar) && !naoClassificado(l);
export const textoPendencias = (l) => {
  const n = l?.pendencias?.length ?? 0;
  return n === 0 ? '' : `${n} ${n === 1 ? 'pendência' : 'pendências'}`;
};
export const resumoDocumentacao = (linhas) => (linhas ?? []).filter((l) => l.documentacao === 'vencida' || l.documentacao === 'a_vencer').length;

/** Normaliza paginação do Laravel (topo ou meta). Total nunca é inferido da página. */
export function normalizarPaginacao(resposta) {
  const meta = resposta?.meta ?? {};
  const n = (a, b, padrao) => Number(a ?? b ?? padrao);
  return {
    pagina: n(resposta?.current_page, meta.current_page, 1),
    ultimaPagina: Math.max(1, n(resposta?.last_page, meta.last_page, 1)),
    total: n(resposta?.total, meta.total, 0),
  };
}

/** Selo FIPE: sempre texto, nunca só cor (G08, F21, F22). */
export function seloFipe(estado) {
  return ({
    vinculado: { texto: 'FIPE confirmada', tom: 'ok' },
    encontrado: { texto: 'FIPE encontrada', tom: 'ok' },
    provavel: { texto: 'FIPE provável - não confirmada', tom: 'warn' },
    pendente: { texto: 'Sem FIPE', tom: 'neutro' },
    sem_cobertura: { texto: 'FIPE indisponível para esta categoria', tom: 'info' },
    desatualizado: { texto: 'Desatualizada', tom: 'warn' },
  })[estado] ?? { texto: 'Estado FIPE desconhecido', tom: 'neutro' };
}

export const rotuloPropriedade = (p) => PROPRIEDADES[normalizarPropriedade(p)] ?? '—';
export const rotuloPendencia = (p) => PENDENCIAS[p] ?? String(p);
/** Só Próprio é patrimônio da empresa (G15, F53). */
export const ehPatrimonio = (p) => p === 'proprio';
export const notaPropriedade = (p) => (p === 'proprio' ? 'Patrimônio da empresa' : normalizarPropriedade(p) === 'terceiro' ? 'Não é patrimônio da empresa' : '');

/** Valor FIPE só é exibido com mês de referência e > 0 (F20, F23, G09). */
export function valorFipeExibivel(fipe) {
  const valor = Number(fipe?.valor);
  return Boolean(fipe && Number.isFinite(valor) && valor > 0 && String(fipe.mes_referencia ?? '').trim());
}

export const reais = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Máscara de identificador sensível: últimos 4 (G19, F04). */
export function mascarar(valor) {
  const s = String(valor ?? '').trim();
  if (!s) return '—';
  return s.length <= 4 ? '••••' : `${'•'.repeat(s.length - 4)}${s.slice(-4)}`;
}

/** Placas repetidas no ARQUIVO INTEIRO (todas, não só a primeira), antes de qualquer lote. */
export function placasDuplicadasNoArquivo(itens) {
  const vistas = new Map();
  (itens ?? []).forEach((item, i) => {
    const placa = String(item?.placa ?? '').replace(/[^a-z0-9]/gi, '').toUpperCase();
    if (!placa) return;
    vistas.set(placa, [...(vistas.get(placa) ?? []), i + 2]); // +2: cabeçalho + base 1
  });
  return [...vistas].filter(([, linhas]) => linhas.length > 1).map(([placa, linhas]) => ({ placa, linhas }));
}

export function mensagemDuplicadas(duplicadas, maximo = 5) {
  if (!duplicadas.length) return '';
  const lista = duplicadas.slice(0, maximo).map((d) => `${d.placa} (linhas ${d.linhas.join(', ')})`).join('; ');
  const resto = duplicadas.length > maximo ? ` e mais ${duplicadas.length - maximo}` : '';
  return `${duplicadas.length} placa(s) repetida(s) no arquivo: ${lista}${resto}. Nada foi enviado; corrija o CSV.`;
}

/** Comparação "Atual x CSV": destaca só o que mudaria (I-comparação). Atual ausente = não informado. */
export function compararAtualComCsv(atual, csv, campos) {
  return campos.map(([chave, rotulo]) => {
    const c = csv?.[chave];
    const a = atual?.[chave];
    const csvTem = c !== undefined && c !== null && String(c).trim() !== '';
    const atualTem = a !== undefined && a !== null && String(a).trim() !== '';
    return {
      chave, rotulo, atual: atualTem ? String(a) : '', csv: csvTem ? String(c) : '',
      informado: atual != null,
      muda: csvTem && String(a ?? '').trim() !== String(c).trim(),
    };
  });
}

/** Valida avaliação manual (G11). Fonte textual, data e valor obrigatórios. */
export function validarAvaliacaoManual({ valor, fonte, data }, hoje = new Date()) {
  const erros = {};
  const numero = Number(String(valor ?? '').replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(numero) || numero <= 0) erros.valor = 'Informe um valor maior que zero.';
  if (!String(fonte ?? '').trim()) erros.fonte = 'Informe a fonte da avaliação.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data ?? '')) || Number.isNaN(Date.parse(`${data}T12:00:00`))) erros.data = 'Informe uma data válida.';
  else if (new Date(`${data}T00:00:00`) > hoje) erros.data = 'A data não pode ser futura.';
  return { ok: Object.keys(erros).length === 0, erros, valor: numero };
}

/** Aceita "12345,60", "12.345,60" ou número; devolve número com 2 casas. */
export function paraDecimal(texto) {
  const s = String(texto ?? '').trim();
  const limpo = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(limpo);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

/** Mensagem pt-BR para endpoint ainda não implantado ou indisponível. Nunca finge dados. */
export function mensagemFalhaFrota(falha, contexto = 'esta operação') {
  const status = falha?.status ?? null;
  if (status === 404) return `O servidor ainda não oferece ${contexto} (recurso não encontrado). Nenhum dado foi alterado.`;
  if (status === 503) return falha?.mensagem || `Serviço indisponível agora para ${contexto}. Tente novamente em instantes.`;
  if (status === 422) {
    const detalhe = Object.values(falha?.errors ?? {}).flat().filter(Boolean).slice(0, 3).join(' · ');
    return detalhe || falha?.mensagem || 'Confira os dados informados.';
  }
  return falha?.mensagem || 'Não foi possível concluir a operação.';
}

/** Query para "Criar veículo a partir do resultado": proposta, não vínculo confirmado. */
export function queryCriarVeiculoDaConsulta({ tipo, marcaId, modeloId, anoCodigo, codigoFipe }) {
  const anoModelo = Number.parseInt(String(anoCodigo ?? ''), 10);
  const q = { origem_fipe: '1' };
  if (CATEGORIAS_FIPE[tipo]) q.fipe_tipo = tipo;
  if (marcaId) q.marca_id = String(marcaId);
  if (modeloId) q.modelo_id = String(modeloId);
  if (anoCodigo) q.fipe_ano_codigo = String(anoCodigo);
  if (Number.isInteger(anoModelo) && anoModelo >= 1950 && anoModelo <= 2100) q.ano_modelo = String(anoModelo);
  if (codigoFipe) q.codigo_fipe = String(codigoFipe);
  return q;
}

export function lerPrefillDaConsulta(query = {}) {
  if (primeiro(query.origem_fipe) !== '1') return null;
  const inteiro = (v) => { const n = Number.parseInt(primeiro(v), 10); return Number.isInteger(n) && n > 0 ? n : null; };
  const tipo = String(primeiro(query.fipe_tipo) ?? '');
  const anoCodigo = String(primeiro(query.fipe_ano_codigo) ?? '');
  return {
    fipe_tipo: Object.hasOwn(CATEGORIAS_FIPE, tipo) ? tipo : '',
    marca_id: inteiro(query.marca_id),
    modelo_id: inteiro(query.modelo_id),
    fipe_ano_codigo: /^\d{4,5}-\d{1,2}$/.test(anoCodigo) ? anoCodigo : '',
    ano_modelo: inteiro(query.ano_modelo),
    codigo_fipe: String(primeiro(query.codigo_fipe) ?? '').slice(0, 20),
  };
}

/** Veículo de categoria sem FIPE (reboque/semirreboque/implemento): estado, não pendência (P12). */
export const categoriaSemFipe = (veiculo) => ['reboque', 'semirreboque', 'implemento', 'carreta'].includes(String(veiculo?.categoria ?? '').toLowerCase());

/**
 * Em /painel/cadastros/veiculos a Central de Frota atende a aba "placas" sem `classe`;
 * marcas, modelos, tipos e a lista clássica (`classe`) continuam na CadastrosPage.
 */
export function ehCentralDeFrota(tipo, query = {}) {
  const aba = String(primeiro(query.aba) ?? '');
  // Qualquer aba desconhecida cai na Central (nunca na lista clássica); só marcas/modelos/tipos usam a CadastrosPage.
  return tipo === 'veiculos' && !['marcas', 'modelos'].includes(aba);
}

/** Legado `classe`: reboques -> tipo Reboque/Carreta; motorizados (ou desconhecido) -> sem filtro de tipo. */
export function classeParaFiltros(classe) {
  return String(classe ?? '').toLowerCase() === 'reboques' ? { tipo: 'Reboque/Carreta' } : {};
}

/** Origem segura: só caminhos internos '/painel/...' (nada de URL externa, '//', '\' ou esquema). */
export function origemSegura(valor) {
  const v = String(primeiro(valor) ?? '');
  if (!v.startsWith('/painel/') && v !== '/painel') return '';
  const caminho = v.split(/[?#]/)[0]; // valida só o caminho: '://' ou '\' dentro da busca (q) é inofensivo
  if (v.startsWith('//') || [...v].some((c) => c.charCodeAt(0) < 32) || caminho.includes(String.fromCharCode(92)) || caminho.includes(':')) return '';
  return v;
}
/** Query `{ voltar }` para repassar a origem (vazia se a origem for insegura). */
export function queryVoltar(fullPath) {
  const o = origemSegura(fullPath);
  return o ? { voltar: o } : {};
}
/** Destino 'voltar': rota-string da origem ou o fallback. */
export function destinoVoltar(query, fallback) {
  return origemSegura(query?.voltar) || fallback;
}

/**
 * Taxonomia TIPO -> CLASSIFICAÇÃO (regras_frota_central.md §1), compartilhada entre Central e ficha do veículo.
 * A classificação é gravada em `tipo_operacional`; o tipo é derivado. Valores fora do mapa nunca são descartados.
 */
export const TAXONOMIA_FROTA = Object.freeze({
  'Caminhão': ['3/4', 'VUC', 'Toco', 'Truck', 'Bitruck'],
  'Utilitário/Van': ['Fiorino', 'Van', 'Utilitário (genérico)', 'HR'],
  'Cavalo mecânico': ['Simples (4x2)', 'Trucado (6x2/6x4)'],
  'Reboque/Carreta': ['Semi-reboque 2 eixos', 'Semi-reboque 3 eixos'],
  'Automóvel': ['Automóvel'],
});
export const TIPOS_FROTA = Object.freeze(Object.keys(TAXONOMIA_FROTA));
export const classificacoesDoTipo = (tipo) => TAXONOMIA_FROTA[tipo] ?? [];
export function tipoDaClassificacao(classificacao) {
  const alvo = String(classificacao ?? '').trim().toLowerCase();
  if (!alvo) return '';
  return TIPOS_FROTA.find((t) => TAXONOMIA_FROTA[t].some((c) => c.toLowerCase() === alvo)) ?? '';
}
