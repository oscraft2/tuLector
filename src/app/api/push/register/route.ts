import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/supabase_server";

export async function POST(request: Request) {
  try {
    const { supabase, user, school } = await getDashboardContext();
    const { token } = (await request.json().catch(() => ({}))) as { token?: string };

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Falta token" }, { status: 400 });
    }

    const platform = request.headers.get("x-platform") || "android";

    await supabase.from("device_tokens").upsert({
      school_id: school.id,
      user_id: user.id,
      token,
      platform,
    }, { onConflict: "token" });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo registrar el token" }, { status: 500 });
  }
}
