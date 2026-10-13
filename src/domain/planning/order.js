/** Ordem de execução dos serviços empenhados (rota = início + serviços em ordem + fim). */

export function ordenarServicos(servicos) {
    const sem = Number.MAX_SAFE_INTEGER;
    return [...(servicos ?? [])].sort((a, b) => (a.ordem ?? sem) - (b.ordem ?? sem) || (a.id - b.id));
}

/** Move o id `delta` posições; fora dos limites devolve a mesma lista. */
export function moverServico(ids, id, delta) {
    const i = ids.indexOf(id);
    const j = i + delta;
    if (i === -1 || j < 0 || j >= ids.length) return ids;
    const copia = [...ids];
    const [item] = copia.splice(i, 1);
    copia.splice(j, 0, item);
    return copia;
}

/** Arrastar: coloca `origem` na posição de `destino`. */
export function moverServicoPara(ids, origem, destino) {
    const i = ids.indexOf(origem);
    const j = ids.indexOf(destino);
    if (i === -1 || j === -1 || i === j) return ids;
    const copia = [...ids];
    const [item] = copia.splice(i, 1);
    copia.splice(j, 0, item);
    return copia;
}

export function ordemMudou(a, b) {
    return a.length !== b.length || a.some((id, i) => id !== b[i]);
}

/** Corpo do PUT /mapa/manifestos/{id}/servicos/ordem. */
export function payloadDaOrdem(ids) {
    return { servico_ids: [...ids] };
}
