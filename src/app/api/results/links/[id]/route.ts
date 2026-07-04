import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/supabase_server";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, isAdmin } = await getDashboardContext();

    if (!isAdmin) return NextResponse.json({ error: "Solo administradores pueden revocar enlaces" }, { status: 403 });

    const { data: existing, error: fetchError } = await supabase
      .from("result_links")
      .select("id, revoked_at")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Enlace no encontrado" }, { status: 404 });
    }

    if (existing.revoked_at) {
      return NextResponse.json({ error: "El enlace ya esta revocado" }, { status: 409 });
    }

    const { error } = await supabase
      .from("result_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[results/links DELETE]", error);
    return NextResponse.json({ error: "No se pudo revocar el enlace" }, { status: 500 });
  }
}
