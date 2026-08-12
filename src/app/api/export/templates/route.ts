import { getDashboardContext } from "@/lib/supabase_server";
import { EXPORT_COLUMNS_BY_ID } from "@/lib/export_columns";
import { isMissingColumnError } from "@/lib/supabase_errors";

export const dynamic = "force-dynamic";

/**
 * Guarda (o reemplaza) una plantilla de exportacion del establecimiento.
 *
 * Solo un admin: la plantilla es configuracion compartida del colegio, la ven y
 * usan todos los docentes. Es el mismo criterio que ya exige la ruta de
 * exportacion de resultados.
 */
export async function POST(request: Request) {
  const { supabase, user, school, isAdmin } = await getDashboardContext();
  if (!isAdmin) return new Response("Solo administradores pueden guardar plantillas de exportacion.", { status: 403 });

  const payload = (await request.json().catch(() => null)) as {
    name?: unknown;
    columns?: unknown;
    header_labels?: unknown;
    per_question?: unknown;
    separator?: unknown;
    format?: unknown;
    is_default?: unknown;
  } | null;
  if (!payload) return new Response("Payload invalido.", { status: 400 });

  const name = String(payload.name ?? "").trim();
  if (!name) return new Response("Ponle un nombre a la plantilla.", { status: 400 });
  if (name.length > 60) return new Response("El nombre de la plantilla es demasiado largo.", { status: 400 });

  // Se descarta cualquier id que no exista en el catalogo: el payload viene del
  // cliente y no puede inventar columnas.
  const columns = Array.isArray(payload.columns)
    ? [...new Set(payload.columns.map((c) => String(c).trim()))].filter((c) => EXPORT_COLUMNS_BY_ID.has(c))
    : [];
  const perQuestion = Array.isArray(payload.per_question)
    ? payload.per_question.map((b) => String(b).trim()).filter((b) => b === "answers" || b === "points")
    : [];
  if (columns.length === 0 && perQuestion.length === 0) {
    return new Response("Elige al menos una columna.", { status: 400 });
  }

  const separator = payload.separator === ";" ? ";" : ",";
  const format = payload.format === "xlsx" ? "xlsx" : "csv";
  const isDefault = payload.is_default === true;

  // La plantilla del establecimiento es UNA: al marcar una nueva, se desmarca
  // la anterior. Sin esto el panel elegiria una cualquiera de las marcadas.
  if (isDefault) {
    await supabase.from("export_templates").update({ is_default: false }).eq("school_id", school.id);
  }

  const { error } = await supabase.from("export_templates").upsert({
    school_id: school.id,
    name,
    columns,
    header_labels: (payload.header_labels as Record<string, string> | undefined) ?? null,
    per_question: perQuestion.length > 0 ? perQuestion : null,
    separator,
    format,
    is_default: isDefault,
    created_by: user.id,
  }, { onConflict: "school_id,name" });

  if (error) {
    if (isMissingColumnError(error, "columns") || String(error.message ?? "").includes("export_templates")) {
      return new Response("Las plantillas de exportacion requieren actualizar la base de datos (migracion 20260813000002_export_templates.sql).", { status: 503 });
    }
    return new Response("No se pudo guardar la plantilla.", { status: 500 });
  }

  return Response.json({ ok: true });
}
