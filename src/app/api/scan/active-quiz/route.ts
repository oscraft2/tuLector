import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase_server";

export async function GET() {
  const cookieStore = await cookies();
  const quizId = cookieStore.get("tulector_active_quiz")?.value;
  if (!quizId) return NextResponse.json({ error: "No hay ensayo activo" }, { status: 404 });

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("quizzes")
    .select("id,title,answer_key,num_questions,options_per_question,option_labels,num_columns,sheet_code")
    .eq("id", quizId)
    .is("archived_at", null)
    .single();

  if (error || !data) return NextResponse.json({ error: "Ensayo no disponible" }, { status: 404 });

  return NextResponse.json({
    id: data.id,
    title: data.title,
    answer_key: data.answer_key,
    num_questions: data.num_questions,
    options_per_question: data.options_per_question,
    option_labels: data.option_labels,
    num_columns: data.num_columns,
    sheet_code: data.sheet_code,
  });
}
