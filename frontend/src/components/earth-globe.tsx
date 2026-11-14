"use client";

import { useEffect, useRef } from "react";
import "cesium/Build/Cesium/Widgets/widgets.css";

export default function EarthGlobe() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let viewer: import("cesium").Viewer | undefined;

    async function initialize() {
      // Configurar antes de cargar Cesium
      (window as Window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL =
        "/cesium/";

      const Cesium = await import("cesium");

      if (disposed || !containerRef.current) return;

      Cesium.Ion.defaultAccessToken =
        process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN ?? "";

      viewer = new Cesium.Viewer(containerRef.current, {
        animation: false,
        timeline: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
        terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      });

      // Presentación visual
      viewer.scene.globe.enableLighting = true;
      viewer.scene.skyAtmosphere!.show = true;

      // Mostrar Sudamérica
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(-63.5, -17.5, 11000000),
        orientation: {
          heading: 0,
          pitch: Cesium.Math.toRadians(-85),
          roll: 0,
        },
      });

      viewer.scene.screenSpaceCameraController.enableZoom = true;
      viewer.scene.screenSpaceCameraController.enableRotate = true;

      const minimumLongitude = Cesium.Math.toRadians(-145);
      const maximumLongitude = Cesium.Math.toRadians(15);

      viewer.camera.changed.addEventListener(() => {
        const cartographic = viewer?.camera.positionCartographic;
        if (!viewer || !cartographic) return;

        const longitude = Cesium.Math.negativePiToPi(cartographic.longitude);
        if (longitude >= minimumLongitude && longitude <= maximumLongitude) {
          return;
        }

        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromRadians(
            Cesium.Math.clamp(longitude, minimumLongitude, maximumLongitude),
            cartographic.latitude,
            cartographic.height
          ),
          orientation: {
            heading: viewer.camera.heading,
            pitch: viewer.camera.pitch,
            roll: viewer.camera.roll,
          },
        });
      });
    }

    initialize().catch(console.error);

    return () => {
      disposed = true;
      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy();
      }
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0 h-full w-full" />;
}
