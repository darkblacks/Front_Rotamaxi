import test from 'node:test';
import assert from 'node:assert/strict';
import {lerExportacaoEsl,descricaoAcao} from '../../../../src/domain/vehicles/esl/vehicle-csv.js';
const cabecalho='Placa;Marca;Modelo;Cor;Combustível;Nº Frota;Ano Fabricação;Ano Modelo;Renavam;Chassi;Cidade Licenciamento;Tipo Veículo;Tipo Carroceria;Tipo Proprietário;Proprietário;Agregado;Tabela de agregado;Motorista Padrão;Data Compra;Valor Compra;Data Venda;Valor Venda;PBT (Peso Bruto Total);Tara (kg);Capacidade (m3);Capacidade Lotação;Número Autorização GR;Validade GR;Status do Veículo;Lote para Fechamento do CIOT';
const linha=(placa='ABC1D23')=>`${placa};FIAT;FIORINO;BRANCA;Diesel S10;;2017;2018;"=""01140908933""";9BD;São Paulo - SP;Fiorino;;Agregado;Pessoa X;Terceiro A;Tabela;Motorista X;;0,00;;0,00;2.100,00;1.500,00;100,00;600,00;"=""6389596995""";13/10/2026;Ativo;`;
test('CSV exportação real: 30 colunas, campos especiais e números Excel',()=>{
 const [r]=lerExportacaoEsl(`\uFEFF${cabecalho}\r\n${linha()}`);
 assert.equal(r.placa,'ABC1D23');assert.equal(r.marca_nome,'FIAT');assert.equal(r.modelo_nome,'FIORINO');
 assert.equal(r.numero_frota,undefined);assert.equal(r.ano_fabricacao,2017);assert.equal(r.ano_modelo,2018);
 assert.equal(r.renavam,'01140908933');assert.equal(r.numero_autorizacao_gr,'6389596995');
 assert.equal(r.pbt_kg,'2.100,00');assert.equal(r.validade_gr,'13/10/2026');
 assert.equal(r.tipo_proprietario_esl,'Agregado');assert.equal(r.motorista_padrao,'Motorista X');
});
test('impede placas duplicadas na mesma exportação',()=>assert.throws(()=>lerExportacaoEsl(`${cabecalho}\n${linha()}\n${linha()}`),/duplicada/));
test('não exige ID externo ESL, não inventa dados',()=>{
 const [v]=lerExportacaoEsl(`${cabecalho}\n${linha()}`);
 assert.equal(v.externo_id,undefined);assert.equal(descricaoAcao('revisar'),'Confirmar catálogo');
});
