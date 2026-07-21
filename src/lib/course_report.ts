import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalRut } from "@/lib/rut";
import { isNotaType } from "@/lib/evaluation_types";

export type CourseReportFilters = {
  evalType?: string | null;
  quizId?: string | null;
  from?: string | null;
  to?: string | null;
  scoreMin?: number | null;
  scoreMax?: number | null;
};

export type CourseStudentRow = { id: string; name: string; rut: string | null; student_id: string | null; rut_normalized: string | null };

export type CoursePaperRow = {
  score: number | null;
  total: number | null;
  grade: string | number | null;
  equivalent_score: number | null;
  scanned_at: string;
  student_rut_norm: string | null;
  student_id: string | null;
  quiz_id: string | null;
  quizzes: { id: string; title: string; num_questions: number; evaluation_type: string | null } | null;
};

// Trae todos los papers validos del curso (sin filtrar por criterios de la
// UI) y aparte el subconjunto que matchea los filtros activos. El dataset de
// un curso es chico (decenas/pocos cientos de papers) asi que filtrar en
// memoria evita duplicar round-trips a Supabase por cada combinacion de filtro.
export async function buildCourseReportData(
  supabase: SupabaseClient,
  courseId: string,
  filters: CourseReportFilters = {},
) {
  const [{ data: course }, { data: students }] = await Promise.all([
    supabase.from("courses").select("id,name,grade").eq("id", courseId).single(),
    supabase.from("students").select("id,name,rut,student_id,rut_normalized").eq("course_id", courseId).order("name"),
  ]);

  const studentList = (students ?? []) as CourseStudentRow[];
  const studentRutNorms = studentList
    .map((s) => s.rut_normalized ?? canonicalRut(s.rut) ?? canonicalRut(s.student_id))
    .filter((v): v is string => Boolean(v));

  let allPapers: CoursePaperRow[] = [];
  if (studentRutNorms.length > 0) {
    const { data: papersData } = await supabase
      .from("papers")
      .select("score,total,grade,equivalent_score,scanned_at,student_rut_norm,student_id,quiz_id,quizzes(id,title,num_questions,evaluation_type)")
      .in("student_rut_norm", studentRutNorms)
      .in("status", ["corrected", "active", "manual_review"])
      .order("scanned_at", { ascending: false });
    allPapers = (papersData ?? []) as unknown as CoursePaperRow[];
  }

  const filteredPapers = allPapers.filter((p) => {
    const evType = p.quizzes?.evaluation_type ?? "custom";
    if (filters.evalType && evType !== filters.evalType) return false;
    if (filters.quizId && p.quiz_id !== filters.quizId) return false;
    if (filters.from && p.scanned_at < filters.from) return false;
    if (filters.to && p.scanned_at > `${filters.to}T23:59:59`) return false;
    if (filters.scoreMin != null || filters.scoreMax != null) {
      const value = isNotaType(evType)
        ? ((p.score ?? 0) / Math.max(1, p.total ?? 1)) * 100
        : (p.equivalent_score ?? 0);
      if (filters.scoreMin != null && value < filters.scoreMin) return false;
      if (filters.scoreMax != null && value > filters.scoreMax) return false;
    }
    return true;
  });

  return { course, studentList, allPapers, filteredPapers };
}

// Ultimo puntaje equivalente PAES/SIMCE por alumno, tomado de allPapers (no de
// filteredPapers) -- esto es lo que hace que la tabla de equivalencia se vea
// siempre, sin importar el filtro activo.
export function latestEquivalentByStudent(papers: CoursePaperRow[], evalType: "paes" | "simce") {
  const result: Record<string, number> = {};
  for (const p of papers) {
    if (p.quizzes?.evaluation_type !== evalType || p.equivalent_score == null) continue;
    const key = p.student_rut_norm ?? p.student_id ?? "unknown";
    // allPapers viene ordenado desc por scanned_at, asi que el primero que
    // encontramos para cada alumno ya es el mas reciente.
    if (!(key in result)) result[key] = p.equivalent_score;
  }
  return result;
}
