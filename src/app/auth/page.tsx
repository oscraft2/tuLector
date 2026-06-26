"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import Link from "next/link";
import type { AuthError } from "@supabase/supabase-js";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");

  const client = createClient();

  useEffect(() => {
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
        const { error } = await client.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("Revisa tu correo para confirmar la cuenta.");
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

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center">
          <Link href="/" className="text-2xl font-bold">TuLector</Link>
          <p className="text-zinc-400 text-sm mt-1">
            {mode === "login" ? "Inicia sesion para continuar" : "Crea tu cuenta"}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-green-600 transition"
              placeholder="tu@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-green-600 transition"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {message && (
            <div className={`text-sm p-3 rounded-lg ${message.includes("Revisa") ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"}`}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg font-semibold text-sm transition"
          >
            {loading ? "Cargando..." : mode === "login" ? "Iniciar sesion" : "Crear cuenta"}
          </button>
        </form>

        <div className="text-center text-sm text-zinc-400">
          {mode === "login" ? (
            <p>No tienes cuenta? <button onClick={() => setMode("register")} className="text-green-500 hover:underline">Registrate</button></p>
          ) : (
            <p>Ya tienes cuenta? <button onClick={() => setMode("login")} className="text-green-500 hover:underline">Inicia sesion</button></p>
          )}
        </div>
      </div>
    </div>
  );
}
