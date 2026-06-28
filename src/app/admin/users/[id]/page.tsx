import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePlatformContext, writeAuditLog } from "@/lib/supabaseAdmin";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { KPI, KPIGrid } from "@/components/dashboard/KPI";
import { DataTable } from "@/components/dashboard/DataTable";
import {
  updatePlatformUserRole,
  linkUserToSchool,
  unlinkUserFromSchool,
  updateUserSchoolRole,
} from "@/app/admin/actions";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function UserDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { admin, user: actorUser, role: actorRole } = await requirePlatformContext(["platform_admin", "support"]);

  // 1. Fetch user detail from Auth
  let targetUser;
  try {
    const { data } = await admin.auth.admin.getUserById(id);
    targetUser = data.user;
  } catch {
    // Auth user not found
  }

  if (!targetUser) notFound();

  // 2. Fetch profile, memberships, platform role and all schools
  const [
    { data: profile },
    { data: memberships },
    { data: platformUser },
    { data: schools },
    { data: auditLogs },
  ] = await Promise.all([
    admin.from("profiles").select("*").eq("user_id", id).maybeSingle(),
    admin.from("school_members").select("id, school_id, role, created_at, schools(name)").eq("user_id", id),
    admin.from("platform_users").select("*").eq("user_id", id).is("revoked_at", null).maybeSingle(),
    admin.from("schools").select("id, name").order("name"),
    admin
      .from("audit_log")
      .select("*")
      .or(`actor_user_id.eq.${id},target_id.eq.${id}`)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  // Log audit log for viewing detail
  await writeAuditLog({
    actorUserId: actorUser.id,
    actorRole: actorRole,
    targetType: "user",
    targetId: id,
    action: "user.view_detail",
    reason: "Vista detalle usuario desde consola admin",
  });

  return (
    <AdminShell active="/admin/users" title={`Usuario: ${targetUser.email}`} description="Ver perfil, vinculaciones multicolegio y roles de staff administrativo.">
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="text-sm font-semibold text-[#6b7280]">
          <Link href="/admin/users" className="hover:text-[#111827]">Usuarios</Link> &gt; <span className="text-[#111827]">{targetUser.email}</span>
        </div>

        {/* Audit Notification Warning */}
        <section className="rounded-md border border-[#f59e0b] bg-[#fffbeb] p-4 text-sm text-[#92400e]">
          Accediendo con credenciales de personal de plataforma ({actorUser.email}). Esta acción ha sido registrada en el log de auditoría global.
        </section>

        {/* KPI Cards */}
        <KPIGrid>
          <KPI label="Colegios Vinculados" value={memberships?.length ?? 0} />
          <KPI label="Rol en Plataforma" value={platformUser?.role ? platformUser.role.toUpperCase() : "USUARIO COMÚN"} />
          <KPI label="Idioma Perfil" value={profile?.locale || "es-CL"} />
          <KPI label="Creado el" value={new Date(targetUser.created_at).toLocaleDateString("es-CL")} />
        </KPIGrid>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          {/* Memberships Section */}
          <div className="space-y-6">
            <div className="rounded-md border border-[#e5e7eb] bg-white p-5">
              <h2 className="text-base font-semibold mb-4">Colegios Asociados (Workspace)</h2>
              <DataTable
                columns={["Colegio", "Rol Escolar", "Fecha Unión", "Acciones"]}
                rows={memberships ?? []}
                empty="Este usuario no está asociado a ningún colegio."
                renderRow={(m) => {
                  const schoolName = (m.schools as any)?.name || "Colegio sin nombre";
                  return (
                    <tr key={m.id} className="border-b border-[#eef0f3] last:border-0 text-sm">
                      <td className="px-5 py-4 font-semibold text-[#111827]">
                        <Link href={`/admin/schools/${m.school_id}`} className="hover:underline">{schoolName}</Link>
                      </td>
                      <td className="px-5 py-4">
                        <form action={updateUserSchoolRole} className="flex gap-2">
                          <input type="hidden" name="membership_id" value={m.id} />
                          <input type="hidden" name="target_user_id" value={id} />
                          <select name="school_role" defaultValue={m.role} className="rounded border border-[#cfd6df] px-2 py-1 text-xs">
                            <option value="admin">Administrador (admin)</option>
                            <option value="teacher">Profesor (teacher)</option>
                            <option value="viewer">Observador (viewer)</option>
                          </select>
                          <button className="rounded border border-[#cfd6df] px-2 py-1 text-xs font-semibold">Guardar</button>
                        </form>
                      </td>
                      <td className="px-5 py-4 text-xs text-[#6b7280]">
                        {new Date(m.created_at).toLocaleDateString("es-CL")}
                      </td>
                      <td className="px-5 py-4">
                        <form action={unlinkUserFromSchool}>
                          <input type="hidden" name="membership_id" value={m.id} />
                          <input type="hidden" name="target_user_id" value={id} />
                          <button className="rounded bg-red-50 text-red-600 border border-red-200 px-2 py-1 text-xs font-semibold hover:bg-red-100 transition-colors">
                            Desvincular
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                }}
              />
            </div>

            {/* Link New School Form */}
            <div className="rounded-md border border-[#e5e7eb] bg-white p-5">
              <h2 className="text-base font-semibold mb-4">Vincular a un nuevo Colegio</h2>
              <form action={linkUserToSchool} className="space-y-4 text-sm">
                <input type="hidden" name="target_user_id" value={id} />
                <div>
                  <label className="block font-semibold text-[#111827] mb-1">Seleccionar Colegio</label>
                  <select name="school_id" required className="w-full rounded border border-[#cfd6df] px-3 py-2 text-sm outline-none">
                    <option value="">-- Elige un colegio registrado --</option>
                    {schools?.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#111827] mb-1">Rol del usuario en el colegio</label>
                  <select name="school_role" defaultValue="teacher" className="w-full rounded border border-[#cfd6df] px-3 py-2 text-sm outline-none">
                    <option value="admin">Administrador (admin)</option>
                    <option value="teacher">Profesor (teacher)</option>
                    <option value="viewer">Observador (viewer)</option>
                  </select>
                </div>
                <button className="w-full rounded bg-[#07305f] px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-[#0b3f78] transition-colors">
                  Vincular y Dar Acceso
                </button>
              </form>
            </div>
          </div>

          <div className="space-y-6">
            {/* Platform Role Manager */}
            <div className="rounded-md border border-[#e5e7eb] bg-white p-5">
              <h2 className="text-base font-semibold mb-2">Rol de Personal de Plataforma (Staff)</h2>
              <p className="text-sm text-[#5b6472] mb-4">
                El staff tiene privilegios globales de administración, finanzas, soporte o marketing. El rol de administrador de plataforma puede modificar configuraciones globales y base de datos.
              </p>
              <form action={updatePlatformUserRole} className="space-y-4 text-sm">
                <input type="hidden" name="target_user_id" value={id} />
                <div>
                  <label className="block font-semibold text-[#111827] mb-1">Rol de Staff</label>
                  <select name="platform_role" defaultValue={platformUser?.role || "none"} className="w-full rounded border border-[#cfd6df] px-3 py-2 text-sm outline-none font-semibold">
                    <option value="none">Ninguno (Usuario común de colegio)</option>
                    <option value="platform_admin">Platform Admin (Acceso Total)</option>
                    <option value="support">Soporte Operativo (Visualizar logs/tickets)</option>
                    <option value="finance">Finanzas (Facturas y Reembolsos)</option>
                    <option value="marketing">Marketing (Plantillas y Campañas)</option>
                  </select>
                </div>
                <button className="w-full rounded bg-[#f59e0b] px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-[#d97706] transition-colors">
                  Actualizar Rol de Staff
                </button>
              </form>
            </div>

            {/* Audit Log for User */}
            <div className="rounded-md border border-[#e5e7eb] bg-white p-5">
              <h2 className="text-base font-semibold mb-4">Registro Reciente de Acciones</h2>
              <DataTable
                columns={["Acción", "Fecha", "Detalles"]}
                rows={auditLogs ?? []}
                empty="No hay auditorías recientes para este usuario."
                renderRow={(log) => (
                  <tr key={log.id} className="border-b border-[#eef0f3] last:border-0 text-xs">
                    <td className="px-5 py-3 font-semibold text-[#07305f]">{log.action}</td>
                    <td className="px-5 py-3 text-[#6b7280]">
                      {new Date(log.created_at).toLocaleString("es-CL")}
                    </td>
                    <td className="px-5 py-3 text-xs text-[#4b5563]">
                      {log.reason || "-"}
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <pre className="mt-1 max-w-[240px] overflow-hidden text-ellipsis font-mono text-[10px] text-[#9ca3af]">
                          {JSON.stringify(log.metadata)}
                        </pre>
                      )}
                    </td>
                  </tr>
                )}
              />
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
