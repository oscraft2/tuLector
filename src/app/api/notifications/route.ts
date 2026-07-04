import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/supabase_server";

export async function GET() {
  try {
    const { supabase, school } = await getDashboardContext();
    const { data, error } = await supabase
      .from("notifications")
      .select("id,type,title,body,link,read_at,created_at")
      .eq("school_id", school.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;
    return NextResponse.json({ notifications: data ?? [] });
  } catch (error) {
    console.error("[notifications]", error);
    return NextResponse.json({ error: "No se pudieron cargar las notificaciones" }, { status: 500 });
  }
}
