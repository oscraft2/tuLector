/**
 * Reubicar hojas que quedaron en el ensayo equivocado de un lote multi-curso.
 *
 * Contexto: se imprimio la hoja del 2° Medio E y con ella se corrigio todo el
 * nivel, asi que ese ensayo acumulo alumnos de 2°A..2°D y los demas quedaron
 * incompletos. Desde ahora el escaneo enruta por el curso del alumno
 * (src/lib/quiz_batch.ts), pero lo YA guardado hay que moverlo.
 *
 * Mover una hoja no es solo cambiarle el `quiz_id`: su nota vive en
 * `grade_records` colgando del ensayo de origen, y si no se mueve queda una nota
 * fantasma en un ensayo que el alumno nunca rindio. Por eso se reusa el mismo
 * manejo de notas de la asignacion manual (src/lib/paper_assign.ts).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardSchool } from "@/lib/supabase_server";
import { canonicalRut } from "@/lib/rut";
import { deleteGradeRecord, upsertGradeRecord } from "@/lib/paper_assign";
import { fetchSiblingQuizzes, type BatchQuiz } from "@/lib/quiz_batch";

type MinimalClient = Pick<SupabaseClient, "from">;
type SiblingQuiz = BatchQuiz;

export type MisplacedPaper = {
  paperId: string;
  studentName: string | null;
  studentCode: string | null;
  /** ID canonico del alumno, que es la clave de `grade_records`. */
  studentRutNorm: string | null;
  score: number | null;
  total: number | null;
  targetQuizId: string;
  targetCourseName: string;
};

/**
 * Hojas de este ensayo que pertenecen a otro curso CON ensayo propio en el mismo
 * lote. Devuelve lista vacia si el ensayo no es de un lote (nada que reubicar) o
 * si todas las hojas estan donde corresponde.
 */
export async function findMisplacedPapers(
  supabase: MinimalClient,
  schoolId: string,
  quizId: string,
): Promise<MisplacedPaper[]> {
  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id,batch_id,course_id,answer_key,num_questions")
    .eq("id", quizId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!quiz) return [];

  // Hermanos: por lote si existe y, si no, por contenido identico -- la misma
  // prueba impresa para varios cursos. Ver fetchSiblingQuizzes.
  const siblings = await fetchSiblingQuizzes(
    supabase,
    schoolId,
    quiz as SiblingQuiz,
    "id,batch_id,course_id,answer_key,num_questions",
  );
  const quizByCourse = new Map(
    siblings.filter((s) => s.course_id).map((s) => [s.course_id as string, s.id]),
  );
  if (quizByCourse.size === 0) return [];

  const { data: paperRows } = await supabase
    .from("papers")
    .select("id,student_name,student_id,student_rut_norm,course_id,score,total")
    .eq("school_id", schoolId)
    .eq("quiz_id", quizId)
    .neq("status", "void");
  const papers = (paperRows ?? []) as {
    id: string; student_name: string | null; student_id: string | null;
    student_rut_norm: string | null; course_id: string | null; score: number | null; total: number | null;
  }[];
  if (papers.length === 0) return [];

  // Curso del alumno: el grabado al escanear y, si falta (papers anteriores a
  // esa migracion), el curso ACTUAL del alumno -- mismo criterio que
  // buildPaperCourseResolver en src/lib/paper_course.ts.
  const rutNorms = Array.from(
    new Set(papers.map((p) => p.student_rut_norm ?? canonicalRut(p.student_id)).filter((v): v is string => Boolean(v))),
  );
  const courseIdByRut = new Map<string, string>();
  if (rutNorms.length > 0) {
    const { data: students } = await supabase
      .from("students")
      .select("rut_normalized,course_id")
      .eq("school_id", schoolId)
      .in("rut_normalized", rutNorms);
    for (const s of (students ?? []) as { rut_normalized: string | null; course_id: string | null }[]) {
      if (s.rut_normalized && s.course_id) courseIdByRut.set(s.rut_normalized, s.course_id);
    }
  }

  const courseNames = new Map<string, string>();
  const courseIds = siblings.map((s) => s.course_id).filter((v): v is string => Boolean(v));
  if (courseIds.length > 0) {
    const { data: courses } = await supabase.from("courses").select("id,name").in("id", courseIds);
    for (const c of (courses ?? []) as { id: string; name: string }[]) courseNames.set(c.id, c.name);
  }

  const misplaced: MisplacedPaper[] = [];
  for (const paper of papers) {
    const rutNorm = paper.student_rut_norm ?? canonicalRut(paper.student_id);
    const courseId = paper.course_id ?? (rutNorm ? courseIdByRut.get(rutNorm) ?? null : null);
    if (!courseId || courseId === quiz?.course_id) continue;
    const targetQuizId = quizByCourse.get(courseId);
    if (!targetQuizId || targetQuizId === quizId) continue;
    misplaced.push({
      paperId: paper.id,
      studentName: paper.student_name,
      studentCode: paper.student_id,
      studentRutNorm: rutNorm,
      score: paper.score,
      total: paper.total,
      targetQuizId,
      targetCourseName: courseNames.get(courseId) ?? "otro curso",
    });
  }
  return misplaced;
}

/**
 * Mueve las hojas a su ensayo y con ellas su nota. Si el alumno YA tenia hoja en
 * el ensayo destino, la mas antigua queda anulada (`status: "void"`) -- mismo
 * criterio que la reasignacion manual, para no dejar dos notas del mismo alumno
 * en un mismo ensayo.
 */
export async function reroutePapers(
  supabase: MinimalClient,
  school: DashboardSchool,
  quizId: string,
  papers: MisplacedPaper[],
): Promise<{ moved: number; voided: number }> {
  let moved = 0;
  let voided = 0;

  for (const paper of papers) {
    // ¿El alumno ya tiene hoja en el ensayo destino?
    const { data: existingRows } = await supabase
      .from("papers")
      .select("id,scanned_at")
      .eq("school_id", school.id)
      .eq("quiz_id", paper.targetQuizId)
      .eq("student_rut_norm", paper.studentRutNorm ?? " ")
      .neq("status", "void")
      .order("scanned_at", { ascending: false })
      .limit(1);
    const existing = ((existingRows ?? []) as { id: string }[])[0] ?? null;
    if (existing) {
      // La hoja que se mueve es la que vale (es la que el profesor escaneó en
      // este ensayo); la que ya estaba en el destino se anula.
      await supabase.from("papers").update({ status: "void" }).eq("id", existing.id).eq("school_id", school.id);
      voided++;
    }

    const { error } = await supabase
      .from("papers")
      .update({ quiz_id: paper.targetQuizId })
      .eq("id", paper.paperId)
      .eq("school_id", school.id);
    if (error) continue;

    // La nota se muda con la hoja: fuera del ensayo de origen, dentro del destino.
    await deleteGradeRecord(supabase, school.id, quizId, paper.studentRutNorm);
    await upsertGradeRecord(supabase, school, {
      quizId: paper.targetQuizId,
      paperId: paper.paperId,
      studentCode: paper.studentRutNorm,
      score: paper.score ?? 0,
      total: paper.total ?? 0,
    });
    moved++;
  }

  return { moved, voided };
}
