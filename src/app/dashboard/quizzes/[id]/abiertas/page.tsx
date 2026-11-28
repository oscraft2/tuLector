import Link from "next/link";
import { notFound } from "next/navigation";
import { getDashboardContext } from "@/lib/supabase_server";
import { parseOpenQuestions, parseOpenQuestionRubrics } from "@/lib/quiz_constraints";
import { buildPaperCourseResolver, groupByCourse, NO_COURSE_KEY, NO_COURSE_LABEL, type PaperCourseInput } from "@/lib/paper_course";
import { canonicalRut } from "@/lib/rut";
import { formatRutConGuion } from "@/lib/export_columns";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { AbiertasFilters } from "@/components/dashboard/AbiertasFilters";
import { Pagination } from "@/components/dashboard/Pagination";
import { OpenAnswerCell } from "@/components/dashboard/OpenAnswerCell";
import { AbiertasBarraLote, AbiertasLoteProvider } from "@/components/dashboard/AbiertasLote";
import { claveCelda, cumpleEstado } from "@/lib/open_bulk";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type Paper = PaperCourseInput & {
  id: string;
  student_name: string | null;
};

type OpenAnswerRow = {
  paper_id: string;
  question: number;
  transcripcion: string | null;
  puntaje: number | null;
  max_points: number | null;
  confianza: string | null;
  legible: boolean | null;
  confirmed_points: number | null;
};

function firstParam(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

/** Coincide por nombre (substring, sin distinguir mayus/minus) o por RUT
 *  (solo digitos/K, substring) -- sin exigir un RUT valido: el profesor puede
 *  estar buscando a mitad de tipeo. */
function matchesQuery(q: string, name: string | null, rutNorm: string | null): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  if (name && name.toLowerCase().includes(needle)) return true;
  const rutNeedle = q.replace(/[^0-9kK]/g, "").toUpperCase();
  if (rutNeedle.length >= 3 && rutNorm && rutNorm.includes(rutNeedle)) return true;
  return false;
}

/**
 * Calificacion rapida de preguntas de desarrollo: filtra por curso o busca
 * por RUT/nombre, una fila por alumno, una columna por pregunta abierta. Ver
 * docs/plan-dia-abiertas.md -- pantalla nueva, separada de la tabla plana de
 * "sugerencias IA" en quizzes/[id]/page.tsx (esa se deja como esta, solo con
 * el fix de que el default pase a 0).
 */
