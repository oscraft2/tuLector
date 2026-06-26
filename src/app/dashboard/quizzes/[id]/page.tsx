import Link from "next/link";
import { notFound } from "next/navigation";
import { getDashboardContext } from "@/lib/supabase_server";
import { DashboardShell } from "@/components/dashboard/DashboardNav";
import { DataTable } from "@/components/dashboard/DataTable";
import { StatusPill } from "@/components/AppShell";
import { startScanForQuiz } from "@/app/dashboard/actions";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function QuizDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { supabase, locale } = await getDashboardContext();
  const [{ data: quiz }, { data: papers }, { data: metadata }] = await Promise.all([
    supabase.from("quizzes").select("*").eq("id", id).single(),
    supabase.from("papers").select("id,student_name,student_id,score,total,status,scanned_at").eq("quiz_id", id).order("scanned_at", { ascending: false }),
    supabase.from("question_metadata").select("question_number,axis_name,skill_name,difficulty").eq("quiz_id", id).order("question_number"),
  ]);
  if (!quiz) notFound();
  const avg = papers?.length ? Math.round(papers.reduce((s, p) => s + ((p.score ?? 0) / Math.max(1, p.total ?? quiz.num_questions)) * 100, 0) / papers.length) : 0;

  return (
    <DashboardShell locale={locale} title={quiz.title} description="Detalle del ensayo, clave, lecturas sincronizadas y analisis por item.">
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-4">
          <Info label="Preguntas" value={quiz.num_questions} />
          <Info label="Asignatura" value={quiz.subject ?? "-"} />
          <Info label="Curso" value={quiz.grade ?? "-"} />
          <Info label="Promedio" value={`${avg}%`} />
        </section>
        <section className="rounded-md border border-[#e1e5ea] bg-white p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div><h2 className="text-xl font-semibold">Clave</h2><p className="mt-1 font-mono text-sm tracking-wider text-[#5b6472]">{quiz.answer_key}</p></div>
            <div className="flex gap-2"><Link href={`/sheet?quiz=${quiz.id}`} className="rounded-md border border-[#cfd6df] px-4 py-2 text-sm font-semibold">Generar hoja</Link><form action={startScanForQuiz}><input type="hidden" name="quiz_id" value={quiz.id} /><button className="rounded-md bg-[#07305f] px-4 py-2 text-sm font-semibold text-white">Abrir lector</button></form></div>
          </div>
        </section>
        <DataTable columns={["Alumno", "Puntaje", "Estado", "Fecha"]} rows={papers ?? []} empty="Aun no hay lecturas sincronizadas para este ensayo." renderRow={(paper) => (
          <tr key={paper.id} className="border-b border-[#eef0f3] last:border-0"><td className="px-5 py-4 font-semibold">{paper.student_name ?? paper.student_id ?? "Sin identificar"}</td><td className="px-5 py-4">{paper.score ?? "-"}/{paper.total ?? quiz.num_questions}</td><td className="px-5 py-4"><StatusPill>{paper.status ?? "active"}</StatusPill></td><td className="px-5 py-4 text-[#5b6472]">{new Date(paper.scanned_at).toLocaleString("es-CL")}</td></tr>
        )} />
        <DataTable columns={["Pregunta", "Eje", "Habilidad", "Dificultad"]} rows={metadata ?? []} empty="Sin metadatos curriculares por item." renderRow={(row) => (
          <tr key={row.question_number} className="border-b border-[#eef0f3] last:border-0"><td className="px-5 py-4 font-semibold">{row.question_number}</td><td className="px-5 py-4 text-[#5b6472]">{row.axis_name ?? "-"}</td><td className="px-5 py-4 text-[#5b6472]">{row.skill_name ?? "-"}</td><td className="px-5 py-4 text-[#5b6472]">{row.difficulty ?? "-"}</td></tr>
        )} />
      </div>
    </DashboardShell>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-md border border-[#e1e5ea] bg-white p-5"><p className="text-sm text-[#5b6472]">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>;
}


