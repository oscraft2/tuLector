import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/supabase_server";
import { isMissingColumnError } from "@/lib/supabase_errors";

/** Columnas de la campana. `link` llego con 20260815000000_quiz_shares.sql; en
 *  una BD sin esa migracion se relee sin ella en vez de responder 500 (que es
 *  lo que pasaba antes: el select pedia `link`, la columna no existia y el
 *  campanario se comia el error en su catch, quedando siempre vacio). */
const COLUMNS = "id,type,title,body,link,read_at,created_at";
const COLUMNS_LEGACY = "id,type,title,body,read_at,created_at";

export async function GET() {
  try {
    const { supabase, school } = await getDashboardContext();
    const query = (columns: string) =>
      supabase
        .from("notifications")
        .select(columns)
        .eq("school_id", school.id)
        .order("created_at", { ascending: false })
        .limit(20);

    let { data, error } = await query(COLUMNS);
    if (error && isMissingColumnError(error, "link")) {
      ({ data, error } = await query(COLUMNS_LEGACY));
    }

    if (error) throw error;
    return NextResponse.json({ notifications: data ?? [] });
  } catch (error) {
    console.error("[notifications]", error);
    return NextResponse.json({ error: "No se pudieron cargar las notificaciones" }, { status: 500 });
  }
}

/**
 * Marcar como leida(s). Acepta las tres formas que necesita el campanario:
 *   { id }            una sola (al hacer clic en ella)
 *   { ids: [...] }    las que se acaban de mostrar (al abrir el panel)
 *   { all: true }     todas las pendientes del usuario
 *
 * La RLS (`notifications_user`) restringe las filas a las propias del usuario o,
 * si es admin, a las del colegio — por eso basta con el id y no hace falta
 * repetir el filtro por usuario aca.
 */
export async function PATCH(request: Request) {
  try {
    const { supabase, school } = await getDashboardContext();
    const body = (await request.json()) as { id?: unknown; ids?: unknown; all?: unknown; read_at?: unknown };

    const ids = [
      ...(typeof body.id === "string" ? [body.id.trim()] : []),
      ...(Array.isArray(body.ids) ? body.ids.filter((v): v is string => typeof v === "string").map((v) => v.trim()) : []),
    ].filter(Boolean);
    const markAll = body.all === true;
    if (ids.length === 0 && !markAll) {
      return NextResponse.json({ error: "Falta la notificacion" }, { status: 400 });
    }

    const readAt = typeof body.read_at === "string" ? body.read_at : new Date().toISOString();
    // `is("read_at", null)` en el modo "todas": no se reescribe la fecha de las
    // que ya estaban leidas, asi el historial conserva cuando se leyo cada una.
    const query = supabase.from("notifications").update({ read_at: readAt });
    const { error } = markAll
      ? await query.eq("school_id", school.id).is("read_at", null)
      : await query.in("id", ids);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[notifications] patch", error);
    return NextResponse.json({ error: "No se pudo marcar como leida" }, { status: 500 });
  }
}
