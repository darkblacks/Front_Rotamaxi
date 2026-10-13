/** Regras independentes da interface para impedir duplicidade de ano e valor FIPE incorreto. */
export function anoDoCodigoFipe(codigo) {
  const texto = String(codigo ?? '');
  if (!/^\d{4,5}-\d{1,2}$/.test(texto)) return null;
  const ano = Number(texto.split('-')[0]);
  return ano >= 1950 && ano <= 2100 ? ano : null; // 32000 = zero quilômetro, não é ano calendário
}

export function versoesDoAno(lista, ano) {
  const numero = Number(ano);
  if (!Number.isInteger(numero) || numero < 1950 || numero > 2100) return [];
  return (Array.isArray(lista) ? lista : []).filter(opcao => anoDoCodigoFipe(opcao.codigo) === numero);
}

export function resolverAnoDigitado(texto, lista) {
  const anoTexto = String(texto ?? '').trim();
  if (!/^\d{4}$/.test(anoTexto) || Number(anoTexto) < 1950 || Number(anoTexto) > 2100) {
    return { tipo: 'invalido', mensagem: 'Informe um ano entre 1950 e 2100.' };
  }
  const ano = Number(anoTexto);
  const versoes = versoesDoAno(lista, ano);
  if (versoes.length === 1) return { tipo: 'existente', ano, codigo: versoes[0].codigo, versoes };
  if (versoes.length > 1) return { tipo: 'ambiguo', ano, versoes };
  return { tipo: 'personalizado', ano, versoes: [] };
}
