import type { Metadata, Viewport } from "next";
import "./globals.css";
import { NativeBootstrap } from "@/components/native/NativeBootstrap";

const siteUrl = "https://tulector.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "TuLector | Corrige pruebas y ensayos en minutos",
    template: "%s | TuLector",
  },
  description: "Plataforma para leer hojas de respuesta con camara, corregir ensayos y simulacros, y entregar resultados academicos para colegios y preuniversitarios.",
  applicationName: "TuLector",
  keywords: [
    "corregir pruebas",
    "lector de hojas de respuesta",
    "correccion de ensayos",
    "simulacros academicos",
    "plataforma para colegios",
    "hojas de respuesta",
  ],
  alternates: {
    canonical: "/",
    languages: {
      "es-CL": "/",
      "pt-BR": "/?lang=pt",
      en: "/?lang=en",
    },
  },
  openGraph: {
    type: "website",
    locale: "es_CL",
    url: siteUrl,
    siteName: "TuLector",
    title: "TuLector | Corrige pruebas y ensayos en minutos",
    description: "Lee hojas de respuesta con camara, corrige pruebas y exporta resultados academicos.",
    images: [
      {
        url: "/tulector-hero.webp",
        width: 1400,
        height: 980,
        alt: "TuLector leyendo una hoja de respuestas con camara",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TuLector | Corrige pruebas y ensayos en minutos",
    description: "Lee hojas de respuesta con camara y entrega resultados academicos.",
    images: ["/tulector-hero.webp"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#fafafa] text-[#0b1220]">
        <NativeBootstrap />
        {children}
      </body>
    </html>
  );
}
