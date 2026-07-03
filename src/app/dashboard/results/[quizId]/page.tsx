import { notFound } from "next/navigation";
import { getDashboardContext } from "@/lib/supabase_server";
import { KPI, KPIGrid } from "@/components/dashboard/KPI";
import { DataTable } from "@/components/dashboard/DataTable";
import { PageHeader } from "@/components/dashboard/PageHeader";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ quizId: string }> };

type PaperResult = {
  id: string;
  student_name: string | null;
  student_id: string | null;
  score: number | null;
  total: number | null;
  scanned_at: string;
  equivalent_score: number | null;
  grade: string | number | null;
};

export default async function ResultsPage({ params }: PageProps) {
  const { quizId } = await params;
  const { supabase, isAdmin } = await getDashboardContext();
  const [{ data: quiz }, { data: papers }] = await Promise.all([
    supabase.from("quizzes").select("id,title,num_questions,answer_key,evaluation_type,evaluation_variant").eq("id", quizId).single(),
    supabase.from("papers").select("id,student_name,student_id,score,total,answers,scanned_at,equivalent_score,grade").eq("quiz_id", quizId).order("score", { ascending: false }),
  ]);
  if (!quiz) notFound();
  const rows = (papers ?? []) as PaperResult[];
  const avg = rows.length ? Math.round(rows.reduce((sum, p) => sum + ((p.score ?? 0) / Math.max(1, p.total ?? quiz.num_questions)) * 100, 0) / rows.length) : 0;
  const max = rows.reduce((best, p) => Math.max(best, p.score ?? 0), 0);
  const min = rows.length ? rows.reduce((low, p) => Math.min(low, p.score ?? 0), rows[0].score ?? 0) : 0;

  const isPAES = quiz.evaluation_type === "paes";
  const isSIMCE = quiz.evaluation_type === "simce";

  const getScoreDisplay = (paper: PaperResult) => {
    if (isPAES) {
      return `${paper.equivalent_score ?? Math.round(100 + ((paper.score ?? 0) / (paper.total || quiz.num_questions)) * 900)} pts PAES`;
    }
    if (isSIMCE) {
      return `${paper.equivalent_score ?? Math.round(100 + ((paper.score ?? 0) / (paper.total || quiz.num_questions)) * 300)} pts SIMCE`;
    }
    const defaultGrade = paper.grade || (paper.total ? calculateGradeFallback(paper.score ?? 0, paper.total) : "-");
    return `Nota ${defaultGrade}`;
  };

  const getVariantLabel = () => {
    if (!quiz.evaluation_variant) return "Personalizado";
    const labels: Record<string, string> = {
      paes_m1: "PAES Competencia Matemática 1 (M1)",
      paes_m2: "PAES Competencia Matemática 2 (M2)",
      paes_lectora: "PAES Competencia Lectora",
      paes_ciencias: "PAES Ciencias",
      paes_historia: "PAES Historia",
      simce_4b_mate: "SIMCE 4° Básico - Matemática",
      simce_4b_lectura: "SIMCE 4° Básico - Lectura",
      simce_8b_mate: "SIMCE 8° Básico - Matemática",
      simce_8b_lectura: "SIMCE 8° Básico - Lectura",
      simce_2m_mate: "SIMCE II Medio - Matemática",
      simce_2m_lectura: "SIMCE II Medio - Lectura",
    };
    return labels[quiz.evaluation_variant] || quiz.evaluation_variant;
  };

  return (
    <>
      <PageHeader title={`Resultados: ${quiz.title}`} description={`Tipo de evaluación: ${getVariantLabel()}. Distribucion de puntaje, logro por alumno y exportaciones.`} />
      <div className="space-y-6">
        <KPIGrid>
          <KPI label="Alumnos" value={rows.length} />
          <KPI label="Logro Promedio" value={`${avg}%`} />
          <KPI label="Maximo Correctas" value={`${max}/${quiz.num_questions}`} />
          <KPI label="Minimo Correctas" value={`${min}/${quiz.num_questions}`} />
        </KPIGrid>
        <div className="rounded-md border border-[#e1e5ea] bg-white p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold">Exportaciones</h2>
            <a
              href={isAdmin ? `/api/export/results/${quiz.id}` : undefined}
              download
              aria-disabled={!isAdmin}
              className={`w-full rounded-md border border-[#cfd6df] px-4 py-2 text-center text-sm font-semibold sm:w-auto ${isAdmin ? "hover:bg-[#f4f6f8]" : "pointer-events-none opacity-50"}`}
            >
              Exportar CSV
            </a>
          </div>
          <p className="text-sm text-[#5b6472]">Descarga resultados reales del ensayo en CSV. Solo administradores del colegio pueden exportar.</p>
        </div>
        <DataTable
          columns={["Alumno", "Respuestas", "Resultado Equivalente", "Porcentaje", "Fecha"]}
          rows={rows}
          empty="Sin resultados para este ensayo."
          renderRow={(paper) => (
            <tr key={paper.id} className="border-b border-[#eef0f3] last:border-0">
              <td className="px-5 py-4 font-semibold">{paper.student_name ?? paper.student_id ?? "Sin identificar"}</td>
              <td className="px-5 py-4">{paper.score ?? "-"}/{paper.total ?? quiz.num_questions}</td>
              <td className="px-5 py-4 font-semibold text-[#07305f]">{getScoreDisplay(paper)}</td>
              <td className="px-5 py-4">{paper.total ? Math.round(((paper.score ?? 0) / paper.total) * 100) : 0}%</td>
              <td className="px-5 py-4 text-[#5b6472]">{new Date(paper.scanned_at).toLocaleString("es-CL")}</td>
            </tr>
          )}
          renderMobileRow={(paper) => (
            <article key={paper.id} className="rounded-md border border-[#e6e8eb] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 truncate text-base font-semibold text-[#111827]">{paper.student_name ?? paper.student_id ?? "Sin identificar"}</p>
                <span className="shrink-0 rounded bg-[#eef4ff] px-2 py-1 text-xs font-bold text-[#07305f]">{paper.total ? Math.round(((paper.score ?? 0) / paper.total) * 100) : 0}%</span>
              </div>
              <div className="mt-3 grid gap-1 text-sm text-[#5b6472]">
                <p>Respuestas: <span className="font-semibold text-[#111827]">{paper.score ?? "-"}/{paper.total ?? quiz.num_questions}</span></p>
                <p>Resultado: <span className="font-semibold text-[#07305f]">{getScoreDisplay(paper)}</span></p>
                <p className="text-xs">Fecha: {new Date(paper.scanned_at).toLocaleString("es-CL")}</p>
              </div>
            </article>
          )}
        />
      </div>
    </>
  );
}

function calculateGradeFallback(score: number, total: number): string {
  if (total <= 0) return "1.0";
  const pct = score / total;
  const exigencia = 0.6;
  const grade = pct >= exigencia
    ? ((pct - exigencia) / (1 - exigencia)) * (7.0 - 4.0) + 4.0
    : (pct / exigencia) * (4.0 - 1.0) + 1.0;
  return grade.toFixed(1);
}
