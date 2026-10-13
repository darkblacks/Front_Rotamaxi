/** Ranking local para escolher o modelo do ESL sem sair da simulação.
 * Não confirma vínculos automaticamente: devolve candidatos e eventual pré-seleção.
 */
export function normalizarModelo(nome) {
  return String(nome ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toUpperCase().replace(/(\d)[,.](\d)/g,'$1_$2')
    .replace(/[^A-Z0-9_]+/g,' ').replace(/\s+/g,' ').trim();
}
const palavrasIgnoradas = new Set(['DE','DA','DO','DAS','DOS','COM','MODELO','VEICULO','ANO']);
function tokens(nome) {
  return normalizarModelo(nome).split(' ').filter(x => x && !palavrasIgnoradas.has(x));
}
function editDistance(a,b) {
  if (Math.abs(a.length-b.length)>7)return 99;
  let prev=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    const curr=[i];
    for(let j=1;j<=b.length;j++)curr[j]=Math.min(curr[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
    prev=curr;
  }
  return prev[b.length];
}
export function pontuacaoModeloEsl(nomeEsl, nomeCatalogo) {
  const a=tokens(nomeEsl),b=tokens(nomeCatalogo);
  if(!a.length||!b.length)return 0;
  if(a.join(' ')===b.join(' '))return 100;
  const similares=a.map(ta => b.reduce((best,tb) => Math.max(best, ta===tb?1:(ta.length>=5&&tb.length>=5&&editDistance(ta,tb)<=1?.82:0)),0));
  // A palavra-base precisa aparecer: FIORINO 1.4 não pode priorizar PALIO 1.4.
  if(similares[0]<.8)return 0;
  const cobertura=similares.reduce((sum,x)=>sum+x,0)/a.length;
  const comuns=similares.filter(x=>x>=.8).length;
  if(!comuns)return 0;
  const sequencia=a.every((t,i)=>b[i]===t);
  const extras=Math.max(0,b.length-a.length);
  const temNumero=a.some(t=>/\d/.test(t));
  if(cobertura===1&&sequencia){
    return Math.max(0, Math.min(96,(temNumero||a.length>=2?96:84)-Math.min(extras,6)*2));
  }
  if(cobertura>=.98){return Math.max(0,92-Math.min(extras,7)*3);}
  if(cobertura>=.8){return Math.round(81*cobertura+6-Math.min(extras,6));}
  return Math.round(65*cobertura);
}
export function recomendarModelosEsl(nomeEsl, modelos, limite=12) {
  const todos=(modelos??[]).map(m=>({...m,pontuacao:pontuacaoModeloEsl(nomeEsl,m.nome)}))
    .sort((a,b)=>b.pontuacao-a.pontuacao||String(a.nome).localeCompare(String(b.nome),'pt-BR'));
  const principais=todos.filter(m=>m.pontuacao>=65).slice(0,limite);
  const sugeridos=new Set(principais.map(m=>String(m.id)));
  const demais=todos.filter(m=>!sugeridos.has(String(m.id)));
  const primeiro=principais[0],segundo=principais[1];
  const especifico=tokens(nomeEsl).length>=2;
  const preSelecionado = primeiro && (primeiro.pontuacao===100 && (!segundo||segundo.pontuacao<100)
    || especifico&&primeiro.pontuacao>=90&&(!segundo||primeiro.pontuacao-segundo.pontuacao>=12))
    ? primeiro : null;
  return { principais, demais, preSelecionado };
}
/** Mescla resultados ressimulados por linha, mantendo a prévia e a ordem originais. */
export function atualizarPreviaEsl(preview, revisados) {
  const mapa=new Map(revisados.map(r=>[Number(r.linha),r]));
  return preview.map(r=>mapa.has(Number(r.linha))?{...r,...mapa.get(Number(r.linha))}:r);
}
