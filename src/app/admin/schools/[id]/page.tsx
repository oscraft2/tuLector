import { notFound } from "next/navigation";
import { requirePlatformContext, writeAuditLog } from "@/lib/supabaseAdmin";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { KPI, KPIGrid } from "@/components/dashboard/KPI";
import { DataTable } from "@/components/dashboard/DataTable";

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
        <KPIGrid><KPI label="Plan" value={school.plan} /><KPI label="Miembros" value={members ?? 0} /><KPI label="Ensayos" value={quizzes ?? 0} /><KPI label="Lecturas" value={papers ?? 0} /></KPIGrid>
        <DataTable columns={["Alumno", "Puntaje", "Estado", "Fecha"]} rows={recentPapers ?? []} empty="Sin lecturas." renderRow={(paper) => <tr key={paper.id} className="border-b border-[#eef0f3] last:border-0"><td className="px-5 py-4 font-semibold">{paper.student_name ?? "Sin identificar"}</td><td className="px-5 py-4">{paper.score ?? "-"}/{paper.total ?? "-"}</td><td className="px-5 py-4">{paper.status}</td><td className="px-5 py-4">{new Date(paper.scanned_at).toLocaleString("es-CL")}</td></tr>} />
      </div>
    </AdminShell>
  );
}
