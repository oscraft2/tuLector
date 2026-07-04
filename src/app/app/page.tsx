import Link from "next/link";
import { getDashboardContext } from "@/lib/supabase_server";
import { SignOutButton } from "@/components/native/SignOutButton";
import { NativeBottomNav } from "@/components/native/NativeBottomNav";
import { APP_VERSION } from "@/lib/version";

/**
 * Menú de la app (Capacitor). Server component: sin flash de "Cargando…" y
 * puede consultar datos reales (hojas por revisar) en el mismo request.
 * Cuatro tarjetas: Escanear, Resultados, Alumnos, Mi plan. Cada una tiene su
 * propia pantalla nativa (no reusa las paginas de escritorio) — ver
 * /app/scan, /app/results, /app/students. Ver docs/apk-plan.md.
 */
export default async function AppMenuPage() {
  const { user, school, supabase } = await getDashboardContext();

  const { count: pendingReview } = await supabase
    .from("papers")
    .select("id", { count: "exact", head: true })
    .eq("school_id", school.id)
    .eq("status", "manual_review");

  return (
    <main className="flex min-h-dvh flex-col bg-[#f5f6f8] text-[#0b1220]">
      <header className="safe-pt bg-[#111827] px-6 pb-6 pt-5 text-white">
        <div className="flex items-center justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-lg font-black text-[#111827]">TL</div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard/settings" aria-label="Configuración" className="text-white/60 active:text-white">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
              </svg>
            </Link>
            <SignOutButton />
          </div>
        </div>
        <h1 className="mt-5 text-2xl font-black tracking-tight">Hola 👋</h1>
        <p className="mt-1 text-sm text-white/60">{user.email}</p>
      </header>

      <section className="px-5 py-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#6b7280]">Herramientas</p>
        <div className="grid gap-4">
          <Link
            href="/app/scan"
            className="group flex items-center gap-4 rounded-2xl border border-[#e6e8eb] bg-white p-5 shadow-sm transition-all active:scale-[0.98]"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#07305f] text-white">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
                <line x1="3" y1="12" x2="21" y2="12" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[#111827]">Escanear</h2>
              <p className="mt-0.5 text-sm text-[#5b6472]">Sigue con tu ultimo ensayo o elige otro para leer.</p>
            </div>
            <svg className="ml-auto h-5 w-5 shrink-0 text-[#9aa3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </Link>

          <Link
            href="/app/results"
            className="group flex items-center gap-4 rounded-2xl border border-[#e6e8eb] bg-white p-5 shadow-sm transition-all active:scale-[0.98]"
          >
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#1a8f52]/10 text-[#1a8f52]">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" /><path d="M18.7 8 13 13.7 9.5 10.2 3 16.7" />
              </svg>
              {pendingReview ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#c2410c] px-1 text-[11px] font-bold text-white">
                  {pendingReview}
                </span>
              ) : null}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[#111827]">Resultados</h2>
              <p className="mt-0.5 text-sm text-[#5b6472]">
                {pendingReview ? `${pendingReview} hoja${pendingReview === 1 ? "" : "s"} por revisar.` : "Puntajes y logro por ensayo."}
              </p>
            </div>
            <svg className="ml-auto h-5 w-5 shrink-0 text-[#9aa3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </Link>

          <Link
            href="/app/students"
            className="group flex items-center gap-4 rounded-2xl border border-[#e6e8eb] bg-white p-5 shadow-sm transition-all active:scale-[0.98]"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#e6e8eb] text-[#111827]">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[#111827]">Alumnos</h2>
              <p className="mt-0.5 text-sm text-[#5b6472]">Busca alumnos y agrega nuevos.</p>
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
              <p className="mt-0.5 text-sm text-[#5b6472]">Plan {school.plan}. Para comprar, ingresa desde un navegador.</p>
            </div>
            <svg className="ml-auto h-5 w-5 shrink-0 text-[#9aa3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </Link>
        </div>
      </section>

      <footer className="mt-auto px-5 pb-24 pt-2 text-center">
        <p className="text-xs font-semibold tracking-wide text-[#9aa3af]">TuLector · versión {APP_VERSION}</p>
      </footer>
      <NativeBottomNav />
    </main>
  );
}
