import { NextResponse } from "next/server";
import { getStripeConfig } from "@/lib/stripe";

export async function POST(request: Request) {
  const config = getStripeConfig();
  if (!config.configured) return NextResponse.json({ error: "Stripe webhook no configurado" }, { status: 501 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Falta stripe-signature" }, { status: 400 });
  return NextResponse.json({ error: "Verificacion de firma pendiente de SDK Stripe server-side" }, { status: 501 });
}
