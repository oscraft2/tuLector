"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AuthError } from "@supabase/supabase-js";
import { PublicFooter } from "@/components/PublicFooter";
import { PublicHeader } from "@/components/PublicHeader";
import { createClient } from "@/lib/supabase";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [institution, setInstitution] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");

  const client = createClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "register") setMode("register");

    client.auth.getSession().then(({ data: { session } }) => {
      if (session) window.location.href = "/dashboard";
    });
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (mode === "register") {
        const { error } = await client.auth.signUp({
          email,
          password,
          options: { data: { institution } },
        });
        if (error) throw error;
        setMessage("Revisa tu correo para confirmar la cuenta y activar tu espacio TuLector.");
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

  const isRegister = mode === "register";

  return (
    <main className="min-h-screen bg-white text-[#111827]" style={{ fontFamily: '"Source Sans 3", "Noto Sans", "Segoe UI", Arial, sans-serif' }}>
      <PublicHeader />

      <section className="border-b border-[#e2e6ea] bg-[#f6f7f9] px-4 py-10 md:px-8 md:py-16">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-md border border-[#e2e6ea] bg-white p-6 md:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#123a5a]">Cuenta TuLector</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
              {isRegister ? "Crea tu espacio de correccion." : "Ingresa a tu plataforma."}
            </h1>
            <p className="mt-4 text-sm leading-6 text-[#4b5563]">
              Una sola cuenta conecta la administracion web con la app movil de lectura: cursos, alumnos, ensayos,
              resultados, exportaciones y puntajes equivalentes.
            </p>

            <div className="mt-8 grid gap-3">
              {["Administrar alumnos y cursos", "Crear ensayos y claves", "Sincronizar lecturas desde la app", "Exportar resultados y reportes"].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-md border border-[#e2e6ea] bg-[#f6f7f9] px-4 py-3 text-sm font-semibold">
                  <span className="h-2 w-2 rounded-full bg-[#168a5b]" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-[#e2e6ea] bg-white p-6 shadow-sm md:p-8">
            <div className="flex rounded-md border border-[#e2e6ea] bg-[#f6f7f9] p-1">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`h-10 flex-1 rounded px-3 text-sm font-semibold ${!isRegister ? "bg-white text-[#123a5a] shadow-sm" : "text-[#6b7280]"}`}
              >
                Iniciar sesion
              </button>
              <button
                type="button"
                onClick={() => setMode("register")}
                className={`h-10 flex-1 rounded px-3 text-sm font-semibold ${isRegister ? "bg-white text-[#123a5a] shadow-sm" : "text-[#6b7280]"}`}
              >
                Crear cuenta
              </button>
            </div>

            <form onSubmit={handleAuth} className="mt-6 space-y-4">
              {isRegister && (
                <Field
                  label="Institucion o nombre profesional"
                  type="text"
                  value={institution}
                  onChange={setInstitution}
                  placeholder="Colegio, preuniversitario o profesor independiente"
                  required
                />
              )}
              <Field label="Correo electronico" type="email" value={email} onChange={setEmail} placeholder="tu@email.com" required />
              <Field label="Contrasena" type="password" value={password} onChange={setPassword} placeholder="Minimo 6 caracteres" required minLength={6} />

              {message && (
                <div className={`rounded-md border px-4 py-3 text-sm ${message.includes("Revisa") ? "border-[#bde6d2] bg-[#eaf7f1] text-[#168a5b]" : "border-[#f0c7c7] bg-[#fff4f4] text-[#c62828]"}`}>
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-[#123a5a] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0e304b] disabled:opacity-60"
              >
                {loading ? "Procesando..." : isRegister ? "Crear cuenta" : "Iniciar sesion"}
              </button>
            </form>

            <p className="mt-5 text-center text-xs leading-5 text-[#6b7280]">
              Al crear una cuenta aceptas los <Link href="/terms" className="font-semibold text-[#123a5a]">Terminos</Link> y la <Link href="/privacy" className="font-semibold text-[#123a5a]">Politica de privacidad</Link>.
            </p>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}

function Field({ label, type, value, onChange, placeholder, required, minLength }: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b7280]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        className="mt-1 w-full rounded-md border border-[#d1d8df] bg-white px-3 py-3 text-sm text-[#111827] outline-none transition focus:border-[#123a5a] focus:ring-2 focus:ring-[#123a5a]/10"
      />
    </label>
  );
}
