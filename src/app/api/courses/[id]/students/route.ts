import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/supabase_server";

/** Roster de alumnos de un curso, scopeado al colegio del usuario. Lo usa
 * /sheet para precargar el RUT real de cada alumno al generar las hojas
 * (modo "lista" de generateBatch, ver sheet/page.tsx) sin que el profesor
 * tenga que pegar la lista a mano. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, school } = await getDashboardContext();

  const { data, error } = await supabase
    .from("students")
    .select("id,name,rut,student_id,rut_normalized")
    .eq("course_id", id)
    .eq("school_id", school.id)
    .order("name");

  if (error) return NextResponse.json({ error: "No se pudo cargar el roster del curso" }, { status: 500 });
  return NextResponse.json({ students: data ?? [] });
}
