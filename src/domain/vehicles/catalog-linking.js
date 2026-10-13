/** Seleção exclusivamente por registros existentes; classificação FIPE interna. */
export const TIPOS_FIPE = ['trucks', 'cars', 'motorcycles'];

export function tipoPreferidoMacro(macroCategoria) {
  if (macroCategoria === 'motocicleta') return 'motorcycles';
  if (macroCategoria === 'leve' || macroCategoria === 'utilitario') return 'cars';
  if (macroCategoria === 'reboque') return '';
  return 'trucks';
}

export function resolverTipoFipeCatalogado(marca, modelo, macroCategoria, tipoAtual = '') {
  if (!marca || !modelo) return '';
  const comuns = TIPOS_FIPE.filter(tipo => Boolean(marca.fipe_codigos?.[tipo]) && Boolean(modelo.fipe_codigos?.[tipo]));
  const preferido = tipoPreferidoMacro(macroCategoria);
  // Em edição, preservar o tipo da cotação já salva, se ainda for válido.
  if (comuns.includes(tipoAtual)) return tipoAtual;
  if (comuns.includes(preferido)) return preferido;
  return comuns[0] ?? '';
}

export function dadosCatalogadosValidos(form, marca, modelo) {
  if (!form?.marca_id || !marca || Number(form.marca_id) !== Number(marca.id)) {
    return { ok: false, mensagem: 'Selecione uma marca cadastrada. Se ela não existir, cadastre-a em Marcas cadastradas.' };
  }
  if (!form?.modelo_id || !modelo || Number(form.modelo_id) !== Number(modelo.id)) {
    return { ok: false, mensagem: 'Selecione um modelo cadastrado. Se ele não existir, cadastre-o em Modelos de veículos.' };
  }
  if (Number(modelo.marca_id) !== Number(marca.id)) {
    return { ok: false, mensagem: 'O modelo selecionado não pertence à marca. Selecione um modelo válido.' };
  }
  return { ok: true, mensagem: '' };
}
