import Link from "next/link";
import { notFound } from "next/navigation";
import { getDashboardContext } from "@/lib/supabase_server";
import { calculateGrade } from "@/lib/latam";
import { DataTable } from "@/components/dashboard/DataTable";
import { StatusPill } from "@/components/AppShell";
import { startScanForQuiz, confirmOpenAnswer } from "@/app/dashboard/actions";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { QuizStats } from "@/components/dashboard/QuizStats";
import { canonicalRut } from "@/lib/rut";
import { PrintButton } from "@/components/dashboard/PrintButton";
import { AnswerKeyGrid } from "@/components/dashboard/AnswerKeyGrid";
import { parseOpenQuestions, countMissingKeySlots } from "@/lib/quiz_constraints";
import { parseSheetMode, compactModeIssue } from "@/lib/sheet_mode";
import { buildPaperCourseResolver } from "@/lib/paper_course";
import { findMisplacedPapers } from "@/lib/paper_reroute";
import { reroutePapersAction } from "@/app/dashboard/papers/actions";
import { ReroutePapersCard } from "@/components/dashboard/ReroutePapersCard";
import { ExportPanel, type ExportTemplateOption } from "@/components/dashboard/ExportPanel";
import { fetchExportPresets } from "@/lib/export_presets";
import { equivalencesForCourse } from "@/lib/course_level";
import { achievementPct, paesEquivalence, simceEquivalence } from "@/lib/paes_scale";

export const dynamic = "force-dynamic";

/** Plantillas de exportacion del colegio. Lista vacia si la migracion
 *  20260813000002_export_templates.sql no se aplico todavia. */
async function fetchExportTemplates(
  supabase: Awaited<ReturnType<typeof getDashboardContext>>["supabase"],
  schoolId: string,
): Promise<ExportTemplateOption[]> {
  const { data, error } = await supabase
    .from("export_templates")
    .select("id,name,columns,header_labels,per_question,separator,format,is_default")
    .eq("school_id", schoolId)
    .order("name");
  if (error || !data) return [];
  return data.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    columns: Array.isArray(row.columns) ? row.columns.map(String) : [],
    headerLabels: (row.header_labels as Record<string, string> | null) ?? null,
    perQuestion: Array.isArray(row.per_question) ? row.per_question.map(String) : null,
    separator: (row.separator as string | null) ?? null,
    format: (row.format as string | null) ?? null,
    isDefault: row.is_default === true,
  }));
}

type PageProps = { params: Promise<{ id: string }> };

type QuizPaper = {
  id: string;
  student_name: string | null;
  student_id: string | null;
  student_rut_norm: string | null;
  course_id?: string | null;
  score: number | null;
  total: number | null;
  status: string | null;
  scanned_at: string;
  equivalent_score: number | null;
  grade: string | number | null;
  answers: unknown;
  /** Puntaje ponderado (migracion quiz_points). Ausentes en una BD sin migrar. */
  points?: number | null;
  points_total?: number | null;
};

