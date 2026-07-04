"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { APP_VERSION } from "@/lib/version";

/**
 * Menú de la app (pensado para Capacitor). Pantalla limpia tipo cards; hoy solo
 * "Lector Prueba" → /scan. Escalable: agregar tarjetas a futuro. Ver docs/apk-plan.md.
 */
export default function AppMenuPage() {
  const router = useRouter();
  const client = useMemo(() => createClient(), []);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    let active = true;
    client.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (!session) { router.replace("/auth"); return; }
      setEmail(session.user.email ?? "");
      setReady(true);
    });
    return () => { active = false; };
  }, [client, router]);

  const signOut = async () => { await client.auth.signOut(); router.replace("/auth"); };

  if (!ready) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#111827] text-white/60 text-sm">Cargando…</main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col bg-[#f5f6f8] text-[#0b1220]">
      {/* Header */}
      <header className="safe-pt bg-[#111827] px-6 pb-6 pt-5 text-white">
        <div className="flex items-center justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-lg font-black text-[#111827]">TL</div>
          <button onClick={signOut} className="text-xs font-semibold text-white/60 active:text-white">Salir</button>
        </div>
        <h1 className="mt-5 text-2xl font-black tracking-tight">Hola 👋</h1>
        <p className="mt-1 text-sm text-white/60">{email}</p>
      </header>

      {/* Cards */}
      <section className="px-5 py-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#6b7280]">Herramientas</p>
        <div className="grid gap-4">
          <Link
            href="/dashboard/quizzes"
            className="group flex items-center gap-4 rounded-2xl border border-[#e6e8eb] bg-white p-5 shadow-sm transition-all active:scale-[0.98]"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#07305f] text-white">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
                <line x1="3" y1="12" x2="21" y2="12" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[#111827]">Lector Prueba</h2>
              {/* Ojo: antes iba directo a /scan sin ensayo seleccionado, imposible
               * asociar el escaneo. Ahora pasa por la lista para elegir el ensayo
               * y usar su boton "Escanear" (fija tulector_active_quiz). */}
              <p className="mt-0.5 text-sm text-[#5b6472]">Elige el ensayo y escanea la hoja de respuestas.</p>
            </div>
            <svg className="ml-auto h-5 w-5 shrink-0 text-[#9aa3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </Link>

          <Link
            href="/dashboard/billing"
            className="group flex items-center gap-4 rounded-2xl border border-[#e6e8eb] bg-white p-5 shadow-sm transition-all active:scale-[0.98]"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#e6e8eb] text-[#111827]">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[#111827]">Mi plan</h2>
              <p className="mt-0.5 text-sm text-[#5b6472]">Cuota de lecturas y facturas. Para comprar, ingresa desde un navegador.</p>
            </div>
            <svg className="ml-auto h-5 w-5 shrink-0 text-[#9aa3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </Link>

          {/* Placeholder de futuras opciones (deshabilitado) */}
          <div className="flex items-center gap-4 rounded-2xl border border-dashed border-[#dfe3e8] bg-white/50 p-5 opacity-60">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#e6e8eb] text-[#9aa3af] text-2xl">＋</div>
            <div>
              <h2 className="text-base font-bold text-[#9aa3af]">Más opciones</h2>
              <p className="mt-0.5 text-sm text-[#9aa3af]">Pronto: resultados, alumnos.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer con la versión (para saber siempre qué build corres) */}
      <footer className="safe-pb mt-auto px-5 pb-6 pt-2 text-center">
        <p className="text-xs font-semibold tracking-wide text-[#9aa3af]">TuLector · versión {APP_VERSION}</p>
      </footer>
    </main>
  );
}
