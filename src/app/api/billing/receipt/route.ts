import { NextResponse } from "next/server";
import { assertSchoolAdmin, getDashboardContext } from "@/lib/supabase_server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { formatReceiptNumber } from "@/lib/billing_orders";

export async function POST(request: Request) {
  try {
    const { school, isAdmin } = await getDashboardContext();
    try {
      assertSchoolAdmin(isAdmin);
    } catch {
      return NextResponse.json({ error: "Solo un administrador puede reenviar comprobantes." }, { status: 403 });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "El cuerpo de la solicitud no es JSON valido." }, { status: 400 });
    }

    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "Solicitud invalida." }, { status: 400 });
    }

    const data = payload as Record<string, unknown>;
    const orderId = String(data.orderId ?? "");
    if (!orderId) {
      return NextResponse.json({ error: "Falta el identificador de la orden." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id, school_id, status, receipt_seq, receipt_sent_at, billing_details, amount_cents, currency, type, scans_added, gateway, gateway_payment_id, paid_at")
      .eq("id", orderId)
      .eq("school_id", school.id)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json({ error: "Orden no encontrada." }, { status: 404 });
    }

    if (order.status !== "paid") {
      return NextResponse.json({ error: "La orden aun no esta pagada." }, { status: 409 });
    }

    const receiptNumber = formatReceiptNumber(order);

    return NextResponse.json({
      receiptNumber,
      sentAt: order.receipt_sent_at,
      canResend: true,
      billingDetails: order.billing_details,
    });
  } catch (err: unknown) {
    console.error("[receipt] error crítico:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Excepción de servidor" }, { status: 500 });
  }
}
