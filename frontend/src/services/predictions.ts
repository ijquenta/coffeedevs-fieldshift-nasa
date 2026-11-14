import type { AnalyzeProductRequest, Confidence, CropRecommendation, PredictionRequest, PredictionResponse, ProductAnalysisResponse, RangeValue, Rotation, Signal, TimePoint } from "../types/predictions";
import { PredictionServiceError } from "../types/predictions";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
const REQUEST_TIMEOUT_MS = 20_000;

function seededNumber(seed: number, salt: number, min: number, max: number): number {
  const raw = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return min + (raw - Math.floor(raw)) * (max - min);
}

function fieldGeometry(request: PredictionRequest) {
  const ring = request.polygon.geometry.coordinates[0];
  const points = ring.length > 1 ? ring.slice(0, -1) : ring;
  const lng = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const lat = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  const areaHa = Math.abs(points.slice(0, -1).reduce((sum, p, i) => {
    const next = points[i + 1];
    return sum + p[0] * next[1] - next[0] * p[1];
  }, 0)) * 618_200 * Math.cos(lat * Math.PI / 180);
  const seed = Math.abs(Math.round(lng * 10_000 + lat * 100_000 + areaHa * 23));
  return { lng, lat, areaHa: Math.max(.1, areaHa), seed };
}

function range(min: number, max: number, unit: string, confidence: Confidence, motivo: string, senal: Signal): RangeValue {
  return { min: round(min), max: round(max), p25: round(min + (max - min) * .25), p75: round(min + (max - min) * .75), unidad: unit, confianza: confidence, motivoConfianza: motivo, senal };
}

const round = (n: number) => Math.round(n * 10) / 10;

function makeCrops(seed: number): CropRecommendation[] {
  const crops: CropRecommendation[] = [
    { cultivo: "Quinua", puntaje: 0, confianza: "alta", porQue: "Tolera amplitudes térmicas y periodos secos moderados del altiplano.", datosNASA: ["SMAP · humedad del suelo", "POWER · temperatura", "GPM IMERG · precipitación"], beneficios: ["Buena adaptación a altura", "Demanda hídrica moderada"], riesgos: ["Sensibilidad a encharcamiento en emergencia"], vaciosDeInformacion: ["Variedad local y fecha de siembra"] },
    { cultivo: "Papa", puntaje: 0, confianza: "media", porQue: "El rango térmico estimado es compatible; conviene observar heladas al inicio del ciclo.", datosNASA: ["POWER · temperatura mínima", "GPM IMERG · lluvia", "SRTM · pendiente"], beneficios: ["Cultivo conocido en la zona", "Diversidad de variedades"], riesgos: ["Helada y déficit hídrico durante tuberización"], vaciosDeInformacion: ["Textura y profundidad efectiva del suelo"] },
    { cultivo: "Haba", puntaje: 0, confianza: "media", porQue: "Puede aportar diversidad a la rotación y aprovechar humedad residual.", datosNASA: ["SMAP · humedad", "MODIS · estrés de vegetación"], beneficios: ["Aporta nitrógeno a la rotación", "Alternativa de ciclo corto"], riesgos: ["Exceso de humedad favorece enfermedades"], vaciosDeInformacion: ["Historial sanitario de la parcela"] },
    { cultivo: "Cebada", puntaje: 0, confianza: "media", porQue: "Alternativa rústica para diversificar el calendario agrícola.", datosNASA: ["POWER · temperatura", "GPM IMERG · precipitación", "SRTM · relieve"], beneficios: ["Ciclo flexible", "Cobertura para el suelo"], riesgos: ["Baja producción con sequía prolongada"], vaciosDeInformacion: ["Disponibilidad de semilla y destino comercial"] },
    { cultivo: "Maíz", puntaje: 0, confianza: "baja", porQue: "Opción condicionada a una ventana térmica suficiente y disponibilidad de agua.", datosNASA: ["POWER · temperatura", "SMAP · humedad", "GPM IMERG · lluvia"], beneficios: ["Puede diversificar ingresos"], riesgos: ["Mayor demanda de agua y calor"], vaciosDeInformacion: ["Variedad, altitud y calendario local"] },
  ];
  return crops.map((crop, i) => ({ ...crop, puntaje: Math.round(seededNumber(seed, i + 8, 57, 94)) })).sort((a, b) => b.puntaje - a.puntaje);
}

