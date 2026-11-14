"use client";

import { useEffect, useRef } from "react";
import type { AgriculturalParcel } from "../data/parcels";

interface Props {
  parcels: AgriculturalParcel[];
}

export default function DashboardGlobe({ parcels }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<import("cesium").Viewer | null>(null);
  const cesiumRef = useRef<typeof import("cesium") | null>(null);

  // Inicializar Cesium una sola vez.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      (window as Window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL =
        "/cesium/";

      const Cesium = await import("cesium");

      if (cancelled || !containerRef.current) return;

      Cesium.Ion.defaultAccessToken =
        process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN ?? "";

      const viewer = new Cesium.Viewer(containerRef.current, {
        animation: false,
        timeline: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        infoBox: true,
        terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      });

      viewerRef.current = viewer;
      cesiumRef.current = Cesium;

      viewer.scene.globe.enableLighting = false;

      const cameraController = viewer.scene.screenSpaceCameraController;
      cameraController.enableRotate = true;

      // Mantener la navegación dentro del hemisferio de Bolivia.
      const minimumLongitude = Cesium.Math.toRadians(-145);
      const maximumLongitude = Cesium.Math.toRadians(15);

      viewer.camera.changed.addEventListener(() => {
        const cartographic = viewer.camera.positionCartographic;
        const longitude = Cesium.Math.zeroToTwoPi(cartographic.longitude);
        const minimum = Cesium.Math.zeroToTwoPi(minimumLongitude);
        const maximum = Cesium.Math.zeroToTwoPi(maximumLongitude);

        if (longitude < minimum || longitude > maximum) {
          const clampedLongitude = Cesium.Math.clamp(
            Cesium.Math.negativePiToPi(cartographic.longitude),
            minimumLongitude,
            maximumLongitude
          );

          viewer.camera.setView({
            destination: Cesium.Cartesian3.fromRadians(
              clampedLongitude,
              cartographic.latitude,
              cartographic.height
            ),
            orientation: {
              heading: viewer.camera.heading,
              pitch: viewer.camera.pitch,
              roll: viewer.camera.roll,
            },
          });
        }
      });

      // Acercar la cámara a Bolivia.
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-64.5, -16.5, 2300000),
        duration: 2,
      });
    }

    init().catch(console.error);

    return () => {
      cancelled = true;

      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
      }

      viewerRef.current = null;
      cesiumRef.current = null;
    };
  }, []);

  // Actualizar puntos cuando cambien los filtros.
  useEffect(() => {
    let cancelled = false;

    async function updateParcels() {
      // Esperar la inicialización, si es necesaria.
      while (!cancelled && !viewerRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (cancelled) return;

      const viewer = viewerRef.current;
      const Cesium = cesiumRef.current;

      if (!viewer || !Cesium || viewer.isDestroyed()) {
        return;
      }

      viewer.entities.removeAll();

      for (const parcel of parcels) {
        const color = parcel.moisture >= 60
          ? Cesium.Color.fromCssColorString("#b8dc91")
          : parcel.moisture >= 45
            ? Cesium.Color.fromCssColorString("#d7b56d")
            : Cesium.Color.fromCssColorString("#c77c67");

        viewer.entities.add({
          id: parcel.id,
          name: parcel.name,
          position: Cesium.Cartesian3.fromDegrees(
            parcel.longitude,
            parcel.latitude,
            0
          ),
          point: {
            pixelSize: 10,
            color,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 1,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          description: `
             <table><tr><td>Cultivo:</td><td>${parcel.crop}</td></tr>
               <tr><td>Humedad:</td><td>${parcel.moisture}%</td></tr>
               <tr><td>Temperatura:</td><td>${parcel.temperature}° C</td></tr>
               <tr><td>Precipitación:</td><td>${parcel.precipitation} mm</td></tr>
               <tr><td>Localidad:</td><td>${parcel.locality}</td></tr>
             </table>
           `,
        });
      }

      viewer.scene.requestRender();
    }

    updateParcels().catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [parcels]);

  return <div ref={containerRef} className="cesium-dashboard-container" />;
}
