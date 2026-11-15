"use client";

import { useEffect, useRef, useState } from "react";
import { CloudRain, Droplets, Leaf, Thermometer, Waves } from "lucide-react";
import type { Position } from "../../types/wizard";
import type { MapMode } from "./wizard-store";

interface Props { points: Position[]; mode: MapMode; cameraTarget: { position: Position; altitude?: number; key: string } | null; spin: boolean; onChange: (points: Position[]) => void; onCameraMove?: (moving: boolean) => void }

type WeatherLayerId = "rain" | "temperature" | "soil" | "vegetation";

const WEATHER_LAYERS: Record<WeatherLayerId, { label: string; source: string; product: string; cadence: string; icon: typeof CloudRain }> = {
  rain: { label: "Lluvia", source: "NASA GPM IMERG", product: "IMERG_Precipitation_Rate_30min", cadence: "cada 30 min", icon: CloudRain },
  temperature: { label: "Temperatura", source: "NASA AIRS · Aqua", product: "AIRS_L2_Surface_Air_Temperature_Day", cadence: "diaria", icon: Thermometer },
  soil: { label: "Humedad del suelo", source: "NASA SMAP L4", product: "SMAP_L4_Analyzed_Root_Zone_Soil_Moisture", cadence: "diaria", icon: Waves },
  vegetation: { label: "Vegetación", source: "NASA VIIRS NOAA-21", product: "VIIRS_NOAA21_NDVI_8Day", cadence: "cada 8 días", icon: Leaf },
};

