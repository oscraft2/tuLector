import Link from "next/link";
import { getDashboardContext } from "@/lib/supabase_server";
import { getDashboardMessages } from "@/locales";
import { StudentForm } from "@/components/dashboard/StudentForm";
import { DeleteButton } from "@/components/dashboard/DeleteButton";
import { DataTable } from "@/components/dashboard/DataTable";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { deleteStudent, createStudent } from "@/app/dashboard/actions";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StudentFilters } from "@/components/dashboard/StudentFilters";
import { Pagination } from "@/components/dashboard/Pagination";
import { StudentAvatar } from "@/components/dashboard/StudentAvatar";
import {
  fetchStudentPage, parseStudentFilters, studentFiltersToQuery, hasActiveFilters, PAGE_SIZE,
} from "@/lib/student_search";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type CourseRow = { id: string; name: string; grade: string | null };

/**
 * Gestion de ALUMNOS. Solo estudiantes: buscador, filtros y alta individual.
 * Todo lo de cursos (crear, editar, archivar, roster e importacion masiva) vive
 * en /dashboard/courses.
 *
 * Esta pagina ya NO se trae la tabla completa: pide una pagina de PAGE_SIZE
 * filas y el total, y los filtros se resuelven en la base (ver student_search.ts
 * y la migracion 20260810000000_student_directory.sql).
 */
