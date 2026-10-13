import http from '@/services/api/http.js';

/**
 * Única porta de entrada do frontend para o catálogo/cotação FIPE.
 * O backend continua sendo a fonte de verdade; o browser nunca consulta provedor FIPE diretamente.
 */
const raiz = '/admin/veiculos/catalogo-local';
export const FIPE_TYPES = Object.freeze(['trucks', 'cars', 'motorcycles']);

export async function listFipeBrands() {
  const { data } = await http.get(`${raiz}/marcas`);
  return Array.isArray(data?.data) ? data.data : [];
}

export async function listFipeModels(brandId) {
  const { data } = await http.get(`${raiz}/modelos`, { params: { marca_id: Number(brandId) } });
  return Array.isArray(data?.data) ? data.data : [];
}

export async function listFipeYears(type, brandId, modelId) {
  if (!type || !brandId || !modelId) return [];
  const { data } = await http.get(`${raiz}/fipe/anos`, {
    params: { tipo: type, marca_id: Number(brandId), modelo_id: Number(modelId) },
  });
  return Array.isArray(data?.data) ? data.data : [];
}

export async function getFipeQuote(type, brandId, modelId, yearCode) {
  if (!type || !brandId || !modelId || !yearCode) return null;
  const { data } = await http.get(`${raiz}/fipe/cotacao`, {
    params: { tipo: type, marca_id: Number(brandId), modelo_id: Number(modelId), ano_codigo: yearCode },
  });
  return data?.data ?? null;
}

function metadataTypes(brand, model) {
  return FIPE_TYPES.filter((type) => Boolean(brand?.fipe_codigos?.[type]) && Boolean(model?.fipe_codigos?.[type]));
}

/**
 * Resolve anos sempre contra o MESMO endpoint do backend.
 * Metadados fipe_codigos ajudam a ordenar, mas nunca impedem a consulta: registros antigos podem
 * ter vínculo/cotação válidos mesmo com metadados locais incompletos.
 */
export async function resolveFipeYears({ preferredType = '', brandId, modelId, brand = null, model = null } = {}) {
  if (!brandId || !modelId) return { type: preferredType || '', years: [], tried: [] };
  const candidates = [...new Set([
    preferredType,
    ...metadataTypes(brand, model),
    ...FIPE_TYPES,
  ].filter(Boolean))];

  const tried = [];
  let firstError = null;
  for (const type of candidates) {
    try {
      const years = await listFipeYears(type, brandId, modelId);
      tried.push({ type, count: years.length });
      if (years.length) return { type, years, tried };
    } catch (error) {
      tried.push({ type, count: 0, error: true });
      firstError ??= error;
    }
  }

  if (firstError && tried.every((item) => item.error)) throw firstError;
  return { type: preferredType || metadataTypes(brand, model)[0] || '', years: [], tried };
}


/**
 * Resolve a FIPE quote from the canonical vehicle fields already stored in RotaMaxi.
 * This is the shared fallback for screens that receive a vehicle without the hydrated
 * `fipe` object from /frota. It never guesses between multiple fuel/version options.
 */
export async function resolveVehicleFipeQuote(vehicle = {}) {
  const brandId = Number(vehicle?.marca_id || 0);
  const modelId = Number(vehicle?.modelo_id || 0);
  const preferredType = String(vehicle?.fipe_tipo || '').trim();
  const storedYearCode = String(vehicle?.fipe_ano_codigo || '').trim();
  const modelYear = Number(vehicle?.ano_modelo || 0);

  if (!brandId || !modelId) return null;

  const types = [...new Set([preferredType, ...FIPE_TYPES].filter(Boolean))];

  // Best case: cadastro already stores the exact FIPE year/fuel code.
  if (storedYearCode) {
    for (const type of types) {
      try {
        const quote = await getFipeQuote(type, brandId, modelId, storedYearCode);
        if (quote?.codigo_fipe && quote?.valor) return { ...quote, fipe_tipo: type, fipe_ano_codigo: storedYearCode };
      } catch {
        // Try the next FIPE category. Old records may have an outdated fipe_tipo.
      }
    }
  }

  // Legacy record without fipe_ano_codigo: resolve years using the same backend catalog.
  if (!modelYear) return null;
  try {
    const resolution = await resolveFipeYears({ preferredType, brandId, modelId });
    const compatible = (resolution.years || []).filter((item) => Number.parseInt(String(item?.codigo || ''), 10) === modelYear);
    // More than one entry means different fuel/version: do not silently choose one.
    if (compatible.length !== 1) return null;
    const yearCode = compatible[0].codigo;
    const quote = await getFipeQuote(resolution.type, brandId, modelId, yearCode);
    return quote?.codigo_fipe && quote?.valor ? { ...quote, fipe_tipo: resolution.type, fipe_ano_codigo: yearCode } : null;
  } catch {
    return null;
  }
}
