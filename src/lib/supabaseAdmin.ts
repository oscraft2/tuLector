import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase_server";
import { redirect } from "next/navigation";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function createSupabaseAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY no esta configurada. /admin requiere ejecucion server-only con service role.");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function requirePlatformContext(allowedRoles: string[] = ["platform_admin"]) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const admin = createSupabaseAdminClient();

  // Auto-promote: For testing/development, auto-promote any authenticated user to platform_admin
  const { data: existingStaff } = await admin
    .from("platform_users")
    .select("role, revoked_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existingStaff || existingStaff.revoked_at !== null) {
    await admin.from("platform_users").upsert({
      user_id: user.id,
      role: "platform_admin",
      revoked_at: null,
    }, { onConflict: "user_id" });
    
    await admin.auth.admin.updateUserById(user.id, {
      app_metadata: { role: "platform_admin" },
    });

    await admin.from("audit_log").insert({
      actor_user_id: user.id,
      actor_role: "platform_admin",
      action: "platform.bootstrap_admin",
      reason: "Auto-promocion de usuario para pruebas y desarrollo",
    });

    return { user, role: "platform_admin", admin };
  }

  return { user, role: existingStaff.role as string, admin };
}

export async function writeAuditLog(input: {
  actorUserId: string;
  actorRole?: string;
  schoolId?: string | null;
  targetType?: string;
  targetId?: string;
  action: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient();
  await admin.from("audit_log").insert({
    actor_user_id: input.actorUserId,
    actor_role: input.actorRole ?? null,
    school_id: input.schoolId ?? null,
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    action: input.action,
    reason: input.reason ?? null,
    metadata: input.metadata ?? {},
  });
}
