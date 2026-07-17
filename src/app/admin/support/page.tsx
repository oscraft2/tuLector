import { requirePlatformContext } from "@/lib/supabaseAdmin";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { KPI, KPIGrid } from "@/components/dashboard/KPI";
import { DataTable } from "@/components/dashboard/DataTable";
import { isMissingColumnError, isMissingTableError } from "@/lib/supabase_errors";
import { updateSupportTicket, assignSupportTicket, addSupportTicketNote } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = ["open", "pending", "resolved", "closed"] as const;
const PRIORITY_OPTIONS = ["low", "normal", "high", "urgent"] as const;
const STATUS_LABELS: Record<string, string> = { open: "Abierto", pending: "Pendiente", resolved: "Resuelto", closed: "Cerrado" };
const PRIORITY_LABELS: Record<string, string> = { low: "Baja", normal: "Normal", high: "Alta", urgent: "Urgente" };

export default async function SupportPage() {
  const { admin } = await requirePlatformContext(["platform_admin", "support"]);

  let tickets: { id: string; subject: string; status: string | null; priority: string | null; locale: string | null; assigned_to?: string | null; created_at: string }[] | null;
  const firstAttempt = await admin
    .from("support_tickets")
    .select("id,subject,status,priority,locale,assigned_to,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  const assignMigrationPending = isMissingColumnError(firstAttempt.error, "assigned_to");
  if (assignMigrationPending) {
    const fallback = await admin.from("support_tickets").select("id,subject,status,priority,locale,created_at").order("created_at", { ascending: false }).limit(100);
    tickets = fallback.data;
  } else {
    tickets = firstAttempt.data;
  }

  const [{ data: staffRows }, { data: notesRows, error: notesError }] = await Promise.all([
    admin.from("platform_users").select("user_id, role").is("revoked_at", null),
    admin.from("support_ticket_notes").select("id,ticket_id,note,created_at,author_id").order("created_at", { ascending: false }).limit(300),
  ]);
  const notesMigrationPending = isMissingTableError(notesError, "support_ticket_notes");

  const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const emailById = new Map((usersData?.users ?? []).map((u) => [u.id, u.email ?? u.id]));
  const staffOptions = (staffRows ?? []).map((s) => ({ id: s.user_id, label: emailById.get(s.user_id) ?? s.user_id }));

  const notesByTicket = new Map<string, { id: string; note: string; created_at: string; author_id: string | null }[]>();
  for (const n of notesRows ?? []) {
    const list = notesByTicket.get(n.ticket_id) ?? [];
    list.push(n);
    notesByTicket.set(n.ticket_id, list);
  }

  const openCount = (tickets ?? []).filter((t) => t.status !== "closed").length;
  const urgentCount = (tickets ?? []).filter((t) => t.priority === "urgent" && t.status !== "closed").length;

  return (
    <AdminShell active="/admin/support" title="Soporte" description="Inbox de tickets: asignación, notas internas, estado y prioridad.">
      <div className="space-y-6">
        <KPIGrid>
          <KPI label="Tickets abiertos" value={openCount} />
          <KPI label="Urgentes sin cerrar" value={urgentCount} />
        </KPIGrid>

        {(assignMigrationPending || notesMigrationPending) && (
          <section className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            Falta aplicar la migración <code className="font-mono">supabase/migrations/20260717010000_support_ticket_notes.sql</code> en
            Supabase producción para poder asignar tickets y agregar notas internas.
          </section>
        )}

        <DataTable
          columns={["Ticket", "Estado / Prioridad", "Asignado a", "Notas internas", "Fecha"]}
          rows={tickets ?? []}
          empty="Sin tickets."
          renderRow={(t) => {
            const notes = notesByTicket.get(t.id) ?? [];
            return (
              <tr key={t.id} className="border-b border-[#eef0f3] last:border-0 align-top text-sm">
                <td className="px-5 py-4">
                  <p className="font-semibold">{t.subject}</p>
                  <p className="mt-1 text-xs text-[#6b7280]">{t.locale}</p>
                </td>
                <td className="px-5 py-4">
                  <form action={updateSupportTicket} className="grid gap-1">
                    <input type="hidden" name="ticket_id" value={t.id} />
                    <select name="status" defaultValue={t.status ?? "open"} className="rounded border border-[#cfd6df] px-2 py-1 text-xs">
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                    <select name="priority" defaultValue={t.priority ?? "normal"} className="rounded border border-[#cfd6df] px-2 py-1 text-xs">
                      {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                    </select>
                    <button className="rounded border border-[#cfd6df] px-2 py-1 text-xs font-semibold">Guardar</button>
                  </form>
                </td>
                <td className="px-5 py-4">
                  {assignMigrationPending ? (
                    <span className="text-xs text-[#9ca3af]">Pendiente de migración</span>
                  ) : (
                    <form action={assignSupportTicket} className="grid gap-1">
                      <input type="hidden" name="ticket_id" value={t.id} />
                      <select name="assigned_to" defaultValue={t.assigned_to ?? ""} className="rounded border border-[#cfd6df] px-2 py-1 text-xs">
                        <option value="">Sin asignar</option>
                        {staffOptions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                      <button className="rounded border border-[#cfd6df] px-2 py-1 text-xs font-semibold">Asignar</button>
                    </form>
                  )}
                </td>
                <td className="px-5 py-4 min-w-[220px]">
                  {notesMigrationPending ? (
                    <span className="text-xs text-[#9ca3af]">Pendiente de migración</span>
                  ) : (
                    <>
                      <div className="mb-2 space-y-1">
                        {notes.slice(0, 3).map((n) => (
                          <p key={n.id} className="rounded bg-[#f8fafc] px-2 py-1 text-xs text-[#4b5563]">{n.note}</p>
                        ))}
                        {notes.length === 0 && <p className="text-xs text-[#9ca3af]">Sin notas.</p>}
                      </div>
                      <form action={addSupportTicketNote} className="flex gap-1">
                        <input type="hidden" name="ticket_id" value={t.id} />
                        <input name="note" placeholder="Nueva nota interna..." className="flex-1 rounded border border-[#cfd6df] px-2 py-1 text-xs outline-none" />
                        <button className="rounded border border-[#cfd6df] px-2 py-1 text-xs font-semibold">+</button>
                      </form>
                    </>
                  )}
                </td>
                <td className="px-5 py-4 text-xs text-[#6b7280]">{new Date(t.created_at).toLocaleDateString("es-CL")}</td>
              </tr>
            );
          }}
        />
      </div>
    </AdminShell>
  );
}