function getMockPrediction(request: PredictionRequest): PredictionResponse {
  const { lng, lat, areaHa, seed } = fieldGeometry(request);
  const dayCount = Math.max(1, Math.ceil((Date.parse(request.dateTo) - Date.parse(request.dateFrom)) / 86_400_000) + 1);
  const centerRain = seededNumber(seed, dayCount, 12, 68);
  const centerMoisture = seededNumber(seed, 3, 22, 71);
  const centerTemp = seededNumber(seed, 7, 7, 24);
  const confidence: Confidence = areaHa < 150 ? "media" : "baja";
  const variables = {
    humedadSuelo: range(centerMoisture - 7, centerMoisture + 7, "% vol.", "media", "SMAP ofrece una señal regional; la resolución no describe cada surco.", centerMoisture < 35 ? "riesgo" : centerMoisture < 48 ? "atencion" : "favorable"),
    lluvia: range(centerRain * .65, centerRain * 1.35, "mm", confidence, "GPM IMERG estima precipitación por celdas; el relieve puede cambiar la lluvia local.", centerRain < 25 ? "riesgo" : centerRain < 45 ? "atencion" : "favorable"),
    temperatura: { ...range(centerTemp - 4, centerTemp + 4, "°C", "media", "POWER resume condiciones atmosféricas a escala regional.", centerTemp < 8 ? "atencion" : "favorable"), minima: round(centerTemp - 6), media: round(centerTemp), maxima: round(centerTemp + 7) },
    riesgoHelada: range(Math.max(0, 38 - centerTemp * 3), Math.max(4, 55 - centerTemp * 2), "%", "media", "El riesgo es orientativo; no sustituye pronóstico local ni observación en parcela.", centerTemp < 8 ? "riesgo" : centerTemp < 12 ? "atencion" : "favorable"),
    balanceHidrico: range(centerRain - 26, centerRain - 7, "mm", "baja", "Balance simplificado: lluvia menos demanda aproximada; faltan suelo y riego observados.", centerRain < 30 ? "riesgo" : centerRain < 47 ? "atencion" : "favorable"),
    estresVegetacion: range(seededNumber(seed, 11, 12, 38), seededNumber(seed, 12, 45, 78), "%", "media", "MODIS/Landsat puede tener vacíos por nubes y mezcla de cobertura.", centerMoisture < 35 ? "riesgo" : "favorable"),
    erosionPendiente: range(seededNumber(seed, 13, 2, 9), seededNumber(seed, 14, 12, 28), "% pendiente", "baja", "SRTM describe relieve general; faltan cobertura, manejo y lluvias intensas locales.", seededNumber(seed, 15, 0, 1) > .65 ? "atencion" : "favorable"),
  };
  const steps = Math.min(12, Math.max(4, Math.ceil(dayCount / 7)));
  const serieTemporal: TimePoint[] = Array.from({ length: steps }, (_, i) => {
    const t = i / Math.max(1, steps - 1);
    const wave = Math.sin(t * Math.PI * 2 + seed) * .2;
    const rain = Math.max(0, centerRain * (1 + wave) / Math.max(1, steps / 4));
    const moisture = Math.max(5, Math.min(90, centerMoisture + Math.sin(t * Math.PI * 2 + 1) * 9));
    return { fecha: new Date(Date.parse(request.dateFrom) + (Date.parse(request.dateTo) - Date.parse(request.dateFrom)) * t).toISOString().slice(0, 10), lluvia: { min: round(rain * .55), p25: round(rain * .8), p75: round(rain * 1.2), max: round(rain * 1.45) }, humedad: { min: round(moisture - 9), p25: round(moisture - 4), p75: round(moisture + 4), max: round(moisture + 9) } };
  });
  const cultivos = makeCrops(seed);
  const rotaciones: Rotation[] = [
    { nombre: "Diversificación resiliente", cultivos: [cultivos[0].cultivo, "Haba", "Cebada"], puntaje: Math.round(seededNumber(seed, 17, 82, 95)), nota: "Alterna demanda hídrica y ayuda a mantener cobertura del suelo." },
    { nombre: "Rotación actual", cultivos: request.currentRotation?.length ? request.currentRotation : ["Papa", "Cebada", "Descanso"], puntaje: 72, actual: true, nota: "Referencia declarada por el agricultor; conviene contrastarla con el historial de la parcela." },
    { nombre: "Ciclo de mercado", cultivos: ["Maíz", cultivos[1].cultivo, "Haba"], puntaje: Math.round(seededNumber(seed, 18, 61, 84)), nota: "Más sensible a temperatura y agua; confirmar ventana y disponibilidad de riego." },
  ];
  return { variables, serieTemporal, cultivos, rotaciones, vaciosDeInformacion: ["Textura, profundidad y materia orgánica del suelo", "Fechas reales de siembra y variedad", "Riego aplicado, drenaje y manejo", "Nubes y resolución de los productos satelitales"], riesgos: ["La lluvia estimada no confirma precipitación dentro de la parcela.", "La helada puede variar con orientación, sombra y microrelieve."], fuentes: ["NASA SMAP · humedad del suelo", "NASA GPM IMERG · precipitación", "NASA POWER · temperatura y clima", "MODIS / Landsat · vegetación", "SRTM · elevación y pendiente", "GRACE-FO · señal regional de almacenamiento de agua"], metadatos: { generadoEn: new Date().toISOString(), esDatoDeEjemplo: true, zona: `${Math.abs(lat).toFixed(2)}° S, ${Math.abs(lng).toFixed(2)}° O`, areaHa, centroide: [lng, lat] } };
}

