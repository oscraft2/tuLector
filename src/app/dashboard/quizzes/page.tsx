import Link from "next/link";
import { getDashboardContext } from "@/lib/supabase_server";
import { getDashboardMessages, formatDate } from "@/locales";
import { DataTable } from "@/components/dashboard/DataTable";
import { archiveQuiz, duplicateQuiz, startScanForQuiz } from "@/app/dashboard/actions";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { QuizCreateForm } from "@/components/dashboard/QuizCreateForm";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { isMissingColumnError } from "@/lib/supabase_errors";
import { resolveCountryProfile } from "@/lib/country_profiles";

export const dynamic = "force-dynamic";

const DUP_CLS = "rounded-md border border-[#cfd6df] px-3 py-1.5 text-xs font-semibold hover:bg-gray-50";
const ARCH_CLS = "rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50";
const DUP_CLS_M = "rounded-md border border-[#cfd6df] px-3 py-2 text-xs font-semibold hover:bg-gray-50";
const ARCH_CLS_M = "rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50";

type QuizRow = {
  id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  course_id?: string | null;
  num_questions: number | null;
  options_per_question: number | null;
  answer_key: string | null;
  created_at: string;
};

function isKeyIncomplete(quiz: Pick<QuizRow, "answer_key" | "num_questions">) {
  const key = String(quiz.answer_key ?? "");
  return key.includes("-") || key.length < Number(quiz.num_questions ?? 0);
}

type CourseRow = { id: string; name: string; grade: string | null };

