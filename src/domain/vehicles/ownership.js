// Frontend: dono operacional do veículo é a Transmassa ou uma prestadora de transporte.
// Motorista é referência de contato, nunca proprietário obrigatório.
export function normalizarVinculoVeiculo(vinculo) {
  const texto=String(vinculo||'').trim().toLowerCase();
  if(texto==='proprio' || texto==='próprio')return 'proprio';
  if(texto==='terceiro' || texto==='agregado')return 'terceiro';
  return '';
}
export function validarPropriedadeVeiculo(veiculo,prestadores=[],motoristas=[]) {
  if(!['proprio','terceiro'].includes(veiculo.vinculo))
    return {ok:false,mensagem:'Selecione se o veículo é próprio ou terceiro.'};
  if(veiculo.vinculo==='terceiro') {
    const prestador=prestadores.find(p=>Number(p.id)===Number(veiculo.prestador_servico_id));
    if(!prestador || prestador.tipo_prestador!=='transporte' || prestador.is_active===false)
      return {ok:false,mensagem:'Selecione uma transportadora ativa cadastrada em Terceiros → Serviços de Transporte.'};
  }
  if(veiculo.motorista_referencia_pessoa_id) {
    const motorista=motoristas.find(m=>Number(m.id)===Number(veiculo.motorista_referencia_pessoa_id));
    if(!motorista)return {ok:false,mensagem:'Selecione um motorista válido na lista de motoristas cadastrados.'};
  }
  return {ok:true,mensagem:''};
}
