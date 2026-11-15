"use client";
import { useState } from "react";

export function BillingReceiptButton({ orderId }: { orderId: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  async function resend() {
    setState("sending");
    setError("");
    try {
      const response = await fetch("/api/billing/receipt", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo enviar.");
      setState("sent");
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo enviar.");
      setState("idle");
    }
  }
  return <span className="block text-xs">
    <button type="button" onClick={resend} disabled={state !== "idle"} className="underline disabled:opacity-60">
      {state === "sent" ? "Enviado por correo" : state === "sending" ? "Enviando..." : "Reenviar comprobante"}
    </button>
    {error ? <span role="alert" className="block text-red-700">{error}</span> : null}
  </span>;
}
