export function KPI({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <article className="rounded-md border border-[#e6e8eb] bg-white p-4 md:p-5" aria-label={label}>
      <p className="text-sm font-medium text-[#6b7280]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-[#111827] md:mt-3 md:text-3xl">{value}</p>
      {detail ? <p className="mt-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#4b5563]">{detail}</p> : null}
    </article>
  );
}

export function KPIGrid({ children }: { children: React.ReactNode }) {
  return <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</section>;
}
