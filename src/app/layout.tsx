import type { Metadata, Viewport } from "next";
import "./globals.css";
import { NativeBootstrap } from "@/components/native/NativeBootstrap";

export const metadata: Metadata = {
  title: "TuLector - Escaner de examenes",
  description: "Escanea examenes de opcion multiple con la camara de tu telefono. Procesamiento 100% en el navegador.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover", // habilita env(safe-area-inset-*) para las safe areas del APK
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
