function semAcento(valor = '') {
  return String(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

export function ehVinculoProprio(vinculo) {
  return semAcento(vinculo) === 'proprio';
}

export function apresentarVinculoMotorista(motorista = {}, prestador = null, empresaAtual = {}) {
  const tipo = String(motorista?.vinculo || '').trim() || 'Não informado';
  if (motorista?.prestadorServicoId) {
    return {
      tipo,
      nome: prestador?.nome || 'Prestadora não encontrada',
      logo: prestador?.logo_url || '',
      proprio: false,
    };
  }
  if (ehVinculoProprio(tipo)) {
    return {
      tipo: 'Próprio',
      nome: empresaAtual?.nome || 'Empresa própria',
      logo: empresaAtual?.logo || '',
      proprio: true,
    };
  }
  return { tipo, nome: '', logo: '', proprio: false };
}
