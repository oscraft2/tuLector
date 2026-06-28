"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { TuLectorLogo } from "@/components/TuLectorLogo";

export default function AuthPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="text-[#6b7280] text-sm">Cargando...</div>
      </main>
    }>
      <AuthForm />
    </Suspense>
  );
}

function AuthForm() {
  const searchParams = useSearchParams();
  const initialMode: "login" | "register" = searchParams.get("mode") === "register" ? "register" : "login";
  const initialMessage = (() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      const msg = decodeURIComponent(errorParam);
      return msg.length > 200 ? msg.slice(0, 200) + "..." : msg;
    }
    return "";
  })();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const client = useMemo(() => createClient(), []);

  useEffect(() => {
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
          options: {
            emailRedirectTo: authCallbackUrl(),
          },
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
          redirectTo: authCallbackUrl(),
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
    <main className="min-h-screen bg-[#fafafa] px-5 py-10 text-[#0b1220]">
      <div className="mx-auto grid min-h-[calc(100vh-80px)] max-w-6xl items-center gap-10 lg:grid-cols-[1fr_420px]">
        <section className="max-w-xl">
          <TuLectorLogo href="/" size="lg" />
          <p className="mt-10 text-sm font-semibold uppercase tracking-[0.16em] text-[#6b7280]">Cuenta sincronizada</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight md:text-6xl">Web y app con una sola sesion.</h1>
          <p className="mt-6 text-lg leading-8 text-[#5b6472]">Administra ensayos y alumnos desde la web. Escanea hojas desde la app movil con la misma cuenta Supabase.</p>
        </section>

        <section className="rounded-xl border border-[#e0e4ea] bg-white p-8 shadow-sm">
          <div>
            <h2 className="text-2xl font-semibold">{mode === "login" ? "Iniciar sesion" : "Crear cuenta"}</h2>
            <p className="mt-2 text-sm text-[#5b6472]">Usa correo institucional o Google. El pais se define al crear el colegio.</p>
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading || loading}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg border border-[#cfd6df] bg-white px-4 py-3 text-sm font-semibold text-[#111827] shadow-sm transition-all hover:border-[#b0b8c3] hover:bg-[#f6f7f9] hover:shadow-md disabled:opacity-50 active:scale-[0.99]"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
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
                className="mt-2 w-full rounded-lg border border-[#cfd6df] bg-white px-3 py-3 text-sm outline-none transition-all placeholder:text-[#9aa3af] focus:border-[#07305f] focus:ring-2 focus:ring-[#07305f]/10"
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
                className="mt-2 w-full rounded-lg border border-[#cfd6df] bg-white px-3 py-3 text-sm outline-none transition-all placeholder:text-[#9aa3af] focus:border-[#07305f] focus:ring-2 focus:ring-[#07305f]/10"
                placeholder="Minimo 6 caracteres"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={6}
              />
            </label>

            {message ? (
              <div className={message.toLowerCase().includes("error") || message.toLowerCase().includes("invalid") || message.toLowerCase().includes("no se pudo")
                ? "rounded-lg border border-[#fecaca] bg-[#fef2f2] p-3 text-sm text-[#991b1b]"
                : "rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-sm text-[#166534]"}
              >
                {message}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full rounded-lg bg-[#07305f] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0b3f78] hover:shadow-md disabled:opacity-50 active:scale-[0.99]"
            >
              {loading ? "Procesando..." : mode === "login" ? "Entrar" : "Crear cuenta"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-[#5b6472]">
            {mode === "login" ? (
              <p>No tienes cuenta?{" "}<button onClick={() => { setMode("register"); setMessage(""); }} className="font-semibold text-[#07305f] transition-colors hover:text-[#0b3f78] hover:underline">Crear cuenta</button></p>
            ) : (
              <p>Ya tienes cuenta?{" "}<button onClick={() => { setMode("login"); setMessage(""); }} className="font-semibold text-[#07305f] transition-colors hover:text-[#0b3f78] hover:underline">Iniciar sesion</button></p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function authCallbackUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
  return new URL("/auth/callback", siteUrl).toString();
}
