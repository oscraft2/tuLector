/**
 * Curso al que pertenece un escaneo, para agrupar resultados por curso REAL del
 * alumno y no por el curso de la hoja.
 *
 * Por que existe: un curso puede rendir con la hoja de otro (caso real: la hoja
 * del 2E impresa para todo el nivel de segundo). Los papers se listan por
 * `quiz_id`, asi que sin esto un alumno del 2B aparece dentro del ensayo del 2E
 * y su curso real no se ve por ninguna parte.
 *
 * Dos fuentes, en orden:
 *   1. `papers.course_id` — snapshot grabado al escanear
 *      (20260812000000_paper_course_and_assignment.sql). Es el valor historico:
 *      no cambia si el alumno se traslada de curso despues.
 *   2. El curso ACTUAL del alumno, cruzando `student_rut_norm` con `students`.
 *      Cubre los papers anteriores a esa migracion y a las BD sin migrar.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalRut } from "@/lib/rut";

export type PaperCourseInput = {
  student_rut_norm?: string | null;
  student_id?: string | null;
  course_id?: string | null;
};

export type CourseRef = { id: string; name: string };

/** Clave de agrupacion de los papers sin curso resoluble. */
export const NO_COURSE_KEY = "__sin_curso__";
export const NO_COURSE_LABEL = "Sin curso";

/**
 * Devuelve `courseOf(paper)`: el curso de cada escaneo, o `null` si no se pudo
 * determinar. Hace como maximo dos consultas acotadas (cursos del colegio y los
 * alumnos que aparecen en estos papers), nunca la tabla completa de alumnos.
 */
export async function buildPaperCourseResolver(
  supabase: Pick<SupabaseClient, "from">,
  schoolId: string,
  papers: PaperCourseInput[],
): Promise<(paper: PaperCourseInput) => CourseRef | null> {
  const rutNorms = Array.from(
    new Set(
      papers
        .map((p) => p.student_rut_norm ?? canonicalRut(p.student_id ?? null))
        .filter((v): v is string => Boolean(v)),
    ),
  );

  const [coursesResult, studentsResult] = await Promise.all([
    supabase.from("courses").select("id,name").eq("school_id", schoolId).is("archived_at", null),
    rutNorms.length > 0
      ? supabase.from("students").select("rut_normalized,course_id").eq("school_id", schoolId).in("rut_normalized", rutNorms)
      : Promise.resolve({ data: [] as { rut_normalized: string | null; course_id: string | null }[] }),
  ]);

  const nameById = new Map<string, string>();
  for (const c of (coursesResult.data ?? []) as { id: string; name: string }[]) nameById.set(c.id, c.name);

  const courseIdByRut = new Map<string, string>();
  for (const s of (studentsResult.data ?? []) as { rut_normalized: string | null; course_id: string | null }[]) {
    if (s.rut_normalized && s.course_id) courseIdByRut.set(s.rut_normalized, s.course_id);
  }

  return (paper: PaperCourseInput): CourseRef | null => {
    const rutNorm = paper.student_rut_norm ?? canonicalRut(paper.student_id ?? null);
    const courseId = paper.course_id ?? (rutNorm ? courseIdByRut.get(rutNorm) ?? null : null);
    if (!courseId) return null;
    const name = nameById.get(courseId);
    // Curso archivado o borrado: se conserva el id como clave de agrupacion para
    // no mezclar esos escaneos con los que de verdad no tienen curso.
    return { id: courseId, name: name ?? "Curso archivado" };
  };
}

/**
 * Agrupa filas por curso, ordenando los grupos por nombre y dejando "Sin curso"
 * siempre al final (es el cajon de lo pendiente, no un curso mas).
 */
export function groupByCourse<T extends PaperCourseInput>(
  rows: T[],
  courseOf: (paper: PaperCourseInput) => CourseRef | null,
): { key: string; label: string; rows: T[] }[] {
  const groups = new Map<string, { key: string; label: string; rows: T[] }>();
  for (const row of rows) {
    const course = courseOf(row);
    const key = course?.id ?? NO_COURSE_KEY;
    const label = course?.name ?? NO_COURSE_LABEL;
    const entry = groups.get(key) ?? { key, label, rows: [] };
    entry.rows.push(row);
    groups.set(key, entry);
  }
  return [...groups.values()].sort((a, b) => {
    if (a.key === NO_COURSE_KEY) return 1;
    if (b.key === NO_COURSE_KEY) return -1;
    return a.label.localeCompare(b.label, "es");
  });
}
