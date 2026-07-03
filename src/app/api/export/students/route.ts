import { getDashboardContext } from "@/lib/supabase_server";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

type StudentExportRow = {
  rut: string | null;
  student_id: string | null;
  name: string | null;
  course: string | null;
  created_at: string | null;
};

export async function GET(request: Request) {
  const { supabase, user, school, isAdmin } = await getDashboardContext();
  if (!isAdmin) return new Response("Solo administradores pueden exportar alumnos.", { status: 403 });

  const { searchParams } = new URL(request.url);
  const course = searchParams.get("course")?.trim() || null;

  let query = supabase
    .from("students")
    .select("rut, student_id, name, course, created_at")
    .eq("school_id", school.id)
    .order("name");

  if (course) query = query.eq("course", course);

  const { data, error } = await query;
  if (error) return new Response("No se pudo generar el CSV de alumnos.", { status: 500 });

  const rows = (data ?? []) as StudentExportRow[];
  const csv = toCsv(
    ["rut", "nombre", "curso", "registrado"],
    rows.map((student) => [
      student.rut ?? student.student_id ?? "",
      student.name ?? "",
      student.course ?? "",
      formatDate(student.created_at),
    ]),
  );

  const { error: logError } = await supabase.from("export_logs").insert({
    school_id: school.id,
    user_id: user.id,
    export_type: "students_csv",
    entity_type: "students",
    reason: course ? `exportacion CSV de alumnos del curso ${course}` : "exportacion CSV de alumnos",
    row_count: rows.length,
  });

  if (logError) return new Response("No se pudo registrar la exportacion.", { status: 500 });

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="alumnos_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

function formatDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("es-CL");
}
