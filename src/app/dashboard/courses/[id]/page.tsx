import Link from "next/link";
import { notFound } from "next/navigation";
import { getDashboardContext } from "@/lib/supabase_server";
import { KPI, KPIGrid } from "@/components/dashboard/KPI";
import { DataTable } from "@/components/dashboard/DataTable";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { CourseResultsFilter } from "@/components/dashboard/CourseResultsFilter";
import { canonicalRut } from "@/lib/rut";
import { isNotaType, evaluationLabel } from "@/lib/evaluation_types";
import { buildCourseReportData, latestEquivalentByStudent } from "@/lib/course_report";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ evalType?: string; quizId?: string; from?: string; to?: string; scoreMin?: string; scoreMax?: string }>;
};

type QuizStat = { quizId: string; title: string; evType: string | null; count: number; avgPct: number; avgEquivalent: number };

export default async function CourseDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const filters = {
    evalType: sp.evalType || null,
    quizId: sp.quizId || null,
    from: sp.from || null,
    to: sp.to || null,
    scoreMin: sp.scoreMin ? Number(sp.scoreMin) : null,
    scoreMax: sp.scoreMax ? Number(sp.scoreMax) : null,
  };

  const { supabase, isAdmin } = await getDashboardContext();
  const { course, studentList, allPapers, filteredPapers } = await buildCourseReportData(supabase, id, filters);

  if (!course) notFound();

  const paesEquivByStudent = latestEquivalentByStudent(allPapers, "paes");
  const simceEquivByStudent = latestEquivalentByStudent(allPapers, "simce");

  // Ensayos disponibles para el selector del filtro: los rendidos en el curso
  // (mismo universo que hoy alimenta la tabla "ensayos rendidos").
  const quizOptions = [...new Map(allPapers.filter((p) => p.quizzes).map((p) => [p.quizzes!.id, p.quizzes!])).values()]
    .map((q) => ({ id: q.id, title: q.title, evaluation_type: q.evaluation_type }));

  const papersByStudent: Record<string, { sum: number; count: number; grades: number[]; lastQuiz: string | null; lastDate: string | null }> = {};
  const quizMap = new Map<string, QuizStat>();

  for (const paper of filteredPapers) {
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
  const notaPapers = filteredPapers.filter((p) => isNotaType(p.quizzes?.evaluation_type ?? null));
  const courseAvg = notaPapers.length ? Math.round(notaPapers.reduce((s, p) => s + ((p.score ?? 0) / Math.max(1, p.total ?? 1)) * 100, 0) / notaPapers.length) : 0;
  const paesPapers = filteredPapers.filter((p) => p.quizzes?.evaluation_type === "paes" && p.equivalent_score != null);
  const simcePapers = filteredPapers.filter((p) => p.quizzes?.evaluation_type === "simce" && p.equivalent_score != null);
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
    return {
      ...s,
      avgPct,
      count: stats?.count ?? 0,
      lastQuiz: stats?.lastQuiz ?? null,
      trend,
      equivPaes: r ? paesEquivByStudent[r] ?? null : null,
      equivSimce: r ? simceEquivByStudent[r] ?? null : null,
    };
  });

  const exportQuery = new URLSearchParams();
  if (filters.evalType) exportQuery.set("evalType", filters.evalType);
  if (filters.quizId) exportQuery.set("quizId", filters.quizId);
  if (filters.from) exportQuery.set("from", filters.from);
  if (filters.to) exportQuery.set("to", filters.to);
  if (filters.scoreMin != null) exportQuery.set("scoreMin", String(filters.scoreMin));
  if (filters.scoreMax != null) exportQuery.set("scoreMax", String(filters.scoreMax));

  return (
    <>
      <PageHeader title={course.name} description={`Detalle del curso. ${studentList.length} alumno${studentList.length === 1 ? "" : "s"}, ${filteredPapers.length} hoja${filteredPapers.length === 1 ? "" : "s"} escaneada${filteredPapers.length === 1 ? "" : "s"}.`} />

      <div className="space-y-6">
        <CourseResultsFilter quizzes={quizOptions} />

        <KPIGrid>
          <KPI label="Alumnos" value={studentList.length} />
          <KPI label="Promedio del curso" value={`${courseAvg}%`} detail={paesPapers.length || simcePapers.length ? "ensayos personalizados" : undefined} />
          <KPI label="Hojas escaneadas" value={filteredPapers.length} />
          <KPI label="Aprobacion" value={`${passingRate}%`} />
          {avgPaesCourse != null && <KPI label="Promedio PAES" value={`${avgPaesCourse} pts`} />}
          {avgSimceCourse != null && <KPI label="Promedio SIMCE" value={`${avgSimceCourse} pts`} />}
        </KPIGrid>

        <div className="rounded-md border border-[#e1e5ea] bg-white p-5">
          <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold">Exportaciones</h2>
            <div className="flex gap-2">
              <a
                href={isAdmin ? `/api/export/course/${id}?${exportQuery.toString()}&format=csv` : undefined}
                download
                aria-disabled={!isAdmin}
                className={`rounded-md border border-[#cfd6df] px-4 py-2 text-center text-sm font-semibold ${isAdmin ? "hover:bg-[#f4f6f8]" : "pointer-events-none opacity-50"}`}
              >
                Exportar CSV
              </a>
              <a
                href={isAdmin ? `/api/export/course/${id}?${exportQuery.toString()}&format=xlsx` : undefined}
                download
                aria-disabled={!isAdmin}
                className={`rounded-md border border-[#cfd6df] px-4 py-2 text-center text-sm font-semibold ${isAdmin ? "hover:bg-[#f4f6f8]" : "pointer-events-none opacity-50"}`}
              >
                Exportar Excel
              </a>
            </div>
          </div>
          <p className="text-sm text-[#5b6472]">Exporta los resultados del curso respetando el filtro activo. Solo administradores del colegio pueden exportar.</p>
        </div>

        {quizStats.length > 0 && (
          <DataTable
            columns={["Ensayo", "Tipo", "Alumnos", "Promedio", "Accion"]}
            rows={quizStats}
            empty=""
            renderRow={(qs) => {
              const label = evaluationLabel(qs.evType);
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

        <div>
          <h2 className="mb-2 text-lg font-semibold text-[#111827]">Equivalencia PAES / SIMCE</h2>
          <p className="mb-3 text-xs text-[#8b93a1]">Ultimo puntaje equivalente de cada alumno, independiente del filtro de arriba y del ensayo de origen.</p>
          <DataTable
            columns={["Alumno", "Equiv. PAES", "Equiv. SIMCE"]}
            rows={studentWithStats}
            empty="Sin alumnos asignados a este curso."
            renderRow={(s) => (
              <tr key={`equiv-${s.id}`} className="border-b border-[#eef0f3] last:border-0">
                <td className="px-5 py-4 font-semibold">
                  <Link href={`/dashboard/students/${s.id}`} className="text-[#07305f] hover:underline">{s.name}</Link>
                </td>
                <td className="px-5 py-4">{s.equivPaes != null ? `${s.equivPaes} pts` : "—"}</td>
                <td className="px-5 py-4">{s.equivSimce != null ? `${s.equivSimce} pts` : "—"}</td>
              </tr>
            )}
          />
        </div>

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
