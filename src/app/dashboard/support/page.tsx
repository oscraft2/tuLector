import { getDashboardContext } from "@/lib/supabase_server";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { DataTable } from "@/components/dashboard/DataTable";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase_server";

export const dynamic = "force-dynamic";

export default async function DashboardSupportPage() {
  const { school } = await getDashboardContext();
  const supabase = await createSupabaseServerClient();

  // Obtener tickets de la escuela
  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("id, subject, status, token, created_at")
    .eq("school_id", school.id)
    .order("created_at", { ascending: false });

  const STATUS_LABELS: Record<string, string> = { open: "Abierto", pending: "En revisión", resolved: "Resuelto", closed: "Cerrado" };
  const STATUS_COLORS: Record<string, string> = {
    open: "bg-blue-100 text-blue-800",
    pending: "bg-amber-100 text-amber-800",
    resolved: "bg-green-100 text-green-800",
    closed: "bg-gray-100 text-gray-800"
  };

  return (
    <>
      <PageHeader title="Soporte Técnico" description="Gestiona tus solicitudes de soporte con nuestro equipo." />
      <div className="space-y-6">
        <div className="flex justify-end">
          <Link href="/dashboard/support/new" className="rounded-md bg-[#0a0a0a] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[#111]">
            + Nuevo Ticket
          </Link>
        </div>

        <DataTable
          columns={["Asunto", "Estado", "Fecha", "Acciones"]}
          rows={tickets ?? []}
          empty="No tienes tickets de soporte activos."
          renderRow={(t) => (
            <tr key={t.id} className="border-b border-[#eef0f3] last:border-0 align-middle text-sm">
              <td className="px-5 py-4 font-semibold text-[#111827]">{t.subject}</td>
              <td className="px-5 py-4">
                <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[t.status] || STATUS_COLORS.open}`}>
                  {STATUS_LABELS[t.status] || t.status}
                </span>
              </td>
              <td className="px-5 py-4 text-[#6b7280]">
                {new Date(t.created_at).toLocaleDateString()}
              </td>
              <td className="px-5 py-4">
                <Link href={`/t/${t.token}`} className="text-[#2563eb] hover:underline font-medium">
                  Ver hilo →
                </Link>
              </td>
            </tr>
          )}
        />
      </div>
    </>
  );
}
