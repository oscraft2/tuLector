import Link from "next/link";
import { getDashboardContext } from "@/lib/supabase_server";
import { DataTable } from "@/components/dashboard/DataTable";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EmptyState } from "@/components/dashboard/EmptyState";

export const dynamic = "force-dynamic";

type CourseRow = { id: string; name: string; grade: string | null; student_count?: number };

export default async function CoursesPage() {
  const { supabase } = await getDashboardContext();
  const { data: courses } = await supabase.from("courses").select("id,name,grade").order("name");

  const courseList = (courses ?? []) as CourseRow[];

  if (courseList.length === 0) {
    return (
      <>
        <PageHeader title="Cursos" description="Agrupa alumnos por curso y nivel para ver estadisticas y rendimiento." />
        <EmptyState
          icon="🏫"
          title="Sin cursos creados"
          description="Crea cursos como '4° Básico' o 'I Medio' para organizar tus alumnos y ver el rendimiento de cada curso por ensayo."
          action={{ label: "Gestionar alumnos", href: "/dashboard/students" }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Cursos" description={`${courseList.length} curso${courseList.length === 1 ? "" : "s"} en el establecimiento. Selecciona uno para ver su detalle.`} />
      <DataTable
        columns={["Curso", "Nivel", "Accion"]}
        rows={courseList}
        empty="Sin cursos creados aun."
        renderRow={(course) => (
          <tr key={course.id} className="border-b border-[#eef0f3] last:border-0">
            <td className="px-5 py-4 font-semibold">
              <Link href={`/dashboard/courses/${course.id}`} className="text-[#07305f] hover:underline">{course.name}</Link>
            </td>
            <td className="px-5 py-4 text-[#5b6472]">{course.grade ?? "-"}</td>
            <td className="px-5 py-4">
              <Link href={`/dashboard/courses/${course.id}`} className="rounded-md bg-[#07305f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#062447]">
                Ver detalle
              </Link>
            </td>
          </tr>
        )}
        renderMobileRow={(course) => (
          <article key={course.id} className="rounded-md border border-[#e6e8eb] bg-white p-4 shadow-sm">
            <p className="text-base font-semibold text-[#111827]">{course.name}</p>
            <p className="mt-1 text-sm text-[#5b6472]">Nivel: {course.grade ?? "-"}</p>
            <Link href={`/dashboard/courses/${course.id}`} className="mt-3 inline-block rounded-md border border-[#cfd6df] px-3 py-1.5 text-xs font-semibold text-[#5b6472] hover:bg-[#f4f6f8]">
              Ver detalle
            </Link>
          </article>
        )}
      />
    </>
  );
}
