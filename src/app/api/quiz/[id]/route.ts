import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/supabase_server";

/** Datos de un ensayo por id, scopeados al colegio del usuario. Lo usa /sheet
 * para que la hoja HEREDE la config + clave + sheet_code del ensayo real
 * (en vez de configurarse a mano y con un codigo demo). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, school } = await getDashboardContext();

  const { data, error } = await supabase
    .from("quizzes")
    .select("id,title,subject,grade,answer_key,num_questions,options_per_question,option_labels,num_columns,sheet_code")
    .eq("id", id)
    .eq("school_id", school.id)
    .is("archived_at", null)
    .single();

  if (error || !data) return NextResponse.json({ error: "Ensayo no disponible" }, { status: 404 });
  return NextResponse.json(data);
}
