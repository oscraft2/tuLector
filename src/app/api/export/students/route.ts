import { getDashboardContext } from "@/lib/supabase_server";
import { toCsv } from "@/lib/csv";
import { fetchStudentsForExport, parseStudentFilters } from "@/lib/student_search";

export const dynamic = "force-dynamic";

/**
 * CSV de alumnos. Respeta los MISMOS filtros que el listado de
 * /dashboard/students (texto, curso, sin curso, nivel, ensayos rendidos): el
 * boton "Exportar CSV" vive al lado de una tabla filtrada, asi que exportar
 * otra cosa que lo que se esta viendo seria una trampa.
 *
 * Compatibilidad: si llega `course` con el NOMBRE de un curso (como lo hacian
 * los enlaces antiguos) se sigue filtrando por nombre.
 */
export async function GET(request: Request) {
  const { supabase, user, school, isAdmin } = await getDashboardContext();
  if (!isAdmin) return new Response("Solo administradores pueden exportar alumnos.", { status: 403 });

  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(searchParams.entries());
  const filters = parseStudentFilters(params);

  // `course` puede venir como UUID (filtro nuevo), "none" (sin curso) o como
  // nombre de curso (enlaces antiguos). Solo el UUID lo entiende el filtro por
  // course_id; un nombre se resuelve a su id antes de consultar.
  const rawCourse = searchParams.get("course")?.trim() ?? "";
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawCourse);
  let courseLabel: string | null = null;
  if (rawCourse && rawCourse !== "none" && !isUuid) {
    const { data: byName } = await supabase
      .from("courses")
      .select("id,name")
      .eq("school_id", school.id)
      .eq("name", rawCourse)
      .maybeSingle();
    filters.courseId = byName?.id ?? null;
    filters.noCourse = false;
    courseLabel = byName?.name ?? rawCourse;
    // Nombre que no existe como curso: no se exporta el colegio entero por error.
    if (!byName) {
      return new Response(`No existe un curso llamado "${rawCourse}".`, { status: 404 });
    }
  }

  const students = await fetchStudentsForExport(supabase, school, filters);

  const csv = toCsv(
    ["rut", "nombre", "curso", "registrado"],
    students.map((student) => [
      student.rut ?? student.student_id ?? "",
      student.name ?? "",
      student.course ?? "",
      formatDate(student.created_at),
    ]),
  );

  const describe = () => {
    const parts: string[] = [];
    if (filters.q) parts.push(`busqueda "${filters.q}"`);
    if (courseLabel) parts.push(`curso ${courseLabel}`);
    else if (filters.noCourse) parts.push("sin curso asignado");
    else if (filters.courseId) parts.push(`curso ${filters.courseId}`);
    if (filters.grade) parts.push(`nivel ${filters.grade}`);
    if (filters.hasPapers === true) parts.push("con ensayos rendidos");
    if (filters.hasPapers === false) parts.push("sin ensayos rendidos");
    return parts.length ? `exportacion CSV de alumnos (${parts.join(", ")})` : "exportacion CSV de alumnos";
  };

  const { error: logError } = await supabase.from("export_logs").insert({
    school_id: school.id,
    user_id: user.id,
    export_type: "students_csv",
    entity_type: "students",
    reason: describe(),
    row_count: students.length,
  });

  if (logError) return new Response("No se pudo registrar la exportacion.", { status: 500 });

  // BOM para que Excel abra el CSV en UTF-8 (tildes y ñ).
  return new Response(`﻿${csv}`, {
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
