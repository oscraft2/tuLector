import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
  compress: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      { source: "/r/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/api/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/auth", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/consulta", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
  async redirects() {
    return [];
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
