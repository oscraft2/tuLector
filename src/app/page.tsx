import Image from "next/image";
import Link from "next/link";
import { PublicFooter } from "@/components/PublicFooter";
import { PublicHeader } from "@/components/PublicHeader";
import { localizedHref, publicCopy, resolvePublicLocale } from "@/lib/public_i18n";

type HomeProps = {
  searchParams?: Promise<{ lang?: string | string[] }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const locale = resolvePublicLocale(params?.lang);
  const copy = publicCopy[locale].home;
  const actions = [
    { href: "/auth?mode=register", label: copy.actions.register, primary: true },
    { href: "/auth", label: copy.actions.login },
    { href: "/scan", label: copy.actions.scan },
  ];

  return (
    <main className="min-h-screen bg-white text-[#111827]" style={{ fontFamily: '"Source Sans 3", "Noto Sans", "Segoe UI", Arial, sans-serif' }}>
      <PublicHeader locale={locale} />

      <section className="mx-auto grid min-h-[calc(100vh-65px)] max-w-7xl items-center gap-10 px-5 py-10 md:px-8 lg:grid-cols-[0.82fr_1.18fr]">
        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#6b7280]">{copy.eyebrow}</p>
          <h1 className="mt-5 text-5xl font-semibold tracking-tight text-[#111827] md:text-7xl">
            {copy.title}
          </h1>
          <p className="mt-6 text-xl leading-8 text-[#4b5563]">
            {copy.body}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {actions.map((action) => (
              <Link
                key={action.href}
                href={localizedHref(action.href, locale)}
                className={action.primary
                  ? "rounded-md bg-[#111827] px-5 py-3 text-center text-sm font-semibold text-white hover:bg-[#1f2937]"
                  : "rounded-md border border-[#d8dde3] bg-white px-5 py-3 text-center text-sm font-semibold text-[#111827] hover:bg-[#f6f7f9]"}
              >
                {action.label}
              </Link>
            ))}
          </div>

          <div className="mt-10 grid max-w-lg grid-cols-3 gap-3 border-t border-[#e6e8eb] pt-6">
            {copy.stats.map((stat) => (
              <SmallStat key={stat.label} value={stat.value} label={stat.label} />
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="overflow-hidden rounded-lg border border-[#e6e8eb] bg-[#f6f7f9]">
            <Image
              src="/tulector-hero.png"
              alt="Hoja de respuestas escaneada con telefono y analisis educativo"
              width={1400}
              height={980}
              priority
              className="h-auto w-full object-cover"
            />
          </div>
          <div className="absolute bottom-5 left-5 right-5 rounded-md border border-white/70 bg-white/92 p-4 shadow-sm backdrop-blur">
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

      <section className="border-y border-[#e6e8eb] bg-[#f8f9fb] px-5 py-10 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-4">
          {copy.workflow.map((item) => (
            <div key={item} className="rounded-md border border-[#e6e8eb] bg-white px-5 py-5 text-sm font-semibold">
              {item}
            </div>
          ))}
        </div>
      </section>

      <PublicFooter locale={locale} />
    </main>
  );
}

function SmallStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-lg font-semibold text-[#111827]">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[#6b7280]">{label}</p>
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
