import Link from "next/link";
import { requirePlatformContext } from "@/lib/supabaseAdmin";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { DataTable } from "@/components/dashboard/DataTable";
import { updateSchoolPlan } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminSchoolsPage() {
  const { admin } = await requirePlatformContext(["platform_admin", "support", "finance"]);
  const { data: schools } = await admin.from("schools").select("id,name,country_code,plan,status,scans_used,scans_limit,created_at").order("created_at", { ascending: false });
  return (
    <AdminShell active="/admin/schools" title="Colegios" description="Tenants multi-tenant: estado, plan, cuota, miembros y acciones con auditoria.">
      <DataTable columns={["Colegio", "Pais", "Plan", "Cuota", "Estado", "Acciones"]} rows={schools ?? []} empty="No hay tenants." renderRow={(school) => (
        <tr key={school.id} className="border-b border-[#eef0f3] last:border-0">
          <td className="px-5 py-4 font-semibold"><Link href={`/admin/schools/${school.id}`} className="hover:underline">{school.name}</Link></td><td className="px-5 py-4">{school.country_code}</td><td className="px-5 py-4">{school.plan}</td><td className="px-5 py-4">{school.scans_used}/{school.scans_limit}</td><td className="px-5 py-4">{school.status ?? "active"}</td>
          <td className="px-5 py-4"><form action={updateSchoolPlan} className="flex gap-2"><input type="hidden" name="school_id" value={school.id} /><input type="hidden" name="reason" value="Ajuste manual desde admin" /><select name="plan" defaultValue={school.plan} className="rounded border border-[#cfd6df] px-2 py-1 text-xs"><option value="starter">gratis</option><option value="pro">pro</option><option value="school">school</option></select><button className="rounded border border-[#cfd6df] px-2 py-1 text-xs font-semibold">Guardar</button></form></td>
        </tr>
      )} />
    </AdminShell>
  );
}
