"use client";

import { useEffect, useRef, useState } from "react";
import type { Position } from "../../types/predictions";

interface Props {
  vertices: Position[];
  mode: "draw" | "edit" | "view";
  onVerticesChange: (vertices: Position[]) => void;
}

export default function PredictionGlobe({ vertices, mode, onVerticesChange }: Props) {
  const [viewerReady, setViewerReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<import("cesium").Viewer | null>(null);
  const CesiumRef = useRef<typeof import("cesium") | null>(null);
  const verticesRef = useRef(vertices);
  const modeRef = useRef(mode);
  const onChangeRef = useRef(onVerticesChange);
  const draggingRef = useRef<number | null>(null);
  const handleCountRef = useRef(0);

  useEffect(() => {
    verticesRef.current = vertices;
    modeRef.current = mode;
    onChangeRef.current = onVerticesChange;
  }, [vertices, mode, onVerticesChange]);

  useEffect(() => {
    let cancelled = false;
    let handler: import("cesium").ScreenSpaceEventHandler | null = null;

    async function initialize() {
      (window as Window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = "/cesium/";
      const Cesium = await import("cesium");
      if (cancelled || !containerRef.current) return;
      const ionToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
      if (ionToken) Cesium.Ion.defaultAccessToken = ionToken;
      const viewer = new Cesium.Viewer(containerRef.current, {
        animation: false, timeline: false, baseLayerPicker: false, geocoder: false,
        homeButton: false, sceneModePicker: false, navigationHelpButton: false,
        fullscreenButton: false, infoBox: false, selectionIndicator: false,
        terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      });
      viewerRef.current = viewer;
      CesiumRef.current = Cesium;
      setViewerReady(true);
      viewer.scene.globe.enableLighting = true;
      viewer.scene.screenSpaceCameraController.minimumZoomDistance = 900;
      viewer.scene.screenSpaceCameraController.maximumZoomDistance = 15_000_000;
      viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(-65.2, -17.1, 1_300_000), duration: 1.2 });

      handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((event: { position: import("cesium").Cartesian2 }) => {
        if (modeRef.current !== "draw") return;
        const scenePosition = viewer.camera.pickEllipsoid(event.position, viewer.scene.globe.ellipsoid);
        if (!scenePosition) return;
        const cartographic = Cesium.Cartographic.fromCartesian(scenePosition);
        const next: Position = [Cesium.Math.toDegrees(cartographic.longitude), Cesium.Math.toDegrees(cartographic.latitude)];
        onChangeRef.current([...verticesRef.current, next]);
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      handler.setInputAction((event: { position: import("cesium").Cartesian2 }) => {
        if (modeRef.current !== "edit") return;
        const picked = viewer.scene.pick(event.position);
        const entity = picked?.id as import("cesium").Entity | undefined;
        const index = typeof entity?.id === "string" && entity.id.startsWith("vertex-") ? Number(entity.id.slice(7)) : -1;
        if (index >= 0 && index < verticesRef.current.length) {
          draggingRef.current = index;
          viewer.scene.screenSpaceCameraController.enableRotate = false;
        }
      }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

      handler.setInputAction((event: { endPosition: import("cesium").Cartesian2 }) => {
        const index = draggingRef.current;
        if (modeRef.current !== "edit" || index === null) return;
        const scenePosition = viewer.camera.pickEllipsoid(event.endPosition, viewer.scene.globe.ellipsoid);
        if (!scenePosition) return;
        const cartographic = Cesium.Cartographic.fromCartesian(scenePosition);
        const next = [...verticesRef.current];
        next[index] = [Cesium.Math.toDegrees(cartographic.longitude), Cesium.Math.toDegrees(cartographic.latitude)];
        onChangeRef.current(next);
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

      handler.setInputAction(() => {
        draggingRef.current = null;
        viewer.scene.screenSpaceCameraController.enableRotate = true;
      }, Cesium.ScreenSpaceEventType.LEFT_UP);
    }

    initialize().catch((error) => console.error("No se pudo iniciar el globo de predicciones", error));
    return () => {
      cancelled = true;
      handler?.destroy();
      if (viewerRef.current && !viewerRef.current.isDestroyed()) viewerRef.current.destroy();
      viewerRef.current = null;
      CesiumRef.current = null;
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = CesiumRef.current;
    if (!viewerReady || !viewer || !Cesium || viewer.isDestroyed()) return;
    viewer.entities.removeById("prediction-parcel");
    for (let i = 0; i < handleCountRef.current; i += 1) viewer.entities.removeById(`vertex-${i}`);
    handleCountRef.current = vertices.length;
    if (vertices.length >= 3) {
      const positions = vertices.map(([longitude, latitude]) => Cesium.Cartesian3.fromDegrees(longitude, latitude));
      viewer.entities.add({
        id: "prediction-parcel",
        polygon: { hierarchy: positions, material: Cesium.Color.fromCssColorString("#9ce54b").withAlpha(.36), outline: true, outlineColor: Cesium.Color.fromCssColorString("#d4ff8b"), outlineWidth: 3, perPositionHeight: false },
        polyline: { positions: [...positions, positions[0]], width: 3, material: Cesium.Color.fromCssColorString("#d4ff8b"), clampToGround: true },
      });
    } else {
      if (vertices.length === 2) viewer.entities.add({ id: "prediction-parcel", polyline: { positions: vertices.map(([lng, lat]) => Cesium.Cartesian3.fromDegrees(lng, lat)), width: 3, material: Cesium.Color.fromCssColorString("#d4ff8b"), clampToGround: true } });
    }
    vertices.forEach(([longitude, latitude], index) => {
      viewer.entities.add({ id: `vertex-${index}`, position: Cesium.Cartesian3.fromDegrees(longitude, latitude, 10), point: { pixelSize: mode === "edit" ? 13 : 8, color: Cesium.Color.fromCssColorString(mode === "edit" ? "#ecff9e" : "#d4ff8b"), outlineColor: Cesium.Color.fromCssColorString("#102c22"), outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY } });
    });
    viewer.scene.requestRender();
  }, [vertices, mode, viewerReady]);

  return <div ref={containerRef} className="prediction-globe" aria-label="Globo 3D para delimitar la parcela" />;
}
