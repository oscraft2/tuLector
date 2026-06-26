export function QuotaBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div aria-label="Uso de lecturas" role="group">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold text-[#111827]">Lecturas usadas</span>
        <span className="text-[#4b5563]">{used} / {limit}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#eef0f3]" role="progressbar" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used}>
        <div className="h-full bg-[#111827]" style={{ width: `${pct}%` }} />
      </div>
      {pct >= 85 ? <p className="mt-3 text-sm font-semibold text-[#92400e]">Limite cercano. Compra lecturas o sube de plan.</p> : null}
    </div>
  );
}
