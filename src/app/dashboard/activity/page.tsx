import { getDashboardContext } from "@/lib/supabase_server";
import { DataTable } from "@/components/dashboard/DataTable";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EmptyState } from "@/components/dashboard/EmptyState";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<{ type?: string }> };

type ActivityRow = {
  id: string;
  type: "scan" | "export" | "update";
  title: string;
  detail: string;
  ts: string;
};

export default async function ActivityPage({ searchParams }: PageProps) {
  const { supabase, school } = await getDashboardContext();
  const sp = ((await searchParams) ?? {}) as { type?: string };

  const { data: papers } = await supabase
    .from("papers")
    .select("id,student_name,student_id,score,total,status,scanned_at,quiz_id,quizzes(title)")
    .eq("quizzes.school_id", school.id)
    .neq("status", "void")
    .order("scanned_at", { ascending: false })
    .limit(100);

  const { data: exports } = await supabase
    .from("export_logs")
    .select("id,format,quiz_id,created_at")
    .eq("school_id", school.id)
    .order("created_at", { ascending: false })
    .limit(30);

  const rows: ActivityRow[] = [];

  for (const p of papers ?? []) {
    const quiz = (p as unknown as { quizzes?: { title?: string } })?.quizzes;
    rows.push({
      id: `${(p as { id: string }).id}-scan`,
      type: "scan",
      title: `Escaneo ${(p as { status?: string }).status === "manual_review" ? "en revisión" : "procesado"}`,
      detail: `${(p as { student_name?: string | null; student_id?: string | null }).student_name ?? (p as { student_id?: string | null }).student_id ?? "Sin identificar"} — ${(p as { score?: number | null }).score ?? 0}/${(p as { total?: number | null }).total ?? "?"} en ${quiz?.title ?? "ensayo"}`,
      ts: (p as { scanned_at?: string }).scanned_at ?? "",
    });
  }

  for (const e of exports ?? []) {
    rows.push({
      id: `${(e as { id: string }).id}-exp`,
      type: "export",
      title: `Exportación CSV`,
      detail: `Formato ${(e as { format?: string }).format ?? "genérico"} — Quiz #${(e as { quiz_id?: string }).quiz_id}`,
      ts: (e as { created_at?: string }).created_at ?? "",
    });
  }

  rows.sort((a, b) => b.ts.localeCompare(a.ts));

  const filtered = sp.type ? rows.filter((r) => r.type === sp.type) : rows;

  const typeIcon: Record<string, string> = { scan: "📄", export: "📥", update: "✏️" };

  // Add to nav
  if (filtered.length === 0 && !sp.type) {
    return (
      <>
        <PageHeader title="Actividad" description="Bitácora de escaneos, exportaciones y cambios en el colegio. Solo visible para administradores." />
        <EmptyState
          icon="📋"
          title="Sin actividad registrada"
          description="Aqui apareceran los escaneos y exportaciones a medida que uses la plataforma."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Actividad" description={`${filtered.length} evento${filtered.length === 1 ? "" : "s"}. Bitácora de escaneos y exportaciones del colegio.`} />
      <div className="space-y-4">
        <div className="flex gap-2 text-xs">
          <a href="/dashboard/activity" className={`rounded-full px-3 py-1 font-semibold ${!sp.type ? "bg-[#07305f] text-white" : "bg-[#f4f6f8] text-[#5b6472]"}`}>Todos</a>
          <a href="/dashboard/activity?type=scan" className={`rounded-full px-3 py-1 font-semibold ${sp.type === "scan" ? "bg-[#07305f] text-white" : "bg-[#f4f6f8] text-[#5b6472]"}`}>Escaneos</a>
          <a href="/dashboard/activity?type=export" className={`rounded-full px-3 py-1 font-semibold ${sp.type === "export" ? "bg-[#07305f] text-white" : "bg-[#f4f6f8] text-[#5b6472]"}`}>Exportaciones</a>
        </div>
        <DataTable
          columns={["Tipo", "Evento", "Detalle", "Fecha"]}
          rows={filtered}
          empty="Sin eventos para el filtro seleccionado."
          renderRow={(r: ActivityRow) => (
            <tr key={r.id} className="border-b border-[#eef0f3] last:border-0">
              <td className="px-5 py-4 text-lg">{typeIcon[r.type] ?? "🔔"}</td>
              <td className="px-5 py-4 font-semibold text-sm">{r.title}</td>
              <td className="px-5 py-4 text-xs text-[#5b6472] max-w-xs truncate">{r.detail}</td>
              <td className="px-5 py-4 text-xs text-[#5b6472]">{new Date(r.ts).toLocaleString("es-CL")}</td>
            </tr>
          )}
          renderMobileRow={(r: ActivityRow) => (
            <article className="rounded-md border border-[#e6e8eb] bg-white p-4 shadow-sm">
              <span className="text-lg">{typeIcon[r.type] ?? "🔔"}</span>
              <p className="mt-1 text-sm font-semibold">{r.title}</p>
              <p className="mt-1 text-xs text-[#5b6472]">{r.detail}</p>
              <p className="mt-2 text-[10px] text-[#9aa3af]">{new Date(r.ts).toLocaleString("es-CL")}</p>
            </article>
          )}
        />
      </div>
    </>
  );
}
