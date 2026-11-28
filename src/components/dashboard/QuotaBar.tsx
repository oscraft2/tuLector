export function QuotaBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const barColor = pct >= 90 ? "bg-[#c2410c]" : pct >= 75 ? "bg-[#c77700]" : "bg-[#07305f]";
  return (
    <div aria-label="Uso de lecturas" role="group">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold text-[#1c1917]">Lecturas usadas</span>
        <span className="tnum font-medium text-[#57534e]">{used} / {limit}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#efede8]" role="progressbar" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used}>
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      {pct >= 85 ? <p className="mt-2.5 text-xs font-semibold text-[#9a3412]">Límite cercano. Sube de plan para ampliar tu cuota anual.</p> : null}
    </div>
  );
}
