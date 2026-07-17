import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { PublicFooter } from "@/components/PublicFooter";
import { PublicHeaderServer } from "@/components/PublicHeaderServer";
import { WorkflowShowcase } from "@/components/WorkflowShowcase";
import { locales, defaultLocale, type Locale } from "@/i18n/config";
import { messages } from "@/i18n/messages";
import { newLocaleToLegacy } from "@/lib/public_i18n";

const siteUrl = "https://tulector.app";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const copy = messages[locale as Locale] ?? messages[defaultLocale];
  return {
    title: copy.home.title,
    description: copy.home.body,
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries([
        ...locales.map((l) => [l, `${siteUrl}/${l}`]),
        ["x-default", `${siteUrl}/es-MX`],
      ]),
    },
    openGraph: {
      title: `${copy.home.title} | TuLector`,
      description: copy.home.body,
      locale: locale.replace("-", "_"),
    },
  };
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const validLocale = locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;
  const copy = messages[validLocale].home;
  const legacyLocale = newLocaleToLegacy(locale);

  return (
    <main className="min-h-screen bg-white text-[#111827]">
      <PublicHeaderServer currentLocale={validLocale} />

      <section className="mx-auto grid max-w-7xl items-center gap-8 px-5 pb-12 pt-8 md:px-8 md:py-14 lg:min-h-[calc(100vh-105px)] lg:grid-cols-[0.82fr_1.18fr] lg:gap-10">
        <div className="max-w-xl">
          <p className="inline-flex rounded-full border border-[#dfe5e2] bg-[#f8faf9] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[#2f6f5e]">
            {copy.audience}
          </p>
          <h1 className="mt-5 text-5xl font-semibold leading-tight tracking-tight text-[#111827] md:text-7xl">
            {copy.title}
          </h1>
          <p className="mt-5 text-lg leading-8 text-[#4b5563] md:text-xl">{copy.body}</p>
          <p className="mt-4 text-base font-semibold leading-7 text-[#123b5d] md:hidden">{copy.mobileLead}</p>

          <div className="mt-6 flex flex-wrap gap-2">
            {copy.badges.map((badge) => (
              <span key={badge} className="rounded-full border border-[#dfe5e2] bg-white px-3 py-1.5 text-xs font-bold text-[#4b5563] shadow-sm">
                {badge}
              </span>
            ))}
          </div>

          <div className="mt-8 hidden gap-3 md:flex">
            <Link
              href="#workflow"
              className="rounded-lg bg-[#111827] px-6 py-3.5 text-center text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#07305f] hover:shadow-md active:scale-[0.98]"
            >
              {copy.actions.workflow}
            </Link>
            <Link
              href="#contacto"
              className="rounded-lg border border-[#d8dde3] bg-white px-6 py-3.5 text-center text-sm font-semibold text-[#111827] transition-all hover:border-[#bcc3cd] hover:bg-[#f6f7f9] active:scale-[0.98]"
            >
              {copy.actions.contact}
            </Link>
          </div>

          <Link href="#workflow" className="mt-7 inline-flex text-sm font-bold text-[#123b5d] md:hidden">
            {copy.actions.workflow}
            <span className="ml-2" aria-hidden="true">-&gt;</span>
          </Link>

          <div className="mt-8 grid max-w-lg grid-cols-3 gap-4 border-t border-[#f0f0f3] pt-6 md:mt-10">
            {copy.stats.map((stat) => (
              <SmallStat key={stat.label} value={stat.value} label={stat.label} />
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="overflow-hidden rounded-xl border border-[#e6e8eb] bg-[#f6f7f9] shadow-lg shadow-black/5">
            <Image
              src="/tulector-hero.webp"
              alt="Hoja de respuestas escaneada con telefono y analisis educativo"
              width={1400}
              height={980}
              priority
              className="h-auto w-full object-cover"
            />
          </div>
          <div className="mt-3 rounded-lg border border-[#e6e8eb] bg-white p-4 shadow-lg shadow-black/5 md:absolute md:bottom-5 md:left-5 md:right-5 md:mt-0 md:border-white/60 md:bg-white/90 md:backdrop-blur-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#111827]">{copy.exam.name}</p>
                <p className="mt-1 text-xs text-[#6b7280]">{copy.exam.sync}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <MiniMetric value="71%" label={copy.exam.average} />
                <MiniMetric value="3" label={copy.exam.alerts} />
                <MiniMetric value="742" label={copy.exam.score} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <WorkflowShowcase locale={legacyLocale} />

      <PublicFooter currentLocale={validLocale} />
    </main>
  );
}

function SmallStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-base font-semibold text-[#111827] md:text-lg">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[#6b7280] md:text-xs">{label}</p>
    </div>
  );
}

function MiniMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-md bg-[#f6f7f9] px-3 py-2">
      <p className="text-sm font-semibold text-[#111827]">{value}</p>
      <p className="text-[11px] uppercase tracking-[0.08em] text-[#6b7280]">{label}</p>
    </div>
  );
}
