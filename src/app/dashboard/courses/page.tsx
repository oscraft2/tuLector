import Link from "next/link";
import { getDashboardContext } from "@/lib/supabase_server";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { CourseForm } from "@/components/dashboard/CourseForm";
import { CourseEditRow } from "@/components/dashboard/CourseEditRow";
import { CSVImport } from "@/components/dashboard/CSVImport";
import { DeleteButton } from "@/components/dashboard/DeleteButton";
import { createCourse, updateCourse, archiveCourse, restoreCourse, importStudents, importStudentsMapped } from "@/app/dashboard/actions";
import { isMissingColumnError } from "@/lib/supabase_errors";
import { resolveCountryProfile } from "@/lib/country_profiles";
import { fetchCourseStudentCounts } from "@/lib/student_search";
import { SCHOOL_GRADES } from "@/lib/grades";

export const dynamic = "force-dynamic";

type CourseRow = { id: string; name: string; grade: string | null };

/**
 * Modulo de CURSOS: el hogar de los cursos del colegio. Crear, editar,
 * archivar y restaurar, mas la importacion masiva de alumnos (que ya crea los
 * cursos que vengan en el CSV, ver findOrCreateCourse en actions.ts).
 *
 * Todo esto vivia antes apretado en la barra lateral de /dashboard/students,
 * que ademas se traia la tabla completa de alumnos para poder mostrarlo.
 */
export default async function CoursesPage() {
  const { supabase, isAdmin, school } = await getDashboardContext();
  const studentIdLabel = resolveCountryProfile(school.country_code ?? "CL").studentIdLabel;

  const coursesResult = await supabase
    .from("courses")
    .select("id,name,grade,archived_at")
    .eq("school_id", school.id)
    .order("name");

  // BD sin migrar (archived_at): degradacion silenciosa -- todos los cursos se
  // tratan como activos y no hay seccion de archivados.
  let allCourses = (coursesResult.data ?? []) as (CourseRow & { archived_at: string | null })[];
  if (coursesResult.error && isMissingColumnError(coursesResult.error, "archived_at")) {
    const fallback = await supabase.from("courses").select("id,name,grade").eq("school_id", school.id).order("name");
    allCourses = ((fallback.data ?? []) as CourseRow[]).map((c) => ({ ...c, archived_at: null }));
  }

  const courseList = allCourses.filter((c) => !c.archived_at);
  const archivedCourses = allCourses.filter((c) => c.archived_at);

  // Un solo RPC agregado en vez de una consulta por curso. Mapa vacio = la
  // migracion no esta aplicada: se omite la columna en vez de fallar.
  const counts = await fetchCourseStudentCounts(supabase, school.id);
  const hasCounts = counts.size > 0;

  return (
    <>
      <PageHeader
        title="Cursos"
        description="Crea y administra los cursos del establecimiento, e importa alumnos de forma masiva. Los alumnos individuales se gestionan en Gestion de alumnos."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-6">
        <div className="space-y-4">
          {courseList.length === 0 ? (
            <EmptyState
              icon="🏫"
              title="Sin cursos creados"
              description="Crea cursos como '4° Básico' o 'I Medio' para organizar tus alumnos y ver el rendimiento de cada curso por ensayo. Tambien puedes importar un CSV: los cursos que traiga se crean solos."
              action={{ label: "Ver alumnos", href: "/dashboard/students" }}
            />
          ) : (
            <div className="rounded-md border border-[#e6e8eb] bg-white p-5">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#111827]">Cursos activos</h2>
                <span className="text-xs text-[#5b6472]">{courseList.length} curso{courseList.length === 1 ? "" : "s"}</span>
              </div>
              <p className="mb-3 text-xs text-[#5b6472]">
                Toca un curso para ver su detalle y rendimiento, o el contador de alumnos para verlos en Gestion de alumnos.
              </p>
              <div className="divide-y divide-[#eef0f3]">
                {courseList.map((course) => (
                  <CourseEditRow
                    key={course.id}
                    course={course}
                    isAdmin={isAdmin}
                    updateAction={updateCourse}
                    archiveAction={archiveCourse}
                    grades={SCHOOL_GRADES}
                    studentCount={hasCounts ? counts.get(course.id) ?? 0 : null}
                  />
                ))}
              </div>
            </div>
          )}

          {isAdmin && archivedCourses.length > 0 && (
            <details className="rounded-md border border-[#eef0f3] bg-[#f8fafc] p-4">
              <summary className="cursor-pointer text-sm font-semibold text-[#5b6472]">
                Cursos archivados ({archivedCourses.length})
              </summary>
              <div className="mt-2 divide-y divide-[#eef0f3]">
                {archivedCourses.map((course) => (
                  <div key={course.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <span className="block truncate font-semibold text-[#5b6472]">{course.name}</span>
                      <span className="text-xs text-[#9aa2af]">{course.grade}</span>
                    </div>
                    <DeleteButton
                      action={restoreCourse}
                      id={course.id}
                      label="Restaurar"
                      pendingLabel="Restaurando…"
                      className="shrink-0 text-xs font-semibold text-[#07305f] hover:underline disabled:opacity-50"
                    />
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        <aside className="space-y-6">
          {isAdmin && (
            <div className="rounded-md border border-[#e6e8eb] bg-white p-5 space-y-3">
              <h2 className="text-lg font-semibold text-[#111827]">Crear curso</h2>
              <p className="text-xs text-[#5b6472]">Define los cursos oficiales para asociarlos a alumnos y ensayos.</p>
              <CourseForm action={createCourse} grades={SCHOOL_GRADES} />
            </div>
          )}

          <CSVImport action={importStudents} mappedAction={importStudentsMapped} studentIdLabel={studentIdLabel} />

          <p className="rounded-md border border-[#eef0f3] bg-[#f8fafc] px-4 py-3 text-xs text-[#5b6472]">
            ¿Buscas un alumno puntual? Usa el buscador de{" "}
            <Link href="/dashboard/students" className="font-semibold text-[#07305f] underline">Gestion de alumnos</Link>.
          </p>
        </aside>
      </div>
    </>
  );
}
