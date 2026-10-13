/**
 * Prévia da exportação ESL tolerante a dados de origem ruins.
 * A API recebe apenas registros que passaram pelas validações locais; erros HTTP 422
 * pontuais são isolados por divisão do lote em vez de bloquear toda a exportação.
 * NENHUMA chamada dessa função executa gravação (o adaptador deve chamar simular:true).
 */
const anoPreenchido = valor => valor !== undefined && valor !== null && String(valor).trim() !== '';
const anoValido = valor => /^\d{4}$/.test(String(valor)) && Number(valor) >= 1950 && Number(valor) <= 2100;

export function problemaLocalEsl(item, indice) {
  const problemas = [];
  for (const [chave, titulo] of [['ano_fabricacao', 'fabricação'], ['ano_modelo', 'modelo']]) {
    if (anoPreenchido(item[chave]) && !anoValido(item[chave])) {
      problemas.push(`Ano de ${titulo} inválido: ${String(item[chave])}. Informe um ano entre 1950 e 2100.`);
    }
  }
  if (!problemas.length) return null;
  return {
    linha: indice + 1,
    placa: item.placa || '—',
    externo_id: item.externo_id ?? null,
    acao: 'invalida',
    motivo: problemas.join(' '),
    ano_modelo: item.ano_modelo ?? null,
  };
}

const erro422 = error => Number(error?.response?.status ?? error?.status ?? 0) === 422;
function motivo422(error) {
  const corpo = error?.response?.data ?? {};
  const detalhes = Object.values(corpo.errors ?? {}).flat().filter(Boolean).slice(0, 3);
  return detalhes.join(' · ') || corpo.message || error?.message || 'Registro rejeitado pelo backend (422).';
}

/**
 * @param {Array<object>} itens Todos os veículos na ordem original do CSV.
 * @param {(lote:Array<object>) => Promise<Array<object>>} consultar Simulação API, nunca gravação.
 */
export async function simularEslTolerante(itens, consultar, { tamanhoLote = 100, progresso, aoLote } = {}) {
  if (!Array.isArray(itens)) throw new TypeError('A importação precisa receber uma lista de veículos.');
  if (!Number.isInteger(tamanhoLote) || tamanhoLote < 1 || tamanhoLote > 100) throw new RangeError('Lote deve conter entre 1 e 100 veículos.');

  const respostas = [];
  const validos = [];
  for (let i = 0; i < itens.length; i++) {
    const item = itens[i];
    const problema = problemaLocalEsl(item, i);
    if (problema) { respostas.push(problema); aoLote?.({ invalidas: 1 }); }
    else validos.push({ indice: i, item });
  }

  async function consultarSemTravar(registros) {
    if (!registros.length) return;
    try {
      const dados = await consultar(registros.map(r => r.item));
      if (!Array.isArray(dados) || dados.length !== registros.length) {
        throw new Error('API devolveu uma quantidade inesperada de veículos na simulação.');
      }
      aoLote?.(dados.contagens ?? null);
      registros.forEach((registro, i) => {
        respostas.push({ ...dados[i], linha: registro.indice + 1,
          placa: dados[i].placa || registro.item.placa,
          ano_modelo: registro.item.ano_modelo ?? null });
      });
    } catch (error) {
      if (!erro422(error)) throw error; // 401, 403, 500 e falhas de conexão continuam visíveis.
      if (registros.length === 1) {
        const { indice, item } = registros[0];
        respostas.push({ linha: indice + 1, placa: item.placa || '—',
          externo_id: item.externo_id ?? null, ano_modelo: item.ano_modelo ?? null,
          acao: 'invalida', motivo: motivo422(error) });
        aoLote?.({ invalidas: 1 });
        return;
      }
      const metade = Math.floor(registros.length / 2);
      await consultarSemTravar(registros.slice(0, metade));
      await consultarSemTravar(registros.slice(metade));
    }
  }

  for (let i = 0; i < validos.length; i += tamanhoLote) {
    await consultarSemTravar(validos.slice(i, i + tamanhoLote));
    progresso?.(Math.min(i + tamanhoLote, validos.length), validos.length);
  }
  return respostas.sort((a, b) => a.linha - b.linha);
}
