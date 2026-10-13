/**
 * Sequência de etapas de um manifesto em montagem. A primeira é `inicio`, a última `fim`;
 * só as `parada` do meio se movem. Funções puras: nunca mutam a entrada.
 */
import { coordenadaValida, janelaValida, pontoParaPayload } from './services.js';

export const PAPEIS_DE_ETAPA = [
    { id: 'coleta', rotulo: 'Coleta' },
    { id: 'ct', rotulo: 'CT' },
    { id: 'distribuicao', rotulo: 'Distribuição' },
    { id: 'base', rotulo: 'Base' },
    { id: 'estacionamento', rotulo: 'Estacionamento' },
    { id: 'outro', rotulo: 'Outro' },
];

let contador = 0;
export function novaChave() {
    contador += 1;
    return `e${contador}`;
}

export function etapaVazia(tipo_etapa, papel = 'outro') {
    return {
        chave: novaChave(), id: null, tipo_etapa, papel, kind: null, ref_id: null,
        nome: '', endereco: '', latitude: null, longitude: null,
        janela_inicio: null, janela_fim: null, servicos: [],
    };
}

/** Preenche a etapa a partir de um ponto do lookup ({kind,id,nome,endereco,latitude,longitude}) ou manual. */
export function aplicarPonto(etapa, ponto) {
    return {
        ...etapa,
        kind: ponto?.kind ?? null,
        ref_id: ponto?.id ?? null,
        nome: ponto?.nome ?? '',
        endereco: ponto?.endereco ?? '',
        latitude: ponto?.latitude ?? null,
        longitude: ponto?.longitude ?? null,
    };
}

export function renumerar(lista) {
    return lista.map((e, i) => ({ ...e, ordem: i + 1 }));
}

