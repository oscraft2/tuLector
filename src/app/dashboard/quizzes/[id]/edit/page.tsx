import Link from "next/link";
import { notFound } from "next/navigation";
import { getDashboardContext } from "@/lib/supabase_server";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { QuizCreateForm } from "@/components/dashboard/QuizCreateForm";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function QuizEditPage({ params }: PageProps) {
  const { id } = await params;
  const { supabase, school } = await getDashboardContext();

  const [{ data: quiz }, { data: courses }, { count: papersCount }] = await Promise.all([
    supabase.from("quizzes").select("*").eq("id", id).eq("school_id", school.id).single(),
    supabase.from("courses").select("id,name,grade").order("name"),
    supabase.from("papers").select("id", { count: "exact", head: true }).eq("quiz_id", id),
  ]);
  if (!quiz) notFound();

  return (
    <>
      <PageHeader
        title={`Editar: ${quiz.title}`}
        description="Cambia el título, la clave de respuestas u otros datos del ensayo."
      />
      <div className="mb-4">
        <Link href={`/dashboard/quizzes/${id}`} className="text-sm font-semibold text-[#07305f] hover:underline">
          ← Volver al ensayo
        </Link>
      </div>
      <div className="max-w-2xl">
        <QuizCreateForm
          mode="edit"
          quiz={{
            id: quiz.id,
            title: quiz.title,
            subject: quiz.subject,
            grade: quiz.grade,
            num_questions: quiz.num_questions,
            options_per_question: quiz.options_per_question ?? 5,
            answer_key: String(quiz.answer_key ?? ""),
            open_questions: quiz.open_questions ?? null,
            exigencia: quiz.exigencia ?? null,
          }}
          courses={courses ?? []}
          countryCode={school.country_code ?? "CL"}
          papersCount={papersCount ?? 0}
        />
      </div>
    </>
  );
}
