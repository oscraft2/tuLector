export function PlanCard({ plan, current, scans, price }: { plan: string; current?: boolean; scans: string; price: string }) {
  return (
    <article className={current ? "rounded-md border-2 border-[#111827] bg-white p-5" : "rounded-md border border-[#e6e8eb] bg-white p-5"}>
      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#6b7280]">{current ? "Plan actual" : "Plan"}</p>
      <h3 className="mt-2 text-2xl font-semibold capitalize">{plan}</h3>
      <p className="mt-2 text-sm text-[#4b5563]">{scans}</p>
      <p className="mt-4 text-xl font-semibold">{price}</p>
      <button className="mt-5 w-full rounded-md bg-[#111827] px-4 py-2 text-sm font-semibold text-white">Seleccionar</button>
    </article>
  );
}
