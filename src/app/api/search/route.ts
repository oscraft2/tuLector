import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/supabase_server";

export const dynamic = "force-dynamic";

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

    const [studentsRes, quizzesRes, coursesRes] = await Promise.all([
      supabase
        .from("students")
        .select("id, name, rut, student_id, course")
        .eq("school_id", school.id)
        .or(`name.ilike.${like},rut.ilike.${like},student_id.ilike.${like}`)
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

    const courseMap = new Map<string, string>();
    for (const c of coursesRes.data ?? []) {
      if (c?.name) courseMap.set(String(c.name), String(c.id));
    }

    const students = (studentsRes.data ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      rut: s.rut ?? null,
      student_id: s.student_id ?? null,
      course: s.course ?? null,
      courseId: s.course ? courseMap.get(String(s.course)) ?? null : null,
    }));

    return NextResponse.json({ students, quizzes: quizzesRes.data ?? [] });
  } catch {
    return NextResponse.json({ students: [], quizzes: [] });
  }
}
