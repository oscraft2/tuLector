import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/supabase_server";
import { fetchStudentPage } from "@/lib/student_search";

export const dynamic = "force-dynamic";

/**
 * Buscador de alumnos para asignar un escaneo a mano (StudentPicker): texto
 * libre + filtro por curso, acotado al colegio activo.
 *
 * Se apoya en fetchStudentPage (src/lib/student_search.ts) para NO repetir como
 * se busca un alumno: hereda la RPC `search_students` y su modo degradado
 * cuando la migracion no esta aplicada. Nunca devuelve la tabla completa.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const courseId = searchParams.get("course") || null;
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 20;

  try {
    const { supabase, school } = await getDashboardContext();
    const page = await fetchStudentPage(
      supabase,
      school,
      { q, courseId, noCourse: false, grade: null, hasPapers: null, page: 1 },
      limit,
    );

    // Nombre del curso de cada alumno: el buscador se usa para decidir a QUIEN
    // se le asigna una hoja, y ahi el curso es lo que desambigua dos alumnos con
    // nombres parecidos.
    const { data: courses } = await supabase
      .from("courses")
      .select("id,name")
      .eq("school_id", school.id)
      .is("archived_at", null)
      .order("name");
    const courseNameById = new Map(((courses ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));

    return NextResponse.json({
      students: page.rows.map((s) => ({
        id: s.id,
        name: s.name,
        rut: s.rut ?? s.student_id ?? null,
        course: (s.course_id ? courseNameById.get(s.course_id) : null) ?? s.course ?? null,
        courseId: s.course_id ?? null,
      })),
      total: page.total,
      courses: (courses ?? []) as { id: string; name: string }[],
    });
  } catch {
    return NextResponse.json({ error: "No autenticado o sin colegio" }, { status: 401 });
  }
}
