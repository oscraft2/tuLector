import { getDashboardContext } from "@/lib/supabase_server";
import { StudentsScreen } from "@/components/native/StudentsScreen";
import { isMissingColumnError } from "@/lib/supabase_errors";

type StudentRow = { id: string; rut: string | null; student_id: string | null; name: string; course: string | null };
type CourseRow = { id: string; name: string; grade: string | null };

/**
 * Gestion de alumnos nativa: buscar + agregar/editar, en tarjetas. Deja la
 * importacion CSV y edicion masiva para el navegador (/dashboard/students),
 * que sigue intacta para esos flujos mas avanzados. El render vive en
 * StudentsScreen (header + buscador sticky, ver ese archivo).
 */
export default async function NativeStudentsPage() {
  const { supabase, school } = await getDashboardContext();

  const [studentsResult, { data: courses }] = await Promise.all([
    supabase.from("students").select("id,student_id,rut,name,course").eq("school_id", school.id).order("name"),
    supabase.from("courses").select("id,name,grade").eq("school_id", school.id).order("name"),
  ]);

  let studentsData: unknown = studentsResult.data;
  if (studentsResult.error && isMissingColumnError(studentsResult.error, "school_id")) {
    const fallback = await supabase.from("students").select("id,student_id,rut,name,course").order("name");
    studentsData = fallback.data;
  }

  const students = (studentsData ?? []) as StudentRow[];
  const courseList = (courses ?? []) as CourseRow[];

  return <StudentsScreen students={students} courses={courseList} />;
}
