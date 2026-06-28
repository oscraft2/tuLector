import { getDashboardContext } from "@/lib/supabase_server";
import { getDashboardMessages } from "@/locales";
import { CSVImport } from "@/components/dashboard/CSVImport";
import { DataTable } from "@/components/dashboard/DataTable";
import { importStudents, logExport, createCourse, deleteCourse, createStudent } from "@/app/dashboard/actions";
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
    supabase.from("students").select("id,student_id,rut,name,course,grade,created_at").order("name"),
    supabase.from("courses").select("id,name,grade").order("name"),
  ]);

  const courseList = courses ?? [];

  return (
    <>
      <PageHeader title={t.students} description="Administra alumnos de forma individual o masiva, gestiona los cursos oficiales y expórtalos en formatos estandarizados." />
      
      <div className="grid gap-6 lg:grid-cols-[450px_1fr]">
        
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
                      <form action={deleteCourse}>
                        <input type="hidden" name="id" value={course.id} />
                        <button type="submit" className="text-xs font-semibold text-red-600 hover:underline">Eliminar</button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {isAdmin && (
              <form action={createCourse} className="pt-2 border-t border-[#eef0f3] space-y-3">
                <p className="text-xs font-semibold text-[#07305f]">Agregar nuevo curso</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    name="name"
                    required
                    placeholder="Ej: IV Medio A"
                    className="w-full rounded-md border border-[#cfd6df] px-3 py-1.5 text-sm"
                  />
                  <select
                    name="grade"
                    required
                    className="w-full rounded-md border border-[#cfd6df] bg-white px-2 py-1.5 text-sm"
                  >
                    <option value="">Selecciona nivel</option>
                    {CHILEAN_GRADES.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="w-full rounded-md bg-[#07305f] py-1.5 text-xs font-semibold text-white hover:bg-[#062447]">
                  Crear curso
                </button>
              </form>
            )}
          </div>

          {/* 2. Add Single Student */}
          <div className="rounded-md border border-[#e6e8eb] bg-white p-5 space-y-4">
            <h2 className="text-lg font-semibold text-[#111827]">Agregar alumno individual</h2>
            
            <form action={createStudent} className="space-y-3">
              <label className="block text-xs font-semibold">
                Nombre completo
                <input
                  name="name"
                  required
                  placeholder="Ej: Juan Pérez"
                  className="mt-1 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal text-sm"
                />
              </label>
              
              <label className="block text-xs font-semibold">
                RUT Chileno
                <input
                  name="rut"
                  required
                  placeholder="Ej: 12.345.678-5"
                  className="mt-1 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal text-sm"
                />
              </label>
              
              <label className="block text-xs font-semibold">
                Curso / Grupo
                <select
                  name="course"
                  required
                  className="mt-1 w-full rounded-md border border-[#cfd6df] bg-white px-3 py-2 font-normal text-sm"
                >
                  <option value="">Selecciona curso</option>
                  {courseList.map((c) => (
                    <option key={c.id} value={c.name}>{c.name} ({c.grade})</option>
                  ))}
                </select>
              </label>
              
              <button
                type="submit"
                disabled={courseList.length === 0}
                className="w-full rounded-md bg-[#111827] py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
              >
                {courseList.length === 0 ? "Primero crea un curso" : "Agregar Alumno"}
              </button>
            </form>
          </div>

          {/* 3. Bulk CSV Import */}
          <CSVImport action={importStudents} />
          
        </div>

        {/* Right Column: Students Table */}
        <div className="space-y-4">
          <div className="flex justify-end">
            <form action={logExport}>
              <input type="hidden" name="export_type" value="students_csv" />
              <input type="hidden" name="entity_type" value="students" />
              <button disabled={!isAdmin} className="rounded-md border border-[#cfd6df] px-4 py-2 text-sm font-semibold disabled:opacity-50">
                Exportar CSV
              </button>
            </form>
          </div>
          
          <DataTable
            columns={["RUT/ID", "Nombre", "Curso", "Registro"]}
            rows={students ?? []}
            empty="No hay alumnos registrados en el establecimiento."
            renderRow={(student) => (
              <tr key={student.id} className="border-b border-[#eef0f3] last:border-0">
                <td className="px-5 py-4 font-mono text-sm">{student.rut ?? student.student_id}</td>
                <td className="px-5 py-4 font-semibold">{student.name}</td>
                <td className="px-5 py-4 text-[#5b6472]">
                  <span className="rounded bg-[#f4f6f8] px-2 py-0.5 text-xs font-semibold text-[#1e293b]">
                    {student.course ?? student.grade ?? "-"}
                  </span>
                </td>
                <td className="px-5 py-4 text-xs text-[#5b6472]">{new Date(student.created_at).toLocaleDateString("es-CL")}</td>
              </tr>
            )}
          />
        </div>

      </div>
    </>
  );
}
