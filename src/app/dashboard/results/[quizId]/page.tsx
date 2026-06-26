import { notFound } from "next/navigation";
import { getDashboardContext } from "@/lib/supabase_server";
import { DashboardShell } from "@/components/dashboard/DashboardNav";
import { KPI, KPIGrid } from "@/components/dashboard/KPI";
import { DataTable } from "@/components/dashboard/DataTable";
import { logExport } from "@/app/dashboard/actions";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ quizId: string }> };

export default async function ResultsPage({ params }: PageProps) {
  const { quizId } = await params;
  const { supabase, locale, isAdmin } = await getDashboardContext();
  const [{ data: quiz }, { data: papers }] = await Promise.all([
    supabase.from("quizzes").select("id,title,num_questions,answer_key").eq("id", quizId).single(),
    supabase.from("papers").select("id,student_name,student_id,score,total,answers,scanned_at").eq("quiz_id", quizId).order("score", { ascending: false }),
  ]);
  if (!quiz) notFound();
  const rows = papers ?? [];
  const avg = rows.length ? Math.round(rows.reduce((sum, p) => sum + ((p.score ?? 0) / Math.max(1, p.total ?? quiz.num_questions)) * 100, 0) / rows.length) : 0;
  const max = rows.reduce((best, p) => Math.max(best, p.score ?? 0), 0);
  const min = rows.length ? rows.reduce((low, p) => Math.min(low, p.score ?? 0), rows[0].score ?? 0) : 0;
  return (
    <DashboardShell locale={locale} title={`Resultados: ${quiz.title}`} description="Distribucion de puntaje, logro por alumno y exportaciones auditadas para administradores del colegio.">
      <div className="space-y-6">
        <KPIGrid><KPI label="Alumnos" value={rows.length} /><KPI label="Promedio" value={`${avg}%`} /><KPI label="Maximo" value={max} /><KPI label="Minimo" value={min} /></KPIGrid>
        <div className="rounded-md border border-[#e1e5ea] bg-white p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold">Exportaciones</h2><form action={logExport}><input type="hidden" name="export_type" value="results_pdf" /><input type="hidden" name="entity_type" value="quiz" /><button disabled={!isAdmin} className="rounded-md border border-[#cfd6df] px-4 py-2 text-sm font-semibold disabled:opacity-50">Registrar exportacion PDF/Excel</button></form></div>
          <p className="text-sm text-[#5b6472]">La generacion real de PDF/Excel debe quedar tras este log de exportacion y solo para admin del colegio.</p>
        </div>
        <DataTable columns={["Alumno", "Puntaje", "Porcentaje", "Fecha"]} rows={rows} empty="Sin resultados para este ensayo." renderRow={(paper) => (
          <tr key={paper.id} className="border-b border-[#eef0f3] last:border-0"><td className="px-5 py-4 font-semibold">{paper.student_name ?? paper.student_id ?? "Sin identificar"}</td><td className="px-5 py-4">{paper.score ?? "-"}/{paper.total ?? quiz.num_questions}</td><td className="px-5 py-4">{paper.total ? Math.round(((paper.score ?? 0) / paper.total) * 100) : 0}%</td><td className="px-5 py-4 text-[#5b6472]">{new Date(paper.scanned_at).toLocaleString("es-CL")}</td></tr>
        )} />
      </div>
    </DashboardShell>
  );
}
