export type KpiTone = "default" | "good" | "warn" | "bad" | "accent";

const TONE_VALUE: Record<KpiTone, string> = {
  default: "text-[#1c1917]",
  good: "text-[#1a8f52]",
  warn: "text-[#c77700]",
  bad: "text-[#c2410c]",
  accent: "text-[#07305f]",
};

export function KPI({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: KpiTone;
}) {
  return (
    <article
      className={`rounded-xl border p-4 shadow-xs md:p-5 ${
        tone === "accent" ? "border-[#c7d7ee] bg-[#f7faff]" : "border-[#e7e5df] bg-white"
      }`}
      aria-label={label}
    >
      <p className="text-xs font-semibold text-[#78716c]">{label}</p>
      <p className={`tnum mt-2 text-2xl font-bold tracking-tight md:text-3xl ${TONE_VALUE[tone]}`}>{value}</p>
      {detail ? <p className="mt-1.5 text-xs text-[#78716c]">{detail}</p> : null}
    </article>
  );
}

export function KPIGrid({ children }: { children: React.ReactNode }) {
  return <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">{children}</section>;
}
