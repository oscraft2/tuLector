import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { markOrderPaidAndApplyEntitlement } from "@/lib/billing_orders";

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Mock payments are disabled in production" }, { status: 404 });
  }

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
      const admin = createSupabaseAdminClient();
      await markOrderPaidAndApplyEntitlement(admin, orderId);
      if (token) {
        await admin.from("orders").update({ stripe_checkout_session_id: token }).eq("id", orderId);
      }
    }
  } catch (error) {
    console.error("[mock_payment] error during mock processing:", error);
  }

  // Redirect user back to billing dashboard with success status
  redirect(`/dashboard/billing?status=success&order_id=${orderId}`);
}
