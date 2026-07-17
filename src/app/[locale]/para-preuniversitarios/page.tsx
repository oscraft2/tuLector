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
    title: copy.paraPreuniversitarios.title,
    description: copy.paraPreuniversitarios.description,
    alternates: {
      canonical: `/${locale}/para-preuniversitarios`,
      languages: Object.fromEntries([
        ...locales.map((l) => [l, `${siteUrl}/${l}/para-preuniversitarios`]),
        ["x-default", `${siteUrl}/es-MX/para-preuniversitarios`],
      ]),
    },
    openGraph: { title: copy.paraPreuniversitarios.title, description: copy.paraPreuniversitarios.description },
  };
}

export default async function ParaPreuniversitarios({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const validLocale = locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;
  const copy = messages[validLocale as Locale];

  return (
    <main className="min-h-screen bg-white text-[#111827]">
      <PublicHeader currentLocale={validLocale} />

      <section className="mx-auto max-w-7xl px-5 pb-6 pt-6 md:px-8">
        <Breadcrumbs items={[
          { name: "Home", href: `/${locale}` },
          { name: "Para Preuniversitarios", href: `/${locale}/para-preuniversitarios` },
        ]} />
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-12 md:px-8 md:pb-16">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#2f6f5e]">Academias y preuniversitarios</p>
            <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight md:text-6xl">
              {copy.paraPreuniversitarios.h1}
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-[#4b5563]">
              Realiza simulacros frecuentes con correccion inmediata. Tus alumnos reciben feedback al instante y tu equipo docente ahorra horas de correccion manual.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={`/${locale}/auth?mode=register`} className="rounded-lg bg-[#111827] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#07305f] hover:shadow-md">
                Solicitar demo
              </Link>
              <Link href={`/${locale}/precios`} className="rounded-lg border border-[#d8dde3] bg-white px-6 py-3.5 text-sm font-semibold text-[#111827] transition-all hover:bg-[#f6f7f9]">
                Ver precios
              </Link>
            </div>
          </div>
          <div className="space-y-4">
            {[
              { metric: "2 min", label: "Tiempo de correccion por sala" },
              { metric: "100%", label: "Digital sin papel extra" },
              { metric: "+3x", label: "Simulacros por mes vs metodo manual" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-[#e6e8eb] bg-[#f6f7f9] p-5">
                <p className="text-2xl font-bold text-[#111827]">{item.metric}</p>
                <p className="mt-1 text-sm text-[#4b5563]">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f8faf9] py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Simulacros que preparan para {copy.nationalExam}</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              { title: "Simulacros frecuentes", body: "Aplica ensayos cada semana sin sobrecargar a tu equipo. La correccion automatica permite mas frecuencia de practica." },
              { title: "Feedback inmediato", body: "Tus alumnos reciben sus resultados apenas termina el escaneo. Identifican sus areas debiles al instante." },
              { title: "Reportes comparativos", body: "Compara el desempeno de cada alumno entre simulacros. Muestra evolucion real a padres y apoderados." },
              { title: `Formato ${copy.nationalExam}`, body: `Simulacros calibrados al formato real de ${copy.knowsAbout.join(", ")}. Tus alumnos practican en condiciones de examen.` },
              { title: "Gestion de grupos", body: "Administra multiples cursos y horarios. Cada grupo con sus propias evaluaciones y seguimiento independiente." },
              { title: "Resultados web", body: "Cada alumno consulta sus resultados con un link privado. Sin instalar apps, sin compartir datos con terceros." },
            ].map((item) => (
              <div key={item.title} className="rounded-lg border border-[#e2e8e4] bg-white p-6">
                <h3 className="text-lg font-semibold text-[#111827]">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#4b5563]">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#111827] py-14 text-white md:py-20">
        <div className="mx-auto max-w-7xl px-5 text-center md:px-8">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Implementa simulacros en tu academia</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[#9ca3af]">
            Configuramos TuLector para el formato de {copy.nationalExam} que necesitas. Piloto gratuito de 30 dias para validar el flujo con tus alumnos.
          </p>
          <div className="mt-8">
            <Link href={`/${locale}/auth?mode=register`} className="rounded-lg bg-[#22d3ee] px-6 py-3.5 text-sm font-semibold text-[#111827] shadow-sm transition-all hover:bg-[#38bdf8]">
              Empezar piloto gratuito
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter currentLocale={validLocale} />
    </main>
  );
}
