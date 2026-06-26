import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase_server";

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
  if (!user) throw new Error("No autenticado");

  const metadataRole = user.app_metadata?.role as string | undefined;
  if (metadataRole && allowedRoles.includes(metadataRole)) {
    return { user, role: metadataRole, admin: createSupabaseAdminClient() };
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("platform_users")
    .select("role, revoked_at")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || !allowedRoles.includes(data.role)) throw new Error("Acceso restringido a staff TuLector.");

  return { user, role: data.role as string, admin };
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
