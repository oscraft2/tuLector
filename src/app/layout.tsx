import type { Metadata, Viewport } from "next";
import "./globals.css";
import { NativeBootstrap } from "@/components/native/NativeBootstrap";
import { JsonLd } from "@/components/JsonLd";
import { locales, defaultLocale } from "@/i18n/config";

const siteUrl = "https://tulector.app";

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
    languages: Object.fromEntries(locales.map((l) => [l, `/${l}`])),
  },
  openGraph: {
    type: "website",
    locale: "es_MX",
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
  viewportFit: "cover",
};

const orgLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "TuLector",
  url: "https://tulector.app",
  logo: "https://tulector.app/tulector-hero.webp",
  sameAs: [
    "https://www.linkedin.com/company/tulector",
    "https://github.com/oscraft2/tuLector",
  ],
  contactPoint: [{
    "@type": "ContactPoint",
    contactType: "sales",
    email: "contacto@tulector.app",
    availableLanguage: ["Spanish", "Portuguese", "English"],
  }],
};

const webAppLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "TuLector",
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web, Android",
  url: "https://tulector.app",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  publisher: { "@type": "Organization", name: "TuLector" },
};

const webSiteLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "TuLector",
  url: "https://tulector.app",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: "https://tulector.app/recursos?q={search_term_string}",
    },
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={defaultLocale} className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#fafafa] text-[#0b1220]">
        <JsonLd data={[orgLd, webAppLd, webSiteLd]} />
        <NativeBootstrap />
        {children}
      </body>
    </html>
  );
}
