"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requirePlatformContext, writeAuditLog } from "@/lib/supabaseAdmin";
import { sendTemplatedEmail } from "@/lib/email";

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

export async function saveEmailTemplate(formData: FormData) {
  const { user, role, admin } = await requirePlatformContext(["platform_admin", "marketing"]);
  const key = String(formData.get("key") ?? "").trim();
  const locale = String(formData.get("locale") ?? "es-CL").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const html = String(formData.get("html") ?? "");
  const text = String(formData.get("text") ?? "");
  
  if (!key || !subject || !html) throw new Error("Llave, Asunto y HTML son obligatorios.");

  const { error } = await admin.from("email_templates").upsert({
    key,
    locale,
    subject,
    html,
    text: text || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "key" });

  if (error) throw new Error(`Error al guardar la plantilla: ${error.message}`);

  await writeAuditLog({
    actorUserId: user.id,
    actorRole: role,
    targetType: "email_template",
    targetId: key,
    action: "email_template.upsert",
    reason: "Guardado desde consola admin de marketing",
    metadata: { key, locale, subject },
  });

  revalidatePath("/admin/marketing");
}

export async function sendTestEmail(formData: FormData) {
  const { user, role } = await requirePlatformContext(["platform_admin", "marketing"]);
  const key = String(formData.get("key") ?? "");
  const locale = String(formData.get("locale") ?? "es-CL");
  const testEmail = String(formData.get("test_email") ?? "").trim();
  const variablesRaw = String(formData.get("variables_json") ?? "{}");

  if (!key || !testEmail) throw new Error("Llave de plantilla y correo de prueba son obligatorios.");

  let variables = {};
  try {
    variables = JSON.parse(variablesRaw);
  } catch {
    throw new Error("El JSON de variables es inválido.");
  }

  const result = await sendTemplatedEmail({
    to: testEmail,
    templateKey: key,
    locale,
    variables,
  });

  if (!result.success) {
    throw new Error(`Error al enviar correo de prueba: ${result.error}`);
  }

  await writeAuditLog({
    actorUserId: user.id,
    actorRole: role,
    targetType: "email_test",
    targetId: key,
    action: "email.send_test",
    reason: `Envío de prueba a ${testEmail}`,
    metadata: { key, locale, testEmail },
  });
}

export async function refundOrVoidOrder(formData: FormData) {
  const { user, role, admin } = await requirePlatformContext(["platform_admin", "finance"]);
  const orderId = String(formData.get("order_id") ?? "");
  const action = String(formData.get("action") ?? "refund"); // 'refund' | 'void'
  const reason = String(formData.get("reason") ?? "Ajuste manual desde panel administrativo");

  if (!orderId) throw new Error("ID de orden es obligatorio.");

  // Fetch the order
  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (orderError || !order) throw new Error("Orden no encontrada.");

  if (order.status !== "paid") {
    throw new Error("Solo se pueden reembolsar/anular órdenes pagadas.");
  }

  // Update order status
  const targetStatus = action === "refund" ? "void" : "void"; // Using 'void' status from CHECK constraint in unified.sql/migrations
  const { error: updateOrderError } = await admin
    .from("orders")
    .update({
      status: targetStatus,
    })
    .eq("id", orderId);

  if (updateOrderError) throw new Error(`Error al actualizar la orden: ${updateOrderError.message}`);

  // Deduct the scans from school
  const { data: school, error: schoolError } = await admin
    .from("schools")
    .select("id, name, scans_limit")
    .eq("id", order.school_id)
    .single();

  if (!schoolError && school) {
    const scansAdded = order.scans_added ?? 0;
    const newScansLimit = Math.max(0, (school.scans_limit ?? 0) - scansAdded);

    await admin
      .from("schools")
      .update({
        scans_limit: newScansLimit,
        updated_at: new Date().toISOString(),
      })
      .eq("id", school.id);
  }

  await writeAuditLog({
    actorUserId: user.id,
    actorRole: role,
    schoolId: order.school_id,
    targetType: "order",
    targetId: orderId,
    action: `order.${action}`,
    reason,
    metadata: { orderId, amount_cents: order.amount_cents, scans_deducted: order.scans_added },
  });

  revalidatePath("/admin/billing");
}