export default async function QuizzesPage() {
  const { supabase, locale, school } = await getDashboardContext();
  const t = getDashboardMessages(locale);

  const [quizzesResult, { data: courses }] = await Promise.all([
    supabase.from("quizzes").select("id,title,subject,grade,course_id,num_questions,options_per_question,answer_key,created_at,archived_at").is("archived_at", null).order("created_at", { ascending: false }),
    supabase.from("courses").select("id,name,grade").order("name"),
  ]);

  let quizzesData: unknown = quizzesResult.data;
  if (quizzesResult.error && isMissingColumnError(quizzesResult.error, "course_id")) {
    const fallbackResult = await supabase.from("quizzes").select("id,title,subject,grade,num_questions,options_per_question,answer_key,created_at,archived_at").is("archived_at", null).order("created_at", { ascending: false });
    quizzesData = fallbackResult.data;
  }

  const courseList = (courses ?? []) as CourseRow[];
  const quizzes = (quizzesData ?? []) as unknown as QuizRow[];
  const courseNameById = new Map(courseList.map((course) => [course.id, course.name]));
  const countryProfile = resolveCountryProfile(school.country_code ?? "CL");
  // El texto de ayuda no puede nombrar PAES/SIMCE (Chile) para un colegio de
  // otro pais -- usa los sistemas de evaluacion reales de su perfil.
  const evaluationHint = countryProfile.code === "CL"
    ? "personalizada, PAES o SIMCE"
    : `personalizada o ${countryProfile.evaluationSystems.map((s) => s.replace(/_/g, " ")).join("/")}`;

  return (
    <>
      <PageHeader title={t.quizzes} description="Crea ensayos, define claves, duplica instrumentos y genera hojas v2 imprimibles para leerlas luego desde la app movil." />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,450px)_minmax(0,1fr)] xl:gap-6">

        {/* Left Column: Create Quiz Form (cliente: toast + estado "Creando…") */}
        {quizzes.length === 0 && (
          <p className="rounded-md border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm text-blue-800">
            Un ensayo define las preguntas, la clave de respuestas y el tipo de evaluacion ({evaluationHint}). Al crearlo podras generar su hoja imprimible y escanearla desde la app movil.
          </p>
        )}
        <QuizCreateForm courses={courseList} countryCode={school.country_code ?? "CL"} />

        {/* Right Column: Quiz Datatable */}
        <DataTable
          columns={["Ensayo", "Asignatura", "Curso", "Formato", "Creado", "Acciones"]}
          rows={quizzes}
          empty="Todavía no hay ensayos creados en el establecimiento."
          renderRow={(quiz) => (
            <tr key={quiz.id} className="border-b border-[#eef0f3] last:border-0">
              <td className="px-5 py-4 font-semibold">
                <Link href={`/dashboard/quizzes/${quiz.id}`} className="hover:underline text-[#07305f]">
                  {quiz.title}
                </Link>
                {isKeyIncomplete(quiz) && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Clave incompleta</span>
                )}
              </td>
              <td className="px-5 py-4 text-[#5b6472]">{quiz.subject ?? "-"}</td>
              <td className="px-5 py-4">
                <span className="rounded bg-[#f4f6f8] px-2 py-0.5 text-xs font-semibold text-[#1e293b]">
                  {courseLabel(quiz, courseNameById)}
                </span>
              </td>
              <td className="px-5 py-4 text-[#5b6472]">{quiz.num_questions}x{quiz.options_per_question ?? 5}</td>
              <td className="px-5 py-4 text-xs text-[#5b6472]">{formatDate(quiz.created_at, locale)}</td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap gap-2">
                  <Link href={`/sheet?quiz=${quiz.id}`} className="rounded-md border border-[#cfd6df] px-3 py-1.5 text-xs font-semibold hover:bg-gray-50">
                    Hoja
                  </Link>
                  <form action={startScanForQuiz}>
                    <input type="hidden" name="quiz_id" value={quiz.id} />
                    <button className="rounded-md border border-[#cfd6df] px-3 py-1.5 text-xs font-semibold hover:bg-gray-50">
                      Escanear
                    </button>
                  </form>
                  <ActionButton
                    action={duplicateQuiz}
                    fields={{ id: quiz.id }}
                    label="Duplicar"
                    pendingLabel="Duplicando…"
                    className={DUP_CLS}
                  />
                  <ActionButton
                    action={archiveQuiz}
                    fields={{ id: quiz.id }}
                    label="Archivar"
                    pendingLabel="Archivando…"
                    className={ARCH_CLS}
                    confirm={`¿Archivar "${quiz.title}"? Podrás recuperarlo desde archivados.`}
                    confirmTitle="¿Archivar ensayo?"
                    confirmLabel="Archivar"
                  />
                </div>
              </td>
            </tr>
          )}
          renderMobileRow={(quiz) => (
            <article key={quiz.id} className="rounded-md border border-[#e6e8eb] bg-white p-4 shadow-sm">
              <Link href={`/dashboard/quizzes/${quiz.id}`} className="block text-base font-semibold text-[#07305f] hover:underline">{quiz.title}</Link>
              {isKeyIncomplete(quiz) && (
                <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Clave incompleta</span>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#5b6472]">
                <p><span className="font-semibold text-[#111827]">Asignatura:</span> {quiz.subject ?? "-"}</p>
                <p><span className="font-semibold text-[#111827]">Curso:</span> {courseLabel(quiz, courseNameById)}</p>
                <p><span className="font-semibold text-[#111827]">Formato:</span> {quiz.num_questions}x{quiz.options_per_question ?? 5}</p>
                <p><span className="font-semibold text-[#111827]">Creado:</span> {formatDate(quiz.created_at, locale)}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/sheet?quiz=${quiz.id}`} className="rounded-md border border-[#cfd6df] px-3 py-2 text-xs font-semibold hover:bg-gray-50">Hoja</Link>
                <form action={startScanForQuiz}><input type="hidden" name="quiz_id" value={quiz.id} /><button className="rounded-md border border-[#cfd6df] px-3 py-2 text-xs font-semibold hover:bg-gray-50">Escanear</button></form>
                <ActionButton action={duplicateQuiz} fields={{ id: quiz.id }} label="Duplicar" pendingLabel="Duplicando…" className={DUP_CLS_M} />
                <ActionButton action={archiveQuiz} fields={{ id: quiz.id }} label="Archivar" pendingLabel="Archivando…" className={ARCH_CLS_M} confirm={`¿Archivar "${quiz.title}"?`} confirmTitle="¿Archivar ensayo?" confirmLabel="Archivar" />
              </div>
            </article>
          )}
        />
      </div>
    </>
  );
}

function courseLabel(quiz: QuizRow, courseNameById: Map<string, string>) {
  return quiz.course_id ? courseNameById.get(quiz.course_id) ?? quiz.grade ?? "-" : quiz.grade ?? "-";
}
