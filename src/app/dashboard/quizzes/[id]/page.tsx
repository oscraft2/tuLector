import Link from "next/link";
import { notFound } from "next/navigation";
import { getDashboardContext } from "@/lib/supabase_server";
import { DataTable } from "@/components/dashboard/DataTable";
import { StatusPill } from "@/components/AppShell";
import { startScanForQuiz } from "@/app/dashboard/actions";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { QuizStats } from "@/components/dashboard/QuizStats";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function QuizDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { supabase, locale } = await getDashboardContext();
  const [{ data: quiz }, { data: papers }, { data: metadata }] = await Promise.all([
    supabase.from("quizzes").select("*").eq("id", id).single(),
    supabase.from("papers").select("id,student_name,student_id,score,total,status,scanned_at,equivalent_score,grade,answers").eq("quiz_id", id).order("scanned_at", { ascending: false }),
    supabase.from("question_metadata").select("question_number,axis_name,skill_name,difficulty").eq("quiz_id", id).order("question_number"),
  ]);
  if (!quiz) notFound();
  const avg = papers?.length ? Math.round(papers.reduce((s, p) => s + ((p.score ?? 0) / Math.max(1, p.total ?? quiz.num_questions)) * 100, 0) / papers.length) : 0;

  const isPAES = quiz.evaluation_type === "paes";
  const isSIMCE = quiz.evaluation_type === "simce";

  const getScoreDisplay = (paper: any) => {
    if (isPAES) {
      return `${paper.equivalent_score ?? Math.round(100 + ((paper.score ?? 0) / (paper.total || quiz.num_questions)) * 900)} pts PAES`;
    }
    if (isSIMCE) {
      return `${paper.equivalent_score ?? Math.round(100 + ((paper.score ?? 0) / (paper.total || quiz.num_questions)) * 300)} pts SIMCE`;
    }
    const defaultGrade = paper.grade || (paper.total ? calculateGradeFallback(paper.score, paper.total) : "-");
    return `Nota ${defaultGrade}`;
  };

  const getVariantLabel = () => {
    if (!quiz.evaluation_variant) return "Personalizado";
    const labels: Record<string, string> = {
      paes_m1: "PAES Competencia Matemática 1 (M1)",
      paes_m2: "PAES Competencia Matemática 2 (M2)",
      paes_lectora: "PAES Competencia Lectora",
      paes_ciencias: "PAES Ciencias",
      paes_historia: "PAES Historia",
      simce_4b_mate: "SIMCE 4° Básico - Matemática",
      simce_4b_lectura: "SIMCE 4° Básico - Lectura",
      simce_8b_mate: "SIMCE 8° Básico - Matemática",
      simce_8b_lectura: "SIMCE 8° Básico - Lectura",
      simce_2m_mate: "SIMCE II Medio - Matemática",
      simce_2m_lectura: "SIMCE II Medio - Lectura",
    };
    return labels[quiz.evaluation_variant] || quiz.evaluation_variant;
  };

  return (
    <>
      <PageHeader title={quiz.title} description={`Evaluación: ${getVariantLabel()}. Detalle del ensayo, clave, lecturas sincronizadas y analisis por item.`} />
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-5">
          <Info label="Preguntas" value={quiz.num_questions} />
          <Info label="Opciones" value={quiz.options_per_question ?? 5} />
          <Info label="Asignatura" value={quiz.subject ?? "-"} />
          <Info label="Curso" value={quiz.grade ?? "-"} />
          <Info label="Promedio" value={`${avg}%`} />
        </section>
        <section className="rounded-md border border-[#e1e5ea] bg-white p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div><h2 className="text-xl font-semibold">Clave</h2><p className="mt-1 font-mono text-sm tracking-wider text-[#5b6472]">{quiz.answer_key}</p></div>
            <div className="flex flex-col gap-2 sm:flex-row"><Link href={`/sheet?quiz=${quiz.id}`} className="rounded-md border border-[#cfd6df] px-4 py-2 text-center text-sm font-semibold">Generar hoja</Link><form action={startScanForQuiz}><input type="hidden" name="quiz_id" value={quiz.id} /><button className="w-full rounded-md bg-[#07305f] px-4 py-2 text-sm font-semibold text-white sm:w-auto">Abrir lector</button></form></div>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-3">
            <h2 className="whitespace-nowrap text-[12.5px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Estadística global</h2>
            <span className="h-px flex-1 bg-[#e6e8eb]" />
          </div>
          <QuizStats quiz={quiz} papers={papers ?? []} metadata={metadata ?? []} />
        </section>
        <DataTable
          columns={["Alumno", "Respuestas Correctas", "Resultado Equivalente", "Estado", "Fecha"]}
          rows={papers ?? []}
          empty="Aun no hay lecturas sincronizadas para este ensayo."
          renderRow={(paper) => (
            <tr key={paper.id} className="border-b border-[#eef0f3] last:border-0">
              <td className="px-5 py-4 font-semibold">{paper.student_name ?? paper.student_id ?? "Sin identificar"}</td>
              <td className="px-5 py-4">{paper.score ?? "-"}/{paper.total ?? quiz.num_questions}</td>
              <td className="px-5 py-4 font-semibold text-[#07305f]">{getScoreDisplay(paper)}</td>
              <td className="px-5 py-4"><StatusPill>{paper.status ?? "active"}</StatusPill></td>
              <td className="px-5 py-4 text-[#5b6472]">{new Date(paper.scanned_at).toLocaleString("es-CL")}</td>
            </tr>
          )}
          renderMobileRow={(paper) => (
            <article key={paper.id} className="rounded-md border border-[#e6e8eb] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 truncate text-base font-semibold text-[#111827]">{paper.student_name ?? paper.student_id ?? "Sin identificar"}</p>
                <StatusPill>{paper.status ?? "active"}</StatusPill>
              </div>
              <div className="mt-3 grid gap-1 text-sm text-[#5b6472]">
                <p>Correctas: <span className="font-semibold text-[#111827]">{paper.score ?? "-"}/{paper.total ?? quiz.num_questions}</span></p>
                <p>Resultado: <span className="font-semibold text-[#07305f]">{getScoreDisplay(paper)}</span></p>
                <p className="text-xs">Fecha: {new Date(paper.scanned_at).toLocaleString("es-CL")}</p>
              </div>
            </article>
          )}
        />
        <DataTable
          columns={["Pregunta", "Eje", "Habilidad", "Dificultad"]}
          rows={metadata ?? []}
          empty="Sin metadatos curriculares por item."
          renderRow={(row) => (
            <tr key={row.question_number} className="border-b border-[#eef0f3] last:border-0"><td className="px-5 py-4 font-semibold">{row.question_number}</td><td className="px-5 py-4 text-[#5b6472]">{row.axis_name ?? "-"}</td><td className="px-5 py-4 text-[#5b6472]">{row.skill_name ?? "-"}</td><td className="px-5 py-4 text-[#5b6472]">{row.difficulty ?? "-"}</td></tr>
          )}
          renderMobileRow={(row) => (
            <article key={row.question_number} className="rounded-md border border-[#e6e8eb] bg-white p-4 shadow-sm">
              <p className="text-base font-semibold text-[#111827]">Pregunta {row.question_number}</p>
              <div className="mt-3 grid gap-1 text-sm text-[#5b6472]">
                <p>Eje: <span className="font-medium text-[#111827]">{row.axis_name ?? "-"}</span></p>
                <p>Habilidad: <span className="font-medium text-[#111827]">{row.skill_name ?? "-"}</span></p>
                <p>Dificultad: <span className="font-medium text-[#111827]">{row.difficulty ?? "-"}</span></p>
              </div>
            </article>
          )}
        />
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-md border border-[#e1e5ea] bg-white p-5"><p className="text-sm text-[#5b6472]">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>;
}

function calculateGradeFallback(score: number, total: number): string {
  if (total <= 0) return "1.0";
  const pct = score / total;
  const exigencia = 0.6;
  const grade = pct >= exigencia
    ? ((pct - exigencia) / (1 - exigencia)) * (7.0 - 4.0) + 4.0
    : (pct / exigencia) * (4.0 - 1.0) + 1.0;
  return grade.toFixed(1);
}
