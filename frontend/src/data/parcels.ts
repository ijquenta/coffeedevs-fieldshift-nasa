export type AgroVariable = "ALL" | "MOISTURE" | "TEMPERATURE" | "PRECIPITATION";

export interface AgriculturalParcel {
  id: string;
  name: string;
  department: string;
  municipality: string;
  locality: string;
  latitude: number;
  longitude: number;
  crop: string;
  moisture: number;
  temperature: number;
  precipitation: number;
  date: string;
}

export const sampleParcels: AgriculturalParcel[] = [
  { id: "parcel-1", name: "Parcela 04", department: "La Paz", municipality: "Achocalla", locality: "Ventilla", latitude: -16.566, longitude: -68.145, crop: "Quinua", moisture: 61, temperature: 16.8, precipitation: 42, date: "2026-11-10" },
  { id: "parcel-2", name: "Parcela 07", department: "La Paz", municipality: "Achocalla", locality: "Pacajes", latitude: -16.59, longitude: -68.12, crop: "Papa", moisture: 48, temperature: 17.4, precipitation: 35, date: "2026-11-10" },
  { id: "parcel-3", name: "Parcela 12", department: "La Paz", municipality: "Mecapaca", locality: "Palomar", latitude: -16.65, longitude: -68.02, crop: "Haba", moisture: 69, temperature: 18.1, precipitation: 51, date: "2026-11-11" },
  { id: "parcel-4", name: "Parcela 18", department: "La Paz", municipality: "Viacha", locality: "Hichuraya", latitude: -16.65, longitude: -68.3, crop: "Cebada", moisture: 39, temperature: 15.9, precipitation: 28, date: "2026-11-12" },
  { id: "parcel-5", name: "Parcela 21", department: "La Paz", municipality: "Palca", locality: "Uni", latitude: -16.58, longitude: -67.95, crop: "Quinua", moisture: 56, temperature: 17.2, precipitation: 46, date: "2026-11-12" },
];
