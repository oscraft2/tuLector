import Link from "next/link";
import { notFound } from "next/navigation";
import { getDashboardContext } from "@/lib/supabase_server";
import { calculateGrade } from "@/lib/latam";
import { buildPaperCourseResolver, groupByCourse } from "@/lib/paper_course";
import { equivalencesForCourse } from "@/lib/course_level";
import { achievementPct, paesEquivalence, simceEquivalence, paesTableForQuiz } from "@/lib/paes_scale";
import { PaperAssignSheet } from "@/components/native/PaperAssignSheet";

type PageProps = { params: Promise<{ quizId: string }> };

type PaperResult = {
  id: string;
  student_name: string | null;
  student_id: string | null;
  student_rut_norm: string | null;
  course_id: string | null;
  score: number | null;
  total: number | null;
  status: string | null;
  scanned_at: string;
  equivalent_score: number | null;
  grade: string | number | null;
  name_img_url: string | null;
  image_url: string | null;
  /** Puntaje ponderado (migracion quiz_points); ausente en una BD sin migrar. */
  points?: number | null;
  points_total?: number | null;
};

const PAPER_BASE = "id,student_name,student_id,student_rut_norm,score,total,status,scanned_at,equivalent_score,grade,name_img_url,image_url";
// `course_id` (20260812000000) y `points`/`points_total` (20260813000000) pueden
// faltar en una BD sin migrar, en cualquier combinacion: se prueba de mas a
// menos columnas. Sin course_id el curso se resuelve igual por el alumno, y sin
// points la equivalencia sale del conteo de correctas.
const PAPER_SELECTS = [
  `${PAPER_BASE},course_id,points,points_total`,
  `${PAPER_BASE},course_id`,
  `${PAPER_BASE},points,points_total`,
  PAPER_BASE,
];

/**
 * Detalle nativo de resultados por ensayo: tarjetas por alumno, AGRUPADAS por
 * el curso del alumno (no por el curso de la hoja) -- un curso puede rendir con
 * la hoja de otro, ver src/lib/paper_course.ts. Misma fuente de datos que
 * /dashboard/results/[quizId].
 */
