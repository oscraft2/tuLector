import { requirePlatformContext } from "@/lib/supabaseAdmin";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { DataTable } from "@/components/dashboard/DataTable";

export const dynamic = "force-dynamic";
export default async function SupportPage() { const { admin } = await requirePlatformContext(["platform_admin", "support"]); const { data: tickets } = await admin.from("support_tickets").select("id,subject,status,priority,locale,created_at").order("created_at", { ascending: false }).limit(100); return <AdminShell active="/admin/support" title="Soporte" description="Inbox de tickets, SLA, macros y contexto de scan_logs con auditoria antes de ver fotos."><DataTable columns={["Ticket", "Estado", "Prioridad", "Idioma", "Fecha"]} rows={tickets ?? []} empty="Sin tickets." renderRow={(t) => <tr key={t.id} className="border-b border-[#eef0f3] last:border-0"><td className="px-5 py-4 font-semibold">{t.subject}</td><td className="px-5 py-4">{t.status}</td><td className="px-5 py-4">{t.priority}</td><td className="px-5 py-4">{t.locale}</td><td className="px-5 py-4">{new Date(t.created_at).toLocaleDateString("es-CL")}</td></tr>} /></AdminShell>; }
