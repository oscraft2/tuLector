import Link from "next/link";
import { getDashboardContext } from "@/lib/supabase_server";
import { KPI, KPIGrid } from "@/components/dashboard/KPI";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { QuizCompareSelector } from "./QuizCompareSelector";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<{ q1?: string; q2?: string }> };

type QuizInfo = { id: string; title: string; num_questions: number; evaluation_type: string | null; answer_key: string | null };
type PaperInfo = { score: number | null; total: number | null; student_rut_norm: string | null; student_id: string | null };

export default async function ComparePage({ searchParams }: PageProps) {
  const { supabase } = await getDashboardContext();
  const sp = ((await searchParams) ?? {}) as { q1?: string; q2?: string };

  const { data: quizList } = await supabase.from("quizzes").select("id,title,evaluation_type").is("archived_at", null).order("created_at", { ascending: false });
  const quizzes = (quizList ?? []) as QuizInfo[];

  if (quizzes.length < 2) {
    return (
      <>
        <PageHeader title="Comparar ensayos" description="Compara dos ensayos lado a lado: rendimiento, preguntas y alumnos." />
        <EmptyState
          icon="📊"
          title="Necesitas al menos 2 ensayos"
          description="Crea al menos dos ensayos para comparar su rendimiento, preguntas con mayor dificultad y evolucion de alumnos."
          action={{ label: "Crear ensayos", href: "/dashboard/quizzes" }}
        />
      </>
    );
  }

  const q1Id = sp.q1 ?? null;
  const q2Id = sp.q2 ?? null;

  let quizA: QuizInfo | null = null;
  let quizB: QuizInfo | null = null;
  let papersA: PaperInfo[] = [];
  let papersB: PaperInfo[] = [];

  if (q1Id && q2Id && q1Id !== q2Id) {
    const [{ data: a }, { data: b }, { data: pa }, { data: pb }] = await Promise.all([
      supabase.from("quizzes").select("id,title,num_questions,evaluation_type,answer_key").eq("id", q1Id).single(),
      supabase.from("quizzes").select("id,title,num_questions,evaluation_type,answer_key").eq("id", q2Id).single(),
      supabase.from("papers").select("score,total,student_rut_norm,student_id").eq("quiz_id", q1Id).in("status", ["corrected", "active", "manual_review"]),
      supabase.from("papers").select("score,total,student_rut_norm,student_id").eq("quiz_id", q2Id).in("status", ["corrected", "active", "manual_review"]),
    ]);
    quizA = (a ?? null) as QuizInfo | null;
    quizB = (b ?? null) as QuizInfo | null;
    papersA = (pa ?? []) as PaperInfo[];
    papersB = (pb ?? []) as PaperInfo[];
  }

  const hasComparison = quizA && quizB;
  const avgA = papersA.length ? Math.round(papersA.reduce((s, p) => s + ((p.score ?? 0) / Math.max(1, p.total ?? quizA!.num_questions)) * 100, 0) / papersA.length) : 0;
  const avgB = papersB.length ? Math.round(papersB.reduce((s, p) => s + ((p.score ?? 0) / Math.max(1, p.total ?? quizB!.num_questions)) * 100, 0) / papersB.length) : 0;
  const passingA = papersA.filter((p) => ((p.score ?? 0) / Math.max(1, p.total ?? 1)) >= 0.6).length;
  const passingB = papersB.filter((p) => ((p.score ?? 0) / Math.max(1, p.total ?? 1)) >= 0.6).length;

  // Per-question comparison
  const questionComparison = hasComparison ? Array.from({ length: Math.max(quizA!.num_questions, quizB!.num_questions) }, (_, i) => {
    const keyA = quizA!.answer_key?.[i] ?? null;
    const keyB = quizB!.answer_key?.[i] ?? null;
    const correctA = papersA.filter((p) => {
      const ans = (p as unknown as { answers?: { a: string }[] }).answers?.[i]?.a;
      return ans && ans === keyA;
    }).length;
    const correctB = papersB.filter((p) => {
      const ans = (p as unknown as { answers?: { a: string }[] }).answers?.[i]?.a;
      return ans && ans === keyB;
    }).length;
    const pctA = papersA.length > 0 ? Math.round((correctA / papersA.length) * 100) : 0;
    const pctB = papersB.length > 0 ? Math.round((correctB / papersB.length) * 100) : 0;
    return { q: i + 1, keyA, keyB, pctA, pctB, delta: pctB - pctA };
  }) : [];

  // Students who took both
  const studentsA = new Set(papersA.map((p) => p.student_rut_norm ?? p.student_id).filter(Boolean));
  const studentsB = new Set(papersB.map((p) => p.student_rut_norm ?? p.student_id).filter(Boolean));
  const bothStudents = [...studentsA].filter((s) => studentsB.has(s));
  const studentComparison = bothStudents.map((sid) => {
    const pa = papersA.find((p) => (p.student_rut_norm ?? p.student_id) === sid);
    const pb = papersB.find((p) => (p.student_rut_norm ?? p.student_id) === sid);
    const scoreA = pa ? ((pa.score ?? 0) / Math.max(1, pa.total ?? 1)) * 100 : 0;
    const scoreB = pb ? ((pb.score ?? 0) / Math.max(1, pb.total ?? 1)) * 100 : 0;
    return { student: sid, scoreA: Math.round(scoreA), scoreB: Math.round(scoreB), delta: Math.round(scoreB - scoreA) };
  }).sort((a, b) => b.delta - a.delta);

  return (
    <>
      <PageHeader title="Comparar ensayos" description="Elige dos ensayos para comparar rendimiento, preguntas con mayor dificultad y evolucion de alumnos que rindieron ambos." />
      <div className="space-y-6">
        <QuizCompareSelector quizzes={quizzes} q1={q1Id} q2={q2Id} />

        {!hasComparison ? (
          <EmptyState
            icon="🔍"
            title="Selecciona dos ensayos"
            description="Elige dos ensayos distintos del menu desplegable para ver la comparacion lado a lado."
          />
        ) : (
          <>
            <KPIGrid>
              <KPI label={`${quizA!.title} — Promedio`} value={`${avgA}%`} />
              <KPI label={`${quizB!.title} — Promedio`} value={`${avgB}%`} />
              <KPI label="Diferencia" value={`${avgB - avgA > 0 ? "+" : ""}${avgB - avgA}%`} />
              <KPI label="Aprobacion A" value={`${papersA.length ? Math.round((passingA / papersA.length) * 100) : 0}%`} />
              <KPI label="Aprobacion B" value={`${papersB.length ? Math.round((passingB / papersB.length) * 100) : 0}%`} />
              <KPI label="Alumnos A" value={papersA.length} />
              <KPI label="Alumnos B" value={papersB.length} />
              <KPI label="Rindieron ambos" value={bothStudents.length} />
            </KPIGrid>

            {questionComparison.length > 0 && (
              <div className="rounded-md border border-[#e1e5ea] bg-white p-5">
                <h2 className="mb-4 text-lg font-semibold">Comparacion por pregunta</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#eef0f3] text-left text-xs font-semibold text-[#5b6472]">
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Clave A</th>
                        <th className="px-3 py-2">Clave B</th>
                        <th className="px-3 py-2 text-right">% Acierto A</th>
                        <th className="px-3 py-2 text-right">% Acierto B</th>
                        <th className="px-3 py-2 text-right">Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {questionComparison.map((q) => (
                        <tr key={q.q} className="border-b border-[#f4f6f8] last:border-0">
                          <td className="px-3 py-2 font-semibold">{q.q}</td>
                          <td className="px-3 py-2 font-mono">{q.keyA ?? "-"}</td>
                          <td className="px-3 py-2 font-mono">{q.keyB ?? "-"}</td>
                          <td className="px-3 py-2 text-right">{q.pctA}%</td>
                          <td className="px-3 py-2 text-right">{q.pctB}%</td>
                          <td className={`px-3 py-2 text-right font-semibold ${q.delta > 0 ? "text-[#1a8f52]" : q.delta < 0 ? "text-[#c2410c]" : "text-[#5b6472]"}`}>
                            {q.delta > 0 ? "+" : ""}{q.delta}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {studentComparison.length > 0 && (
              <div className="rounded-md border border-[#e1e5ea] bg-white p-5">
                <h2 className="mb-4 text-lg font-semibold">Alumnos que rindieron ambos ({studentComparison.length})</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#eef0f3] text-left text-xs font-semibold text-[#5b6472]">
                        <th className="px-3 py-2">Alumno</th>
                        <th className="px-3 py-2 text-right">% {quizA!.title.split(" ").slice(0, 2).join(" ")}</th>
                        <th className="px-3 py-2 text-right">% {quizB!.title.split(" ").slice(0, 2).join(" ")}</th>
                        <th className="px-3 py-2 text-right">Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentComparison.map((s) => (
                        <tr key={s.student} className="border-b border-[#f4f6f8] last:border-0">
                          <td className="px-3 py-2 font-mono text-xs">{s.student}</td>
                          <td className="px-3 py-2 text-right">{s.scoreA}%</td>
                          <td className="px-3 py-2 text-right">{s.scoreB}%</td>
                          <td className={`px-3 py-2 text-right font-semibold ${s.delta > 0 ? "text-[#1a8f52]" : s.delta < 0 ? "text-[#c2410c]" : "text-[#5b6472]"}`}>
                            {s.delta > 0 ? "+" : ""}{s.delta}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
