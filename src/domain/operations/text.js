/** Texto legível de um campo que o contrato não fixa: string, número, objeto ou lista. */
export function rotulo(valor, vazio = '—') {
    if (valor === null || valor === undefined || valor === '') return vazio;
    if (Array.isArray(valor)) {
        const partes = valor.map((v) => rotulo(v, '')).filter(Boolean);
        return partes.length ? partes.join(', ') : vazio;
    }
    if (typeof valor === 'object') {
        const texto = valor.nome ?? valor.descricao ?? valor.numero ?? valor.placa ?? valor.snapshot_nome
            ?? (valor.tipo ?? (Array.isArray(valor.tipos) ? valor.tipos[0] : null));
        return texto === null || texto === undefined || texto === '' ? vazio : String(texto);
    }
    return String(valor);
}

/** id de um campo que pode vir como número ou como `{id}`. */
export function idDe(valor) {
    if (valor === null || valor === undefined) return null;
    return typeof valor === 'object' ? (valor.id ?? null) : valor;
}

/** Atualiza ou insere um item pelo `id`, mantendo a ordem; devolve nova lista. */
export function mesclarPorId(lista, item, chave = 'id') {
    if (item === null || item === undefined || item[chave] === undefined) return lista;
    const existe = lista.some((x) => x[chave] === item[chave]);
    return existe
        ? lista.map((x) => (x[chave] === item[chave] ? { ...x, ...item } : x))
        : [item, ...lista];
}

/** Valor de `<input type="datetime-local">` para a hora de `data` (hora local). */
export function paraInputLocal(data = new Date()) {
    const d = data instanceof Date ? data : new Date(data);
    if (Number.isNaN(d.getTime())) return '';
    const dois = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}T${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

/** ISO-8601 (UTC) a partir do valor local do input; `null` se vazio/inválido. */
export function deInputLocal(valor) {
    if (!valor) return null;
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
