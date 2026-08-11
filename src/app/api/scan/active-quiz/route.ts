import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/supabase_server";
import { isMissingColumnError } from "@/lib/supabase_errors";

export async function GET() {
  const cookieStore = await cookies();
  const quizId = cookieStore.get("tulector_active_quiz")?.value;
  if (!quizId) return NextResponse.json({ error: "No hay ensayo activo" }, { status: 404 });

  let context;
  try {
    context = await getDashboardContext();
  } catch (error) {
    return NextResponse.json({ error: "No autenticado o sin colegio" }, { status: 401 });
  }
  const { supabase, school } = context;

  let result = await supabase
    .from("quizzes")
    .select("id,school_id,title,answer_key,num_questions,options_per_question,option_labels,num_columns,sheet_code,open_questions,option_overrides,multi_select_questions,open_boxes_per_page,sheet_mode")
    .eq("id", quizId)
    .eq("school_id", school.id)
    .is("archived_at", null)
    .single();

  if (result.error && isMissingColumnError(result.error, "sheet_mode")) {
    // BD sin migrar (sheet_mode): degradacion silenciosa -- sin la columna
    // ningun ensayo es compacto y el lector de hoja completa sigue igual.
    result = await supabase
      .from("quizzes")
      .select("id,school_id,title,answer_key,num_questions,options_per_question,option_labels,num_columns,sheet_code,open_questions,option_overrides,multi_select_questions,open_boxes_per_page")
      .eq("id", quizId)
      .eq("school_id", school.id)
      .is("archived_at", null)
      .single();
  }

  if (result.error && isMissingColumnError(result.error, "open_boxes_per_page")) {
    // BD sin migrar (open_boxes_per_page): degradacion SIEMPRE silenciosa --
    // /scan/reverso cae al fallback LEGACY_OPEN_BOXES_PER_PAGE.
    result = await supabase
      .from("quizzes")
      .select("id,school_id,title,answer_key,num_questions,options_per_question,option_labels,num_columns,sheet_code,open_questions,option_overrides,multi_select_questions")
      .eq("id", quizId)
      .eq("school_id", school.id)
      .is("archived_at", null)
      .single();
  }

  if (result.error && (isMissingColumnError(result.error, "option_overrides") || isMissingColumnError(result.error, "multi_select_questions"))) {
    result = await supabase
      .from("quizzes")
      .select("id,school_id,title,answer_key,num_questions,options_per_question,option_labels,num_columns,sheet_code,open_questions")
      .eq("id", quizId)
      .eq("school_id", school.id)
      .is("archived_at", null)
      .single();
  }

  if (result.error && isMissingColumnError(result.error, "open_questions")) {
    result = await supabase
      .from("quizzes")
      .select("id,school_id,title,answer_key,num_questions,options_per_question,option_labels,num_columns,sheet_code")
      .eq("id", quizId)
      .eq("school_id", school.id)
      .is("archived_at", null)
      .single();
  }

  const { data, error } = result;

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
    open_questions: (data as { open_questions?: string | null }).open_questions ?? null,
    option_overrides: (data as { option_overrides?: string | null }).option_overrides ?? null,
    multi_select_questions: (data as { multi_select_questions?: string | null }).multi_select_questions ?? null,
    open_boxes_per_page: (data as { open_boxes_per_page?: number | null }).open_boxes_per_page ?? null,
    // 'full' | 'compact' -- decide con que motor se lee esta hoja (/scan vs
    // /scan/compacto). Siempre presente, exista o no la columna todavia.
    sheet_mode: (data as { sheet_mode?: unknown }).sheet_mode === "compact" ? "compact" : "full",
    country_code: schoolRow?.country_code ?? "CL",
  });
}
