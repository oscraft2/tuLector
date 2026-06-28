import { createSupabaseAdminClient } from "./supabaseAdmin";
import { sendTemplatedEmail } from "./email";

/**
 * Checks if a school has exceeded 90% or 100% of its scan quota.
 * If so, and no notification has been registered yet, it creates the notification
 * in the database and sends alert emails to all school admins.
 */
export async function checkAndTriggerQuotaAlerts(schoolId: string): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();

    // 1. Fetch school usage and limit
    const { data: school, error: schoolError } = await admin
      .from("schools")
      .select("name, scans_used, scans_limit")
      .eq("id", schoolId)
      .single();

    if (schoolError || !school) {
      console.warn("[quota_alerts] school not found:", schoolId, schoolError?.message);
      return;
    }

    const scansUsed = school.scans_used ?? 0;
    const scansLimit = school.scans_limit ?? 0;

    if (scansLimit <= 0) return;

    const usagePct = scansUsed / scansLimit;
    let alertType: "quota_alert_90" | "quota_alert_100" | null = null;
    let alertTitle = "";
    let alertBody = "";

    if (usagePct >= 1.0) {
      alertType = "quota_alert_100";
      alertTitle = "🚨 Límite de Escaneos Bloqueado (100%)";
      alertBody = `El colegio ${school.name} ha consumido el 100% de su cuota de escaneos OMR (${scansUsed}/${scansLimit}). Los nuevos escaneos serán bloqueados hasta que se amplíe la cuota.`;
    } else if (usagePct >= 0.9) {
      alertType = "quota_alert_90";
      alertTitle = "⚠️ Límite de Escaneos Cercano (90%)";
      alertBody = `El colegio ${school.name} ha consumido el 90% de su cuota de escaneos OMR (${scansUsed}/${scansLimit}). Le sugerimos comprar escaneos adicionales pronto para evitar bloqueos.`;
    }

    if (!alertType) return;

    // 2. Check if this specific alert type was already generated
    const { data: existingAlert, error: alertCheckError } = await admin
      .from("notifications")
      .select("id")
      .eq("school_id", schoolId)
      .eq("type", alertType)
      .limit(1)
      .maybeSingle();

    if (alertCheckError) {
      console.warn("[quota_alerts] error checking existing alerts:", alertCheckError.message);
      return;
    }

    // If alert already sent/registered, skip
    if (existingAlert) return;

    // 3. Register the notification in the database
    const { error: insertError } = await admin.from("notifications").insert({
      school_id: schoolId,
      type: alertType,
      title: alertTitle,
      body: alertBody,
    });

    if (insertError) {
      console.warn("[quota_alerts] error inserting notification:", insertError.message);
      return;
    }

    // 4. Fetch school admins to send them email alerts
    const { data: admins, error: adminsError } = await admin
      .from("school_members")
      .select("user_id")
      .eq("school_id", schoolId)
      .eq("role", "admin");

    if (adminsError || !admins || admins.length === 0) {
      console.warn("[quota_alerts] no admins found for school:", schoolId, adminsError?.message);
      return;
    }

    const adminUserIds = admins.map((a) => a.user_id);

    // Fetch emails of these admins from auth schema using auth.admin.listUsers
    // For simplicity, we can query profiles or just list users and match IDs
    const { data: usersData, error: usersError } = await admin.auth.admin.listUsers();
    if (usersError || !usersData) {
      console.warn("[quota_alerts] error fetching user emails:", usersError?.message);
      return;
    }

    const adminEmails = usersData.users
      .filter((u) => adminUserIds.includes(u.id) && u.email)
      .map((u) => u.email!);

    if (adminEmails.length === 0) return;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const billingLink = `${siteUrl}/dashboard/billing`;

    // 5. Send templated email alerts
    for (const email of adminEmails) {
      await sendTemplatedEmail({
        to: email,
        templateKey: alertType,
        locale: "es-CL", // Default to es-CL for these alerts
        variables: {
          school_name: school.name,
          scans_used: scansUsed,
          scans_limit: scansLimit,
          billing_link: billingLink,
        },
      });
    }
  } catch (error) {
    console.error("[quota_alerts] critical error in checkAndTriggerQuotaAlerts:", error);
  }
}
