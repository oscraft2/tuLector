import { notFound } from "next/navigation";
import { requirePlatformContext, writeAuditLog } from "@/lib/supabaseAdmin";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { KPI, KPIGrid } from "@/components/dashboard/KPI";
import { DataTable } from "@/components/dashboard/DataTable";
import { impersonateSchool } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function SchoolDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { admin, user, role } = await requirePlatformContext(["platform_admin", "support", "finance"]);
  const [{ data: school }, { count: members }, { count: quizzes }, { count: papers }, { data: recentPapers }] = await Promise.all([
    admin.from("schools").select("*").eq("id", id).single(),
    admin.from("school_members").select("id", { count: "exact", head: true }).eq("school_id", id),
    admin.from("quizzes").select("id", { count: "exact", head: true }).eq("school_id", id),
    admin.from("papers").select("id", { count: "exact", head: true }).eq("school_id", id),
    admin.from("papers").select("id,student_name,score,total,status,scanned_at").eq("school_id", id).order("scanned_at", { ascending: false }).limit(20),
  ]);
  if (!school) notFound();
  await writeAuditLog({ actorUserId: user.id, actorRole: role, schoolId: id, targetType: "school", targetId: id, action: "school.view", reason: "Vista detalle admin plataforma" });
  return (
    <AdminShell active="/admin/schools" title={school.name} description="Vista read-only de tenant. Cualquier impersonacion, acceso a fotos o accion destructiva requiere motivo, 2FA y audit_log.">
      <div className="space-y-6">
        <section className="rounded-md border border-[#f59e0b] bg-[#fffbeb] p-4 text-sm text-[#92400e]">Visto por staff {user.email}. Motivo registrado: Vista detalle admin plataforma.</section>
        
        {/* Impersonación Section */}
        <section className="rounded-md border border-[#e5e7eb] bg-white p-5">
          <h2 className="text-base font-semibold text-[#111827]">Impersonar este Colegio (Acceder como administrador)</h2>
          <p className="mt-1 text-sm text-[#5b6472] mb-4">
            Esto te redirigirá al Dashboard principal de este colegio con privilegios de Administrador para diagnosticar problemas. Esta acción quedará registrada bajo tu cuenta.
          </p>
          <form action={impersonateSchool} className="flex flex-col gap-3 md:flex-row md:items-end">
            <input type="hidden" name="school_id" value={id} />
            <div className="flex-1">
              <label className="block text-xs font-semibold uppercase tracking-[0.1em] text-[#6b7280] mb-1">
                Justificación de Impersonación (Obligatorio)
              </label>
              <input
                type="text"
                name="reason"
                required
                placeholder="ej: Resolver ticket #2841 - Problema al sincronizar RUT..."
                className="w-full rounded border border-[#cfd6df] bg-white px-3 py-2 text-sm outline-none focus:border-amber-500"
              />
            </div>
            <button className="rounded bg-amber-500 hover:bg-amber-600 text-white font-semibold px-4 py-2 text-sm shadow transition-colors">
              Iniciar Impersonación
            </button>
          </form>
        </section>

        <KPIGrid><KPI label="Plan" value={school.plan} /><KPI label="Miembros" value={members ?? 0} /><KPI label="Ensayos" value={quizzes ?? 0} /><KPI label="Lecturas" value={papers ?? 0} /></KPIGrid>
        <DataTable columns={["Alumno", "Puntaje", "Estado", "Fecha"]} rows={recentPapers ?? []} empty="Sin lecturas." renderRow={(paper) => <tr key={paper.id} className="border-b border-[#eef0f3] last:border-0"><td className="px-5 py-4 font-semibold">{paper.student_name ?? "Sin identificar"}</td><td className="px-5 py-4">{paper.score ?? "-"}/{paper.total ?? "-"}</td><td className="px-5 py-4">{paper.status}</td><td className="px-5 py-4">{new Date(paper.scanned_at).toLocaleString("es-CL")}</td></tr>} />
      </div>
    </AdminShell>
  );
}
