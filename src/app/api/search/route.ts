import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/supabase_server";
import { resolveNationalId } from "@/lib/national_id";
import { isMissingColumnError } from "@/lib/supabase_errors";

export const dynamic = "force-dynamic";

type StudentSearchRow = {
  id: string;
  name: string | null;
  rut: string | null;
  student_id: string | null;
  course: string | null;
  course_id?: string | null;
};

// Búsqueda global del header: alumnos (nombre / RUT / ID) y ensayos (título),
// acotada al colegio activo. Se llama desde GlobalSearch con debounce.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get("q") ?? "").trim();
  // Sanea caracteres que rompen el filtro .or()/.ilike de PostgREST.
  const q = raw.replace(/[,%()*]/g, " ").trim();
  if (q.length < 2) return NextResponse.json({ students: [], quizzes: [] });

  try {
    const { supabase, school } = await getDashboardContext();
    const like = `%${q}%`;
    // Exacto por ID nacional canonico: antes solo Chile (canonicalRut), ahora
    // usa el pais del colegio (resolveNationalId, ver national_id.ts) — ilike
    // sobre rut/student_id ya buscaba por coincidencia parcial en cualquier
    // pais (esas columnas guardan el ID normalizado sin importar el formato).
    const rutNorm = resolveNationalId(raw, school.country_code ?? "CL").canonical;
    const studentFilters = [`name.ilike.${like}`, `rut.ilike.${like}`, `student_id.ilike.${like}`];
    if (rutNorm) studentFilters.push(`rut_normalized.eq.${rutNorm}`);

    const [studentsResWithCourseId, quizzesRes, coursesRes] = await Promise.all([
      supabase
        .from("students")
        .select("id, name, rut, student_id, course, course_id")
        .eq("school_id", school.id)
        .or(studentFilters.join(","))
        .order("name")
        .limit(6),
      supabase
        .from("quizzes")
        .select("id, title, subject, grade")
        .eq("school_id", school.id)
        .is("archived_at", null)
        .ilike("title", like)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase.from("courses").select("id, name").eq("school_id", school.id),
    ]);

    const studentsRes = studentsResWithCourseId.error && isMissingColumnError(studentsResWithCourseId.error, "course_id")
      ? await supabase
          .from("students")
          .select("id, name, rut, student_id, course")
          .eq("school_id", school.id)
          .or(studentFilters.join(","))
          .order("name")
          .limit(6)
      : studentsResWithCourseId;

    const courseMap = new Map<string, string>();
    for (const c of coursesRes.data ?? []) {
      if (c?.name) courseMap.set(String(c.name), String(c.id));
    }

    const students = ((studentsRes.data ?? []) as StudentSearchRow[]).map((s) => ({
      id: s.id,
      name: s.name,
      rut: s.rut ?? null,
      student_id: s.student_id ?? null,
      course: s.course ?? null,
      courseId: s.course_id ?? (s.course ? courseMap.get(String(s.course)) ?? null : null),
    }));

    return NextResponse.json({ students, quizzes: quizzesRes.data ?? [] });
  } catch {
    return NextResponse.json({ students: [], quizzes: [] });
  }
}
