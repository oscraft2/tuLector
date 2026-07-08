import Link from "next/link";
import { notFound } from "next/navigation";
import { getDashboardContext } from "@/lib/supabase_server";
import { calculateGrade } from "@/lib/latam";

type PageProps = { params: Promise<{ quizId: string }> };

type PaperResult = {
  id: string;
  student_name: string | null;
  student_id: string | null;
  score: number | null;
  total: number | null;
  status: string | null;
  scanned_at: string;
  equivalent_score: number | null;
  grade: string | number | null;
};

/**
 * Detalle nativo de resultados por ensayo: tarjetas por alumno (no la tabla
 * de escritorio). Misma fuente de datos que /dashboard/results/[quizId].
 */
export default async function NativeQuizResultsPage({ params }: PageProps) {
  const { quizId } = await params;
  const { supabase, school } = await getDashboardContext();

  const [{ data: quiz }, { data: papers }] = await Promise.all([
    supabase.from("quizzes").select("id,title,num_questions,evaluation_type,evaluation_variant,exigencia").eq("id", quizId).eq("school_id", school.id).single(),
    supabase.from("papers").select("id,student_name,student_id,score,total,status,scanned_at,equivalent_score,grade").eq("quiz_id", quizId).neq("status", "void").order("scanned_at", { ascending: false }),
  ]);
  if (!quiz) notFound();

  const rows = (papers ?? []) as PaperResult[];
  const avg = rows.length
    ? Math.round(rows.reduce((sum, p) => sum + ((p.score ?? 0) / Math.max(1, p.total ?? quiz.num_questions)) * 100, 0) / rows.length)
    : 0;

  const isPAES = quiz.evaluation_type === "paes";
  const isSIMCE = quiz.evaluation_type === "simce";

  const scoreDisplay = (paper: PaperResult) => {
    const total = paper.total || quiz.num_questions;
    if (isPAES) return `${paper.equivalent_score ?? Math.round(100 + ((paper.score ?? 0) / total) * 900)} pts PAES`;
    if (isSIMCE) return `${paper.equivalent_score ?? Math.round(100 + ((paper.score ?? 0) / total) * 300)} pts SIMCE`;
    if (paper.grade) return `Nota ${paper.grade}`;
    const gradeResult = calculateGrade(paper.score ?? 0, total, school.country_code ?? "CL", { exigencia: (quiz.exigencia as number | undefined) ?? school.exigencia ?? 0.6 });
    return `Nota ${gradeResult.grade}`;
  };

  return (
    <main className="min-h-dvh bg-[#f5f6f8] text-[#0b1220]">
      <header className="safe-pt flex items-center gap-3 bg-[#111827] px-5 pb-5 pt-5 text-white">
        <Link href="/app/results" aria-label="Volver" transitionTypes={["nav-back"]} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 active:bg-white/20">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </Link>
        <h1 className="truncate text-lg font-black tracking-tight">{quiz.title}</h1>
      </header>

      <section className="space-y-5 px-5 py-6 pb-24">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-[#e6e8eb] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Alumnos</p>
            <p className="mt-1 text-2xl font-black text-[#111827]">{rows.length}</p>
          </div>
          <div className="rounded-2xl border border-[#e6e8eb] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Logro promedio</p>
            <p className="mt-1 text-2xl font-black text-[#111827]">{avg}%</p>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#dfe3e8] bg-white/50 p-5 text-center text-sm text-[#5b6472]">
            Sin resultados todavia para este ensayo.
          </div>
        ) : (
          <div className="grid gap-3">
            {rows.map((paper) => (
              <div key={paper.id} className="rounded-2xl border border-[#e6e8eb] bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-bold text-[#111827]">{paper.student_name ?? paper.student_id ?? "Sin identificar"}</p>
                  {paper.status === "manual_review" ? (
                    <span className="shrink-0 rounded-full bg-[#fdf3ec] px-2 py-0.5 text-[11px] font-bold text-[#9a3412]">Revisar</span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-[#eef4ff] px-2 py-0.5 text-[11px] font-bold text-[#07305f]">
                      {paper.total ? Math.round(((paper.score ?? 0) / paper.total) * 100) : 0}%
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-[#5b6472]">
                  {paper.score ?? "-"}/{paper.total ?? quiz.num_questions} · {scoreDisplay(paper)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
