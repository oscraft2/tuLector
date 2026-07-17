import { PublicFooter } from "@/components/PublicFooter";
import { PublicHeaderServer } from "@/components/PublicHeaderServer";
import type { PublicLocale } from "@/lib/public_i18n";
import type { PublicPageKey } from "@/lib/public_pages";
import { publicPages } from "@/lib/public_pages";

type PublicInfoPageProps = {
  pageKey: PublicPageKey;
  locale: PublicLocale;
  currentLocale?: string;
};

export function PublicInfoPage({ pageKey, locale, currentLocale }: PublicInfoPageProps) {
  const copy = publicPages[pageKey][locale];

  return (
    <main className="min-h-screen bg-white text-[#111827]" style={{ fontFamily: '"Source Sans 3", "Noto Sans", "Segoe UI", Arial, sans-serif' }}>
      <PublicHeaderServer locale={locale} currentLocale={currentLocale} />
      <section className="mx-auto max-w-4xl px-5 py-14 md:px-8 md:py-20">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2f6f5e]">{copy.eyebrow}</p>
        <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">{copy.title}</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-[#4b5563]">{copy.intro}</p>
        {copy.updated ? <p className="mt-5 text-sm font-semibold text-[#6b7280]">{copy.updated}</p> : null}

        <div className="mt-12 grid gap-4">
          {copy.sections.map((section) => (
            <section key={section.title} className="rounded-lg border border-[#e2e8e4] bg-[#fbfcfb] p-5 md:p-6">
              <h2 className="text-base font-semibold text-[#111827]">{section.title}</h2>
              <p className="mt-3 text-sm leading-6 text-[#4b5563]">{section.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-10 rounded-lg border border-[#dfe5e2] bg-white p-5 text-sm leading-6 text-[#5f6b66] shadow-sm">
          Esta informacion es una base operativa de producto y no reemplaza una revision legal formal. Para contratos institucionales, tratamiento de datos de estudiantes o despliegues internacionales, TuLector debe validar el documento con asesoria legal local.
        </div>
      </section>
      <PublicFooter currentLocale={currentLocale} />
    </main>
  );
}
