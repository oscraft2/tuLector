import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/PublicFooter";
import { PublicHeader } from "@/components/PublicHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { locales, defaultLocale, type Locale } from "@/i18n/config";
import { messages } from "@/i18n/messages";

const siteUrl = "https://tulector.app";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const validLocale = locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;
  const copy = messages[validLocale as Locale];
  return {
    title: copy.paraColegios.title,
    description: copy.paraColegios.description,
    alternates: {
      canonical: `/${locale}/para-colegios`,
      languages: Object.fromEntries([
        ...locales.map((l) => [l, `${siteUrl}/${l}/para-colegios`]),
        ["x-default", `${siteUrl}/es-MX/para-colegios`],
      ]),
    },
    openGraph: {
      title: copy.paraColegios.title,
      description: copy.paraColegios.description,
    },
  };
}

export default async function ParaColegios({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const validLocale = locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;
  const copy = messages[validLocale as Locale];

  const serviceLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "TuLector para Colegios",
    serviceType: "Lectura optica y correccion automatica de evaluaciones",
    provider: { "@type": "Organization", name: "TuLector", url: "https://tulector.app" },
    areaServed: copy.areaServed,
    audience: { "@type": "Audience", audienceType: "colegios, escuelas, preuniversitarios" },
  };

  return (
    <main className="min-h-screen bg-white text-[#111827]">
      <PublicHeader currentLocale={validLocale} />

      <section className="mx-auto max-w-7xl px-5 pb-6 pt-6 md:px-8">
        <Breadcrumbs items={[
          { name: "Home", href: `/${locale}` },
          { name: "Para Colegios", href: `/${locale}/para-colegios` },
        ]} />
      </section>

      <JsonLd data={serviceLd} />

      <section className="mx-auto max-w-7xl px-5 pb-12 md:px-8 md:pb-16">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#2f6f5e]">
              Instituciones educativas
            </p>
            <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight md:text-6xl">
              {copy.paraColegios.h1}
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-[#4b5563]">
              Escanea hojas de respuesta con camara, corrige {copy.nationalExam} y entrega resultados por alumno y curso en minutos. Sin papeleo, sin errores de digitacion.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={`/${locale}/auth?mode=register`}
                className="rounded-lg bg-[#111827] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#07305f] hover:shadow-md"
              >
                Solicitar piloto gratuito
              </Link>
              <a
                href={`mailto:${copy.footer.contact}?subject=Piloto%20TuLector%20${copy.countryName}`}
                className="rounded-lg border border-[#d8dde3] bg-white px-6 py-3.5 text-sm font-semibold text-[#111827] transition-all hover:bg-[#f6f7f9]"
              >
                Hablar con ventas
              </a>
            </div>
          </div>
          <div className="rounded-xl border border-[#e6e8eb] bg-[#f6f7f9] p-8">
            <div className="grid gap-6 text-center">
              <div>
                <p className="text-3xl font-bold text-[#111827]">1. Imprime</p>
                <p className="mt-2 text-sm text-[#4b5563]">Genera hojas de respuesta personalizadas para {copy.nationalExam} con tu logo y formato institucional.</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-[#111827]">2. Escanea</p>
                <p className="mt-2 text-sm text-[#4b5563]">Tus alumnos completan las hojas y tu las escaneas con el celular. Sin hardware especial.</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-[#111827]">3. Analiza</p>
                <p className="mt-2 text-sm text-[#4b5563]">Resultados instantaneos por alumno, curso y pregunta. Exporta a Excel, PDF o comparte por link.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f8faf9] py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Por que colegios en {copy.countryName} eligen TuLector</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              { title: "Sin hardware especial", body: "Solo necesitas un celular con camara. No requieres scanner OMR costoso ni impresoras especializadas." },
              { title: `Compatible con ${copy.nationalExam}`, body: `Formato configurable para ${copy.knowsAbout.join(", ")} y cualquier prueba estandarizada del ${copy.govBody}.` },
              { title: "Resultados en minutos", body: "Corrige 40 hojas en menos de 3 minutos. Resultados por alumno, curso y pregunta listos para compartir." },
              { title: "Portal de familias", body: "Cada alumno recibe un link privado para consultar sus resultados sin compartir datos sensibles." },
              { title: "Exportacion flexible", body: "Descarga resultados en Excel, PDF o conecta con Google Sheets para integrar con tus sistemas actuales." },
              { title: "Seguridad y compliance", body: "Datos encriptados, RLS en base de datos y cumplimiento de normativas de proteccion de datos educativos." },
            ].map((item) => (
              <div key={item.title} className="rounded-lg border border-[#e2e8e4] bg-white p-6">
                <h3 className="text-lg font-semibold text-[#111827]">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#4b5563]">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Integraciones</h2>
          <p className="mt-4 max-w-2xl text-lg text-[#4b5563]">TuLector se conecta con las herramientas que ya usas en tu colegio.</p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              { name: "Supabase", body: "Base de datos en tiempo real con Row Level Security. Tus datos siempre protegidos y disponibles via API." },
              { name: "Google Sheets", body: "Exporta resultados directamente a Google Sheets para analisis avanzado y reportes personalizados." },
              { name: "Notion / Webhooks", body: "Integra resultados en tu workspace de Notion o envia datos a cualquier sistema via webhooks configurables." },
            ].map((item) => (
              <div key={item.name} className="rounded-lg border border-[#e6e8eb] p-6">
                <p className="text-sm font-bold uppercase tracking-[0.12em] text-[#2f6f5e]">{item.name}</p>
                <p className="mt-3 text-sm leading-6 text-[#4b5563]">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#111827] py-14 text-white md:py-20">
        <div className="mx-auto max-w-7xl px-5 text-center md:px-8">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Empieza con un piloto gratuito</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[#9ca3af]">
            Implementa TuLector en tu colegio sin compromiso. Te acompanamos en la configuracion y primeras lecturas con tu equipo docente.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href={`/${locale}/auth?mode=register`}
              className="rounded-lg bg-[#22d3ee] px-6 py-3.5 text-sm font-semibold text-[#111827] shadow-sm transition-all hover:bg-[#38bdf8]"
            >
              Crear cuenta gratis
            </Link>
            <Link
              href={`/${locale}/precios`}
              className="rounded-lg border border-[#374151] px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#1f2937]"
            >
              Ver planes y precios
            </Link>
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20">
        <div className="mx-auto max-w-3xl px-5 md:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Preguntas frecuentes</h2>
          <div className="mt-8 space-y-4">
            {copy.faqs.map((faq, i) => (
              <details key={i} className="group rounded-lg border border-[#e6e8eb] bg-white p-5">
                <summary className="cursor-pointer text-sm font-semibold text-[#111827]">{faq.q}</summary>
                <p className="mt-3 text-sm leading-6 text-[#4b5563]">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <PublicFooter currentLocale={validLocale} />
    </main>
  );
}
