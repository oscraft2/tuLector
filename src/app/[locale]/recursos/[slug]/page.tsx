import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicFooter } from "@/components/PublicFooter";
import { PublicHeader } from "@/components/PublicHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { locales, defaultLocale, type Locale } from "@/i18n/config";
import { messages } from "@/i18n/messages";
import { articleContent } from "@/lib/recursos_content";

const siteUrl = "https://tulector.app";

export function generateStaticParams() {
  const slugs = Object.keys(articleContent);
  return locales.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = articleContent[slug];
  if (!article) return {};
  return {
    title: article.title,
    description: article.resumenEjecutivo.slice(0, 160),
    alternates: {
      canonical: `/${locale}/recursos/${slug}`,
      languages: Object.fromEntries([
        ...locales.map((l) => [l, `${siteUrl}/${l}/recursos/${slug}`]),
        ["x-default", `${siteUrl}/es-MX/recursos/${slug}`],
      ]),
    },
    openGraph: {
      title: article.title,
      description: article.resumenEjecutivo.slice(0, 160),
      type: "article",
      locale: locale.replace("-", "_"),
    },
  };
}

export default async function Articulo({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const article = articleContent[slug];
  if (!article) notFound();

  const validLocale = locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;
  const copy = messages[validLocale as Locale];

  const publishedAt = "2026-01-15T12:00:00Z";
  const modifiedAt = "2026-06-01T12:00:00Z";

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    author: {
      "@type": "Person",
      name: article.author,
      jobTitle: "Educational Engineer",
      url: `${siteUrl}/${locale}/autores/${article.authorSlug}`,
    },
    datePublished: publishedAt,
    dateModified: modifiedAt,
    image: `${siteUrl}/${locale}/recursos/${slug}/opengraph-image`,
    isAccessibleForFree: true,
    publisher: { "@type": "Organization", name: "TuLector" },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${siteUrl}/${locale}/recursos/${slug}` },
  };

  return (
    <main className="min-h-screen bg-white text-[#111827]">
      <PublicHeader currentLocale={validLocale} />

      <article className="mx-auto max-w-4xl px-5 pb-14 pt-6 md:px-8 md:pb-20">
        <Breadcrumbs items={[
          { name: "Home", href: `/${locale}` },
          { name: "Recursos", href: `/${locale}/recursos` },
          { name: article.title, href: `/${locale}/recursos/${slug}` },
        ]} />

        <JsonLd data={articleLd} />

        <header className="mt-8">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#2f6f5e]">{copy.nationalExam}</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-6xl">{article.title}</h1>
          <div className="mt-6 flex items-center gap-3 text-sm text-[#6b7280]">
            <span>{article.author}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={publishedAt}>Enero 2026</time>
          </div>
        </header>

        <div className="mt-8 rounded-xl border border-[#dfe5e2] bg-[#f8faf9] p-6">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#2f6f5e]">Resumen ejecutivo</p>
          <p className="mt-2 text-lg leading-8 text-[#111827]">{article.resumenEjecutivo}</p>
        </div>

        <div className="mt-10 space-y-6">
          {article.body.map((p, i) => (
            <p key={i} className="text-lg leading-8 text-[#4b5563]">{p}</p>
          ))}
        </div>

        {article.faqs.length > 0 && (
          <section className="mt-14">
            <h2 className="text-2xl font-semibold tracking-tight">Preguntas frecuentes</h2>
            <div className="mt-6 space-y-4">
              {article.faqs.map((faq, i) => (
                <details key={i} className="group rounded-lg border border-[#e6e8eb] bg-white p-5">
                  <summary className="cursor-pointer text-sm font-semibold text-[#111827]">{faq.q}</summary>
                  <p className="mt-3 text-sm leading-6 text-[#4b5563]">{faq.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        <section className="mt-14 rounded-lg border border-[#e6e8eb] p-6 text-center">
          <p className="text-lg font-semibold">Te ayudo TuLector con la correccion de ensayos?</p>
          <p className="mt-2 text-sm text-[#4b5563]">Crea una cuenta gratis y empieza a escanear hojas de respuesta hoy mismo.</p>
          <a
            href={`/${locale}/auth?mode=register`}
            className="mt-4 inline-block rounded-lg bg-[#111827] px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[#07305f]"
          >
            Crear cuenta gratis
          </a>
        </section>
      </article>

      <PublicFooter currentLocale={validLocale} />
    </main>
  );
}
