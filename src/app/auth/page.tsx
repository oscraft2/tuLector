"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const client = useMemo(() => createClient(), []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "register") setMode("register");

    client.auth.getSession().then(({ data: { session } }) => {
      if (session) window.location.href = "/dashboard";
    });
  }, [client]);

  const handleAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (mode === "register") {
        const { error } = await client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard/onboarding` },
        });
        if (error) throw error;
        setMessage("Cuenta creada. Si Supabase exige confirmacion, revisa tu correo; si no, entra directamente.");
      } else {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = "/dashboard";
      }
    } catch (err) {
      const authErr = err as AuthError;
      setMessage(authErr.message || "Error de autenticacion");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setMessage("");
    try {
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      if (error) throw error;
    } catch (err) {
      const authErr = err as AuthError;
      setMessage(authErr.message || "No se pudo iniciar sesion con Google");
      setGoogleLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fafafa] px-5 py-10 text-[#0b1220]" style={{ fontFamily: '"Source Sans 3", "Noto Sans", "Segoe UI", Arial, sans-serif' }}>
      <div className="mx-auto grid min-h-[calc(100vh-80px)] max-w-6xl items-center gap-10 lg:grid-cols-[1fr_420px]">
        <section className="max-w-xl">
          <Link href="/" className="text-3xl font-semibold tracking-tight text-[#07305f]">TuLector</Link>
          <p className="mt-10 text-sm font-semibold uppercase tracking-[0.16em] text-[#6b7280]">Cuenta sincronizada</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight md:text-6xl">Web y app con una sola sesion.</h1>
          <p className="mt-6 text-lg leading-8 text-[#5b6472]">Administra ensayos y alumnos desde la web. Escanea hojas desde la app movil con la misma cuenta Supabase.</p>
        </section>

        <section className="rounded-md border border-[#d8dde3] bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-2xl font-semibold">{mode === "login" ? "Iniciar sesion" : "Crear cuenta"}</h2>
            <p className="mt-2 text-sm text-[#5b6472]">Usa correo institucional o Google.</p>
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading || loading}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-md border border-[#cfd6df] bg-white px-4 py-3 text-sm font-semibold text-[#111827] hover:bg-[#f6f7f9] disabled:opacity-50"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#cfd6df] text-xs font-bold">G</span>
            {googleLoading ? "Conectando..." : "Continuar con Google"}
          </button>

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-[#9aa3af]"><span className="h-px flex-1 bg-[#e1e5ea]" />o<span className="h-px flex-1 bg-[#e1e5ea]" /></div>

          <form onSubmit={handleAuth} className="space-y-4">
            <label className="block text-sm font-semibold text-[#111827]">
              Correo electronico
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-md border border-[#cfd6df] bg-white px-3 py-3 text-sm outline-none focus:border-[#07305f]"
                placeholder="tu@colegio.cl"
                autoComplete="email"
                required
              />
            </label>

            <label className="block text-sm font-semibold text-[#111827]">
              Contrasena
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-md border border-[#cfd6df] bg-white px-3 py-3 text-sm outline-none focus:border-[#07305f]"
                placeholder="Minimo 6 caracteres"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={6}
              />
            </label>

            {message ? (
              <div className={message.toLowerCase().includes("error") || message.toLowerCase().includes("invalid") || message.toLowerCase().includes("no se pudo")
                ? "rounded-md border border-[#fecaca] bg-[#fef2f2] p-3 text-sm text-[#991b1b]"
                : "rounded-md border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-sm text-[#166534]"}
              >
                {message}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full rounded-md bg-[#07305f] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0b3f78] disabled:opacity-50"
            >
              {loading ? "Procesando..." : mode === "login" ? "Entrar" : "Crear cuenta"}
            </button>
          </form>

          <div className="mt-5 text-center text-sm text-[#5b6472]">
            {mode === "login" ? (
              <p>No tienes cuenta? <button onClick={() => setMode("register")} className="font-semibold text-[#07305f] hover:underline">Crear cuenta</button></p>
            ) : (
              <p>Ya tienes cuenta? <button onClick={() => setMode("login")} className="font-semibold text-[#07305f] hover:underline">Iniciar sesion</button></p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
