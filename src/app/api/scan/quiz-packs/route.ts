import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/supabase_server";
import { isMissingColumnError } from "@/lib/supabase_errors";

/**
 * Todos los ensayos activos del colegio, con lo necesario para CORREGIR SIN RED
 * (pauta + formato + codigo de hoja). Es la version en lote de
 * /api/scan/active-quiz, que solo devuelve el ensayo seleccionado.
 *
 * Existe porque sin conexion el profesor no puede elegir ensayo: la pantalla que
 * lo hace (/app/scan) es de servidor y no responde sin red. Descargando todos de
 * una, offline puede cambiar entre ellos.
 *
 * RLS se respeta tal cual: un docente no-admin recibe solo SUS ensayos
 * (20260808000000_teacher_isolation.sql). Eso es lo correcto.
 */

export const dynamic = "force-dynamic";

/** Tope de ensayos descargados. Acota el payload y lo que queda en el telefono. */
const MAX_PACKS = 50;

// Se intenta con todas las columnas y se va recortando: hay bases sin las
// migraciones mas nuevas y la degradacion tiene que ser silenciosa, igual que
// en /api/scan/active-quiz.
const COLUMN_SETS = [
  "id,title,answer_key,num_questions,options_per_question,option_labels,num_columns,sheet_code,open_questions,option_overrides,multi_select_questions,open_boxes_per_page,updated_at",
  "id,title,answer_key,num_questions,options_per_question,option_labels,num_columns,sheet_code,open_questions,option_overrides,multi_select_questions",
  "id,title,answer_key,num_questions,options_per_question,option_labels,num_columns,sheet_code,open_questions",
  "id,title,answer_key,num_questions,options_per_question,option_labels,num_columns,sheet_code",
];

export async function GET() {
  let context;
  try {
    context = await getDashboardContext();
  } catch {
    return NextResponse.json({ error: "No autenticado o sin colegio" }, { status: 401 });
  }
  const { supabase, school } = context;

  let data: Record<string, unknown>[] | null = null;
  for (const columns of COLUMN_SETS) {
    const result = await supabase
      .from("quizzes")
      .select(columns)
      .eq("school_id", school.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(MAX_PACKS);

    if (!result.error) {
      data = (result.data ?? []) as unknown as Record<string, unknown>[];
      break;
    }
    // Solo se reintenta si falta una columna; cualquier otro error es real.
    const missing = ["open_boxes_per_page", "option_overrides", "multi_select_questions", "open_questions", "updated_at"]
      .some((col) => isMissingColumnError(result.error, col));
    if (!missing) {
      return NextResponse.json({ error: "No se pudieron cargar los ensayos" }, { status: 500 });
    }
  }

  if (!data) return NextResponse.json({ error: "No se pudieron cargar los ensayos" }, { status: 500 });

  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const num = (v: unknown) => (typeof v === "number" ? v : null);

  return NextResponse.json({
    country_code: school.country_code ?? "CL",
    quizzes: data.map((q) => ({
      id: String(q.id),
      title: str(q.title) ?? "Ensayo",
      answer_key: str(q.answer_key),
      num_questions: num(q.num_questions) ?? 20,
      options_per_question: num(q.options_per_question) ?? 5,
      option_labels: str(q.option_labels),
      num_columns: num(q.num_columns),
      sheet_code: num(q.sheet_code),
      open_questions: str(q.open_questions),
      option_overrides: str(q.option_overrides),
      multi_select_questions: str(q.multi_select_questions),
      open_boxes_per_page: num(q.open_boxes_per_page),
    })),
  });
}
