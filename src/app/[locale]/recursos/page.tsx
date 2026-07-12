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

const seedArticles: Record<string, { slug: string; title: string; excerpt: string; locale: string }[]> = {
  "es-CL": [
    { slug: "como-escanear-hojas-con-camara", title: "Como escanear hojas de respuesta con camara", excerpt: "Guia paso a paso para digitalizar hojas de respuesta usando la camara de tu celular. Sin scanner OMR ni hardware especial.", locale: "es-CL" },
    { slug: "simular-paes-paso-a-paso", title: "Como simular la PAES paso a paso", excerpt: "Aprende a crear, aplicar y corregir simulacros PAES para tus alumnos con resultados inmediatos y reportes por eje tematico.", locale: "es-CL" },
    { slug: "correccion-automatica-ensayos", title: "Correccion automatica de ensayos: guia para docentes", excerpt: "Reduce el tiempo de correccion de ensayos de horas a minutos con tecnologia de lectura optica por camara movil.", locale: "es-CL" },
  ],
  "es-MX": [
    { slug: "como-escanear-hojas-con-camara", title: "Como escanear hojas de respuesta con camara", excerpt: "Guia paso a paso para digitalizar hojas de respuesta usando la camara de tu celular. Sin scanner OMR ni hardware especial.", locale: "es-MX" },
    { slug: "exani-vs-comipems-mexico", title: "EXANI vs COMIPEMS: diferencias y como preparar a tus alumnos", excerpt: "Comparativa de los examenes de ingreso mas importantes de Mexico. Estrategias de preparacion y como usar simulacros efectivos.", locale: "es-MX" },
    { slug: "correccion-automatica-examenes", title: "Correccion automatica de examenes: guia CENEVAL", excerpt: "Optimiza la correccion de examenes tipo CENEVAL con tecnologia de lectura optica. Resultados inmediatos por alumno y grupo.", locale: "es-MX" },
  ],
  "es-PE": [
    { slug: "como-escanear-hojas-con-camara", title: "Como escanear hojas de respuesta con camara", excerpt: "Guia paso a paso para digitalizar hojas de respuesta usando la camara de tu celular. Sin scanner OMR ni hardware especial.", locale: "es-PE" },
    { slug: "ece-peru-evaluacion-censal", title: "ECE Peru: como preparar la Evaluacion Censal de Estudiantes", excerpt: "Todo sobre la ECE del MINEDU: estructura, areas evaluadas y como implementar simulacros efectivos en tu colegio.", locale: "es-PE" },
    { slug: "examen-admision-uni-preparacion", title: "Examen de Admision UNI: estrategia de preparacion con simulacros", excerpt: "Como usar simulacros frecuentes para preparar el examen de admision de la UNI. Metodologia y herramientas digitales.", locale: "es-PE" },
  ],
  "es-AR": [
    { slug: "como-escanear-hojas-con-camara", title: "Como escanear hojas de respuesta con camara", excerpt: "Guia paso a paso para digitalizar hojas de respuesta usando la camara de tu celular. Sin scanner OMR ni hardware especial.", locale: "es-AR" },
    { slug: "cbc-uba-ingreso-2026", title: "CBC UBA: como preparar el ingreso con simulacros efectivos", excerpt: "Guia completa del Ciclo Basico Comun de la UBA. Estrategias de estudio, simulacros y herramientas digitales para el ingreso.", locale: "es-AR" },
    { slug: "correccion-automatica-ingresos", title: "Correccion automatica de examenes de ingreso universitario", excerpt: "Como los preuniversitarios y academias estan usando tecnologia OMR para corregir examenes de ingreso en minutos.", locale: "es-AR" },
  ],
  "pt-BR": [
    { slug: "como-escanear-hojas-com-camera", title: "Como escanear folhas de resposta com a camera", excerpt: "Guia passo a passo para digitalizar folhas de resposta usando a camera do celular. Sem scanner OMR ou hardware especial.", locale: "pt-BR" },
    { slug: "enem-2026-como-preparar-simulados", title: "ENEM 2026: como preparar simulados eficientes", excerpt: "Estrategias para criar e corrigir simulados ENEM com resultados imediatos. Preparacao completa para o exame nacional.", locale: "pt-BR" },
    { slug: "fuvest-unicamp-vestibular", title: "FUVEST e UNICAMP: simulados para os principais vestibulares", excerpt: "Como preparar alunos para FUVEST, UNICAMP e outros vestibulares com simulados frequentes e correcao automatica.", locale: "pt-BR" },
  ],
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const validLocale = locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;
  const copy = messages[validLocale as Locale];
  return {
    title: copy.recursos.title,
    description: copy.recursos.description,
    alternates: {
      canonical: `/${locale}/recursos`,
      languages: Object.fromEntries([
        ...locales.map((l) => [l, `${siteUrl}/${l}/recursos`]),
        ["x-default", `${siteUrl}/es-MX/recursos`],
      ]),
    },
    openGraph: { title: copy.recursos.title, description: copy.recursos.description },
  };
}

export default async function Recursos({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const validLocale = locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;
  const copy = messages[validLocale as Locale];
  const legacyLocale = newLocaleToLegacy(locale);

  const articles = seedArticles[validLocale] ?? seedArticles["es-MX"];
  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: copy.recursos.title,
    description: copy.recursos.description,
    url: `https://tulector.app/${locale}/recursos`,
    hasPart: articles.map((a) => ({
      "@type": "Article",
      headline: a.title,
      url: `https://tulector.app/${locale}/recursos/${a.slug}`,
    })),
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: copy.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <main className="min-h-screen bg-white text-[#111827]">
      <PublicHeader locale={legacyLocale} currentLocale={validLocale} />

      <section className="mx-auto max-w-7xl px-5 pb-6 pt-6 md:px-8">
        <Breadcrumbs items={[
          { name: "Home", href: `/${locale}` },
          { name: "Recursos", href: `/${locale}/recursos` },
        ]} />
      </section>

      <JsonLd data={[collectionLd, faqLd]} />

      <section className="mx-auto max-w-7xl px-5 pb-12 text-center md:px-8">
        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">{copy.recursos.title}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-[#4b5563]">{copy.recursos.description}</p>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-14 md:px-8 md:pb-20">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <Link
              key={article.slug}
              href={`/${locale}/recursos/${article.slug}`}
              className="group rounded-xl border border-[#e6e8eb] bg-white p-6 transition-all hover:border-[#bcc3cd] hover:shadow-md"
            >
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#2f6f5e]">
                {copy.nationalExam}
              </p>
              <h2 className="mt-3 text-lg font-semibold text-[#111827] group-hover:text-[#07305f] transition-colors">
                {article.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#4b5563]">{article.excerpt}</p>
              <p className="mt-3 text-sm font-bold text-[#123b5d]">Leer mas &rarr;</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-[#f8faf9] py-14 md:py-20">
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

      <PublicFooter locale={legacyLocale} />
    </main>
  );
}