function getMockAnalysis(request: AnalyzeProductRequest): ProductAnalysisResponse {
  const known = ["quinua", "papa", "haba", "cebada", "maíz", "avena", "alfalfa"];
  const product = request.product.trim();
  const familiar = known.includes(product.toLocaleLowerCase("es"));
  const { seed } = fieldGeometry(request);
  const score = Math.round(seededNumber(seed, product.length, familiar ? 65 : 42, familiar ? 94 : 73));
  const compatibility = score >= 78 ? "alta" : score >= 58 ? "media" : "baja";
  return { producto: product, requerimientos: { agua: "Demanda estacional variable; confirmar precipitación efectiva y riego.", temperatura: "Evaluar temperatura mínima, media y amplitud térmica del ciclo.", suelo: "Revisar profundidad, drenaje, textura y fertilidad con análisis local.", ciclo: "La duración depende de variedad, altitud y fecha de siembra." }, compatibilidad: compatibility, puntaje: score, razones_a_favor: familiar ? ["Cultivo incluido en la biblioteca de demostración.", "Rango climático estimado permite evaluar una ventana potencial."] : ["Se puede realizar una comparación exploratoria con las señales disponibles.", "El nombre se conserva como texto libre para validación agronómica."], riesgos: ["Riesgo de helada o falta de agua en fases sensibles.", "La estimación regional puede diferir del microclima de la parcela."], vacios_de_informacion: ["Variedad y calendario de siembra", "Análisis de suelo, riego y costos locales"], recomendaciones_practicas: ["Contrastar el resultado con un técnico y experiencia local.", "Probar primero en una franja pequeña y registrar el comportamiento."], confianza: familiar ? "media" : "baja", aviso: "Análisis simulado para prototipo. No representa una recomendación agronómica validada." };
}

