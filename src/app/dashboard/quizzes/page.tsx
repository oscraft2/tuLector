import Link from "next/link";
import { getDashboardContext } from "@/lib/supabase_server";
import { getDashboardMessages, formatDate } from "@/locales";
import { AnswerKeyEditor } from "@/components/dashboard/AnswerKeyEditor";
import { DataTable } from "@/components/dashboard/DataTable";
import { createQuiz, archiveQuiz, duplicateQuiz, startScanForQuiz } from "@/app/dashboard/actions";
import { QUIZ_MAX_QUESTIONS } from "@/lib/quiz_constraints";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { SubmitButton } from "@/components/dashboard/SubmitButton";

export const dynamic = "force-dynamic";

const CHILEAN_SUBJECTS = [
  "Lengua y Literatura",
  "Matemática",
  "Historia, Geografía y Ciencias Sociales",
  "Ciencias Naturales (Biología)",
  "Ciencias Naturales (Física)",
  "Ciencias Naturales (Química)",
  "Inglés",
  "Educación Física y Salud",
  "Artes Visuales",
  "Música",
  "Tecnología",
  "Orientación",
  "Otro",
];

export default async function QuizzesPage() {
  const { supabase, locale } = await getDashboardContext();
  const t = getDashboardMessages(locale);

  // Load quizzes and courses
  const [{ data: quizzes }, { data: courses }] = await Promise.all([
    supabase.from("quizzes").select("id,title,subject,grade,num_questions,options_per_question,created_at,archived_at").is("archived_at", null).order("created_at", { ascending: false }),
    supabase.from("courses").select("id,name,grade").order("name"),
  ]);

  const courseList = courses ?? [];

  return (
    <>
      <PageHeader title={t.quizzes} description="Crea ensayos, define claves, duplica instrumentos y genera hojas v2 imprimibles para leerlas luego desde la app movil." />
      
      <div className="grid gap-5 xl:grid-cols-[minmax(0,450px)_minmax(0,1fr)] xl:gap-6">
        
        {/* Left Column: Create Quiz Form */}
        <form action={createQuiz} className="rounded-md border border-[#e1e5ea] bg-white p-5 space-y-4">
          <h2 className="text-xl font-semibold">Nuevo ensayo</h2>
          
          <div className="space-y-4">
            <label className="block text-sm font-semibold">
              Título
              <input
                name="title"
                required
                className="mt-2 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal text-sm"
                placeholder="Matemática M1 - Ensayo 05"
              />
            </label>
            
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold">
                Asignatura (Base Curricular)
                <select
                  name="subject"
                  required
                  className="mt-2 w-full rounded-md border border-[#cfd6df] bg-white px-2 py-2 font-normal text-sm"
                >
                  <option value="">Selecciona materia</option>
                  {CHILEAN_SUBJECTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              
              <label className="block text-sm font-semibold">
                Curso del establecimiento
                <select
                  name="grade"
                  required
                  className="mt-2 w-full rounded-md border border-[#cfd6df] bg-white px-2 py-2 font-normal text-sm"
                >
                  <option value="">Selecciona curso</option>
                  {courseList.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
                {courseList.length === 0 && (
                  <span className="mt-1 block text-[10px] text-amber-700">
                    * Primero crea un curso en {" "}
                    <Link href="/dashboard/students" className="underline font-bold">
                      Alumnos
                    </Link>
                  </span>
                )}
              </label>
            </div>
            
            <AnswerKeyEditor questions={20} />
            
            <p className="text-xs text-[#5b6472]">
              Formatos compatibles con el lector móvil: hasta {QUIZ_MAX_QUESTIONS} preguntas y 3, 4 o 5 opciones.
            </p>
            
            <SubmitButton
              pendingLabel="Creando ensayo…"
              disabled={courseList.length === 0}
              className="w-full rounded-md bg-[#07305f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#062447] disabled:opacity-50"
            >
              {courseList.length === 0 ? "Requiere crear curso primero" : "Crear ensayo"}
            </SubmitButton>
          </div>
        </form>

        {/* Right Column: Quiz Datatable */}
        <DataTable
          columns={["Ensayo", "Asignatura", "Curso", "Formato", "Creado", "Acciones"]}
          rows={quizzes ?? []}
          empty="Todavía no hay ensayos creados en el establecimiento."
          renderRow={(quiz) => (
            <tr key={quiz.id} className="border-b border-[#eef0f3] last:border-0">
              <td className="px-5 py-4 font-semibold">
                <Link href={`/dashboard/quizzes/${quiz.id}`} className="hover:underline text-[#07305f]">
                  {quiz.title}
                </Link>
              </td>
              <td className="px-5 py-4 text-[#5b6472]">{quiz.subject ?? "-"}</td>
              <td className="px-5 py-4">
                <span className="rounded bg-[#f4f6f8] px-2 py-0.5 text-xs font-semibold text-[#1e293b]">
                  {quiz.grade ?? "-"}
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
                  <form action={duplicateQuiz}>
                    <input type="hidden" name="id" value={quiz.id} />
                    <button className="rounded-md border border-[#cfd6df] px-3 py-1.5 text-xs font-semibold hover:bg-gray-50">
                      Duplicar
                    </button>
                  </form>
                  <form action={archiveQuiz}>
                    <input type="hidden" name="id" value={quiz.id} />
                    <button className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">
                      Archivar
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          )}
          renderMobileRow={(quiz) => (
            <article key={quiz.id} className="rounded-md border border-[#e6e8eb] bg-white p-4 shadow-sm">
              <Link href={`/dashboard/quizzes/${quiz.id}`} className="block text-base font-semibold text-[#07305f] hover:underline">{quiz.title}</Link>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#5b6472]">
                <p><span className="font-semibold text-[#111827]">Asignatura:</span> {quiz.subject ?? "-"}</p>
                <p><span className="font-semibold text-[#111827]">Curso:</span> {quiz.grade ?? "-"}</p>
                <p><span className="font-semibold text-[#111827]">Formato:</span> {quiz.num_questions}x{quiz.options_per_question ?? 5}</p>
                <p><span className="font-semibold text-[#111827]">Creado:</span> {formatDate(quiz.created_at, locale)}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/sheet?quiz=${quiz.id}`} className="rounded-md border border-[#cfd6df] px-3 py-2 text-xs font-semibold hover:bg-gray-50">Hoja</Link>
                <form action={startScanForQuiz}><input type="hidden" name="quiz_id" value={quiz.id} /><button className="rounded-md border border-[#cfd6df] px-3 py-2 text-xs font-semibold hover:bg-gray-50">Escanear</button></form>
                <form action={duplicateQuiz}><input type="hidden" name="id" value={quiz.id} /><button className="rounded-md border border-[#cfd6df] px-3 py-2 text-xs font-semibold hover:bg-gray-50">Duplicar</button></form>
                <form action={archiveQuiz}><input type="hidden" name="id" value={quiz.id} /><button className="rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50">Archivar</button></form>
              </div>
            </article>
          )}
        />
      </div>
    </>
  );
}
