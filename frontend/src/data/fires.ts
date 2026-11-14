export type FireSensor = "MODIS" | "VIIRS";

export interface FireDetection {
  id: string;
  latitude: number;
  longitude: number;
  date: string;
  sensor: FireSensor;
  frp: number;
}

export const sampleFires: FireDetection[] = [
  {
    id: "fire-1",
    latitude: -17.8,
    longitude: -63.2,
    date: "2026-11-10",
    sensor: "VIIRS",
    frp: 42.5,
  },
  {
    id: "fire-2",
    latitude: -16.4,
    longitude: -62.1,
    date: "2026-11-10",
    sensor: "MODIS",
    frp: 58.2,
  },
  {
    id: "fire-3",
    latitude: -14.9,
    longitude: -64.2,
    date: "2026-11-11",
    sensor: "VIIRS",
    frp: 26.8,
  },
  {
    id: "fire-4",
    latitude: -13.6,
    longitude: -61.8,
    date: "2026-11-12",
    sensor: "MODIS",
    frp: 74.1,
  },
  {
    id: "fire-5",
    latitude: -18.9,
    longitude: -60.4,
    date: "2026-11-12",
    sensor: "VIIRS",
    frp: 33.7,
  },
];
