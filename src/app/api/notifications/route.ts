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

/** Marcar como leida. La RLS (`notifications_user`) restringe la fila a las
 *  propias del usuario o, si es admin, a las del colegio — por eso basta el id. */
export async function PATCH(request: Request) {
  try {
    const { supabase } = await getDashboardContext();
    const body = (await request.json()) as { id?: unknown; read_at?: unknown };
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) return NextResponse.json({ error: "Falta la notificacion" }, { status: 400 });

    const readAt = typeof body.read_at === "string" ? body.read_at : new Date().toISOString();
    const { error } = await supabase.from("notifications").update({ read_at: readAt }).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[notifications] patch", error);
    return NextResponse.json({ error: "No se pudo marcar como leida" }, { status: 500 });
  }
}