export async function updatePlatformUserRole(formData: FormData) {
  const { user, role, admin } = await requirePlatformContext(["platform_admin"]);
  const targetUserId = String(formData.get("target_user_id") ?? "");
  const targetRole = String(formData.get("platform_role") ?? "none");

  if (!targetUserId) throw new Error("ID de usuario es obligatorio.");

  if (targetRole === "none") {
    // Revoke platform staff access
    await admin.from("platform_users").update({ revoked_at: new Date().toISOString() }).eq("user_id", targetUserId);
    // Remove role from Auth metadata
    await admin.auth.admin.updateUserById(targetUserId, { app_metadata: { role: null } });
  } else {
    // Upsert platform staff role
    const { data: existing } = await admin
      .from("platform_users")
      .select("id")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (existing) {
      await admin.from("platform_users").update({
        role: targetRole,
        revoked_at: null,
      }).eq("user_id", targetUserId);
    } else {
      await admin.from("platform_users").insert({
        user_id: targetUserId,
        role: targetRole,
      });
    }

    // Sync to Auth metadata
    await admin.auth.admin.updateUserById(targetUserId, { app_metadata: { role: targetRole } });
  }

  await writeAuditLog({
    actorUserId: user.id,
    actorRole: role,
    targetType: "user",
    targetId: targetUserId,
    action: "user.platform_role_update",
    reason: `Cambio de rol de plataforma a: ${targetRole}`,
    metadata: { targetUserId, targetRole },
  });

  revalidatePath(`/admin/users/${targetUserId}`);
  revalidatePath("/admin/users");
}

export async function linkUserToSchool(formData: FormData) {
  const { user, role, admin } = await requirePlatformContext(["platform_admin", "support"]);
  const targetUserId = String(formData.get("target_user_id") ?? "");
  const schoolId = String(formData.get("school_id") ?? "");
  const schoolRole = String(formData.get("school_role") ?? "teacher");

  if (!targetUserId || !schoolId) throw new Error("Usuario y Colegio son obligatorios.");

  const { error } = await admin.from("school_members").insert({
    school_id: schoolId,
    user_id: targetUserId,
    role: schoolRole,
  });

  if (error) throw new Error(`Error al vincular: ${error.message}`);

  await writeAuditLog({
    actorUserId: user.id,
    actorRole: role,
    schoolId,
    targetType: "school_member",
    targetId: targetUserId,
    action: "school_member.link",
    reason: "Vinculación manual desde panel admin",
    metadata: { targetUserId, schoolId, schoolRole },
  });

  revalidatePath(`/admin/users/${targetUserId}`);
}

export async function unlinkUserFromSchool(formData: FormData) {
  const { user, role, admin } = await requirePlatformContext(["platform_admin", "support"]);
  const membershipId = String(formData.get("membership_id") ?? "");
  const targetUserId = String(formData.get("target_user_id") ?? "");

  if (!membershipId) throw new Error("ID de membresía es obligatorio.");

  const { data: member } = await admin
    .from("school_members")
    .select("school_id, user_id")
    .eq("id", membershipId)
    .single();

  const { error } = await admin.from("school_members").delete().eq("id", membershipId);
  if (error) throw new Error(`Error al desvincular: ${error.message}`);

  if (member) {
    await writeAuditLog({
      actorUserId: user.id,
      actorRole: role,
      schoolId: member.school_id,
      targetType: "school_member",
      targetId: member.user_id,
      action: "school_member.unlink",
      reason: "Desvinculación manual desde panel admin",
      metadata: { targetUserId: member.user_id, schoolId: member.school_id },
    });
  }

  revalidatePath(`/admin/users/${targetUserId}`);
}

export async function updateUserSchoolRole(formData: FormData) {
  const { user, role, admin } = await requirePlatformContext(["platform_admin", "support"]);
  const membershipId = String(formData.get("membership_id") ?? "");
  const schoolRole = String(formData.get("school_role") ?? "teacher");
  const targetUserId = String(formData.get("target_user_id") ?? "");

  if (!membershipId) throw new Error("ID de membresía es obligatorio.");

  const { data: member } = await admin
    .from("school_members")
    .select("school_id, user_id")
    .eq("id", membershipId)
    .single();

  const { error } = await admin
    .from("school_members")
    .update({ role: schoolRole })
    .eq("id", membershipId);

  if (error) throw new Error(`Error al actualizar rol: ${error.message}`);

  if (member) {
    await writeAuditLog({
      actorUserId: user.id,
      actorRole: role,
      schoolId: member.school_id,
      targetType: "school_member",
      targetId: member.user_id,
      action: "school_member.role_update",
      reason: `Cambio de rol escolar a: ${schoolRole}`,
      metadata: { targetUserId: member.user_id, schoolId: member.school_id, schoolRole },
    });
  }

  revalidatePath(`/admin/users/${targetUserId}`);
}

export async function impersonateSchool(formData: FormData) {
  const { user, role } = await requirePlatformContext(["platform_admin", "support"]);
  const schoolId = String(formData.get("school_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!schoolId || !reason) {
    throw new Error("Se requiere justificación para impersonar un colegio.");
  }

  await writeAuditLog({
    actorUserId: user.id,
    actorRole: role,
    schoolId,
    targetType: "school",
    targetId: schoolId,
    action: "school.impersonate",
    reason: `Impersonación: ${reason}`,
  });

  const cookieStore = await cookies();
  cookieStore.set("tulector_active_school_id", schoolId, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
