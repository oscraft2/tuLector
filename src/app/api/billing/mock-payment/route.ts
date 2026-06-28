import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const gateway = url.searchParams.get("gateway");
  const token = url.searchParams.get("token") || "";
  const orderId = url.searchParams.get("orderId") || "";

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  try {
    if (gateway === "flow") {
      // Trigger our own Flow webhook locally
      const tokenWithOrderId = `${token}_orderId_${orderId}`;
      const body = new URLSearchParams();
      body.append("token", tokenWithOrderId);

      await fetch(`${siteUrl}/api/billing/webhook/flow`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
    } else if (gateway === "mercadopago") {
      // Trigger our own MercadoPago webhook locally
      const paymentId = `mock_mp_payment_orderId_${orderId}`;
      const query = new URLSearchParams({
        topic: "payment",
        id: paymentId,
      });

      await fetch(`${siteUrl}/api/billing/webhook/mercadopago?${query.toString()}`, {
        method: "POST",
      });
    } else {
      // Stripe/Other fallback: directly mark as paid via Admin Client (since Stripe webhook is placeholder)
      const admin = createSupabaseAdminClient();
      
      const { data: order } = await admin
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

      if (order && order.status === "pending") {
        await admin
          .from("orders")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            stripe_checkout_session_id: token,
          })
          .eq("id", orderId);

        // Update school quota
        const { data: school } = await admin
          .from("schools")
          .select("id, scans_limit, plan")
          .eq("id", order.school_id)
          .single();

        if (school) {
          const extraScans = order.scans_added ?? 0;
          const newScansLimit = (school.scans_limit ?? 0) + extraScans;
          let targetPlan = school.plan;
          if (order.type === "plan") {
            targetPlan = extraScans >= 10000 ? "school" : "pro";
          }

          await admin
            .from("schools")
            .update({
              scans_limit: newScansLimit,
              plan: targetPlan,
              updated_at: new Date().toISOString(),
            })
            .eq("id", school.id);

          if (order.type === "plan") {
            await admin.from("subscriptions").upsert({
              school_id: school.id,
              plan: targetPlan,
              status: "active",
              currency: order.currency,
              amount_cents: order.amount_cents,
              current_period_start: new Date().toISOString(),
              current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: "stripe_subscription_id" });
          }
        }
      }
    }
  } catch (error) {
    console.error("[mock_payment] error during mock processing:", error);
  }

  // Redirect user back to billing dashboard with success status
  redirect(`/dashboard/billing?status=success&order_id=${orderId}`);
}
