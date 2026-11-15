"use client";

import { useEffect, useRef, useState } from "react";
import type { Position } from "../../types/wizard";
import type { MapMode } from "./wizard-store";

interface Props { points: Position[]; mode: MapMode; cameraTarget: { position: Position; altitude?: number; key: string } | null; spin: boolean; onChange: (points: Position[]) => void }

export default function WizardMap({ points, mode, cameraTarget, spin, onChange }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<import("cesium").Viewer | null>(null);
  const cesiumRef = useRef<typeof import("cesium") | null>(null);
  const handlerRef = useRef<import("cesium").ScreenSpaceEventHandler | null>(null);
  const pointsRef = useRef(points), modeRef = useRef(mode), onChangeRef = useRef(onChange);
  const dragging = useRef<{ index: number } | { original: Position[]; origin: Position } | null>(null);
  const userInputUntil = useRef(0);
  const [ready, setReady] = useState(false);

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
    viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(cameraTarget.position[0], cameraTarget.position[1], cameraTarget.altitude ?? 4200), duration: 1.6 });
  }, [cameraTarget, ready]);

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

  return <div ref={host} className="wizard-cesium" aria-label="Globo 3D interactivo para ubicar y editar la parcela" />;
}
