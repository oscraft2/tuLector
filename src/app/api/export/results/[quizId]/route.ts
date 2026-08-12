import { getDashboardContext } from "@/lib/supabase_server";
import { toCsv } from "@/lib/csv";
import {
  EXPORT_COLUMNS_BY_ID, LEGACY_RESULTS_COLUMNS, buildHeaders, buildRow,
  type ExportPaperRow, type ExportSpec, type PerQuestionBlock,
} from "@/lib/export_columns";
import { parseOpenQuestions, parseMultiSelectQuestions, parseQuestionPoints, normalizeDefaultQuestionPoints } from "@/lib/quiz_constraints";
import { buildPaperCourseResolver } from "@/lib/paper_course";

export const dynamic = "force-dynamic";

/**
 * Exportacion de resultados de un ensayo.
 *
 * SIN querystring devuelve exactamente el CSV historico (mismas 8 columnas,
 * mismo orden, separador coma): cualquier enlace guardado o costumbre previa
 * sigue funcionando igual.
 *
 * Con querystring se arma a medida (docs/plan-puntaje-y-exportacion.md, Fase 4):
 *   ?cols=student_name,rut,points,grade   ids de src/lib/export_columns.ts
 *   &sep=;                                separador (coma o punto y coma)
 *   &fmt=xlsx                             csv (default) o xlsx
 *   &perq=answers,points                  columnas p1..pN
 *   &template=<uuid>                      plantilla guardada del colegio
 */
export async function GET(request: Request, { params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params;
  const { supabase, user, school, isAdmin } = await getDashboardContext();
  if (!isAdmin) return new Response("Solo administradores pueden exportar resultados.", { status: 403 });

  const { data: quiz, error: quizError } = await supabase
    .from("quizzes")
    .select("*")
    .eq("id", quizId)
    .eq("school_id", school.id)
    .single();

  if (quizError || !quiz) return new Response("Ensayo no encontrado.", { status: 404 });

  const url = new URL(request.url);
  const spec = await resolveSpec(supabase, school.id, url, quiz);
  if (!spec) return new Response("La configuracion de exportacion no es valida.", { status: 400 });

  const separator = url.searchParams.get("sep") === ";" ? ";" : ",";
  const format = url.searchParams.get("fmt") === "xlsx" ? "xlsx" : "csv";

  const rows = await fetchPapers(supabase, school.id, quiz.id);
  // El curso REAL es el del alumno, no el de la hoja (ver src/lib/paper_course.ts).
  const courseOf = await buildPaperCourseResolver(supabase, school.id, rows);
  const exportRows: ExportPaperRow[] = rows.map((paper) => ({
    ...paper,
    course_name: courseOf(paper)?.name ?? null,
  }));

  const numQuestions = Number(quiz.num_questions ?? 0);
  const ctx = {
    passingGrade: Number(quiz.passing_grade ?? school.passing_grade ?? 4.0),
    openQuestions: parseOpenQuestions(quiz.open_questions ?? "", numQuestions),
    multiSelectQuestions: parseMultiSelectQuestions(quiz.multi_select_questions ?? "", numQuestions),
  };

  const headers = buildHeaders(spec);
  const body = exportRows.map((row) => buildRow(row, spec, ctx));

  const { error: logError } = await supabase.from("export_logs").insert({
    school_id: school.id,
    user_id: user.id,
    export_type: format === "xlsx" ? "results_xlsx" : "results_csv",
    entity_type: "quiz",
    entity_id: quiz.id,
    reason: `exportacion de resultados (${headers.length} columnas: ${spec.columns.join(", ")})`,
    row_count: exportRows.length,
  });
  // El registro es BLOQUEANTE a proposito (criterio previo de esta ruta): una
  // descarga de datos de alumnos que no queda auditada no se entrega.
  if (logError) return new Response("No se pudo registrar la exportacion.", { status: 500 });

  const filename = `resultados_${toFilenameSlug(quiz.title)}`;
  if (format === "xlsx") {
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...body]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Resultados");
    const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  }

  const csv = toCsv(headers, body, separator);
  // BOM para que Excel en Windows reconozca UTF-8 (nombres con tildes/Ñ).
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
    },
  });
}

/** Columnas del paper que necesita cualquier export. `points`/`points_total`
 *  pueden faltar en una BD sin migrar: se reintenta sin ellas. */
async function fetchPapers(
  supabase: Awaited<ReturnType<typeof getDashboardContext>>["supabase"],
  schoolId: string,
  quizId: string,
) {
  const BASE = "student_name,student_id,student_rut_norm,course_id,score,total,equivalent_score,grade,status,scanned_at,answers";
  const attempts = [`${BASE},points,points_total`, BASE];
  for (const select of attempts) {
    const result = await supabase
      .from("papers")
      .select(select)
      .eq("school_id", schoolId)
      .eq("quiz_id", quizId)
      .order("score", { ascending: false });
    if (!result.error) return (result.data ?? []) as unknown as (ExportPaperRow & { course_id?: string | null })[];
  }
  return [];
}

/**
 * Arma la especificacion pedida. Sin `cols` ni `template` devuelve la del CSV
 * historico, que es lo que hace que la ruta siga siendo compatible.
 */
async function resolveSpec(
  supabase: Awaited<ReturnType<typeof getDashboardContext>>["supabase"],
  schoolId: string,
  url: URL,
  quiz: Record<string, unknown>,
): Promise<ExportSpec | null> {
  const numQuestions = Number(quiz.num_questions ?? 0);
  const defaultPoints = normalizeDefaultQuestionPoints(quiz.default_question_points as string | number | null);
  const overrides = parseQuestionPoints((quiz.question_points as string | null) ?? "", numQuestions);
  const shared = {
    numQuestions,
    answerKey: String(quiz.answer_key ?? ""),
    pointsForQuestion: (q: number) => overrides[q] ?? defaultPoints,
  };

  const templateId = url.searchParams.get("template");
  if (templateId) {
    const { data, error } = await supabase
      .from("export_templates")
      .select("columns,header_labels,per_question")
      .eq("id", templateId)
      .eq("school_id", schoolId)
      .single();
    if (error || !data) return null;
    const columns = sanitizeColumns(data.columns);
    if (columns.length === 0) return null;
    return {
      ...shared,
      columns,
      headerLabels: (data.header_labels as Record<string, string> | null) ?? undefined,
      perQuestion: sanitizePerQuestion(data.per_question),
    };
  }

  const cols = url.searchParams.get("cols");
  const perq = url.searchParams.get("perq");
  if (!cols && !perq) {
    return { ...shared, columns: [...LEGACY_RESULTS_COLUMNS] };
  }

  const columns = sanitizeColumns(cols ? cols.split(",") : [...LEGACY_RESULTS_COLUMNS]);
  if (columns.length === 0 && !perq) return null;
  return { ...shared, columns, perQuestion: sanitizePerQuestion(perq ? perq.split(",") : null) };
}

/** Descarta cualquier id que no exista en el catalogo (y los repetidos): la
 *  querystring viene del cliente y no puede inventar columnas. */
function sanitizeColumns(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value) {
    const id = String(raw).trim();
    if (!EXPORT_COLUMNS_BY_ID.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function sanitizePerQuestion(value: unknown): PerQuestionBlock[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const allowed: PerQuestionBlock[] = ["answers", "points"];
  const out = allowed.filter((block) => value.some((v) => String(v).trim() === block));
  return out.length > 0 ? out : undefined;
}

function toFilenameSlug(value: string | null) {
  const slug = (value ?? "ensayo")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "ensayo";
}
