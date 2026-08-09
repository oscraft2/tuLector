"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { TuLectorLogo } from "@/components/TuLectorLogo";
import { isNativeApp } from "@/lib/native/capacitor";
import { translateAuthError } from "@/lib/auth_error_messages";

const PASSWORD_MIN_LENGTH = 6;

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="text-[#6b7280] text-sm">Cargando...</div>
      </main>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const client = useMemo(() => createClient(), []);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    client.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      setHasSession(Boolean(session));
      setChecking(false);
    });
    return () => { active = false; };
  }, [client]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    if (password.length < PASSWORD_MIN_LENGTH) {
      setMessage(`Usa una contrasena de al menos ${PASSWORD_MIN_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Las contrasenas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setTimeout(() => router.replace(isNativeApp() ? "/app" : "/dashboard"), 1200);
    } catch (err) {
      const authErr = err as AuthError;
      setMessage(authErr.message ? translateAuthError(authErr.message) : "No se pudo actualizar la contrasena.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f8faf9] px-4 py-10 text-[#0b1220]">
      <div className="mx-auto max-w-md">
        <div className="mb-6"><TuLectorLogo href="/" /></div>
        <section className="rounded-xl border border-[#dfe5e2] bg-white p-6 shadow-xl shadow-[#123b5d]/8 md:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">Nueva contrasena</h1>

          {checking ? (
            <p className="mt-4 text-sm text-[#5b6472]">Verificando enlace...</p>
          ) : !hasSession ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm leading-6 text-[#5b6472]">
                Este enlace ya no es valido o expiro. Pide uno nuevo desde la pantalla de inicio de sesion.
              </p>
              <Link href="/auth" className="inline-block rounded-lg bg-[#123b5d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0f2f49]">
                Volver a inicio de sesion
              </Link>
            </div>
          ) : done ? (
            <p className="mt-4 text-sm font-semibold text-[#166534]">Contrasena actualizada. Entrando...</p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <label className="block text-sm font-bold text-[#111827]">
                Nueva contrasena
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-[#cfd8d4] bg-white px-3 py-3 text-sm outline-none transition placeholder:text-[#9aa3af] focus:border-[#123b5d] focus:ring-2 focus:ring-[#123b5d]/10"
                  placeholder={`Minimo ${PASSWORD_MIN_LENGTH} caracteres`}
                  autoComplete="new-password"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                />
              </label>
              <label className="block text-sm font-bold text-[#111827]">
                Confirmar contrasena
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-[#cfd8d4] bg-white px-3 py-3 text-sm outline-none transition placeholder:text-[#9aa3af] focus:border-[#123b5d] focus:ring-2 focus:ring-[#123b5d]/10"
                  placeholder="Repite tu contrasena"
                  autoComplete="new-password"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                />
              </label>
              {message ? (
                <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] p-3 text-sm text-[#991b1b]">{message}</div>
              ) : null}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#123b5d] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#0f2f49] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Guardando..." : "Guardar y entrar"}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
