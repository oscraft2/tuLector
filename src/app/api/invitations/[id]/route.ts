import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Endpoint publico (sin sesion) -- lo usa /auth antes de iniciar sesion para
// mostrarle al docente invitado a que colegio/rol se esta uniendo. Solo
// devuelve lo minimo no sensible de una invitacion pendiente y no vencida.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const admin = createSupabaseAdminClient();

    const { data: invite } = await admin
      .from("invitations")
      .select("email, role, status, expires_at, schools(name)")
      .eq("id", id)
      .maybeSingle();

    if (!invite || invite.status !== "pending" || new Date(invite.expires_at) <= new Date()) {
      return NextResponse.json({ valid: false });
    }

    const joinedSchool = invite.schools as unknown as { name?: string } | { name?: string }[] | null;
    const schoolName = (Array.isArray(joinedSchool) ? joinedSchool[0]?.name : joinedSchool?.name) ?? "";

    return NextResponse.json({
      valid: true,
      email: invite.email,
      role: invite.role,
      schoolName,
    });
  } catch (error) {
    console.error("[api/invitations/id]", error);
    return NextResponse.json({ valid: false });
  }
}