export default async function NativeQuizResultsPage({ params }: PageProps) {
  const { quizId } = await params;
  const { supabase, school } = await getDashboardContext();

  const papersQuery = (select: string) =>
    supabase.from("papers").select(select).eq("quiz_id", quizId).neq("status", "void").order("scanned_at", { ascending: false });

  const fetchPapers = async () => {
    for (const select of PAPER_SELECTS) {
      const result = await papersQuery(select);
      if (!result.error) return result.data;
    }
    return null;
  };

  const [{ data: quiz }, papers] = await Promise.all([
    // `subject` y `grade` deciden que tabla del DEMRE aplica y si corresponde
    // mostrar SIMCE (ver equivalencesForCourse / paesTableForQuiz).
    supabase.from("quizzes").select("id,title,num_questions,evaluation_type,evaluation_variant,exigencia,subject,grade").eq("id", quizId).eq("school_id", school.id).single(),
    fetchPapers(),
  ]);
  if (!quiz) notFound();

  const rows = ((papers ?? []) as unknown as PaperResult[]).map((p) => ({ ...p, course_id: p.course_id ?? null }));
  const courseOf = await buildPaperCourseResolver(supabase, school.id, rows);
  const groups = groupByCourse(rows, courseOf);
  const avg = rows.length
    ? Math.round(rows.reduce((sum, p) => sum + ((p.score ?? 0) / Math.max(1, p.total ?? quiz.num_questions)) * 100, 0) / rows.length)
    : 0;

  const scoreDisplay = (paper: PaperResult) => {
    const total = paper.total || quiz.num_questions;
    if (paper.grade) return `Nota ${paper.grade}`;
    const gradeResult = calculateGrade(paper.score ?? 0, total, school.country_code ?? "CL", { exigencia: (quiz.exigencia as number | undefined) ?? school.exigencia ?? 0.6 });
    return `Nota ${gradeResult.grade}`;
  };

  // Equivalencias: PAES con la tabla del DEMRE que corresponda a este ensayo, y
  // SIMCE solo hasta II medio. Mismo criterio que la tabla web del ensayo.
  const showEquivalence = equivalencesForCourse(quiz.grade as string | null);
  const paesTable = paesTableForQuiz(quiz);

  const equivalenceOf = (paper: PaperResult) => {
    const pct = achievementPct(paper);
    if (pct === null) return null;
    return {
      paes: paesEquivalence(pct, paesTable),
      simce: simceEquivalence(pct),
    };
  };

  // Promedio PAES del grupo: se promedian los puntajes de cada alumno, no el
  // puntaje del porcentaje promedio -- la tabla no es lineal, asi que no dan lo
  // mismo, y lo que el profesor entiende por "el PAES del curso" es lo primero.
  const paesScores = rows.map(equivalenceOf).filter((e): e is NonNullable<typeof e> => e !== null).map((e) => e.paes.score);
  const avgPaes = paesScores.length ? Math.round(paesScores.reduce((a, b) => a + b, 0) / paesScores.length) : null;

  return (
    <main className="min-h-dvh bg-[#f5f6f8] text-[#0b1220]">
      <header className="safe-pt flex items-center gap-3 bg-[#111827] px-5 pb-5 pt-5 text-white">
        <Link href="/app/results" aria-label="Volver" transitionTypes={["nav-back"]} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 active:bg-white/20">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </Link>
        <h1 className="truncate text-lg font-black tracking-tight">{quiz.title}</h1>
      </header>

      <section className="space-y-5 px-5 py-6 pb-24">
        {/* Dos recuadros sin equivalencia, tres con ella. Las etiquetas se
            acortan al pasar a tres para que ninguna corte en pantalla angosta. */}
        <div className={`grid gap-3 ${avgPaes !== null && showEquivalence.paes ? "grid-cols-3" : "grid-cols-2"}`}>
          <div className="rounded-2xl border border-[#e6e8eb] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Alumnos</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-[#111827]">{rows.length}</p>
          </div>
          <div className="rounded-2xl border border-[#e6e8eb] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#6b7280]">
              {avgPaes !== null && showEquivalence.paes ? "Logro" : "Logro promedio"}
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums text-[#111827]">{avg}%</p>
          </div>
          {avgPaes !== null && showEquivalence.paes && (
            <div className="rounded-2xl border border-[#e6e8eb] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#6b7280]">PAES</p>
              <p className="mt-1 text-2xl font-black tabular-nums text-[#111827]">{avgPaes}</p>
            </div>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#dfe3e8] bg-white/50 p-5 text-center text-sm text-[#5b6472]">
            Sin resultados todavia para este ensayo.
          </div>
        ) : (
          // Un solo curso (el caso normal): lista plana, sin encabezados que no
          // aportan. Varios cursos con la misma hoja: cada uno con su propio
          // bloque y su promedio.
          <div className="space-y-6">
            {groups.map((group) => {
              const groupAvg = Math.round(
                group.rows.reduce((sum, p) => sum + ((p.score ?? 0) / Math.max(1, p.total ?? quiz.num_questions)) * 100, 0) / group.rows.length,
              );
              return (
                <div key={group.key} className="space-y-3">
                  {groups.length > 1 && (
                    <div className="flex items-baseline justify-between gap-3 border-b border-[#e6e8eb] pb-1">
                      <p className="text-sm font-black text-[#111827]">{group.label}</p>
                      <p className="shrink-0 text-xs font-semibold text-[#5b6472]">
                        {group.rows.length} {group.rows.length === 1 ? "alumno" : "alumnos"} · {groupAvg}%
                      </p>
                    </div>
                  )}
                  <div className="grid gap-3">
                    {group.rows.map((paper) => (
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
                        {/* Equivalencias: una linea propia, mas tenue que la
                            nota, para que se lea como referencia y no compita
                            con el dato principal. Se omite entera en una hoja
                            sin puntaje (sin identificar). */}
                        {(() => {
                          const eq = equivalenceOf(paper);
                          if (!eq) return null;
                          return (
                            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold tabular-nums text-[#8a93a1]">
                              {showEquivalence.paes && (
                                <span>PAES <span className="text-[#5b6472]">{eq.paes.score}</span></span>
                              )}
                              {showEquivalence.paes && showEquivalence.simce && (
                                <span aria-hidden className="text-[#d5dae0]">·</span>
                              )}
                              {showEquivalence.simce && (
                                <span>SIMCE <span className="text-[#5b6472]">{eq.simce.score}{eq.simce.aproximado ? "~" : ""}</span></span>
                              )}
                            </p>
                          );
                        })()}
                        {/* Identificar o corregir el alumno sin salir de la app
                            (la APK se basta sola: nada de mandar al dashboard web). */}
                        <PaperAssignSheet
                          paperId={paper.id}
                          currentStudentName={paper.student_name ?? paper.student_id ?? null}
                          assigned={paper.status !== "manual_review"}
                          nameImgUrl={paper.name_img_url}
                          photoUrl={paper.image_url}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
