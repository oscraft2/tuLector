import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // View Transitions API (nativo del navegador) para las pantallas del APK
  // (/app/*, ver src/app/app/layout.tsx) — transiciones de pantalla con
  // fisica real en vez de un corte instantaneo. Experimental en Next.js
  // (docs: "not recommended for production" todavia) pero degrada solo:
  // sin soporte del navegador/WebView, la navegacion sigue funcionando
  // igual, simplemente no anima. Chrome/WebView y Safari lo soportan.
  experimental: {
    viewTransition: true,
  },
};

export default nextConfig;
