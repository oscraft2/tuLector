"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformContext, writeAuditLog } from "@/lib/supabaseAdmin";

export async function updateSchoolPlan(formData: FormData) {
  const { user, role, admin } = await requirePlatformContext(["platform_admin", "finance"]);
  const schoolId = String(formData.get("school_id") ?? "");
  const plan = String(formData.get("plan") ?? "starter");
  const reason = String(formData.get("reason") ?? "Cambio manual de plan");
  if (!schoolId || !["starter", "pro", "school", "district"].includes(plan)) return;
  await admin.from("schools").update({ plan, updated_at: new Date().toISOString() }).eq("id", schoolId);
  await writeAuditLog({ actorUserId: user.id, actorRole: role, schoolId, targetType: "school", targetId: schoolId, action: "school.plan_update", reason, metadata: { plan } });
  revalidatePath("/admin/schools");
}

export async function toggleFeatureFlag(formData: FormData) {
  const { user, role, admin } = await requirePlatformContext(["platform_admin"]);
  const key = String(formData.get("key") ?? "");
  const enabled = formData.get("enabled") === "on";
  if (!key) return;
  await admin.from("feature_flags").update({ enabled, updated_at: new Date().toISOString() }).eq("key", key);
  await writeAuditLog({ actorUserId: user.id, actorRole: role, targetType: "feature_flag", targetId: key, action: "feature_flag.update", reason: "Cambio desde panel admin", metadata: { enabled } });
  revalidatePath("/admin/flags");
}
