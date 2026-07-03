import Link from "next/link";
import { getDashboardContext } from "@/lib/supabase_server";
import { getDashboardMessages } from "@/locales";
import { CSVImport } from "@/components/dashboard/CSVImport";
import { CourseForm } from "@/components/dashboard/CourseForm";
import { StudentForm } from "@/components/dashboard/StudentForm";
import { DeleteButton } from "@/components/dashboard/DeleteButton";
import { CourseRoster } from "@/components/dashboard/CourseRoster";
import { DataTable } from "@/components/dashboard/DataTable";
import { importStudents, createCourse, deleteCourse, deleteStudent, createStudent, updateStudentCourse } from "@/app/dashboard/actions";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { isMissingColumnError } from "@/lib/supabase_errors";

export const dynamic = "force-dynamic";

const CHILEAN_GRADES = [
  "1° Básico",
  "2° Básico",
  "3° Básico",
  "4° Básico",
  "5° Básico",
  "6° Básico",
  "7° Básico",
  "8° Básico",
  "I Medio",
  "II Medio",
  "III Medio",
  "IV Medio",
  "Educación Superior",
  "Otro",
];

type PageProps = {
  searchParams?: Promise<{ course?: string | string[] }>;
};

type StudentRow = {
  id: string;
  student_id: string | null;
  rut: string | null;
  name: string;
  course: string | null;
  course_id?: string | null;
  created_at: string;
};

type CourseRow = { id: string; name: string; grade: string | null };

