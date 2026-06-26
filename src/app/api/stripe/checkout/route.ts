import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/supabase_server";
import { getStripeConfig } from "@/lib/stripe";

export async function POST() {
  const { school } = await getDashboardContext();
  const config = getStripeConfig();
  if (!config.configured) {
    return NextResponse.json({ error: "Stripe no configurado", school_id: school.id }, { status: 501 });
  }
  return NextResponse.json({ error: "Checkout pendiente de implementar con SDK Stripe server-side" }, { status: 501 });
}
