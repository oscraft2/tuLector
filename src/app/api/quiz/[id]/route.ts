import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/supabase_server";
import { isMissingColumnError } from "@/lib/supabase_errors";

/** Datos de un ensayo por id, scopeados al colegio del usuario. Lo usa /sheet
 * para que la hoja HEREDE la config + clave + sheet_code del ensayo real
 * (en vez de configurarse a mano y con un codigo demo). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, school } = await getDashboardContext();

  let result = await supabase
    .from("quizzes")
    .select("id,title,subject,grade,answer_key,num_questions,options_per_question,option_labels,num_columns,sheet_code,open_questions")
    .eq("id", id)
    .eq("school_id", school.id)
    .is("archived_at", null)
    .single();

  if (result.error && isMissingColumnError(result.error, "open_questions")) {
    result = await supabase
      .from("quizzes")
      .select("id,title,subject,grade,answer_key,num_questions,options_per_question,option_labels,num_columns,sheet_code")
      .eq("id", id)
      .eq("school_id", school.id)
      .is("archived_at", null)
      .single();
  }

  const { data, error } = result;

  if (error || !data) return NextResponse.json({ error: "Ensayo no disponible" }, { status: 404 });
  // country_code del colegio: /sheet lo usa para imprimir el bloque de ID
  // nacional correcto (RUT/DNI/CPF/... — Fase 0/1, plan-multipais-motor.md).
  return NextResponse.json({ ...data, country_code: school.country_code ?? "CL" });
}
