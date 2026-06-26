import Link from "next/link";
import { getDashboardContext } from "@/lib/supabase_server";
import { getDashboardMessages, formatDate } from "@/locales";
import { DashboardShell } from "@/components/dashboard/DashboardNav";
import { AnswerKeyEditor } from "@/components/dashboard/AnswerKeyEditor";
import { DataTable } from "@/components/dashboard/DataTable";
import { createQuiz, archiveQuiz, duplicateQuiz, startScanForQuiz } from "@/app/dashboard/actions";

export const dynamic = "force-dynamic";

export default async function QuizzesPage() {
  const { supabase, locale } = await getDashboardContext();
  const t = getDashboardMessages(locale);
  const { data: quizzes } = await supabase.from("quizzes").select("id,title,subject,grade,num_questions,created_at,archived_at").is("archived_at", null).order("created_at", { ascending: false });

  return (
    <DashboardShell locale={locale} title={t.quizzes} description="Crea ensayos, define claves, duplica instrumentos y genera hojas v2 imprimibles para leerlas luego desde la app movil.">
      <div className="grid gap-6 xl:grid-cols-[430px_1fr]">
        <form action={createQuiz} className="rounded-md border border-[#e1e5ea] bg-white p-5">
          <h2 className="text-xl font-semibold">Nuevo ensayo</h2>
          <div className="mt-5 grid gap-4">
            <label className="text-sm font-semibold">Titulo<input name="title" required className="mt-2 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal" placeholder="Matematica M1 - Ensayo 05" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-semibold">Asignatura<input name="subject" className="mt-2 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal" /></label>
              <label className="text-sm font-semibold">Curso<input name="grade" className="mt-2 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal" placeholder="IV Medio" /></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-semibold">Preguntas<input name="num_questions" type="number" min="1" max="100" defaultValue="20" className="mt-2 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal" /></label>
              <label className="text-sm font-semibold">Opciones<input name="options_per_question" type="number" min="2" max="8" defaultValue="5" className="mt-2 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal" /></label>
            </div>
            <input type="hidden" name="option_labels" value="A,B,C,D,E" />
            <AnswerKeyEditor questions={20} />
            <button className="rounded-md bg-[#07305f] px-4 py-2 text-sm font-semibold text-white">Crear ensayo</button>
          </div>
        </form>

        <DataTable
          columns={["Ensayo", "Asignatura", "Preguntas", "Creado", "Acciones"]}
          rows={quizzes ?? []}
          empty="Todavia no hay ensayos. Crea uno para generar su hoja imprimible."
          renderRow={(quiz) => (
            <tr key={quiz.id} className="border-b border-[#eef0f3] last:border-0">
              <td className="px-5 py-4 font-semibold"><Link href={`/dashboard/quizzes/${quiz.id}`} className="hover:underline">{quiz.title}</Link></td>
              <td className="px-5 py-4 text-[#5b6472]">{quiz.subject ?? "-"}</td>
              <td className="px-5 py-4 text-[#5b6472]">{quiz.num_questions}</td>
              <td className="px-5 py-4 text-[#5b6472]">{formatDate(quiz.created_at, locale)}</td>
              <td className="px-5 py-4">
                <div className="flex gap-2">
                  <Link href={`/sheet?quiz=${quiz.id}`} className="rounded-md border border-[#cfd6df] px-3 py-1.5 text-xs font-semibold">Hoja</Link><form action={startScanForQuiz}><input type="hidden" name="quiz_id" value={quiz.id} /><button className="rounded-md border border-[#cfd6df] px-3 py-1.5 text-xs font-semibold">Escanear</button></form>
                  <form action={duplicateQuiz}><input type="hidden" name="id" value={quiz.id} /><button className="rounded-md border border-[#cfd6df] px-3 py-1.5 text-xs font-semibold">Duplicar</button></form>
                  <form action={archiveQuiz}><input type="hidden" name="id" value={quiz.id} /><button className="rounded-md border border-[#cfd6df] px-3 py-1.5 text-xs font-semibold">Archivar</button></form>
                </div>
              </td>
            </tr>
          )}
        />
      </div>
    </DashboardShell>
  );
}

