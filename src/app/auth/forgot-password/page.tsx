"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { TuLectorLogo } from "@/components/TuLectorLogo";
import { isNativeApp, OAUTH_DEEP_LINK } from "@/lib/native/capacitor";
import { getSiteUrl } from "@/lib/site_url";
import { translateAuthError } from "@/lib/auth_error_messages";

export default function ForgotPasswordPage() {
  const client = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const target = email.trim().toLowerCase();
    setMessage("");
    setLoading(true);
    try {
      const redirectTo = isNativeApp()
        ? `${OAUTH_DEEP_LINK}?from=app&next=/auth/reset-password`
        : (() => {
            const url = new URL("/auth/callback", getSiteUrl(window.location.origin));
            url.searchParams.set("next", "/auth/reset-password");
            return url.toString();
          })();
      const { error } = await client.auth.resetPasswordForEmail(target, { redirectTo });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      const authErr = err as AuthError;
      setMessage(authErr.message ? translateAuthError(authErr.message) : "No se pudo enviar el enlace de recuperacion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f8faf9] px-4 py-10 text-[#0b1220]">
      <div className="mx-auto max-w-md">
        <div className="mb-6"><TuLectorLogo href="/" /></div>
        <section className="rounded-xl border border-[#dfe5e2] bg-white p-6 shadow-xl shadow-[#123b5d]/8 md:p-8">
          {sent ? (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#e6f4ea] text-2xl text-[#166534]">✓</div>
              <h1 className="text-center text-2xl font-semibold tracking-tight text-[#111827]">Revisa tu correo</h1>
              <p className="mt-3 text-center text-sm leading-6 text-[#5b6472]">
                Si existe una cuenta con <strong className="text-[#111827]">{email.trim()}</strong>, te enviamos un enlace para restablecer tu contrasena. Revisa tambien la carpeta de spam.
              </p>
              <p className="mt-4 text-center text-sm leading-6 text-[#5b6472]">
                El enlace expira en un tiempo limitado. Si no te llega en unos minutos, podes pedir uno nuevo.
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => { setSent(false); setMessage(""); }}
                  className="w-full rounded-lg border border-[#cfd8d4] px-4 py-2.5 text-sm font-bold text-[#123b5d] hover:bg-[#f8faf9]"
                >
                  Enviar de nuevo
                </button>
                <Link href="/auth" className="w-full rounded-lg bg-[#123b5d] px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-[#0f2f49]">
                  Volver a inicio de sesion
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">Recuperar contrasena</h1>
              <p className="mt-2 text-sm leading-6 text-[#5b6472]">
                Escribe el correo de tu cuenta TuLector y te mandamos un enlace para elegir una contrasena nueva.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <label className="block text-sm font-bold text-[#111827]">
                  Correo electronico
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-[#cfd8d4] bg-white px-3 py-3 text-sm outline-none transition placeholder:text-[#9aa3af] focus:border-[#123b5d] focus:ring-2 focus:ring-[#123b5d]/10"
                    placeholder="tu@colegio.cl"
                    autoComplete="email"
                    required
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
                  {loading ? "Enviando..." : "Enviar enlace de recuperacion"}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-[#5b6472]">
                <Link href="/auth" className="font-bold text-[#123b5d] hover:underline">Volver a inicio de sesion</Link>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
