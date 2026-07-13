"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { COUNTRY_ID_FORMATS } from "@/lib/national_id";

export default function PortalAuthPage() {
  return (
    <Suspense fallback={<main className="flex min-h-dvh items-center justify-center bg-[#fafafa] text-sm text-[#6b7280]">Cargando...</main>}>
      <PortalAuthForm />
    </Suspense>
  );
}

function PortalAuthForm() {
  const searchParams = useSearchParams();
  const [countryCode, setCountryCode] = useState("CL");
  const [nationalId, setNationalId] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(searchParams.get("error"));

  const format = COUNTRY_ID_FORMATS.find((c) => c.code === countryCode);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/portal/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryCode, nationalId, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo procesar la solicitud");
        return;
      }
      setMessage(data.message ?? "Revisa tu correo para continuar.");
    } catch {
      setError("No se pudo conectar. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#111827] px-6 text-white">
      <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-[#07305f]/50 blur-3xl" />
      <div className="pointer-events-none absolute left-[-6rem] top-1/3 h-72 w-72 rounded-full bg-indigo-500/15 blur-3xl" />

      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-2xl font-black text-[#111827] shadow-lg">TL</div>
      <h1 className="text-2xl font-black tracking-tight">Portal de apoderados</h1>
      <p className="mt-2 max-w-sm text-center text-sm text-white/60">Ingresa el ID del alumno y tu correo para ver sus resultados.</p>

      <div className="mt-6 w-full max-w-sm rounded-2xl bg-white px-6 py-7 text-[#0b1220] shadow-xl">
        {message ? (
          <div className="text-center">
            <p className="text-sm font-semibold text-[#0b1220]">{message}</p>
            <p className="mt-2 text-xs text-[#6b7280]">Si no lo ves en unos minutos, revisa spam.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[#6b7280]">Pais</span>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="w-full rounded-xl border border-[#cfd6df] bg-white px-4 py-3 text-sm outline-none focus:border-[#07305f] focus:ring-2 focus:ring-[#07305f]/10"
              >
                {COUNTRY_ID_FORMATS.map((c) => (
                  <option key={c.code} value={c.code}>{c.name} ({c.idLabel})</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[#6b7280]">{format?.idLabel ?? "ID"} del alumno</span>
              <input
                type="text" value={nationalId} onChange={(e) => setNationalId(e.target.value)}
                className="w-full rounded-xl border border-[#cfd6df] bg-white px-4 py-3 text-sm outline-none focus:border-[#07305f] focus:ring-2 focus:ring-[#07305f]/10"
                placeholder={format?.example || "Ingresa el ID"} required
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[#6b7280]">Tu correo (apoderado)</span>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-[#cfd6df] bg-white px-4 py-3 text-sm outline-none focus:border-[#07305f] focus:ring-2 focus:ring-[#07305f]/10"
                placeholder="tu@correo.cl" autoComplete="email" required
              />
            </label>

            <button
              type="submit" disabled={loading}
              className="mt-2 flex min-h-12 w-full items-center justify-center rounded-xl bg-[#111827] px-4 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-black disabled:opacity-50"
            >
              {loading ? "Enviando..." : "Enviar enlace de acceso"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