export default async function StudentsPage({ searchParams }: PageProps) {
  const { supabase, locale, isAdmin } = await getDashboardContext();
  const t = getDashboardMessages(locale);
  const params = await searchParams;
  const selectedCourseId = Array.isArray(params?.course) ? params?.course[0] : params?.course;

  const [studentsResult, { data: courses }] = await Promise.all([
    supabase.from("students").select("id,student_id,rut,name,course,course_id,created_at").order("name"),
    supabase.from("courses").select("id,name,grade").order("name"),
  ]);

  let studentsData: unknown = studentsResult.data;
  if (studentsResult.error && isMissingColumnError(studentsResult.error, "course_id")) {
    const fallbackResult = await supabase.from("students").select("id,student_id,rut,name,course,created_at").order("name");
    studentsData = fallbackResult.data;
  }

  const courseList = (courses ?? []) as CourseRow[];
  const allStudents = (studentsData ?? []) as unknown as StudentRow[];
  const selectedCourse = courseList.find((course) => course.id === selectedCourseId) ?? null;
  const courseStudents = selectedCourse ? allStudents.filter((student) => isStudentInCourse(student, selectedCourse)) : [];
  const visibleStudents = selectedCourse ? courseStudents : allStudents;
  const availableStudents = selectedCourse ? allStudents.filter((student) => !isStudentInCourse(student, selectedCourse)) : [];
  const exportHref = selectedCourse ? `/api/export/students?course=${encodeURIComponent(selectedCourse.name)}` : "/api/export/students";

  return (
    <>
      <PageHeader title={t.students} description="Administra alumnos de forma individual o masiva, gestiona los cursos oficiales y expórtalos en formatos estandarizados." />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,450px)_minmax(0,1fr)] lg:gap-6">
        <div className="space-y-6">
          <div className="rounded-md border border-[#e6e8eb] bg-white p-5 space-y-4">
            <h2 className="text-lg font-semibold text-[#111827]">Cursos oficiales del colegio</h2>
            <p className="text-xs text-[#5b6472]">Define los cursos de tu establecimiento para asociarlos a los alumnos y los ensayos.</p>

            {courseList.length === 0 ? (
              <p className="text-sm italic text-[#9aa2af]">No hay cursos registrados. Agrega el primero abajo.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto divide-y divide-[#eef0f3] pr-1">
                {courseList.map((course) => (
                  <div key={course.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <Link
                      href={`/dashboard/students?course=${course.id}`}
                      className={selectedCourse?.id === course.id ? "min-w-0 rounded-md bg-[#eef4ff] px-2 py-1 text-[#07305f]" : "min-w-0 rounded-md px-2 py-1 hover:bg-[#f4f6f8] hover:text-[#07305f]"}
                    >
                      <span className="block truncate font-semibold">{course.name}</span>
                      <span className="text-xs text-[#6b7280]">{course.grade}</span>
                    </Link>
                    {isAdmin && (
                      <DeleteButton
                        action={deleteCourse}
                        id={course.id}
                        confirm={`¿Eliminar el curso "${course.name}"? Los alumnos no se borran, pero deberás reasignarlos.`}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {isAdmin && <CourseForm action={createCourse} grades={CHILEAN_GRADES} />}
          </div>

          <div className="rounded-md border border-[#e6e8eb] bg-white p-5 space-y-4">
            <h2 className="text-lg font-semibold text-[#111827]">Agregar alumno individual</h2>
            {selectedCourse ? (
              <div className="rounded-md border border-[#eef0f3] bg-[#f8fafc] px-3 py-2 text-sm font-semibold text-[#07305f]">
                Se agregara a {selectedCourse.name}
              </div>
            ) : null}
            <StudentForm action={createStudent} courses={courseList} defaultCourse={selectedCourse?.name} />
          </div>

          <CSVImport action={importStudents} />
        </div>

        <div className="space-y-4">
          {selectedCourse ? (
            <CourseRoster
              courseName={selectedCourse.name}
              students={courseStudents}
              availableStudents={availableStudents}
              isAdmin={isAdmin}
              action={updateStudentCourse}
            />
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#111827]">{selectedCourse ? `Alumnos de ${selectedCourse.name}` : "Todos los alumnos"}</h2>
              {selectedCourse ? <Link href="/dashboard/students" className="mt-1 inline-block text-sm font-semibold text-[#07305f] underline">Ver todos</Link> : null}
            </div>
            <a
              href={isAdmin ? exportHref : undefined}
              download
              aria-disabled={!isAdmin}
              className={`w-full rounded-md border border-[#cfd6df] px-4 py-2 text-center text-sm font-semibold sm:w-auto ${isAdmin ? "hover:bg-[#f4f6f8]" : "pointer-events-none opacity-50"}`}
            >
              Exportar CSV
            </a>
          </div>

          <DataTable
            columns={["RUT/ID", "Nombre", "Curso", "Registro", "Acción"]}
            rows={visibleStudents}
            empty={selectedCourse ? "Este curso no tiene alumnos asignados." : "No hay alumnos registrados en el establecimiento."}
            renderRow={(student) => (
              <tr key={student.id} className="border-b border-[#eef0f3] last:border-0">
                <td className="px-5 py-4 font-mono text-sm">{student.rut ?? student.student_id}</td>
                <td className="px-5 py-4 font-semibold"><Link href={`/dashboard/students/${student.id}`} className="text-[#07305f] hover:underline">{student.name}</Link></td>
                <td className="px-5 py-4 text-[#5b6472]">
                  <span className="rounded bg-[#f4f6f8] px-2 py-0.5 text-xs font-semibold text-[#1e293b]">
                    {student.course ?? "-"}
                  </span>
                </td>
                <td className="px-5 py-4 text-xs text-[#5b6472]">{new Date(student.created_at).toLocaleDateString("es-CL")}</td>
                <td className="px-5 py-4">
                  {isAdmin && (
                    <DeleteButton
                      action={deleteStudent}
                      id={student.id}
                      confirm={`¿Eliminar a ${student.name}? Esta acción no se puede deshacer.`}
                    />
                  )}
                </td>
              </tr>
            )}
            renderMobileRow={(student) => (
              <article key={student.id} className="rounded-md border border-[#e6e8eb] bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/dashboard/students/${student.id}`} className="block truncate text-base font-semibold text-[#07305f] hover:underline">{student.name}</Link>
                    <p className="mt-1 font-mono text-xs text-[#5b6472]">{student.rut ?? student.student_id}</p>
                  </div>
                  <span className="rounded bg-[#f4f6f8] px-2 py-0.5 text-xs font-semibold text-[#1e293b]">
                    {student.course ?? "-"}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-[#5b6472]">
                  <span>Registro: {new Date(student.created_at).toLocaleDateString("es-CL")}</span>
                  {isAdmin && (
                    <DeleteButton
                      action={deleteStudent}
                      id={student.id}
                      confirm={`¿Eliminar a ${student.name}? Esta acción no se puede deshacer.`}
                    />
                  )}
                </div>
              </article>
            )}
          />
        </div>
      </div>
    </>
  );
}

function isStudentInCourse(student: StudentRow, course: CourseRow) {
  return student.course_id ? student.course_id === course.id : student.course === course.name;
}
