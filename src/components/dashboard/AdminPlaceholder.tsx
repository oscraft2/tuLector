import { AdminShell } from "@/components/dashboard/AdminShell";
import { KPI, KPIGrid } from "@/components/dashboard/KPI";

export function AdminPlaceholder({ active, title, description, items }: { active: string; title: string; description: string; items: { label: string; value: string | number; detail?: string }[] }) {
  return (
    <AdminShell active={active} title={title} description={description}>
      <div className="space-y-6">
        <KPIGrid>{items.map((item) => <KPI key={item.label} label={item.label} value={item.value} detail={item.detail} />)}</KPIGrid>
        <section className="rounded-md border border-[#e1e5ea] bg-white p-5">
          <h2 className="text-xl font-semibold">Siguiente integracion</h2>
          <p className="mt-2 text-sm leading-6 text-[#5b6472]">Esta pantalla ya esta separada por rol plataforma. Las integraciones externas deben activarse solo con secretos server-side, webhooks verificados e insercion en audit_log.</p>
        </section>
      </div>
    </AdminShell>
  );
}
