import { getDashboardContext } from "@/lib/supabase_server";
import { StudentsScreen } from "@/components/native/StudentsScreen";
import { fetchStudentPage, parseStudentFilters } from "@/lib/student_search";

type CourseRow = { id: string; name: string; grade: string | null };

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Gestion de alumnos nativa: buscar + agregar/editar, en tarjetas. Deja la
 * importacion CSV y la gestion de cursos para el navegador (/dashboard/courses).
 * El render vive en StudentsScreen (header + buscador sticky, ver ese archivo).
 *
 * La busqueda se resuelve EN EL SERVIDOR (student_search.ts). Antes esta
 * pantalla se traia todos los alumnos del colegio y filtraba en el cliente, que
 * es especialmente caro en el APK: datos moviles y equipos lentos.
 */
export default async function NativeStudentsPage({ searchParams }: PageProps) {
  const { supabase, school } = await getDashboardContext();
  const params = await searchParams;
  const filters = parseStudentFilters(params);

  const [page, { data: courses }] = await Promise.all([
    fetchStudentPage(supabase, school, filters),
    supabase.from("courses").select("id,name,grade").eq("school_id", school.id).is("archived_at", null).order("name"),
  ]);

  return (
    <StudentsScreen
      students={page.rows.map((s) => ({
        id: s.id,
        rut: s.rut,
        student_id: s.student_id,
        name: s.name,
        course: s.course,
      }))}
      courses={(courses ?? []) as CourseRow[]}
      total={page.total}
      hasMore={page.total > page.rows.length}
      query={filters.q}
    />
  );
}
