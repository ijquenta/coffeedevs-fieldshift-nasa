export type Confidence = "alta" | "media" | "baja";
export type Signal = "favorable" | "atencion" | "riesgo";
export type Position = [longitude: number, latitude: number];

export interface GeoPolygon {
  type: "Feature";
  properties: Record<string, never>;
  geometry: { type: "Polygon"; coordinates: Position[][] };
}

export interface PredictionRequest {
  polygon: GeoPolygon;
  dateFrom: string;
  dateTo: string;
  priorities?: string[];
  currentRotation?: string[];
}

export interface AnalyzeProductRequest extends PredictionRequest {
  product: string;
}

export interface RangeValue {
  min: number;
  max: number;
  p25: number;
  p75: number;
  unidad: string;
  confianza: Confidence;
  motivoConfianza: string;
  senal: Signal;
}

export interface TimePoint {
  fecha: string;
  lluvia: { min: number; p25: number; p75: number; max: number };
  humedad: { min: number; p25: number; p75: number; max: number };
}

export interface CropRecommendation {
  cultivo: string;
  puntaje: number;
  confianza: Confidence;
  porQue: string;
  datosNASA: string[];
  beneficios: string[];
  riesgos: string[];
  vaciosDeInformacion: string[];
}

export interface Rotation {
  nombre: string;
  cultivos: string[];
  puntaje: number;
  actual?: boolean;
  nota: string;
}

export interface PredictionResponse {
  variables: {
    humedadSuelo: RangeValue;
    lluvia: RangeValue;
    temperatura: RangeValue & { media: number; minima: number; maxima: number };
    riesgoHelada: RangeValue;
    balanceHidrico: RangeValue;
    estresVegetacion: RangeValue;
    erosionPendiente: RangeValue;
  };
  serieTemporal: TimePoint[];
  cultivos: CropRecommendation[];
  rotaciones: Rotation[];
  vaciosDeInformacion: string[];
  riesgos: string[];
  fuentes: string[];
  metadatos: { generadoEn: string; esDatoDeEjemplo: boolean; zona: string; areaHa: number; centroide: Position };
}

export interface ProductAnalysisResponse {
  producto: string;
  requerimientos: { agua: string; temperatura: string; suelo: string; ciclo: string };
  compatibilidad: "alta" | "media" | "baja";
  puntaje: number;
  razones_a_favor: string[];
  riesgos: string[];
  vacios_de_informacion: string[];
  recomendaciones_practicas: string[];
  confianza: Confidence;
  aviso: string;
}

export class PredictionServiceError extends Error {
  constructor(message: string, readonly code: "network" | "http" | "invalid-response" | "timeout" | "aborted") {
    super(message);
    this.name = "PredictionServiceError";
  }
}
