/** Ferramentas puras da revisão ESL: nenhuma correção de ano é aplicada automaticamente. */
export const limparNome = value => String(value ?? '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase();

const aliasMarca = {
  'vw': 'volkswagen', 'vw caminhoes': 'volkswagen', 'mb': 'mercedes benz',
  'mercedes': 'mercedes benz', 'gm': 'gm chevrolet', 'chevrolet': 'gm chevrolet',
  'kia': 'kia motors',
};
export function identificarMarca(nome, marcas) {
  const chave = aliasMarca[limparNome(nome)] ?? limparNome(nome);
  const exatas = marcas.filter(m => (aliasMarca[limparNome(m.nome)] ?? limparNome(m.nome)) === chave);
  return exatas.length === 1 ? exatas[0] : null;
}

function distanciaEdicao(a,b) {
  if (a.length > 160 || b.length > 160) return Math.max(a.length,b.length);
  let prev=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    const next=[i];
    for(let j=1;j<=b.length;j++) next[j]=Math.min(next[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
    prev=next;
  }
  return prev[b.length];
}
export function sugerirModelos(nome, modelos, limite=12) {
  const alvo = limparNome(nome);
  if (!alvo) return [];
  const tokens = alvo.split(' ').filter(x => x.length > 2);
  return modelos.map(m => {
    const atual = limparNome(m.nome);
    if (!atual) return null;
    const exato = atual === alvo;
    const prefixo = atual.startsWith(`${alvo} `) || alvo.startsWith(`${atual} `);
    const comuns = tokens.filter(x => atual.split(' ').includes(x)).length;
    const semelhante = Math.round(84 * (1-distanciaEdicao(alvo,atual)/Math.max(alvo.length,atual.length,1)));
    const pontuacao = exato ? 100 : prefixo ? 85 : Math.max(semelhante,comuns?Math.round(50*comuns/Math.max(1,tokens.length)):0);
    return { ...m, pontuacao };
  }).filter(m => m && m.pontuacao >= 20)
    .sort((a,b) => b.pontuacao-a.pontuacao || a.nome.localeCompare(b.nome))
    .slice(0,limite);
}

export const anoValido = value => /^\d{4}$/.test(String(value ?? '')) && Number(value) >= 1950 && Number(value) <= 2100;
export const anoDaVersao = code => Number(String(code ?? '').split('-')[0]);
export function versoesValidadas(versoes) {
  return (versoes ?? []).filter(x => /^\d{4}-\d{1,2}$/.test(String(x.codigo ?? '')) && anoValido(String(x.codigo).split('-')[0]));
}
export function sugerirFabricacao(valorOriginal, anoModelo) {
  if (anoValido(valorOriginal) && Number(valorOriginal) <= Number(anoModelo)) return String(valorOriginal);
  const raw = String(valorOriginal ?? '').trim();
  // Detecta apenas erro de digitação óbvio: 20066 -> 2006 (não 45062 -> 4506).
  if (/^\d{5}$/.test(raw)) {
    const candidato = raw.substring(0,4);
    if (anoValido(candidato) && Number(candidato) <= Number(anoModelo)) return candidato;
  }
  return '';
}
export function tiposFipeDisponiveis(marca, modelo, contexto='') {
  const a=marca?.fipe_codigos||{},b=modelo?.fipe_codigos||{};
  const validos=['trucks','cars','motorcycles'].filter(t=>Boolean(a[t])&&Boolean(b[t]));
  const ctx=limparNome(contexto);
  const pref=/moto|scooter|ciclomotor/.test(ctx)?'motorcycles':/cavalo|truck|caminh|toco|3 4/.test(ctx)?'trucks':'cars';
  return [pref,...validos].filter((x,i,arr)=>validos.includes(x)&&arr.indexOf(x)===i);
}
