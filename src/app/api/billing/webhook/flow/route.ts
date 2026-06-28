import { NextResponse } from "next/server";
import { getFlowPaymentStatus } from "@/lib/flow";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { sendTemplatedEmail } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const textBody = await request.text();
    const params = new URLSearchParams(textBody);
    const token = params.get("token");

    if (!token) {
      return NextResponse.json({ error: "Falta token" }, { status: 400 });
    }

    // 1. Fetch real status from Flow to prevent spoofing
    const payment = await getFlowPaymentStatus(token);

    if (payment.status !== 2) {
      console.log(`[flow_webhook] pago no aprobado (status: ${payment.status}) para orden: ${payment.commerceOrder}`);
      return NextResponse.json({ status: "processed", detail: "pago no aprobado" });
    }

    const orderId = payment.commerceOrder;
    const admin = createSupabaseAdminClient();

    // 2. Fetch the corresponding pending order
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error("[flow_webhook] orden no encontrada:", orderId, orderError?.message);
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    }

    if (order.status === "paid") {
      // Order already processed
      return NextResponse.json({ status: "already_processed" });
    }

    // 3. Mark order as paid
    const { error: updateOrderError } = await admin
      .from("orders")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateOrderError) {
      console.error("[flow_webhook] error al actualizar orden:", updateOrderError.message);
      return NextResponse.json({ error: "Error de base de datos" }, { status: 500 });
    }

    // 4. Update school scans limit and plan
    const { data: school, error: schoolError } = await admin
      .from("schools")
      .select("id, name, scans_limit, plan")
      .eq("id", order.school_id)
      .single();

    if (schoolError || !school) {
      console.error("[flow_webhook] colegio no encontrado:", order.school_id, schoolError?.message);
      return NextResponse.json({ error: "Colegio no encontrado" }, { status: 404 });
    }

    const extraScans = order.scans_added ?? 0;
    const newScansLimit = (school.scans_limit ?? 0) + extraScans;

    let targetPlan = school.plan;
    if (order.type === "plan") {
      // Pro/School updates depending on price or scans added
      targetPlan = extraScans >= 10000 ? "school" : "pro";
    }

    const { error: updateSchoolError } = await admin
      .from("schools")
      .update({
        scans_limit: newScansLimit,
        plan: targetPlan,
        updated_at: new Date().toISOString(),
      })
      .eq("id", school.id);

    if (updateSchoolError) {
      console.error("[flow_webhook] error al actualizar colegio:", updateSchoolError.message);
    }

    // 5. If it is a subscription plan, create or update subscription record
    if (order.type === "plan") {
      await admin.from("subscriptions").upsert({
        school_id: school.id,
        plan: targetPlan,
        status: "active",
        currency: order.currency,
        amount_cents: order.amount_cents,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        updated_at: new Date().toISOString(),
      }, { onConflict: "stripe_subscription_id" }); // Or school_id if unique
    }

    // 6. Fetch admins to send confirmation email
    const { data: members } = await admin
      .from("school_members")
      .select("user_id")
      .eq("school_id", school.id)
      .eq("role", "admin");

    if (members && members.length > 0) {
      const adminUserIds = members.map((m) => m.user_id);
      const { data: usersData } = await admin.auth.admin.listUsers();
      if (usersData) {
        const emails = usersData.users
          .filter((u) => adminUserIds.includes(u.id) && u.email)
          .map((u) => u.email!);

        const formattedAmount = `$${(order.amount_cents / 100).toLocaleString("es-CL")} ${order.currency.toUpperCase()}`;
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

        for (const email of emails) {
          await sendTemplatedEmail({
            to: email,
            templateKey: "payment_success",
            locale: "es-CL",
            variables: {
              school_name: school.name,
              plan_or_pack: order.type === "plan" ? `Plan ${targetPlan.toUpperCase()}` : `Paquete de ${extraScans} escaneos`,
              amount: formattedAmount,
              transaction_id: token,
              payment_method: "Flow (Chile)",
              dashboard_link: `${siteUrl}/dashboard`,
            },
          });
        }
      }
    }

    return NextResponse.json({ status: "success", order_id: orderId });
  } catch (err: any) {
    console.error("[flow_webhook] error crítico:", err);
    return NextResponse.json({ error: err.message || "Excepción de servidor" }, { status: 500 });
  }
}
