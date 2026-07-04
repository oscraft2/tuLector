import Link from "next/link";
import { getDashboardContext } from "@/lib/supabase_server";
import { createStudent } from "@/app/dashboard/actions";
import { StudentForm } from "@/components/dashboard/StudentForm";
import { StudentSearchList } from "@/components/native/StudentSearchList";
import { isMissingColumnError } from "@/lib/supabase_errors";

export const dynamic = "force-dynamic";

type StudentRow = { id: string; rut: string | null; student_id: string | null; name: string; course: string | null };
type CourseRow = { id: string; name: string; grade: string | null };

/**
 * Gestion de alumnos nativa: buscar + agregar uno nuevo, en tarjetas. Deja la
 * gestion de cursos, importacion CSV y edicion masiva para el navegador
 * (/dashboard/students), que sigue intacta para esos flujos mas avanzados.
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

  return (
    <main className="min-h-dvh bg-[#f5f6f8] text-[#0b1220]">
      <header className="safe-pt flex items-center gap-3 bg-[#111827] px-5 pb-5 pt-5 text-white">
        <Link href="/app" aria-label="Volver" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 active:bg-white/20">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </Link>
        <h1 className="text-lg font-black tracking-tight">Alumnos</h1>
      </header>

      <section className="space-y-5 px-5 py-6">
        <StudentSearchList students={students} />

        <div className="rounded-2xl border border-[#e6e8eb] bg-white p-5">
          <h2 className="mb-3 text-base font-bold text-[#111827]">Agregar alumno</h2>
          {courseList.length === 0 ? (
            <p className="text-sm text-[#5b6472]">
              Primero crea un curso desde <Link href="/dashboard/students" className="font-bold text-[#07305f] underline">el navegador</Link>.
            </p>
          ) : (
            <StudentForm action={createStudent} courses={courseList} />
          )}
        </div>
      </section>
    </main>
  );
}