export default async function StudentsPage({ searchParams }: PageProps) {
  const { supabase, locale, isAdmin, school } = await getDashboardContext();
  const t = getDashboardMessages(locale);
  const params = await searchParams;
  const filters = parseStudentFilters(params);

  // El catalogo de cursos es chico (decenas) y alimenta el desplegable del
  // filtro y el formulario de alta.
  const [{ data: courses }, page] = await Promise.all([
    supabase.from("courses").select("id,name,grade").eq("school_id", school.id).is("archived_at", null).order("name"),
    fetchStudentPage(supabase, school, filters),
  ]);

  const courseList = (courses ?? []) as CourseRow[];
  const grades = [...new Set(courseList.map((c) => c.grade).filter((g): g is string => Boolean(g)))].sort();
  const filtering = hasActiveFilters(filters);

  const baseQuery = studentFiltersToQuery({ ...filters, page: 1 });
  const selectedCourse = filters.noCourse ? null : courseList.find((c) => c.id === filters.courseId) ?? null;
  // El export entiende los mismos parametros que el listado, asi que el CSV sale
  // con exactamente las filas que el profesor esta viendo.
  const exportHref = `/api/export/students${baseQuery.toString() ? `?${baseQuery.toString()}` : ""}`;

  // "Sin alumnos" de verdad (base vacia) vs "el filtro no encontro nada" son
  // situaciones distintas y necesitan mensajes distintos.
  const emptyDatabase = page.total === 0 && !filtering;

  return (
    <>
      <PageHeader
        title={t.students}
        description="Busca, filtra y administra los alumnos del establecimiento. Los cursos y la importación masiva se gestionan en Cursos."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:gap-6">
        <div className="space-y-4">
          <StudentFilters courses={courseList} grades={grades} total={page.total} degraded={page.degraded} />

          {emptyDatabase ? (
            <EmptyState
              icon="👥"
              title="Sin alumnos registrados"
              description="Importa tu lista de alumnos desde Cursos o crea el primer alumno con el formulario de la derecha."
              action={{ label: "Ir a Cursos", href: "/dashboard/courses" }}
            />
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold text-[#1c1917]">
                  {filtering ? "Resultados" : "Todos los alumnos"}
                </h2>
                <a
                  href={isAdmin ? exportHref : undefined}
                  download
                  aria-disabled={!isAdmin}
                  className={`w-full rounded-lg border border-[#d6d3cb] bg-white px-4 py-2 text-center text-sm font-semibold sm:w-auto ${isAdmin ? "hover:bg-[#faf9f6]" : "pointer-events-none opacity-50"}`}
                >
                  Exportar CSV
                </a>
              </div>

              <DataTable
                columns={["RUT/ID", "Nombre", "Curso", "Ensayos", "Registro", "Acción"]}
                rows={page.rows}
                empty="Ningún alumno coincide con los filtros aplicados."
                renderRow={(student) => (
                  <tr key={student.id} className="border-b border-[#efede8] last:border-0">
                    <td className="px-5 py-3.5 font-mono text-sm text-[#44403c]">{student.rut ?? student.student_id}</td>
                    <td className="px-5 py-3.5 font-semibold">
                      <Link href={`/dashboard/students/${student.id}`} className="inline-flex items-center gap-2.5 text-[#07305f] hover:underline">
                        <StudentAvatar seed={student.id} name={student.name} size="sm" />
                        <span>{student.name}</span>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-[#57534e]">
                      <span className="rounded-md bg-[#f4f2ec] px-2.5 py-1 text-xs font-semibold text-[#44403c]">
                        {student.course ?? "Sin curso"}
                      </span>
                    </td>
                    <td className="tnum px-5 py-3.5 text-sm text-[#57534e]">{page.degraded ? "—" : student.papers_count}</td>
                    <td className="tnum px-5 py-3.5 text-xs text-[#78716c]">{new Date(student.created_at).toLocaleDateString("es-CL")}</td>
                    <td className="px-5 py-3.5">
                      {isAdmin ? (
                        <DeleteButton
                          action={deleteStudent}
                          id={student.id}
                          confirm={`¿Eliminar a ${student.name}? Esta acción no se puede deshacer.`}
                        />
                      ) : null}
                    </td>
                  </tr>
                )}
                renderMobileRow={(student) => (
                  <article key={student.id} className="rounded-xl border border-[#e7e5df] bg-white p-4 shadow-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <StudentAvatar seed={student.id} name={student.name} size="sm" />
                        <div className="min-w-0">
                          <Link href={`/dashboard/students/${student.id}`} className="block truncate text-base font-semibold text-[#07305f] hover:underline">{student.name}</Link>
                          <p className="mt-0.5 font-mono text-xs text-[#57534e]">{student.rut ?? student.student_id}</p>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-md bg-[#f4f2ec] px-2 py-0.5 text-xs font-semibold text-[#44403c]">
                        {student.course ?? "Sin curso"}
                      </span>
                    </div>
                    <div className="tnum mt-3 flex items-center justify-between text-xs text-[#57534e]">
                      <span>Registro: {new Date(student.created_at).toLocaleDateString("es-CL")}</span>
                      {!page.degraded && <span>{student.papers_count} ensayo{student.papers_count === 1 ? "" : "s"}</span>}
                    </div>
                    {isAdmin ? (
                      <div className="mt-4 flex flex-wrap gap-3 text-sm">
                        <DeleteButton
                          action={deleteStudent}
                          id={student.id}
                          confirm={`¿Eliminar a ${student.name}? Esta acción no se puede deshacer.`}
                        />
                      </div>
                    ) : null}
                  </article>
                )}
              />

              <Pagination
                page={page.page}
                pageCount={page.pageCount}
                total={page.total}
                pageSize={PAGE_SIZE}
                baseQuery={baseQuery}
              />
            </>
          )}
        </div>

        <aside className="space-y-6">
          <div className="rounded-xl border border-[#e7e5df] bg-white p-5 space-y-4 shadow-xs">
            <h2 className="text-lg font-semibold text-[#1c1917]">Agregar alumno</h2>
            <p className="text-xs text-[#57534e]">
              Para cargar un curso completo usa la importación masiva en{" "}
              <Link href="/dashboard/courses" className="font-semibold text-[#07305f] underline">Cursos</Link>.
            </p>
            <StudentForm action={createStudent} courses={courseList} defaultCourse={selectedCourse?.name} />
          </div>
        </aside>
      </div>
    </>
  );
}