export default async function QuizDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { supabase, school, isAdmin } = await getDashboardContext();
  const papersQuery = (select: string) =>
    supabase.from("papers").select(select).eq("quiz_id", id).order("scanned_at", { ascending: false });
  const PAPER_COLUMNS = "id,student_name,student_id,student_rut_norm,score,total,status,scanned_at,equivalent_score,grade,answers";

  // `course_id` (20260812000000) y `points`/`points_total` (20260813000000)
  // pueden faltar en una BD sin migrar, en cualquier combinacion: se prueban de
  // mas a menos columnas. Sin course_id el curso se resuelve igual por el alumno
  // (paper_course.ts) y sin points la tabla muestra solo correctas, como antes.
  const fetchPapers = async () => {
    const attempts = [
      `${PAPER_COLUMNS},points,points_total,course_id`,
      `${PAPER_COLUMNS},course_id`,
      `${PAPER_COLUMNS},points,points_total`,
      PAPER_COLUMNS,
    ];
    for (const select of attempts) {
      const result = await papersQuery(select);
      if (!result.error) return result.data;
    }
    return null;
  };

  const [{ data: quiz }, papers, { data: metadata }, { data: students }] = await Promise.all([
    supabase.from("quizzes").select("*").eq("id", id).single(),
    fetchPapers(),
    supabase.from("question_metadata").select("question_number,axis_name,skill_name,difficulty").eq("quiz_id", id).order("question_number"),
    supabase.from("students").select("id,rut,student_id,rut_normalized").eq("school_id", school.id),
  ]);
  if (!quiz) notFound();
  const quizPapers = (papers ?? []) as unknown as QuizPaper[];
  // Curso REAL del alumno (la hoja no manda: un curso puede rendir con la hoja
  // de otro -- ver src/lib/paper_course.ts).
  const courseOf = await buildPaperCourseResolver(supabase, school.id, quizPapers);
  // Hojas que deberian estar en otro ensayo del mismo lote (ver el aviso abajo).
  const misplaced = await findMisplacedPapers(supabase, school.id, id);
  const avg = quizPapers.length ? Math.round(quizPapers.reduce((s, p) => s + ((p.score ?? 0) / Math.max(1, p.total ?? quiz.num_questions)) * 100, 0) / quizPapers.length) : 0;
  // Preguntas de desarrollo: su slot de clave es "-" fijo — no cuentan como
  // "clave incompleta" ni tienen letra en la grilla.
  const openQuestions = parseOpenQuestions(quiz.open_questions ?? "", Number(quiz.num_questions ?? 0));
  const openSet0 = new Set(openQuestions.map((q) => q - 1));
  // Mismo criterio que el listado de ensayos (quiz_constraints): una pregunta
  // de desarrollo lleva "-" en la clave y eso NO es un hueco.
  const missingClosed = countMissingKeySlots(quiz);
  const keyIncomplete = missingClosed > 0;
  // Formato de la hoja (migracion sheet_mode): decide si "Generar" ofrece la
  // hoja completa o el bloque pegable. `compactIssue` es el mismo criterio que
  // valida el servidor al guardar el ensayo.
  const isCompact = parseSheetMode(quiz.sheet_mode) === "compact";
  const compactIssue = compactModeIssue(Number(quiz.num_questions ?? 0), Number(quiz.options_per_question ?? 5), openQuestions.length);

  // Sugerencias de la IA para las preguntas de desarrollo (Fase 3, docs/plan-
  // correccion-ia-abiertas.md) -- consulta aparte porque open_answers no tiene
  // quiz_id (se cuelga de paper_id). Si la migracion aun no se aplico (tabla
  // no existe todavia), se degrada a lista vacia en vez de romper la pagina.
  type OpenAnswerRow = {
    paper_id: string; question: number; transcripcion: string | null; puntaje: number | null;
    max_points: number | null; confianza: string | null; legible: boolean | null; confirmed_points: number | null;
  };
  let openAnswers: OpenAnswerRow[] = [];
  if (openQuestions.length > 0 && quizPapers.length > 0) {
    const { data: oa, error: oaError } = await supabase
      .from("open_answers")
      .select("paper_id,question,transcripcion,puntaje,max_points,confianza,legible,confirmed_points")
      .in("paper_id", quizPapers.map((p) => p.id));
    if (!oaError) openAnswers = (oa ?? []) as OpenAnswerRow[];
  }
  const paperNameById = new Map(quizPapers.map((p) => [p.id, p.student_name || p.student_id || "Sin identificar"]));

  // Opciones del panel de exportacion. Ambas se degradan a lista vacia si la
  // tabla no existe todavia: sin plantillas ni presets el panel sigue
  // exportando con las columnas que elija el profesor.
  const exportTemplates = await fetchExportTemplates(supabase, school.id);
  const exportPresets = (await fetchExportPresets(supabase, school.country_code ?? "CL")).map((preset) => ({
    id: preset.id,
    name: preset.name,
    description: preset.description,
    columns: preset.spec.columns,
  }));

  const resolveGrade = (score: number, total: number) => {
    const gradeResult = calculateGrade(score, total, school.country_code ?? "CL", {
      exigencia: (quiz.exigencia as number | undefined) ?? school.exigencia ?? 0.60,
    });
    return String(gradeResult.grade);
  };

  // `isPAES`/`isSIMCE` se fueron con la columna "Resultado Equivalente": ahora
  // PAES y SIMCE tienen columna propia y se muestran segun el NIVEL del curso,
  // no segun el tipo del ensayo. QuizStats recibe el quiz entero y resuelve lo
  // suyo por su cuenta.
  const studentIdByRut = new Map<string, string>();
  for (const student of students ?? []) {
    const rutNorm = student.rut_normalized ?? canonicalRut(student.rut) ?? canonicalRut(student.student_id);
    if (rutNorm) studentIdByRut.set(rutNorm, student.id);
  }

  const studentHrefForPaper = (paper: { student_rut_norm?: string | null; student_id?: string | null }) => {
    const rutNorm = paper.student_rut_norm ?? canonicalRut(paper.student_id);
    const studentId = rutNorm ? studentIdByRut.get(rutNorm) : null;
    return studentId ? `/dashboard/students/${studentId}` : null;
  };

  // ¿Este ensayo pondera? Si ninguna pregunta vale distinto de 1 y las abiertas
  // no suman, `points` coincide con `score` y la tabla se ve igual que siempre.
  const isWeighted = quizPapers.some(
    (p) => p.points != null && p.points_total != null && (p.points !== p.score || p.points_total !== p.total),
  );

  /** "18/20" y, si el ensayo pondera, tambien el puntaje: "18/20 · 22/24 pts".
   *  Sin esto, en un ensayo donde la 7 vale 3 el "18/20" es enganoso. */
  const getCorrectDisplay = (paper: QuizPaper) => {
    const correct = `${paper.score ?? "-"}/${paper.total ?? quiz.num_questions}`;
    if (!isWeighted || paper.points == null || paper.points_total == null) return correct;
    return `${correct} · ${paper.points}/${paper.points_total} pts`;
  };

  /** Solo la NOTA: el puntaje PAES/SIMCE tiene ahora columna propia, asi que
   *  esta ya no tiene que elegir entre mostrar uno u otro. */
  const getScoreDisplay = (paper: QuizPaper) => {
    const grade = paper.grade || (paper.total ? resolveGrade(Number(paper.score ?? 0), Number(paper.total)) : "-");
    return `Nota ${grade}`;
  };

  // Que equivalencias tienen sentido para el nivel de ESTE ensayo: hasta II
  // medio ambas, en III y IV medio solo PAES. Se decide con el curso del
  // ensayo, no con el de cada alumno: es una decision de la tabla completa.
  const showEquivalence = equivalencesForCourse(quiz.grade as string | null);

  /**
   * Puntaje PAES y SIMCE de una hoja, derivados SIEMPRE del porcentaje de logro.
   * Nunca se lee `papers.equivalent_score`: en un ensayo "Personalizado" esa
   * columna guarda el PORCENTAJE (0-100), asi que pintarla bajo el encabezado
   * "PAES" mostraria 90 donde corresponde 910.
   */
  const getEquivalences = (paper: QuizPaper) => {
    const pct = achievementPct(paper);
    if (pct === null) return { paes: null, simce: null };
    return { paes: paesEquivalence(pct), simce: simceEquivalence(pct) };
  };

  // Mientras no este cargada la tabla oficial del DEMRE, el puntaje es
  // proporcional y el encabezado lo dice ("PAES ~").
  const sampleEquivalence = paesEquivalence(0.5);
  const equivalenceIsApprox = sampleEquivalence.aproximado;
  const approxTitle = equivalenceIsApprox
    ? "Puntaje proporcional al porcentaje de logro, no la conversión oficial del DEMRE."
    : undefined;

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
      dia: "DIA (Diagnóstico Integral de Aprendizajes)",
      dia_custom: "DIA (Diagnóstico Integral de Aprendizajes) - otro nivel/asignatura",
      dia_5b_lectura: "DIA 5° Básico - Lectura",
      dia_5b_matematica: "DIA 5° Básico - Matemática",
      dia_6b_lectura: "DIA 6° Básico - Lectura",
      dia_6b_matematica: "DIA 6° Básico - Matemática",
      dia_7b_lectura: "DIA 7° Básico - Lectura",
      dia_7b_matematica: "DIA 7° Básico - Matemática",
      dia_8b_lectura: "DIA 8° Básico - Lectura",
      dia_Imedio_lectura: "DIA I Medio - Lectura",
      dia_Imedio_matematica: "DIA I Medio - Matemática",
      dia_IImedio_lectura: "DIA II Medio - Lectura",
      dia_IImedio_matematica: "DIA II Medio - Matemática",
    };
    return labels[quiz.evaluation_variant] || String(quiz.evaluation_variant).replace(/_/g, " ");
  };

  return (
    <>
      <PageHeader title={quiz.title} description={`Evaluación: ${getVariantLabel()}. Detalle del ensayo, clave, lecturas sincronizadas y analisis por item.`} />
      <div className="space-y-6">
        {/* Lote multi-curso: hojas corregidas con ESTA hoja pero de alumnos de
            otro curso del lote. Se ofrecen para mover al ensayo que les
            corresponde (ver src/lib/paper_reroute.ts). */}
        {misplaced.length > 0 && (
          <ReroutePapersCard
            quizId={quiz.id}
            rows={misplaced.map((m) => ({ paperId: m.paperId, studentName: m.studentName, targetCourseName: m.targetCourseName }))}
            action={reroutePapersAction}
          />
        )}
        <section className="grid gap-4 md:grid-cols-5">
          <Info label="Preguntas" value={openQuestions.length > 0 ? `${quiz.num_questions} (${Number(quiz.num_questions) - openQuestions.length} alt. + ${openQuestions.length} desarrollo)` : quiz.num_questions} />
          <Info label="Opciones" value={quiz.options_per_question ?? 5} />
          <Info label="Asignatura" value={quiz.subject ?? "-"} />
          <Info label="Curso" value={quiz.grade ?? "-"} />
          <Info label="Promedio" value={`${avg}%`} />
        </section>
        <section className="rounded-md border border-[#e1e5ea] bg-white p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">Clave</h2>
              {keyIncomplete && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Clave incompleta</span>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link href={`/dashboard/quizzes/${quiz.id}/edit`} className="rounded-md border border-[#cfd6df] px-4 py-2 text-center text-sm font-semibold hover:bg-gray-50">Editar</Link>
              {/* Un ensayo de bloque compacto se imprime desde /bloque (imagen
                  pegable), no desde /sheet (hoja completa). Se ofrece el otro
                  formato igual, en gris: el profesor puede querer verlo. */}
              {isCompact ? (
                <>
                  <Link href={`/bloque?quiz=${quiz.id}`} className="rounded-md border border-[#cfd6df] px-4 py-2 text-center text-sm font-semibold">Generar bloque</Link>
                  <Link href={`/sheet?quiz=${quiz.id}`} className="rounded-md border border-[#e1e5ea] px-4 py-2 text-center text-sm font-semibold text-[#6b7280] hover:bg-gray-50">Hoja completa</Link>
                </>
              ) : (
                <>
                  <Link href={`/sheet?quiz=${quiz.id}`} className="rounded-md border border-[#cfd6df] px-4 py-2 text-center text-sm font-semibold">Generar hoja</Link>
                  {!compactIssue && (
                    <Link href={`/bloque?quiz=${quiz.id}`} className="rounded-md border border-[#e1e5ea] px-4 py-2 text-center text-sm font-semibold text-[#6b7280] hover:bg-gray-50">Bloque compacto</Link>
                  )}
                </>
              )}
              <form action={startScanForQuiz}><input type="hidden" name="quiz_id" value={quiz.id} /><button className="w-full rounded-md bg-[#07305f] px-4 py-2 text-sm font-semibold text-white sm:w-auto">Abrir lector</button></form>
              <PrintButton label="Imprimir" className="rounded-md border border-[#cfd6df] px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-gray-50" />
            </div>
          </div>
          <div className="mt-4">
            <AnswerKeyGrid answerKey={String(quiz.answer_key ?? "")} numQuestions={Number(quiz.num_questions) || 0} openQuestions={openSet0} />
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-3">
            <h2 className="whitespace-nowrap text-[12.5px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Estadística global</h2>
            <span className="h-px flex-1 bg-[#e6e8eb]" />
          </div>
          <QuizStats quiz={quiz} papers={quizPapers} metadata={metadata ?? []} />
        </section>

        {openQuestions.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="whitespace-nowrap text-[12.5px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Preguntas de desarrollo — sugerencias IA</h2>
              <span className="h-px flex-1 bg-[#e6e8eb]" />
            </div>
            {openAnswers.length === 0 ? (
              <p className="text-sm text-[#6b7280]">
                Sin escaneos de reverso todavía. Al escanear un alumno con preguntas de desarrollo
                pendientes, tuLector pide automáticamente el reverso y muestra acá la sugerencia de
                la IA (sin confirmar) para que la revises.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-[#e1e5ea] bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-[#f8fafc] text-left text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                    <tr>
                      <th className="px-3 py-2">Alumno</th>
                      <th className="px-3 py-2">Pregunta</th>
                      <th className="px-3 py-2">Transcripción IA</th>
                      <th className="px-3 py-2">Puntaje sugerido</th>
                      <th className="px-3 py-2">Confianza</th>
                      <th className="px-3 py-2">Confirmado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openAnswers.map((oa) => (
                      <tr key={`${oa.paper_id}-${oa.question}`} className="border-t border-[#eef0f3]">
                        <td className="px-3 py-2">{paperNameById.get(oa.paper_id) ?? "-"}</td>
                        <td className="px-3 py-2">{oa.question}</td>
                        <td className="px-3 py-2 max-w-sm truncate" title={oa.transcripcion ?? ""}>{oa.transcripcion || "-"}{oa.legible === false && " ⚠"}</td>
                        <td className="px-3 py-2">{oa.puntaje ?? "-"}/{oa.max_points ?? "-"}</td>
                        <td className="px-3 py-2">{oa.confianza ?? "-"}</td>
                        <td className="px-3 py-2">
                          {oa.confirmed_points != null ? (
                            <span className="font-semibold text-[#0f766e]">✓ {oa.confirmed_points} pts</span>
                          ) : (
                            <form action={confirmOpenAnswer} className="flex items-center gap-1.5">
                              <input type="hidden" name="paper_id" value={oa.paper_id} />
                              <input type="hidden" name="question" value={oa.question} />
                              <input type="hidden" name="quiz_id" value={quiz.id} />
                              <input
                                type="number" name="points" step={0.5} min={0} max={oa.max_points ?? undefined}
                                defaultValue={oa.puntaje ?? 0}
                                className="w-14 rounded border border-[#cfd6df] px-1.5 py-1 text-sm"
                              />
                              <button className="rounded border border-[#0f766e] px-2 py-1 text-xs font-semibold text-[#0f766e] hover:bg-[#f0fdfa]">
                                Confirmar
                              </button>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 text-xs text-[#8a93a1]">
              La IA sugiere — el puntaje no cuenta para la nota hasta que lo confirmes (el número
              ya viene precargado con la sugerencia; ajústalo si no estás de acuerdo antes de
              confirmar).
            </p>
          </section>
        )}

        <section>
          <div className="mb-3 flex items-center gap-3">
            <h2 className="whitespace-nowrap text-[12.5px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Resultados por alumno</h2>
            <span className="h-px flex-1 bg-[#e6e8eb]" />
          </div>
          <div className="mb-3">
            <ExportPanel
              quizId={quiz.id}
              papersCount={quizPapers.length}
              diaHref={`/api/quiz/${quiz.id}/export-dia`}
              templates={exportTemplates}
              presets={exportPresets}
              canSaveTemplate={isAdmin}
            />
          </div>
        </section>
        <DataTable
          // "Estado" y "Fecha" cedieron su lugar a las equivalencias. Ninguno se
          // pierde de vista: una hoja en manual_review sigue apareciendo en la
          // columna Alumno como "NOMBRE · identificar" con enlace (el unico
          // estado sobre el que el profesor actua), y las hojas siguen
          // ordenadas por fecha de escaneo descendente.
          columns={[
            "Alumno", "Curso", "Respuestas Correctas", "Nota",
            ...(showEquivalence.paes ? [equivalenceIsApprox ? "PAES ~" : "PAES"] : []),
            ...(showEquivalence.simce ? [equivalenceIsApprox ? "SIMCE ~" : "SIMCE"] : []),
          ]}
          rows={quizPapers}
          empty="Aun no hay lecturas sincronizadas para este ensayo."
          renderRow={(paper) => {
            const studentLabel = paper.student_name ?? paper.student_id ?? "Sin identificar";
            const studentHref = studentHrefForPaper(paper);
            const course = courseOf(paper);
            // Hoja sin dueño: se entra a identificarla (foto del nombre, buscador
            // de alumnos y descarte) en vez de quedar como un texto muerto.
            const needsId = paper.status === "manual_review";
            const eq = getEquivalences(paper);
            return (
              <tr key={paper.id} className="border-b border-[#eef0f3] last:border-0">
                <td className="px-5 py-4 font-semibold">
                  {needsId ? (
                    <Link href={`/dashboard/papers/${paper.id}`} className="text-[#9a3412] underline decoration-dotted hover:text-[#7c2d12]">
                      {studentLabel} · identificar
                    </Link>
                  ) : studentHref ? (
                    <Link href={studentHref} className="text-[#07305f] hover:underline">{studentLabel}</Link>
                  ) : studentLabel}
                </td>
                <td className="px-5 py-4 text-[#5b6472]">{course?.name ?? "-"}</td>
                <td className="px-5 py-4">{getCorrectDisplay(paper)}</td>
                <td className="px-5 py-4 font-semibold text-[#07305f]">{getScoreDisplay(paper)}</td>
                {showEquivalence.paes && (
                  <td className="px-5 py-4 font-semibold text-[#111827]" title={approxTitle}>
                    {eq.paes?.score ?? "-"}
                  </td>
                )}
                {showEquivalence.simce && (
                  <td className="px-5 py-4 font-semibold text-[#111827]" title={approxTitle}>
                    {eq.simce?.score ?? "-"}
                  </td>
                )}
              </tr>
            );
          }}
          renderMobileRow={(paper) => {
            const studentLabel = paper.student_name ?? paper.student_id ?? "Sin identificar";
            const studentHref = studentHrefForPaper(paper);
            const eq = getEquivalences(paper);
            return (
              <article key={paper.id} className="rounded-md border border-[#e6e8eb] bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  {paper.status === "manual_review" ? (
                    <Link href={`/dashboard/papers/${paper.id}`} className="min-w-0 truncate text-base font-semibold text-[#9a3412] underline decoration-dotted">
                      {studentLabel} · identificar
                    </Link>
                  ) : studentHref ? (
                    <Link href={studentHref} className="min-w-0 truncate text-base font-semibold text-[#07305f] hover:underline">{studentLabel}</Link>
                  ) : (
                    <p className="min-w-0 truncate text-base font-semibold text-[#111827]">{studentLabel}</p>
                  )}
                  <StatusPill>{paper.status ?? "active"}</StatusPill>
                </div>
                {/* La tarjeta muestra lo MISMO que la fila de escritorio. */}
                <div className="mt-3 grid gap-1 text-sm text-[#5b6472]">
                  <p>Curso: <span className="font-semibold text-[#111827]">{courseOf(paper)?.name ?? "-"}</span></p>
                  <p>Correctas: <span className="font-semibold text-[#111827]">{getCorrectDisplay(paper)}</span></p>
                  <p>Resultado: <span className="font-semibold text-[#07305f]">{getScoreDisplay(paper)}</span></p>
                  {showEquivalence.paes && (
                    <p title={approxTitle}>
                      PAES{equivalenceIsApprox ? " ~" : ""}: <span className="font-semibold text-[#111827]">{eq.paes?.score ?? "-"}</span>
                    </p>
                  )}
                  {showEquivalence.simce && (
                    <p title={approxTitle}>
                      SIMCE{equivalenceIsApprox ? " ~" : ""}: <span className="font-semibold text-[#111827]">{eq.simce?.score ?? "-"}</span>
                    </p>
                  )}
                </div>
              </article>
            );
          }}
        />
        <DataTable
          columns={["Pregunta", "Eje", "Habilidad", "Dificultad"]}
          rows={metadata ?? []}
          empty="Sin metadatos curriculares por item."
          renderRow={(row) => (
            <tr key={row.question_number} className="border-b border-[#eef0f3] last:border-0"><td className="px-5 py-4 font-semibold">{row.question_number}</td><td className="px-5 py-4 text-[#5b6472]">{row.axis_name ?? "-"}</td><td className="px-5 py-4 text-[#5b6472]">{row.skill_name ?? "-"}</td><td className="px-5 py-4 text-[#5b6472]">{row.difficulty ?? "-"}</td></tr>
          )}
          renderMobileRow={(row) => (
            <article key={row.question_number} className="rounded-md border border-[#e6e8eb] bg-white p-4 shadow-sm">
              <p className="text-base font-semibold text-[#111827]">Pregunta {row.question_number}</p>
              <div className="mt-3 grid gap-1 text-sm text-[#5b6472]">
                <p>Eje: <span className="font-medium text-[#111827]">{row.axis_name ?? "-"}</span></p>
                <p>Habilidad: <span className="font-medium text-[#111827]">{row.skill_name ?? "-"}</span></p>
                <p>Dificultad: <span className="font-medium text-[#111827]">{row.difficulty ?? "-"}</span></p>
              </div>
            </article>
          )}
        />
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-md border border-[#e1e5ea] bg-white p-5"><p className="text-sm text-[#5b6472]">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>;
}
