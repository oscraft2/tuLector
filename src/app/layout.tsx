import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TuLector - Correccion y analisis de ensayos",
  description: "Plataforma para crear ensayos, leer hojas de respuesta por camara, administrar alumnos, analizar resultados y convertir puntajes equivalentes.",
  keywords: [
    "lector de ensayos",
    "correccion de pruebas",
    "hojas de respuesta",
    "puntaje equivalente",
    "analisis educativo",
    "OMR",
    "Chile",
  ],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full bg-white text-[#111827]">{children}</body>
    </html>
  );
}
