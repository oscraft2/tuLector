import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/supabase_server";
import { isMissingColumnError } from "@/lib/supabase_errors";
import { parseSheetMode, compactModeIssue } from "@/lib/sheet_mode";
import { parseOpenQuestions } from "@/lib/quiz_constraints";

/**
 * Fija el FORMATO de hoja de un ensayo ('full' | 'compact').
 *
 * El formato se elige en el generador (/sheet ↔ /bloque), no al crear el
 * ensayo: el profesor decide como va a imprimir cuando esta imprimiendo. Pero
 * el LECTOR necesita saberlo (son dos motores distintos: la hoja completa
 * busca sus 12 anclas, el bloque busca finder patterns dentro de una hoja
 * ajena), asi que el generador persiste aca la eleccion y "Abrir lector" lleva
 * al lector correcto.
 *
 * Se valida contra el ensayo REAL, no contra lo que mande el cliente: un
 * ensayo de 40 preguntas no puede quedar marcado como compacto por mucho que
 * alguien haga POST.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { mode?: unknown } | null;
  const mode = parseSheetMode(body?.mode);

  let context;
  try {
    context = await getDashboardContext();
  } catch {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const { supabase, school } = context;

  const { data: quiz, error } = await supabase
    .from("quizzes")
    .select("id,num_questions,options_per_question,open_questions")
    .eq("id", id)
    .eq("school_id", school.id)
    .is("archived_at", null)
    .single();
  if (error || !quiz) return NextResponse.json({ error: "Ensayo no disponible" }, { status: 404 });

  if (mode === "compact") {
    const numQuestions = Number(quiz.num_questions ?? 0);
    const openCount = parseOpenQuestions(quiz.open_questions ?? "", numQuestions).length;
    const issue = compactModeIssue(numQuestions, Number(quiz.options_per_question ?? 5), openCount);
    if (issue) return NextResponse.json({ error: issue }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("quizzes")
    .update({ sheet_mode: mode })
    .eq("id", id)
    .eq("school_id", school.id);

  if (updateError && isMissingColumnError(updateError, "sheet_mode")) {
    // BD sin migrar: el generador igual entrega el archivo, pero el lector no
    // va a saber cambiar de motor. Se responde 200 con `stored:false` para que
    // la pantalla lo diga en vez de fallar en silencio.
    return NextResponse.json({ ok: true, stored: false, reason: "migracion_pendiente", mode });
  }
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true, stored: true, mode });
}
