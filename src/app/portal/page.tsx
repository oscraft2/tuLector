import { getPortalContext, type GuardianStudent } from "@/lib/supabase_server";

type GradeRecordRow = {
  id: string;
  quiz_id: string;
  raw_score: number | null;
  total_questions: number | null;
  calculated_grade: number | null;
  passing: boolean | null;
  graded_at: string;
  student_code: string;
  quizzes: { title: string | null; subject: string | null; evaluation_type: string | null } | null;
};

function studentForRecord(students: GuardianStudent[], studentCode: string): GuardianStudent | undefined {
  return students.find((s) => s.national_id_normalized && s.national_id_normalized === studentCode);
}

export default async function PortalPage() {
  const { supabase, students } = await getPortalContext();

  // RLS (grade_records_select_guardian) ya restringe esto a los alumnos
  // vinculados a este apoderado — no hace falta filtrar por student_code aca.
  const { data: records } = await supabase
    .from("grade_records")
    .select("id, quiz_id, raw_score, total_questions, calculated_grade, passing, graded_at, student_code, quizzes(title, subject, evaluation_type)")
    .order("graded_at", { ascending: false })
    .returns<GradeRecordRow[]>();

  if (students.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#cfd6df] bg-white p-8 text-center">
        <p className="text-sm font-semibold text-[#111827]">Aun no tienes alumnos vinculados</p>
        <p className="mt-2 text-xs text-[#6b7280]">Vuelve a intentar el login con el ID del alumno para vincularlo a tu cuenta.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {students.map((student) => {
        const studentRecords = (records ?? []).filter((r) => studentForRecord(students, r.student_code)?.id === student.id);
        return (
          <section key={student.id} className="rounded-2xl border border-[#e5e7eb] bg-white p-5">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-base font-black text-[#111827]">{student.name ?? "Alumno"}</h2>
              <span className="text-xs text-[#6b7280]">{student.schools?.name ?? ""}</span>
            </div>
            {studentRecords.length === 0 ? (
              <p className="text-sm text-[#6b7280]">Sin pruebas registradas todavia.</p>
            ) : (
              <ul className="divide-y divide-[#f0f1f3]">
                {studentRecords.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-semibold text-[#111827]">{r.quizzes?.title ?? "Prueba"}</p>
                      <p className="text-xs text-[#6b7280]">
                        {r.quizzes?.subject ? `${r.quizzes.subject} · ` : ""}
                        {new Date(r.graded_at).toLocaleDateString("es-CL")} · {r.raw_score}/{r.total_questions}
                      </p>
                    </div>
                    <span className={`rounded-lg px-3 py-1 text-sm font-bold ${r.passing ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                      {r.calculated_grade?.toFixed(1) ?? "-"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