export default async function AbiertasPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const courseParam = firstParam(sp.course);
  const q = firstParam(sp.q);
  const pageNum = Math.max(1, Number(firstParam(sp.page)) || 1);
  const estadoParam = firstParam(sp.estado);
  const preguntaParam = Number(firstParam(sp.pregunta)) || null;

  const { supabase, school } = await getDashboardContext();

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id,title,num_questions,open_questions,open_question_rubrics")
    .eq("id", id)
    .eq("school_id", school.id)
    .single();
  if (!quiz) notFound();

  const openQuestions = parseOpenQuestions(quiz.open_questions ?? "", Number(quiz.num_questions ?? 0));
  const rubrics = parseOpenQuestionRubrics(quiz.open_question_rubrics ?? "");

  const papersQuery = (select: string) =>
    supabase.from("papers").select(select).eq("quiz_id", id).neq("status", "void").order("scanned_at", { ascending: false });
  const PAPER_COLUMNS = "id,student_name,student_id,student_rut_norm";
  // `course_id` puede faltar en una BD sin migrar (20260812000000) -- el curso
  // se resuelve igual por el alumno (paper_course.ts) si falta la columna.
  const fetchPapers = async (): Promise<Paper[]> => {
    for (const select of [`${PAPER_COLUMNS},course_id`, PAPER_COLUMNS]) {
      const result = await papersQuery(select);
      if (!result.error) return (result.data ?? []) as unknown as Paper[];
    }
    return [];
  };
  const allPapers = openQuestions.length > 0 ? await fetchPapers() : [];

  // Un alumno puede tener mas de un paper en el mismo ensayo (reintento) --
  // se queda con el mas reciente (allPapers ya viene ordenado desc por scanned_at).
  const paperByStudent = new Map<string, Paper>();
  for (const paper of allPapers) {
    const rutNorm = paper.student_rut_norm ?? canonicalRut(paper.student_id ?? null);
    const key = rutNorm ?? `sin-rut:${paper.id}`;
    if (!paperByStudent.has(key)) paperByStudent.set(key, paper);
  }
  const students = [...paperByStudent.values()];

  const courseOf = await buildPaperCourseResolver(supabase, school.id, students);
  const courseGroups = groupByCourse(students, courseOf);
  const courseOptions = courseGroups.map((g) => ({ id: g.key, label: `${g.label} (${g.rows.length})` }));

  const visibleQuestions = preguntaParam && openQuestions.includes(preguntaParam) ? [preguntaParam] : openQuestions;

  const porCursoYBusqueda = students.filter((paper) => {
    if (courseParam) {
      const course = courseOf(paper);
      const key = course?.id ?? NO_COURSE_KEY;
      if (key !== courseParam) return false;
    }
    const rutNorm = paper.student_rut_norm ?? canonicalRut(paper.student_id ?? null);
    return matchesQuery(q, paper.student_name, rutNorm);
  });

  // Las respuestas se leen para toda la lista (no solo la pagina): el filtro
  // por estado y el puntaje masivo las necesitan. Por tandas, por el tope de
  // filas de una consulta.
  const openAnswers: OpenAnswerRow[] = [];
  let lecturaIncompleta = false;
  for (let i = 0; i < porCursoYBusqueda.length; i += 100) {
    const { data: oa, error } = await supabase
      .from("open_answers")
      .select("paper_id,question,transcripcion,puntaje,max_points,confianza,legible,confirmed_points")
      .in("paper_id", porCursoYBusqueda.slice(i, i + 100).map((p) => p.id));
    if (error) { lecturaIncompleta = true; break; }
    openAnswers.push(...((oa ?? []) as OpenAnswerRow[]));
  }
  const answerByPaperQuestion = new Map<string, OpenAnswerRow>();
  for (const row of openAnswers) answerByPaperQuestion.set(claveCelda(row.paper_id, row.question), row);
  const confirmadas = new Set(openAnswers.filter((r) => r.confirmed_points != null).map((r) => claveCelda(r.paper_id, r.question)));

  const filtered = porCursoYBusqueda.filter((paper) => cumpleEstado(paper.id, visibleQuestions, confirmadas, estadoParam));
  filtered.sort((a, b) => (a.student_name ?? "").localeCompare(b.student_name ?? "", "es"));

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(pageNum, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const preguntasLote = visibleQuestions
    .filter((n) => (rubrics[n]?.max_points ?? 0) > 0)
    .map((n) => ({ question: n, maxPoints: rubrics[n].max_points, completacion: rubrics[n].subtipo !== "simple" }));
  const filtro = [
    courseParam ? `curso ${courseOptions.find((c) => c.id === courseParam)?.label ?? ""}` : "todos los cursos",
    q ? `búsqueda «${q}»` : "",
    estadoParam === "pendientes" ? "con algo sin revisar" : estadoParam === "revisadas" ? "todo revisado" : "",
  ].filter(Boolean).join(", ");

  const baseQuery = new URLSearchParams();
  if (courseParam) baseQuery.set("course", courseParam);
  if (q) baseQuery.set("q", q);
  if (estadoParam) baseQuery.set("estado", estadoParam);
  if (preguntaParam) baseQuery.set("pregunta", String(preguntaParam));

  return (
    <>
      <div className="mb-3">
        <Link href={`/dashboard/quizzes/${id}`} className="text-xs font-semibold text-[#07305f] hover:underline">
          ← Volver al ensayo
        </Link>
      </div>
      <PageHeader
        eyebrow="Calificación rápida"
        title={`Preguntas de desarrollo — ${quiz.title ?? "Ensayo"}`}
        description="Filtra y confirma el puntaje de cada pregunta abierta, una por una o en lote. Una respuesta queda «sin revisar» hasta que la guardas, aunque sea en 0."
      />

      {openQuestions.length === 0 ? (
        <p className="text-sm text-[#6b7280]">Este ensayo no tiene preguntas de desarrollo configuradas.</p>
      ) : (
        <div className="space-y-4">
          <AbiertasFilters courses={courseOptions} questions={openQuestions} total={total} />

          <AbiertasLoteProvider>
          {lecturaIncompleta ? (
            <p className="text-sm font-semibold text-[#b91c1c]">No se pudieron leer los puntajes guardados: el guardado en lote queda oculto para no pisarlos. Recarga la página.</p>
          ) : filtered.length > 0 && preguntasLote.length > 0 ? (
            <AbiertasBarraLote quizId={id} preguntas={preguntasLote} paperIds={filtered.map((p) => p.id)} confirmadas={[...confirmadas]} filtro={filtro} />
          ) : null}

          {pageRows.length === 0 ? (
            <p className="text-sm text-[#6b7280]">Sin alumnos que calcen con el filtro.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-[#e1e5ea] bg-white">
              <table className="w-full text-sm">
                <thead className="bg-[#f8fafc] text-left text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                  <tr>
                    <th className="px-3 py-2">Alumno</th>
                    <th className="px-3 py-2">Curso</th>
                    {visibleQuestions.map((qNum) => (
                      <th key={qNum} className="px-3 py-2" title={rubrics[qNum]?.rubric || undefined}>
                        P{qNum} {rubrics[qNum]?.max_points ? `(máx ${rubrics[qNum].max_points})` : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((paper) => {
                    const course = courseOf(paper);
                    const rutNorm = paper.student_rut_norm ?? canonicalRut(paper.student_id ?? null);
                    return (
                      <tr key={paper.id} className="border-t border-[#eef0f3] align-top">
                        <td className="px-3 py-2">
                          <div className="font-medium">{paper.student_name || "Sin identificar"}</div>
                          <div className="text-xs text-[#8a93a1]">{formatRutConGuion(rutNorm) || "-"}</div>
                        </td>
                        <td className="px-3 py-2">{course?.name ?? NO_COURSE_LABEL}</td>
                        {visibleQuestions.map((qNum) => {
                          const oa = answerByPaperQuestion.get(`${paper.id}:${qNum}`);
                          const rubric = rubrics[qNum];
                          const maxPoints = rubric?.max_points ?? oa?.max_points ?? null;
                          const aiHint = oa?.transcripcion
                            ? `${oa.transcripcion} (IA sugiere: ${oa.puntaje ?? "-"}/${maxPoints ?? "-"})`
                            : undefined;
                          return (
                            <td key={qNum} className="px-3 py-2">
                              <OpenAnswerCell
                                key={`${paper.id}:${qNum}:${oa?.confirmed_points ?? "sr"}`}
                                paperId={paper.id}
                                question={qNum}
                                quizId={id}
                                maxPoints={maxPoints}
                                initialConfirmed={oa?.confirmed_points ?? null}
                                aiHint={aiHint}
                                aiPoints={oa?.transcripcion ? oa.puntaje : null}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          </AbiertasLoteProvider>

          <Pagination page={safePage} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} baseQuery={baseQuery} />
        </div>
      )}
    </>
  );
}