export default function WizardMap({ points, mode, cameraTarget, spin, onChange, onCameraMove }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const weatherCanvas = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<import("cesium").Viewer | null>(null);
  const cesiumRef = useRef<typeof import("cesium") | null>(null);
  const handlerRef = useRef<import("cesium").ScreenSpaceEventHandler | null>(null);
  const rainLayerRef = useRef<import("cesium").ImageryLayer | null>(null);
  const pointsRef = useRef(points), modeRef = useRef(mode), onChangeRef = useRef(onChange);
  const dragging = useRef<{ index: number } | { original: Position[]; origin: Position } | null>(null);
  const userInputUntil = useRef(0);
  const [ready, setReady] = useState(false);
  const [rainEnabled, setRainEnabled] = useState(true);
  const [weatherLayer, setWeatherLayer] = useState<WeatherLayerId>("rain");
  const [refreshKey, setRefreshKey] = useState(0);
  const rainEnabledRef = useRef(rainEnabled);

  useEffect(() => { rainEnabledRef.current = rainEnabled; }, [rainEnabled]);

  useEffect(() => { pointsRef.current = points; modeRef.current = mode; onChangeRef.current = onChange; }, [points, mode, onChange]);

  useEffect(() => {
    let disposed = false;
    const start = async () => {
      (window as Window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = "/cesium/";
      const Cesium = await import("cesium");
      if (disposed || !host.current) return;
      const token = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
      if (token) Cesium.Ion.defaultAccessToken = token;
      const viewer = new Cesium.Viewer(host.current, { animation: false, timeline: false, baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false, navigationHelpButton: false, fullscreenButton: false, infoBox: false, selectionIndicator: false, terrainProvider: new Cesium.EllipsoidTerrainProvider(), requestRenderMode: true, maximumRenderTimeChange: Infinity });
      viewerRef.current = viewer; cesiumRef.current = Cesium;
      viewer.scene.globe.enableLighting = true;
      viewer.scene.screenSpaceCameraController.minimumZoomDistance = 120;
      viewer.scene.screenSpaceCameraController.maximumZoomDistance = 18_000_000;
      viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(-63.5, -17.5, 6_000_000), duration: 1.1 });
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas); handlerRef.current = handler;
      const positionAt = (screen: import("cesium").Cartesian2): Position | null => {
        const hit = viewer.camera.pickEllipsoid(screen, viewer.scene.globe.ellipsoid);
        if (!hit) return null;
        const cartographic = Cesium.Cartographic.fromCartesian(hit);
        return [Cesium.Math.toDegrees(cartographic.longitude), Cesium.Math.toDegrees(cartographic.latitude)];
      };
      handler.setInputAction((event: { position: import("cesium").Cartesian2 }) => {
        if (modeRef.current !== "draw") return;
        const point = positionAt(event.position); if (point) onChangeRef.current([...pointsRef.current, point]);
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      handler.setInputAction((event: { position: import("cesium").Cartesian2 }) => {
        if (modeRef.current !== "edit") return;
        const picked = viewer.scene.pick(event.position)?.id as import("cesium").Entity | undefined;
        const id = typeof picked?.id === "string" ? picked.id : "";
        const anchor = positionAt(event.position); if (!anchor) return;
        if (id.startsWith("wizard-mid-")) {
          const index = Number(id.slice(11)); const next = [...pointsRef.current]; next.splice(index + 1, 0, anchor); onChangeRef.current(next); dragging.current = { index: index + 1 };
        } else if (id.startsWith("wizard-vertex-")) dragging.current = { index: Number(id.slice(14)) };
        else if (id === "wizard-parcel") dragging.current = { original: pointsRef.current.map((point) => [...point] as Position), origin: anchor };
        if (dragging.current) viewer.scene.screenSpaceCameraController.enableRotate = false;
      }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
      handler.setInputAction((event: { endPosition: import("cesium").Cartesian2 }) => {
        const drag = dragging.current, target = positionAt(event.endPosition); if (!drag || !target) return;
        if ("index" in drag) { const next = [...pointsRef.current]; if (next[drag.index]) next[drag.index] = target; onChangeRef.current(next); }
        else { const deltaLng = target[0] - drag.origin[0], deltaLat = target[1] - drag.origin[1]; onChangeRef.current(drag.original.map(([lng, lat]) => [lng + deltaLng, lat + deltaLat])); }
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
      handler.setInputAction(() => { dragging.current = null; viewer.scene.screenSpaceCameraController.enableRotate = true; }, Cesium.ScreenSpaceEventType.LEFT_UP);
      handler.setInputAction((event: { position: import("cesium").Cartesian2 }) => {
        if (modeRef.current !== "edit" || pointsRef.current.length <= 3) return;
        const picked = viewer.scene.pick(event.position)?.id as import("cesium").Entity | undefined;
        const id = typeof picked?.id === "string" ? picked.id : "";
        if (id.startsWith("wizard-vertex-")) { const next = [...pointsRef.current]; next.splice(Number(id.slice(14)), 1); onChangeRef.current(next); }
      }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
      setReady(true);
    };
    start().catch((error) => console.error("No se pudo iniciar Cesium", error));
    return () => { disposed = true; handlerRef.current?.destroy(); handlerRef.current = null; if (viewerRef.current && !viewerRef.current.isDestroyed()) viewerRef.current.destroy(); viewerRef.current = null; cesiumRef.current = null; };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current, Cesium = cesiumRef.current;
    if (!ready || !viewer || !Cesium || !spin) return;
    const canvas = viewer.scene.canvas;
    const pauseForInteraction = () => { userInputUntil.current = Date.now() + 3500; };
    canvas.addEventListener("pointerdown", pauseForInteraction);
    canvas.addEventListener("wheel", pauseForInteraction);
    const timer = window.setInterval(() => {
      if (viewer.isDestroyed() || Date.now() < userInputUntil.current) return;
      viewer.camera.rotate(Cesium.Cartesian3.UNIT_Z, 0.00012);
      viewer.scene.requestRender();
    }, 80);
    return () => { window.clearInterval(timer); canvas.removeEventListener("pointerdown", pauseForInteraction); canvas.removeEventListener("wheel", pauseForInteraction); };
  }, [ready, spin]);

  useEffect(() => {
    if (!ready || !cameraTarget) return;
    const Cesium = cesiumRef.current, viewer = viewerRef.current; if (!Cesium || !viewer || viewer.isDestroyed()) return;
    const stopMoving = () => onCameraMove?.(false);
    viewer.camera.moveEnd.addEventListener(stopMoving);
    onCameraMove?.(true);
    viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(cameraTarget.position[0], cameraTarget.position[1], cameraTarget.altitude ?? 4200), duration: 1.6, complete: stopMoving, cancel: stopMoving });
    return () => { viewer.camera.moveEnd.removeEventListener(stopMoving); };
  }, [cameraTarget, ready, onCameraMove]);

  useEffect(() => {
    const Cesium = cesiumRef.current, viewer = viewerRef.current; if (!ready || !Cesium || !viewer || viewer.isDestroyed()) return;
    for (const entity of viewer.entities.values.filter((item) => typeof item.id === "string" && item.id.startsWith("wizard-"))) viewer.entities.remove(entity);
    if (points.length >= 3) {
      const positions = points.map(([lng, lat]) => Cesium.Cartesian3.fromDegrees(lng, lat, 14));
      viewer.entities.add({ id: "wizard-parcel", polygon: { hierarchy: positions, material: Cesium.Color.fromCssColorString("#e64b55").withAlpha(.27), outline: true, outlineColor: Cesium.Color.fromCssColorString("#ff7881"), outlineWidth: 3, perPositionHeight: false }, polyline: { positions: [...positions, positions[0]], width: 3, material: Cesium.Color.fromCssColorString("#ff6673"), clampToGround: true } });
      points.forEach(([lng, lat], index) => viewer.entities.add({ id: `wizard-vertex-${index}`, position: Cesium.Cartesian3.fromDegrees(lng, lat, 25), point: { pixelSize: mode === "edit" ? 13 : 9, color: Cesium.Color.WHITE, outlineColor: Cesium.Color.fromCssColorString("#e64b55"), outlineWidth: 3, disableDepthTestDistance: Number.POSITIVE_INFINITY } }));
      if (mode === "edit") points.forEach(([lng, lat], index) => { const next = points[(index + 1) % points.length]; const midLng = (lng + next[0]) / 2, midLat = (lat + next[1]) / 2; viewer.entities.add({ id: `wizard-mid-${index}`, position: Cesium.Cartesian3.fromDegrees(midLng, midLat, 25), point: { pixelSize: 8, color: Cesium.Color.fromCssColorString("#ffca82"), outlineColor: Cesium.Color.fromCssColorString("#572c20"), outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY } }); });
    }
    viewer.scene.requestRender();
  }, [mode, points, ready]);

  useEffect(() => {
    const Cesium = cesiumRef.current, viewer = viewerRef.current, canvas = weatherCanvas.current;
    if (!ready || !Cesium || !viewer || !canvas || viewer.isDestroyed()) return;
    let cancelled = false;
    let animationFrame = 0;
    let lastFrame = 0;
    let context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    // NASA GIBS serves the georeferenced satellite/model products directly as WMS imagery.
    const selectedLayer = WEATHER_LAYERS[weatherLayer];
    const provider = new Cesium.WebMapServiceImageryProvider({
      url: "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi",
      layers: selectedLayer.product,
      parameters: { format: "image/png", transparent: true, time: "default", cacheBust: refreshKey },
      srs: "EPSG:4326",
      credit: `${selectedLayer.source} · NASA GIBS`,
    });
    const imageryLayer = viewer.imageryLayers.addImageryProvider(provider);
    imageryLayer.alpha = .84;
    imageryLayer.show = rainEnabledRef.current;
    rainLayerRef.current = imageryLayer;
    viewer.scene.requestRender();

    const fitCanvas = () => {
      const bounds = canvas.getBoundingClientRect();
      if (!Number.isFinite(bounds.width) || !Number.isFinite(bounds.height) || bounds.width <= 0 || bounds.height <= 0) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      const maxPixels = 2_000_000;
      const scale = Math.min(1, Math.sqrt(maxPixels / (bounds.width * bounds.height * ratio * ratio)));
      const effectiveRatio = ratio * scale;
      const width = Math.max(1, Math.min(2048, Math.round(bounds.width * effectiveRatio)));
      const height = Math.max(1, Math.min(2048, Math.round(bounds.height * effectiveRatio)));
      if (canvas.width !== width || canvas.height !== height) {
        try {
          canvas.width = width;
          canvas.height = height;
          const nextContext = canvas.getContext("2d", { alpha: true });
          if (!nextContext) return;
          context = nextContext;
        } catch {
          cancelled = true;
          return;
        }
      }
      try {
        const activeContext = context;
        if (!activeContext) return;
        activeContext.setTransform(effectiveRatio, 0, 0, effectiveRatio, 0, 0);
      } catch {
        cancelled = true;
        return;
      }
      const activeContext = context;
      if (!activeContext) return;
      return { width: bounds.width, height: bounds.height, context: activeContext };
    };
    const focus = cameraTarget?.position ?? [-63.5, -17.5] as [number, number];
    let seed = Math.abs(Math.round(focus[0] * 10_000 + focus[1] * 100_000)) + 17;
    const random = (min: number, max: number) => { seed = (seed * 16807) % 2147483647; return min + (seed / 2147483647) * (max - min); };
    const particles = Array.from({ length: 76 }, () => ({
      longitude: focus[0] + random(-.34, .34), latitude: focus[1] + random(-.26, .26),
      direction: random(0, Math.PI * 2), speed: random(.45, 1.15), length: random(.012, .04),
      phase: random(0, Math.PI * 2),
    }));
    const projected = (longitude: number, latitude: number) => Cesium.SceneTransforms.worldToWindowCoordinates(
      viewer.scene, Cesium.Cartesian3.fromDegrees(longitude, latitude, 1800),
    );
    const drawParticles = (time: number) => {
      if (cancelled) return;
      animationFrame = window.requestAnimationFrame(drawParticles);
      if (time - lastFrame < 48) return;
      lastFrame = time;
      const size = fitCanvas(); if (!size) return;
      size.context.clearRect(0, 0, size.width, size.height);
      if (!rainEnabledRef.current || weatherLayer !== "rain" || document.hidden) return;
      for (const particle of particles) {
        // Windy-inspired moving traces: decorative flow only; GPM provides rain, not wind vectors.
        const angle = particle.direction + Math.sin(particle.longitude * 17 + particle.latitude * 23 + particle.phase) * .42;
        const dx = Math.cos(angle) * .0012 * particle.speed, dy = Math.sin(angle) * .0012 * particle.speed;
        particle.longitude += dx; particle.latitude += dy;
        if (Math.abs(particle.longitude - focus[0]) > .36 || Math.abs(particle.latitude - focus[1]) > .28) {
          particle.longitude = focus[0] + random(-.34, .34); particle.latitude = focus[1] + random(-.26, .26);
        }
        const head = projected(particle.longitude, particle.latitude);
        const tail = projected(particle.longitude - Math.cos(angle) * particle.length, particle.latitude - Math.sin(angle) * particle.length);
        if (!head || !tail || head.x < -20 || head.y < -20 || head.x > size.width + 20 || head.y > size.height + 20) continue;
         size.context.beginPath(); size.context.moveTo(tail.x, tail.y); size.context.lineTo(head.x, head.y);
         size.context.strokeStyle = `rgba(221,250,255,${.35 + particle.speed * .25})`;
         size.context.lineWidth = .9 + particle.speed * .8; size.context.lineCap = "round"; size.context.stroke();
         size.context.beginPath(); size.context.arc(head.x, head.y, .7 + particle.speed * .55, 0, Math.PI * 2);
         size.context.fillStyle = "rgba(243,255,234,.85)"; size.context.fill();
      }
    };
    const onVisibilityChange = () => { if (!document.hidden) viewer.scene.requestRender(); };
    document.addEventListener("visibilitychange", onVisibilityChange);
    const resize = new ResizeObserver(fitCanvas); resize.observe(canvas);
    animationFrame = window.requestAnimationFrame(drawParticles);
    return () => {
      cancelled = true; window.cancelAnimationFrame(animationFrame); resize.disconnect(); document.removeEventListener("visibilitychange", onVisibilityChange);
      if (!viewer.isDestroyed()) viewer.imageryLayers.remove(imageryLayer, true);
      if (rainLayerRef.current === imageryLayer) rainLayerRef.current = null;
    };
  }, [ready, cameraTarget, weatherLayer, refreshKey]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!ready || !viewer || viewer.isDestroyed()) return;
    if (rainLayerRef.current) rainLayerRef.current.show = rainEnabled;
    viewer.scene.requestRender();
  }, [rainEnabled, ready]);

  useEffect(() => {
    const interval = WEATHER_LAYERS[weatherLayer].cadence === "cada 30 min" ? 30 * 60_000 : 6 * 60 * 60_000;
    const timer = window.setInterval(() => setRefreshKey((current) => current + 1), interval);
    return () => window.clearInterval(timer);
  }, [weatherLayer]);
  const selectedWeatherLayer = WEATHER_LAYERS[weatherLayer];
  const WeatherIcon = selectedWeatherLayer.icon;

  return <>
    <div ref={host} className="wizard-cesium" aria-label="Globo 3D interactivo para ubicar y editar la parcela" />
    <canvas ref={weatherCanvas} className="wizard-weather-canvas" aria-hidden="true" />
    <div className="wizard-rain-control" aria-label="Capas de observación de NASA">
      <button type="button" className={`wizard-rain-toggle ${rainEnabled ? "is-on" : ""}`} onClick={() => setRainEnabled((current) => !current)} aria-pressed={rainEnabled} title={rainEnabled ? "Ocultar la capa del mapa" : "Mostrar la capa del mapa"}>
        <span className="wizard-rain-icon"><WeatherIcon size={17} /></span>
        <span className="wizard-rain-copy"><strong>{selectedWeatherLayer.label.toLocaleUpperCase("es-BO")}</strong><small>{rainEnabled ? "Capa satelital activa" : "Capa apagada"}</small></span>
        <span className="wizard-rain-switch"><i /></span>
      </button>
      <div className="wizard-weather-options" role="group" aria-label="Variable para mostrar sobre el globo">
        {(Object.keys(WEATHER_LAYERS) as WeatherLayerId[]).map((id) => {
          const layer = WEATHER_LAYERS[id], Icon = layer.icon;
          return <button key={id} type="button" className={weatherLayer === id ? "is-selected" : ""} onClick={() => setWeatherLayer(id)} aria-pressed={weatherLayer === id}>
            <Icon size={12} /><span>{layer.label}</span>
          </button>;
        })}
      </div>
      {rainEnabled && <div className="wizard-rain-legend">
        <div><Droplets size={13} /><span>{weatherLayer === "rain" ? "Tasa de precipitación · mm/h" : selectedWeatherLayer.source}</span></div>
        <span className={`wizard-weather-gradient ${weatherLayer}`} />
        <div className="wizard-rain-scale"><span>{weatherLayer === "rain" ? "0.1 mm/h" : "Bajo"}</span><strong>NASA GIBS · {selectedWeatherLayer.cadence}</strong><span>{weatherLayer === "rain" ? "50+ mm/h" : "Alto"}</span></div>
        {weatherLayer === "rain" && <small className="wizard-flow-disclaimer">Estelas animadas ilustrativas; no son vectores de viento.</small>}
      </div>}
    </div>
  </>;
}