function isObject(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function isNumber(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function isStringArray(value: unknown): value is string[] { return Array.isArray(value) && value.every((item) => typeof item === "string"); }
function hasRangeContract(value: unknown): value is RangeValue {
  return isObject(value) && isNumber(value.min) && isNumber(value.max) && isNumber(value.p25) && isNumber(value.p75) && typeof value.unidad === "string" && ["alta", "media", "baja"].includes(String(value.confianza)) && typeof value.motivoConfianza === "string" && ["favorable", "atencion", "riesgo"].includes(String(value.senal));
}
function hasBandContract(value: unknown): value is { min: number; p25: number; p75: number; max: number } {
  return isObject(value) && ["min", "p25", "p75", "max"].every((key) => isNumber(value[key]));
}
function hasPredictionContract(value: unknown): value is PredictionResponse {
  if (!isObject(value)) return false;
  const variables = value.variables;
  const metadatos = value.metadatos;
  if (!isObject(variables) || !isObject(metadatos)) return false;
  const keys = ["humedadSuelo", "lluvia", "temperatura", "riesgoHelada", "balanceHidrico", "estresVegetacion", "erosionPendiente"];
  const temperature = variables.temperatura;
  const seriesValid = Array.isArray(value.serieTemporal) && value.serieTemporal.every((point) => isObject(point) && typeof point.fecha === "string" && hasBandContract(point.lluvia) && hasBandContract(point.humedad));
  const cropsValid = Array.isArray(value.cultivos) && value.cultivos.every((crop) => isObject(crop) && typeof crop.cultivo === "string" && isNumber(crop.puntaje) && ["alta", "media", "baja"].includes(String(crop.confianza)) && typeof crop.porQue === "string" && isStringArray(crop.datosNASA) && isStringArray(crop.beneficios) && isStringArray(crop.riesgos) && isStringArray(crop.vaciosDeInformacion));
  const rotationsValid = Array.isArray(value.rotaciones) && value.rotaciones.every((rotation) => isObject(rotation) && typeof rotation.nombre === "string" && isStringArray(rotation.cultivos) && isNumber(rotation.puntaje) && typeof rotation.nota === "string");
  const centerValid = Array.isArray(metadatos.centroide) && metadatos.centroide.length === 2 && metadatos.centroide.every(isNumber);
  return keys.every((key) => hasRangeContract(variables[key])) && isObject(temperature) && isNumber(temperature.media) && isNumber(temperature.minima) && isNumber(temperature.maxima) && seriesValid && cropsValid && rotationsValid && isStringArray(value.vaciosDeInformacion) && isStringArray(value.riesgos) && isStringArray(value.fuentes) && typeof metadatos.esDatoDeEjemplo === "boolean" && typeof metadatos.generadoEn === "string" && typeof metadatos.zona === "string" && isNumber(metadatos.areaHa) && centerValid;
}
function hasAnalysisContract(value: unknown): value is ProductAnalysisResponse {
  if (!isObject(value)) return false;
  const requirements = value.requerimientos;
  return typeof value.producto === "string" && isNumber(value.puntaje) && ["alta", "media", "baja"].includes(String(value.compatibilidad)) && isStringArray(value.razones_a_favor) && isStringArray(value.riesgos) && isStringArray(value.vacios_de_informacion) && isStringArray(value.recomendaciones_practicas) && ["alta", "media", "baja"].includes(String(value.confianza)) && typeof value.aviso === "string" && isObject(requirements) && ["agua", "temperatura", "suelo", "ciclo"].every((key) => typeof requirements[key] === "string");
}

async function requestJSON<T>(path: string, body: unknown, signal: AbortSignal | undefined, validate: (value: unknown) => value is T): Promise<T> {
  if (!API_BASE) throw new PredictionServiceError("Configura NEXT_PUBLIC_API_BASE_URL para conectar el servicio real.", "network");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new DOMException("Tiempo de espera agotado", "TimeoutError")), REQUEST_TIMEOUT_MS);
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await fetch(`${API_BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body), signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new PredictionServiceError(`El servicio respondió con estado ${response.status}. Intenta de nuevo más tarde.`, "http");
    let data: unknown;
    try { data = await response.json(); } catch { throw new PredictionServiceError("El servicio respondió con JSON inválido.", "invalid-response"); }
    if (!validate(data)) throw new PredictionServiceError("La respuesta del servicio no coincide con el contrato esperado.", "invalid-response");
    return data;
  } catch (error) {
    if (error instanceof PredictionServiceError) throw error;
    if (signal?.aborted) throw new PredictionServiceError("Consulta cancelada.", "aborted");
    if (controller.signal.aborted) throw new PredictionServiceError("La consulta tardó demasiado. Revisa tu conexión e inténtalo otra vez.", "timeout");
    throw new PredictionServiceError("No se pudo conectar con el servicio. Verifica la conexión e inténtalo de nuevo.", "network");
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

export async function getPrediction(request: PredictionRequest, signal?: AbortSignal): Promise<PredictionResponse> {
  if (signal?.aborted) throw new PredictionServiceError("Consulta cancelada.", "aborted");
  if (USE_MOCK) { await delay(950, signal); return getMockPrediction(request); }
  return requestJSON("/predict", request, signal, hasPredictionContract);
}

export async function analyzeProduct(request: AnalyzeProductRequest, signal?: AbortSignal): Promise<ProductAnalysisResponse> {
  if (signal?.aborted) throw new PredictionServiceError("Consulta cancelada.", "aborted");
  if (USE_MOCK) { await delay(750, signal); return getMockAnalysis(request); }
  return requestJSON("/analyze-product", request, signal, hasAnalysisContract);
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new PredictionServiceError("Consulta cancelada.", "aborted")); }, { once: true });
  });
}
