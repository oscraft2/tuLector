import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/PublicFooter";
import { PublicHeader } from "@/components/PublicHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { locales, defaultLocale, type Locale } from "@/i18n/config";
import { messages } from "@/i18n/messages";

const siteUrl = "https://tulector.app";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const validLocale = locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;
  const copy = messages[validLocale as Locale];
  return {
    title: copy.features.title,
    description: copy.features.description,
    alternates: {
      canonical: `/${locale}/features`,
      languages: Object.fromEntries([
        ...locales.map((l) => [l, `${siteUrl}/${l}/features`]),
        ["x-default", `${siteUrl}/es-MX/features`],
      ]),
    },
    openGraph: { title: copy.features.title, description: copy.features.description },
  };
}

const featuresList = [
  {
    title: "Lector OMR por camara",
    body: "Escanea hojas de respuesta con la camara de tu celular. Deteccion automatica de marcas, correccion de perspectiva y votacion multi-frame para maxima precision. Compatible con lapiz, lapicera y marcador.",
  },
  {
    title: "Dashboard docente",
    body: "Panel de control con metricas por curso, alumno y pregunta. Filtra por fecha, tipo de evaluacion y grupo. Visualiza evolucion de puntajes entre ensayos consecutivos.",
  },
  {
    title: "Exportacion de resultados",
    body: "Descarga resultados en Excel (.xlsx) y PDF con formato profesional. Comparte resultados individuales con alumnos via link privado. Conecta con Google Sheets para integracion con tus sistemas.",
  },
  {
    title: "Hojas de respuesta imprimibles",
    body: "Generador de hojas de respuesta personalizables: cantidad de preguntas, opciones por pregunta, columnas, logo y branding institucional. Incluye campo de identificacion de alumno.",
  },
  {
    title: "App movil Android",
    body: "Aplicacion nativa para Android con escaneo offline. Sincronizacion automatica cuando recuperas conexion. Soporte para multiples dispositivos en una misma cuenta.",
  },
  {
    title: "Seguridad y privacidad",
    body: "Datos encriptados en transito y reposo. Row Level Security en Supabase. Sesiones con cookies httpOnly/secure/sameSite. Cumplimiento de normativas de proteccion de datos LATAM.",
  },
];

export default async function Features({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const validLocale = locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;
  const copy = messages[validLocale as Locale];

  return (
    <main className="min-h-screen bg-white text-[#111827]">
      <PublicHeader currentLocale={validLocale} />

      <section className="mx-auto max-w-7xl px-5 pb-6 pt-6 md:px-8">
        <Breadcrumbs items={[
          { name: "Home", href: `/${locale}` },
          { name: "Funcionalidades", href: `/${locale}/features` },
        ]} />
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-12 text-center md:px-8">
        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">{copy.features.title}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-[#4b5563]">{copy.features.description}</p>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-14 md:px-8 md:pb-20">
        <div className="grid gap-6 md:grid-cols-2">
          {featuresList.map((item) => (
            <div key={item.title} className="rounded-xl border border-[#e6e8eb] bg-white p-6 hover:border-[#bcc3cd] transition-colors">
              <h3 className="text-lg font-semibold text-[#111827]">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#4b5563]">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#111827] py-14 text-white md:py-20">
        <div className="mx-auto max-w-7xl px-5 text-center md:px-8">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Prueba todas las funcionalidades</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[#9ca3af]">
            El plan gratuito incluye acceso a todas las funcionalidades con hasta 100 lecturas mensuales. Ideal para validar el flujo antes de implementar.
          </p>
          <div className="mt-8">
            <Link href={`/${locale}/auth?mode=register`} className="rounded-lg bg-[#22d3ee] px-6 py-3.5 text-sm font-semibold text-[#111827] shadow-sm transition-all hover:bg-[#38bdf8]">
              Crear cuenta gratis
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter currentLocale={validLocale} />
    </main>
  );
}
