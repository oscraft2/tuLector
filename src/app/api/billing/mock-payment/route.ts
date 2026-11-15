import { NextResponse } from "next/server";
import { getDashboardContext, assertSchoolAdmin } from "@/lib/supabase_server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { markOrderPaidAndApplyEntitlement } from "@/lib/billing_orders";

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const { school, isAdmin } = await getDashboardContext();
    assertSchoolAdmin(isAdmin);
    const url = new URL(request.url);
    const orderId = url.searchParams.get("orderId") || "";
    const token = url.searchParams.get("token") || "";
    const admin = createSupabaseAdminClient();
    const { data: order, error } = await admin.from("orders").select("*")
      .eq("id", orderId).eq("school_id", school.id).single();
    if (error || !order || !token.startsWith("mock_") || order.stripe_checkout_session_id !== token) {
      return NextResponse.json({ error: "Orden de prueba no disponible" }, { status: 404 });
    }
    await markOrderPaidAndApplyEntitlement(admin, order.id, {
      expectedAmountCents: order.amount_cents, expectedCurrency: order.currency,
      gateway: order.gateway, gatewayPaymentId: token,
    });
    return NextResponse.redirect(new URL("/dashboard/billing?order_id=" + encodeURIComponent(order.id), request.url), 303);
  } catch (error) {
    console.error("[mock_payment]", error);
    return NextResponse.json({ error: "No se pudo procesar el pago de prueba." }, { status: 500 });
  }
}
