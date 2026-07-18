import Link from "next/link";
import { notFound } from "next/navigation";
import { getDashboardContext } from "@/lib/supabase_server";
import { KPI, KPIGrid } from "@/components/dashboard/KPI";
import { DataTable } from "@/components/dashboard/DataTable";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { calculateGrade } from "@/lib/latam";
import { canonicalRut } from "@/lib/rut";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

type StudentRow = { id: string; name: string; rut: string | null; student_id: string | null; rut_normalized: string | null };

type PaperRow = {
  score: number | null; total: number | null;
  grade: string | number | null;
  equivalent_score: number | null;
  scanned_at: string;
  student_rut_norm: string | null; student_id: string | null;
  quizzes: { id: string; title: string; num_questions: number; evaluation_type: string | null };
};

type QuizStat = { quizId: string; title: string; evType: string | null; count: number; avgPct: number; avgEquivalent: number };

function isNotaType(evType: string | null) {
  return evType !== "paes" && evType !== "simce";
}

export default async function CourseDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { supabase, school } = await getDashboardContext();

  const [{ data: course }, { data: students }] = await Promise.all([
    supabase.from("courses").select("id,name,grade").eq("id", id).single(),
    supabase.from("students").select("id,name,rut,student_id,rut_normalized").eq("course_id", id).order("name"),
  ]);

  if (!course) notFound();
  const studentList = (students ?? []) as StudentRow[];

  const studentRutNorms = studentList
    .map((s) => s.rut_normalized ?? canonicalRut(s.rut) ?? canonicalRut(s.student_id))
    .filter(Boolean);

  let papers: PaperRow[] = [];
  if (studentRutNorms.length > 0) {
    const { data: papersData } = await supabase
      .from("papers")
      .select("score,total,grade,equivalent_score,scanned_at,student_rut_norm,student_id,quizzes(id,title,num_questions,evaluation_type)")
      .in("student_rut_norm", studentRutNorms)
      .in("status", ["corrected", "active", "manual_review"])
      .order("scanned_at", { ascending: false });
    papers = (papersData ?? []) as unknown as PaperRow[];
  }

  const papersByStudent: Record<string, { sum: number; count: number; grades: number[]; lastQuiz: string | null; lastDate: string | null }> = {};
  const quizMap = new Map<string, QuizStat>();

  for (const paper of papers) {
    const studentKey = paper.student_rut_norm ?? paper.student_id ?? "unknown";
    if (!papersByStudent[studentKey]) {
      papersByStudent[studentKey] = { sum: 0, count: 0, grades: [], lastQuiz: null, lastDate: null };
    }
    const pct = ((paper.score ?? 0) / Math.max(1, paper.total ?? 1)) * 100;
    const evType = paper.quizzes?.evaluation_type ?? null;
    papersByStudent[studentKey].sum += pct;
    papersByStudent[studentKey].count++;
    // "Aprobado" (nota >= 4.0) solo aplica a ensayos personalizados -- PAES
    // no tiene concepto de aprobacion (es puntaje de admision) y SIMCE es
    // diagnostico, no un examen que se aprueba/reprueba.
    if (paper.grade && isNotaType(evType)) papersByStudent[studentKey].grades.push(Number(paper.grade));
    if (!papersByStudent[studentKey].lastDate || paper.scanned_at > papersByStudent[studentKey].lastDate!) {
      papersByStudent[studentKey].lastDate = paper.scanned_at;
      papersByStudent[studentKey].lastQuiz = paper.quizzes?.title ?? null;
    }

    const quiz = paper.quizzes;
    if (quiz?.id) {
      if (!quizMap.has(quiz.id)) {
        quizMap.set(quiz.id, { quizId: quiz.id, title: quiz.title, evType: quiz.evaluation_type, count: 0, avgPct: 0, avgEquivalent: 0 });
      }
      const qs = quizMap.get(quiz.id)!;
      qs.count++;
      qs.avgPct += pct;
      qs.avgEquivalent += paper.equivalent_score ?? 0;
    }
  }

  for (const qs of quizMap.values()) {
    qs.avgPct = Math.round(qs.avgPct / qs.count);
    qs.avgEquivalent = Math.round(qs.avgEquivalent / qs.count);
  }

  const quizStats = [...quizMap.values()].sort((a, b) => b.count - a.count);

  // Nunca promediar junto ensayos personalizados (%) con PAES/SIMCE (puntaje
  // equivalente 100-1000/100-400) -- "Promedio del curso" queda restringido
  // a ensayos personalizados, igual criterio que el perfil de alumno.
  const notaPapers = papers.filter((p) => isNotaType(p.quizzes?.evaluation_type ?? null));
  const courseAvg = notaPapers.length ? Math.round(notaPapers.reduce((s, p) => s + ((p.score ?? 0) / Math.max(1, p.total ?? 1)) * 100, 0) / notaPapers.length) : 0;
  const paesPapers = papers.filter((p) => p.quizzes?.evaluation_type === "paes" && p.equivalent_score != null);
  const simcePapers = papers.filter((p) => p.quizzes?.evaluation_type === "simce" && p.equivalent_score != null);
  const avgPaesCourse = paesPapers.length ? Math.round(paesPapers.reduce((s, p) => s + (p.equivalent_score ?? 0), 0) / paesPapers.length) : null;
  const avgSimceCourse = simcePapers.length ? Math.round(simcePapers.reduce((s, p) => s + (p.equivalent_score ?? 0), 0) / simcePapers.length) : null;
  const passingCount = studentList.filter((s) => {
    const r = s.rut_normalized ?? canonicalRut(s.rut) ?? canonicalRut(s.student_id);
    if (!r) return false;
    const stats = papersByStudent[r];
    if (!stats) return false;
    return stats.grades.length > 0 && stats.grades.every((g) => g >= 4.0);
  }).length;

  const passingRate = studentList.length > 0 ? Math.round((passingCount / studentList.length) * 100) : 0;

  const studentWithStats = studentList.map((s) => {
    const r = s.rut_normalized ?? canonicalRut(s.rut) ?? canonicalRut(s.student_id);
    const stats = r ? papersByStudent[r] : null;
    const avgPct = stats ? Math.round(stats.sum / stats.count) : 0;
    const trend = stats && stats.grades.length >= 2
      ? (stats.grades[0] >= stats.grades[1] ? "↑" : stats.grades[0] < stats.grades[1] ? "↓" : "→")
      : "—";
    return { ...s, avgPct, count: stats?.count ?? 0, lastQuiz: stats?.lastQuiz ?? null, trend };
  });

  return (
    <>
      <PageHeader title={course.name} description={`Detalle del curso. ${studentList.length} alumno${studentList.length === 1 ? "" : "s"}, ${papers.length} hoja${papers.length === 1 ? "" : "s"} escaneada${papers.length === 1 ? "" : "s"}.`} />

      <div className="space-y-6">
        <KPIGrid>
          <KPI label="Alumnos" value={studentList.length} />
          <KPI label="Promedio del curso" value={`${courseAvg}%`} detail={paesPapers.length || simcePapers.length ? "ensayos personalizados" : undefined} />
          <KPI label="Hojas escaneadas" value={papers.length} />
          <KPI label="Aprobacion" value={`${passingRate}%`} />
          {avgPaesCourse != null && <KPI label="Promedio PAES" value={`${avgPaesCourse} pts`} />}
          {avgSimceCourse != null && <KPI label="Promedio SIMCE" value={`${avgSimceCourse} pts`} />}
        </KPIGrid>

        {quizStats.length > 0 && (
          <DataTable
            columns={["Ensayo", "Tipo", "Alumnos", "Promedio", "Accion"]}
            rows={quizStats}
            empty=""
            renderRow={(qs) => {
              const label = qs.evType === "paes" ? "PAES" : qs.evType === "simce" ? "SIMCE" : "Personalizado";
              const scoreLabel = isNotaType(qs.evType) ? `${qs.avgPct}%` : `${qs.avgEquivalent} pts`;
              return (
                <tr key={qs.quizId} className="border-b border-[#eef0f3] last:border-0">
                  <td className="px-5 py-4 font-semibold text-[#07305f]">{qs.title}</td>
                  <td className="px-5 py-4"><span className="rounded bg-[#f4f6f8] px-2 py-0.5 text-xs font-semibold">{label}</span></td>
                  <td className="px-5 py-4 text-[#5b6472]">{qs.count}</td>
                  <td className="px-5 py-4 font-semibold">{scoreLabel}</td>
                  <td className="px-5 py-4">
                    <Link href={`/dashboard/results/${qs.quizId}`} className="text-xs font-semibold text-[#07305f] underline">Resultados</Link>
                  </td>
                </tr>
              );
            }}
            renderMobileRow={(qs) => {
              const scoreLabel = isNotaType(qs.evType) ? `${qs.avgPct}%` : `${qs.avgEquivalent} pts`;
              return (
                <article className="rounded-md border border-[#e6e8eb] bg-white p-4 shadow-sm">
                  <p className="font-semibold text-[#111827]">{qs.title}</p>
                  <div className="mt-2 grid gap-1 text-sm text-[#5b6472]">
                    <p>Promedio: <span className="font-semibold">{scoreLabel}</span> · {qs.count} alumno{qs.count === 1 ? "" : "s"}</p>
                  </div>
                  <Link href={`/dashboard/results/${qs.quizId}`} className="mt-2 inline-block text-xs font-semibold text-[#07305f] underline">Ver resultados</Link>
                </article>
              );
            }}
          />
        )}

        <DataTable
          columns={["Alumno", "Promedio", "Lecturas", "Ultimo ensayo", "Tendencia", "Accion"]}
          rows={studentWithStats}
          empty="Sin alumnos asignados a este curso."
          renderRow={(s) => (
            <tr key={s.id} className="border-b border-[#eef0f3] last:border-0">
              <td className="px-5 py-4 font-semibold">
                <Link href={`/dashboard/students/${s.id}`} className="text-[#07305f] hover:underline">{s.name}</Link>
              </td>
              <td className="px-5 py-4 font-semibold">{s.avgPct}%</td>
              <td className="px-5 py-4 text-[#5b6472]">{s.count}</td>
              <td className="px-5 py-4 text-[#5b6472] text-xs">{s.lastQuiz ?? "-"}</td>
              <td className="px-5 py-4"><span className="text-sm">{s.trend}</span></td>
              <td className="px-5 py-4">
                <Link href={`/dashboard/students/${s.id}`} className="text-xs font-semibold text-[#07305f] underline">Perfil</Link>
              </td>
            </tr>
          )}
          renderMobileRow={(s) => (
            <article className="rounded-md border border-[#e6e8eb] bg-white p-4 shadow-sm">
              <Link href={`/dashboard/students/${s.id}`} className="text-base font-semibold text-[#07305f] hover:underline">{s.name}</Link>
              <div className="mt-2 grid gap-1 text-sm text-[#5b6472]">
                <p>Promedio: <span className="font-semibold text-[#111827]">{s.avgPct}%</span></p>
                <p>{s.count} lectura{s.count === 1 ? "" : "s"} · {s.trend}</p>
                {s.lastQuiz && <p className="text-xs truncate">Ultimo: {s.lastQuiz}</p>}
              </div>
            </article>
          )}
        />
      </div>
    </>
  );
}
