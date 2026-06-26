import { PublicFooter } from "@/components/PublicFooter";
import { PublicHeader } from "@/components/PublicHeader";
import type { PublicLocale } from "@/lib/public_i18n";
import type { PublicPageKey } from "@/lib/public_pages";
import { publicPages } from "@/lib/public_pages";

type PublicInfoPageProps = {
  pageKey: PublicPageKey;
  locale: PublicLocale;
};

export function PublicInfoPage({ pageKey, locale }: PublicInfoPageProps) {
  const copy = publicPages[pageKey][locale];

  return (
    <main className="min-h-screen bg-white text-[#111827]" style={{ fontFamily: '"Source Sans 3", "Noto Sans", "Segoe UI", Arial, sans-serif' }}>
      <PublicHeader locale={locale} />
      <section className="mx-auto max-w-4xl px-5 py-16 md:px-8 md:py-24">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#6b7280]">{copy.eyebrow}</p>
        <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">{copy.title}</h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-[#4b5563]">{copy.intro}</p>
        <div className="mt-12 grid gap-4">
          {copy.sections.map((section) => (
            <section key={section.title} className="border-t border-[#e6e8eb] pt-6">
              <h2 className="text-base font-semibold text-[#111827]">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#4b5563]">{section.body}</p>
            </section>
          ))}
        </div>
      </section>
      <PublicFooter locale={locale} />
    </main>
  );
}
