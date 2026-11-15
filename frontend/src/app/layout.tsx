import type { Metadata, Viewport } from "next";
import "./globals.css";
import "cesium/Build/Cesium/Widgets/widgets.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

export const metadata: Metadata = {
  title: "Yapana Agro | Inteligencia agrícola desde Bolivia",
  description: "Explora tu parcela, consulta datos de observación de la Tierra y compara escenarios de siembra con incertidumbre visible.",
  applicationName: "Yapana Agro",
};

export const viewport: Viewport = {
  themeColor: "#07111c",
};
