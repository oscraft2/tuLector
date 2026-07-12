import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/PublicFooter";
import { PublicHeader } from "@/components/PublicHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { locales, defaultLocale, type Locale } from "@/i18n/config";
import { messages } from "@/i18n/messages";
import { newLocaleToLegacy } from "@/lib/public_i18n";

const siteUrl = "https://tulector.app";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const validLocale = locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;
  const copy = messages[validLocale as Locale];
  return {
    title: copy.paraDocentes.title,
    description: copy.paraDocentes.description,
    alternates: {
      canonical: `/${locale}/para-docentes`,
      languages: Object.fromEntries([
        ...locales.map((l) => [l, `${siteUrl}/${l}/para-docentes`]),
        ["x-default", `${siteUrl}/es-MX/para-docentes`],
      ]),
    },
    openGraph: { title: copy.paraDocentes.title, description: copy.paraDocentes.description },
  };
}

export default async function ParaDocentes({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const validLocale = locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;
  const copy = messages[validLocale as Locale];
  const legacyLocale = newLocaleToLegacy(locale);

  return (
    <main className="min-h-screen bg-white text-[#111827]">
      <PublicHeader locale={legacyLocale} currentLocale={validLocale} />

      <section className="mx-auto max-w-7xl px-5 pb-6 pt-6 md:px-8">
        <Breadcrumbs items={[
          { name: "Home", href: `/${locale}` },
          { name: "Para Docentes", href: `/${locale}/para-docentes` },
        ]} />
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-12 md:px-8 md:pb-16">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#2f6f5e]">Docentes</p>
            <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight md:text-6xl">
              {copy.paraDocentes.h1}
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-[#4b5563]">
              Disena tu prueba, imprime las hojas de respuesta, pasalas por la camara de tu celular y revisa los resultados al instante. Sin planillas, sin digitar.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={`/${locale}/auth?mode=register`} className="rounded-lg bg-[#111827] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#07305f] hover:shadow-md">
                Empezar gratis
              </Link>
              <Link href={`/${locale}/recursos`} className="rounded-lg border border-[#d8dde3] bg-white px-6 py-3.5 text-sm font-semibold text-[#111827] transition-all hover:bg-[#f6f7f9]">
                Ver recursos
              </Link>
            </div>
          </div>
          <div className="rounded-xl border border-[#e6e8eb] bg-[#f6f7f9] p-8">
            <div className="space-y-6">
              {[
                { step: "1", title: "Crea tu evaluacion", desc: `Define las preguntas y la clave de respuestas para tu prueba de ${copy.nationalExam}.` },
                { step: "2", title: "Imprime las hojas", desc: "Genera las hojas de respuesta con el formato que prefieras. Tus alumnos las completan a lapiz." },
                { step: "3", title: "Escanea y listo", desc: "Pasa las hojas por la camara. TuLector detecta las marcas, corrige y entrega resultados." },
              ].map((item) => (
                <div key={item.step} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#111827] text-sm font-bold text-white">{item.step}</span>
                  <div>
                    <p className="font-semibold text-[#111827]">{item.title}</p>
                    <p className="mt-1 text-sm text-[#4b5563]">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f8faf9] py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Todo lo que necesitas en un solo lugar</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              { title: "Dashboard por curso", body: "Organiza tus evaluaciones por curso, fecha y tipo de prueba. Compara resultados entre secciones." },
              { title: `Calibrado para ${copy.nationalExam}`, body: `Escalas de puntaje y notas configuradas para ${copy.knowsAbout.join(", ")} segun los parametros del ${copy.govBody}.` },
              { title: "Correccion automatica", body: "El lector detecta marcas de lapiz, asigna puntajes y calcula notas. Tu solo revisas los resultados finales." },
              { title: "Feedback por pregunta", body: "Identifica las preguntas con mas errores y ajusta tu ensenanza en funcion de datos reales de tus alumnos." },
              { title: "Exportacion a Excel", body: "Descarga planillas con resultados individuales y grupales para entregar a coordinacion o a las familias." },
              { title: "Acceso desde cualquier lugar", body: "TuLector funciona en el navegador y en la app movil. Escanea en la sala de clases o desde tu casa." },
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
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Empieza a corregir en minutos</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[#9ca3af]">
            Crea tu cuenta gratis, configura tu primera evaluacion y escanea hojas hoy mismo. Sin instalacion, sin compromiso.
          </p>
          <div className="mt-8">
            <Link href={`/${locale}/auth?mode=register`} className="rounded-lg bg-[#22d3ee] px-6 py-3.5 text-sm font-semibold text-[#111827] shadow-sm transition-all hover:bg-[#38bdf8]">
              Crear cuenta gratis
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter locale={legacyLocale} />
    </main>
  );
}
