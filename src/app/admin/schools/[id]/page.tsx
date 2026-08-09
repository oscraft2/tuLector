import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePlatformContext, writeAuditLog } from "@/lib/supabaseAdmin";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { KPI, KPIGrid } from "@/components/dashboard/KPI";
import { DataTable } from "@/components/dashboard/DataTable";
import { countryProfiles } from "@/lib/country_profiles";
import {
  impersonateSchool,
  updateSchoolPlan,
  updateSchoolStatus,
  updateSchoolDetails,
  linkUserToSchool,
  unlinkUserFromSchool,
  updateUserSchoolRole,
} from "@/app/admin/actions";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

const STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  paused: "Pausado",
  inactive: "Inactivo",
  deleted: "Eliminado",
};

const GATEWAY_LABELS: Record<string, string> = {
  flow: "Flow (Chile)",
  dlocal: "dLocal (LatAm)",
  mercadopago: "MercadoPago (legado)",
  stripe: "Stripe (legado)",
};

export default async function SchoolDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { admin, user, role } = await requirePlatformContext(["platform_admin", "support", "finance"]);
  const [{ data: school }, { data: memberRows }, { count: quizzes }, { count: papers }, { data: recentPapers }, { data: orders }, { data: auditLogs }] = await Promise.all([
    admin.from("schools").select("*").eq("id", id).single(),
    admin.from("school_members").select("id,user_id,role,created_at").eq("school_id", id).order("created_at"),
    admin.from("quizzes").select("id", { count: "exact", head: true }).eq("school_id", id),
    admin.from("papers").select("id", { count: "exact", head: true }).eq("school_id", id),
    admin.from("papers").select("id,student_name,score,total,status,scanned_at").eq("school_id", id).order("scanned_at", { ascending: false }).limit(20),
    admin.from("orders").select("id,type,status,amount_cents,currency,gateway,created_at,paid_at").eq("school_id", id).order("created_at", { ascending: false }).limit(20),
    admin.from("audit_log").select("*").eq("target_id", id).order("created_at", { ascending: false }).limit(10),
  ]);
  if (!school) notFound();

  const members = await Promise.all(
    (memberRows ?? []).map(async (m) => {
      let email = m.user_id;
      try {
        const { data } = await admin.auth.admin.getUserById(m.user_id);
        if (data?.user?.email) email = data.user.email;
      } catch {
        // usuario ya no existe en auth -- se muestra el id crudo
      }
      return { ...m, email };
    })
  );
  await writeAuditLog({ actorUserId: user.id, actorRole: role, schoolId: id, targetType: "school", targetId: id, action: "school.view", reason: "Vista detalle admin plataforma" });
  const currentStatus = school.status ?? "active";
  return (
    <AdminShell active="/admin/schools" title={school.name} description="Vista 360 del cliente: plan, estado de cuenta, pagos y actividad. Cualquier impersonacion, acceso a fotos o accion destructiva requiere motivo, 2FA y audit_log.">
      <div className="space-y-6">
        <section className="rounded-md border border-[#f59e0b] bg-[#fffbeb] p-4 text-sm text-[#92400e]">Visto por staff {user.email}. Motivo registrado: Vista detalle admin plataforma.</section>

        {/* Datos del colegio */}
        <section className="rounded-md border border-[#e5e7eb] bg-white p-5">
          <h2 className="text-base font-semibold text-[#111827]">Datos del colegio</h2>
          <form action={updateSchoolDetails} className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <input type="hidden" name="school_id" value={id} />
            <label className="text-sm font-semibold text-[#111827]">
              Nombre
              <input type="text" name="name" defaultValue={school.name} required className="mt-1 w-full rounded border border-[#cfd6df] px-3 py-2 text-sm outline-none" />
            </label>
            <label className="text-sm font-semibold text-[#111827]">
              Pais
              <select name="country_code" defaultValue={school.country_code ?? ""} className="mt-1 w-full rounded border border-[#cfd6df] bg-white px-3 py-2 text-sm outline-none">
                <option value="">Sin especificar</option>
                {countryProfiles.map((p) => (
                  <option key={p.code} value={p.code}>{p.countryName}</option>
                ))}
              </select>
            </label>
            <div className="md:col-span-3">
              <input type="text" name="reason" required placeholder="Motivo del cambio (obligatorio para auditoria)..." className="w-full rounded border border-[#cfd6df] px-3 py-2 text-sm outline-none" />
            </div>
            <button className="rounded bg-[#111827] px-3 py-2 text-sm font-semibold text-white hover:bg-[#07305f] md:col-span-3 md:w-fit">Guardar datos</button>
          </form>
        </section>

        {/* Cuenta: plan y estado */}
        <section className="grid gap-4 rounded-md border border-[#e5e7eb] bg-white p-5 md:grid-cols-2">
          <div>
            <h2 className="text-base font-semibold text-[#111827]">Cambiar plan</h2>
            <p className="mt-1 text-sm text-[#5b6472] mb-3">Plan actual: <span className="font-semibold">{school.plan}</span>.</p>
            <form action={updateSchoolPlan} className="flex flex-col gap-2">
              <input type="hidden" name="school_id" value={id} />
              <select name="plan" defaultValue={school.plan} className="rounded border border-[#cfd6df] px-3 py-2 text-sm outline-none">
                <option value="starter">gratis</option>
                <option value="pro">pro</option>
                <option value="school">school</option>
              </select>
              <input type="text" name="reason" required placeholder="Motivo del cambio de plan..." className="rounded border border-[#cfd6df] px-3 py-2 text-sm outline-none" />
              <button className="rounded bg-[#111827] px-3 py-2 text-sm font-semibold text-white hover:bg-[#07305f]">Guardar plan</button>
            </form>
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#111827]">Estado de la cuenta</h2>
            <p className="mt-1 text-sm text-[#5b6472] mb-3">Estado actual: <span className="font-semibold">{STATUS_LABELS[currentStatus] ?? currentStatus}</span>.</p>
            <form action={updateSchoolStatus} className="flex flex-col gap-2">
              <input type="hidden" name="school_id" value={id} />
              <select name="status" defaultValue={currentStatus === "deleted" ? "active" : currentStatus} className="rounded border border-[#cfd6df] px-3 py-2 text-sm outline-none">
                <option value="active">Activo</option>
                <option value="paused">Pausado</option>
                <option value="inactive">Inactivo</option>
              </select>
              <input type="text" name="reason" required placeholder="Motivo (ej: falta de pago, solicitud del colegio...)" className="rounded border border-[#cfd6df] px-3 py-2 text-sm outline-none" />
              <button className="rounded bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600">Actualizar estado</button>
            </form>
          </div>
        </section>

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

        <KPIGrid><KPI label="Plan" value={school.plan} /><KPI label="Miembros" value={members.length} /><KPI label="Ensayos" value={quizzes ?? 0} /><KPI label="Lecturas" value={papers ?? 0} /></KPIGrid>

        <div className="rounded-md border border-[#e5e7eb] bg-white p-5">
          <h2 className="mb-4 text-base font-semibold">Miembros del colegio</h2>
          <DataTable
            columns={["Usuario", "Rol", "Desde", "Acciones"]}
            rows={members}
            empty="Este colegio no tiene miembros."
            renderRow={(m) => (
              <tr key={m.id} className="border-b border-[#eef0f3] last:border-0 text-sm">
                <td className="px-5 py-4 font-semibold text-[#111827]">
                  <Link href={`/admin/users/${m.user_id}`} className="hover:underline">{m.email}</Link>
                </td>
                <td className="px-5 py-4">
                  <form action={updateUserSchoolRole} className="flex gap-2">
                    <input type="hidden" name="membership_id" value={m.id} />
                    <input type="hidden" name="target_user_id" value={m.user_id} />
                    <select name="school_role" defaultValue={m.role} className="rounded border border-[#cfd6df] px-2 py-1 text-xs">
                      <option value="admin">Administrador (admin)</option>
                      <option value="teacher">Profesor (teacher)</option>
                      <option value="viewer">Observador (viewer)</option>
                    </select>
                    <button className="rounded border border-[#cfd6df] px-2 py-1 text-xs font-semibold">Guardar</button>
                  </form>
                </td>
                <td className="px-5 py-4 text-xs text-[#6b7280]">{new Date(m.created_at).toLocaleDateString("es-CL")}</td>
                <td className="px-5 py-4">
                  <form action={unlinkUserFromSchool}>
                    <input type="hidden" name="membership_id" value={m.id} />
                    <input type="hidden" name="target_user_id" value={m.user_id} />
                    <button className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-100">Desvincular</button>
                  </form>
                </td>
              </tr>
            )}
          />
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-semibold text-[#07305f]">Vincular usuario existente</summary>
            <form action={linkUserToSchool} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="school_id" value={id} />
              <label className="text-xs font-semibold text-[#111827]">
                ID de usuario (ver en /admin/users/[id])
                <input type="text" name="target_user_id" required placeholder="uuid del usuario" className="mt-1 w-72 rounded border border-[#cfd6df] px-3 py-2 text-sm outline-none" />
              </label>
              <select name="school_role" defaultValue="teacher" className="rounded border border-[#cfd6df] px-3 py-2 text-sm outline-none">
                <option value="admin">Administrador (admin)</option>
                <option value="teacher">Profesor (teacher)</option>
                <option value="viewer">Observador (viewer)</option>
              </select>
              <button className="rounded bg-[#07305f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0b3f78]">Vincular</button>
            </form>
          </details>
        </div>

        <div className="rounded-md border border-[#e5e7eb] bg-white p-5">
          <h2 className="mb-4 text-base font-semibold">Registro de auditoria</h2>
          <DataTable
            columns={["Accion", "Fecha", "Detalles"]}
            rows={auditLogs ?? []}
            empty="No hay auditorias recientes para este colegio."
            renderRow={(log) => (
              <tr key={log.id} className="border-b border-[#eef0f3] last:border-0 text-xs">
                <td className="px-5 py-3 font-semibold text-[#07305f]">{log.action}</td>
                <td className="px-5 py-3 text-[#6b7280]">{new Date(log.created_at).toLocaleString("es-CL")}</td>
                <td className="px-5 py-3 text-xs text-[#4b5563]">
                  {log.reason || "-"}
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <pre className="mt-1 max-w-[240px] overflow-hidden text-ellipsis font-mono text-[10px] text-[#9ca3af]">{JSON.stringify(log.metadata)}</pre>
                  )}
                </td>
              </tr>
            )}
          />
        </div>

        <div className="rounded-md border border-[#e5e7eb] bg-white p-5">
          <h2 className="mb-4 text-base font-semibold">Pagos de este colegio</h2>
          <DataTable
            columns={["Fecha", "Tipo", "Pasarela", "Monto", "Estado"]}
            rows={orders ?? []}
            empty="Sin pagos registrados."
            renderRow={(order) => (
              <tr key={order.id} className="border-b border-[#eef0f3] last:border-0 text-sm">
                <td className="px-5 py-4">{new Date(order.created_at).toLocaleString("es-CL")}</td>
                <td className="px-5 py-4">{order.type === "plan" ? "Suscripción" : "Paquete de escaneos"}</td>
                <td className="px-5 py-4">{GATEWAY_LABELS[order.gateway ?? ""] ?? "Sin registrar"}</td>
                <td className="px-5 py-4 font-semibold">${((order.amount_cents ?? 0) / 100).toLocaleString("es-CL")} {(order.currency || "usd").toUpperCase()}</td>
                <td className="px-5 py-4">{order.status}</td>
              </tr>
            )}
          />
        </div>

        <DataTable columns={["Alumno", "Puntaje", "Estado", "Fecha"]} rows={recentPapers ?? []} empty="Sin lecturas." renderRow={(paper) => <tr key={paper.id} className="border-b border-[#eef0f3] last:border-0"><td className="px-5 py-4 font-semibold">{paper.student_name ?? "Sin identificar"}</td><td className="px-5 py-4">{paper.score ?? "-"}/{paper.total ?? "-"}</td><td className="px-5 py-4">{paper.status}</td><td className="px-5 py-4">{new Date(paper.scanned_at).toLocaleString("es-CL")}</td></tr>} />
      </div>
    </AdminShell>
  );
}
