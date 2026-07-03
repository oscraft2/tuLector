import { getDashboardContext } from "@/lib/supabase_server";
import { getDashboardMessages } from "@/locales";
import { CSVImport } from "@/components/dashboard/CSVImport";
import { CourseForm } from "@/components/dashboard/CourseForm";
import { StudentForm } from "@/components/dashboard/StudentForm";
import { DeleteButton } from "@/components/dashboard/DeleteButton";
import { DataTable } from "@/components/dashboard/DataTable";
import { importStudents, logExport, createCourse, deleteCourse, deleteStudent, createStudent } from "@/app/dashboard/actions";
import { PageHeader } from "@/components/dashboard/PageHeader";

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

export default async function StudentsPage() {
  const { supabase, locale, isAdmin } = await getDashboardContext();
  const t = getDashboardMessages(locale);

  // Fetch students and courses
  const [{ data: students }, { data: courses }] = await Promise.all([
    supabase.from("students").select("id,student_id,rut,name,course,created_at").order("name"),
    supabase.from("courses").select("id,name,grade").order("name"),
  ]);

  const courseList = courses ?? [];

  return (
    <>
      <PageHeader title={t.students} description="Administra alumnos de forma individual o masiva, gestiona los cursos oficiales y expórtalos en formatos estandarizados." />
      
      <div className="grid gap-5 lg:grid-cols-[minmax(0,450px)_minmax(0,1fr)] lg:gap-6">
        
        {/* Left Column: Course Catalog & Student Addition */}
        <div className="space-y-6">
          
          {/* 1. Course Catalog Management */}
          <div className="rounded-md border border-[#e6e8eb] bg-white p-5 space-y-4">
            <h2 className="text-lg font-semibold text-[#111827]">Cursos oficiales del colegio</h2>
            <p className="text-xs text-[#5b6472]">Define los cursos de tu establecimiento para asociarlos a los alumnos y los ensayos.</p>
            
            {courseList.length === 0 ? (
              <p className="text-sm italic text-[#9aa2af]">No hay cursos registrados. Agrega el primero abajo.</p>
            ) : (
              <div className="max-h-40 overflow-y-auto divide-y divide-[#eef0f3] pr-1">
                {courseList.map((course) => (
                  <div key={course.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <span className="font-semibold text-[#111827]">{course.name}</span>
                      <span className="ml-2 text-xs text-[#6b7280]">({course.grade})</span>
                    </div>
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

          {/* 2. Add Single Student */}
          <div className="rounded-md border border-[#e6e8eb] bg-white p-5 space-y-4">
            <h2 className="text-lg font-semibold text-[#111827]">Agregar alumno individual</h2>
            
            <StudentForm action={createStudent} courses={courseList} />
          </div>

          {/* 3. Bulk CSV Import */}
          <CSVImport action={importStudents} />
          
        </div>

        {/* Right Column: Students Table */}
        <div className="space-y-4">
          <div className="flex justify-end">
            <form action={logExport} className="w-full sm:w-auto">
              <input type="hidden" name="export_type" value="students_csv" />
              <input type="hidden" name="entity_type" value="students" />
              <button disabled={!isAdmin} className="w-full rounded-md border border-[#cfd6df] px-4 py-2 text-sm font-semibold disabled:opacity-50 sm:w-auto">
                Exportar CSV
              </button>
            </form>
          </div>
          
          <DataTable
            columns={["RUT/ID", "Nombre", "Curso", "Registro", "Acción"]}
            rows={students ?? []}
            empty="No hay alumnos registrados en el establecimiento."
            renderRow={(student) => (
              <tr key={student.id} className="border-b border-[#eef0f3] last:border-0">
                <td className="px-5 py-4 font-mono text-sm">{student.rut ?? student.student_id}</td>
                <td className="px-5 py-4 font-semibold">{student.name}</td>
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
                    <p className="truncate text-base font-semibold text-[#111827]">{student.name}</p>
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
