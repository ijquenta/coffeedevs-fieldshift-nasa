import type { Metadata } from "next";
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
  description:
    "Datos de observación terrestre para decisiones agrícolas más claras, sostenibles y accesibles.",
};