/** Normaliza as etapas vindas do servidor para o rascunho. */
export function rascunhoDeEtapas(etapasServidor) {
    const ordenadas = [...(etapasServidor ?? [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    return renumerar(ordenadas.map((e) => ({
        chave: novaChave(), id: e.id ?? null, tipo_etapa: e.tipo_etapa ?? 'parada', papel: e.papel ?? 'outro',
        kind: e.unidade_id ? 'unidade' : e.filial_id ? 'filial' : null,
        ref_id: e.unidade_id ?? e.filial_id ?? null,
        nome: e.nome ?? e.snapshot_nome ?? '', endereco: e.endereco ?? e.snapshot_endereco ?? '',
        latitude: e.latitude ?? null, longitude: e.longitude ?? null,
        janela_inicio: e.janela_inicio ?? null, janela_fim: e.janela_fim ?? null,
        servicos: e.servicos ?? [], status: e.status,
    })));
}

export function adicionarParada(lista, parada) {
    const fimIdx = lista.findIndex((e) => e.tipo_etapa === 'fim');
    const pos = fimIdx === -1 ? lista.length : fimIdx;
    return renumerar([...lista.slice(0, pos), { ...parada, tipo_etapa: 'parada' }, ...lista.slice(pos)]);
}

export function removerParada(lista, chave) {
    return renumerar(lista.filter((e) => !(e.chave === chave && paradaManual(e))));
}

export function atualizarEtapa(lista, chave, campos) {
    return lista.map((e) => (e.chave === chave ? { ...e, ...campos } : e));
}

/**
 * Etapas para a pré-visualização no mapa. O ponto final do manifesto é o recebimento do CT
 * (não é serviço): se um serviço aponta para o mesmo local do fim (ex.: transferência para o
 * CT final), o backend o vincula à etapa `fim` e a rota mostra só início -> fim. Defensivo:
 * remove do preview a parada que repete o fim (mesmo cadastro ou mesma coordenada).
 */
export function etapasParaPreview(etapas) {
    const fim = etapas.find((e) => e.tipo_etapa === 'fim');
    if (!fim) return etapas;
    const mesmoLocal = (e) => (e.kind && fim.kind && e.kind === fim.kind && e.ref_id === fim.ref_id)
        || (e.latitude != null && e.latitude === fim.latitude && e.longitude === fim.longitude);
    return etapas.filter((e) => e.tipo_etapa !== 'parada' || !mesmoLocal(e));
}

/** Etapa derivada de serviço empenhado (v2.1): não se move nem se remove pela sequência manual. */
export function etapaDeServico(e) {
    return Array.isArray(e?.servicos) && e.servicos.length > 0;
}

/** Parada operacional manual (opcional): parada sem serviço vinculado. */
export function paradaManual(e) {
    return e?.tipo_etapa === 'parada' && !etapaDeServico(e);
}

/**
 * Move uma parada manual `delta` posições (-1 sobe, +1 desce) sem passar por início/fim.
 * A ordem relativa das demais etapas (inclusive as derivadas de serviços) não muda.
 */
export function moverParada(lista, chave, delta) {
    const i = lista.findIndex((e) => e.chave === chave);
    if (i === -1 || !paradaManual(lista[i])) return lista;
    const j = i + delta;
    if (j < 0 || j >= lista.length || lista[j].tipo_etapa !== 'parada') return lista;
    const copia = [...lista];
    const [item] = copia.splice(i, 1);
    copia.splice(j, 0, item);
    return renumerar(copia);
}

/** Arrastar: move a parada `de` para a posição da parada `para`. */
export function moverParaPosicao(lista, chaveOrigem, chaveDestino) {
    const i = lista.findIndex((e) => e.chave === chaveOrigem);
    const j = lista.findIndex((e) => e.chave === chaveDestino);
    if (i === -1 || j === -1 || i === j) return lista;
    if (!paradaManual(lista[i]) || lista[j].tipo_etapa !== 'parada') return lista;
    const copia = [...lista];
    const [item] = copia.splice(i, 1);
    copia.splice(j, 0, item);
    return renumerar(copia);
}

function georreferenciada(e) {
    return coordenadaValida(e.latitude, e.longitude);
}

/**
 * Validação RN §20 (lado cliente). O servidor valida de novo ao liberar.
 * @returns {{nivel:'erro'|'aviso', texto:string}[]}
 */
export function validarSequencia(etapas, { veiculo = null, motorista = null, servicos = [] } = {}) {
    const msgs = [];
    const erro = (texto) => msgs.push({ nivel: 'erro', texto });
    const aviso = (texto) => msgs.push({ nivel: 'aviso', texto });

    const inicio = etapas.filter((e) => e.tipo_etapa === 'inicio');
    const fim = etapas.filter((e) => e.tipo_etapa === 'fim');
    if (inicio.length !== 1) erro('O manifesto precisa de exatamente um ponto inicial.');
    else if (!georreferenciada(inicio[0])) erro('Ponto inicial sem coordenadas (georreferencie).');
    if (fim.length !== 1) erro('O manifesto precisa de exatamente um ponto final.');
    else if (!georreferenciada(fim[0])) erro('Ponto final sem coordenadas (georreferencie).');
    if (etapas[0] && etapas[0].tipo_etapa !== 'inicio') erro('A primeira etapa deve ser o ponto inicial.');
    if (etapas.length && etapas[etapas.length - 1].tipo_etapa !== 'fim') erro('A última etapa deve ser o ponto final.');

    if (!veiculo) erro('Veículo não informado.');
    if (!motorista) aviso('Motorista não informado.');

    etapas.filter((e) => e.tipo_etapa === 'parada').forEach((e) => {
        const nome = e.nome || `Etapa ${e.ordem}`;
        if (!georreferenciada(e)) erro(`${nome}: sem coordenadas.`);
        if (!janelaValida(e.janela_inicio, e.janela_fim)) erro(`${nome}: janela inválida (fim antes do início).`);
    });

    // Serviços empenhados (v2.1): tipo + local geocodificado e janela válida. O handoff da
    // coleta é o próprio roteiro (próxima etapa/fim); distribuição exige cliente/ponto de entrega.
    (servicos ?? []).forEach((s) => {
        const id = s.numero ?? s.id;
        const tipo = s.tipo ?? s.tipos?.[0];
        const local = s.local ?? s.local_snapshot;
        if (!tipo) erro(`Serviço ${id}: sem tipo.`);
        if (!local || !coordenadaValida(local.latitude, local.longitude)) erro(`Serviço ${id}: local sem coordenadas.`);
        if (!janelaValida(s.janela_inicio, s.janela_fim)) erro(`Serviço ${id}: janela inválida.`);
        if ((tipo === 'distribuicao' || tipo === 'coleta') && !s.cliente_pessoa_id && !s.cliente && !s.cliente_nome) {
            erro(`Serviço ${id}: ${tipo === 'coleta' ? 'coleta' : 'distribuição'} sem cliente.`);
        }
    });

    if (!etapas.some((e) => e.tipo_etapa === 'parada')) aviso('Nenhuma parada: empenhe serviços para montar a rota.');
    return msgs;
}

/** Corpo do PUT /mapa/manifestos/{id}/etapas. */
export function etapasParaPayload(etapas, motivo) {
    return {
        etapas: etapas.map((e) => {
            const item = {
                tipo_etapa: e.tipo_etapa, papel: e.papel, nome: e.nome,
                janela_inicio: e.janela_inicio ?? null, janela_fim: e.janela_fim ?? null,
                servicos: e.servicos ?? [],
            };
            const ponto = e.kind && e.ref_id ? pontoParaPayload({ kind: e.kind, id: e.ref_id }) : null;
            if (ponto?.kind === 'unidade') item.unidade_id = e.ref_id;
            else if (ponto?.kind === 'filial') item.filial_id = e.ref_id;
            item.latitude = Number(e.latitude);
            item.longitude = Number(e.longitude);
            return item;
        }),
        motivo: motivo || 'Ajuste de sequência pelo planejamento',
    };
}

/** `true` se a sequência local difere da salva (compara campos que vão ao servidor). */
export function mudou(a, b) {
    return JSON.stringify(etapasParaPayload(a, '')) !== JSON.stringify(etapasParaPayload(b, ''));
}

/** Extrai mensagens de um 422 (`errors` + `message`). */
export function mensagensDeValidacao(falha) {
    const lista = [];
    const errors = falha?.errors ?? {};
    Object.values(errors).forEach((v) => (Array.isArray(v) ? lista.push(...v) : lista.push(String(v))));
    if (lista.length === 0 && falha?.mensagem) lista.push(falha.mensagem);
    return lista;
}
