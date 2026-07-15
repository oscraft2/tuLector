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
    .select("id,school_id,title,answer_key,num_questions,options_per_question,option_labels,num_columns,sheet_code")
    .eq("id", quizId)
    .is("archived_at", null)
    .single();

  if (error || !data) return NextResponse.json({ error: "Ensayo no disponible" }, { status: 404 });

  // Pais del colegio: decide con que bloque de ID nacional se lee la hoja
  // (Fase 0/1 del plan multi-pais). Query aparte para no depender de un FK
  // join nuevo; fallback "CL" si el colegio no tiene country_code (default).
  const { data: schoolRow } = await supabase
    .from("schools")
    .select("country_code")
    .eq("id", data.school_id)
    .maybeSingle();

  return NextResponse.json({
    id: data.id,
    title: data.title,
    answer_key: data.answer_key,
    num_questions: data.num_questions,
    options_per_question: data.options_per_question,
    option_labels: data.option_labels,
    num_columns: data.num_columns,
    sheet_code: data.sheet_code,
    country_code: schoolRow?.country_code ?? "CL",
  });
}
