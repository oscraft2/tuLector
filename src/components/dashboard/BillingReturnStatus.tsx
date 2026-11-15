"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function BillingReturnStatus({ status }: { status: string | null }) {
  const router = useRouter();
  useEffect(() => {
    if (status !== "pending") return;
    let attempts = 0;
    const timer = setInterval(() => {
      router.refresh();
      if (++attempts >= 10) clearInterval(timer);
    }, 3000);
    return () => clearInterval(timer);
  }, [status, router]);
  return <div role="status" className="rounded-md border border-[#e1e5ea] bg-white p-4 text-sm">
    {status === "paid" ? "Pago confirmado. Tu plan ya esta activo."
      : status === "pending" ? "Estamos esperando la confirmacion de la pasarela. Tu plan se activara cuando recibamos el pago."
      : status === "refunded" ? "Se registro la devolucion de este pago."
      : "Este pago no esta confirmado. Revisa el historial o contacta a soporte."}
  </div>;
}
