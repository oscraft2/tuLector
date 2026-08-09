"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TuLectorLogo } from "@/components/TuLectorLogo";

const ADMIN_NAV = [
  ["/admin", "Panorama"],
  ["/admin/schools", "Colegios"],
  ["/admin/users", "Usuarios"],
  ["/admin/usage", "Motor OMR"],
  ["/admin/billing", "Ingresos"],
  ["/admin/marketing", "Marketing"],
  ["/admin/support", "Soporte"],
  ["/admin/help-center", "Centro de Ayuda"],
  ["/admin/flags", "Flags"],
  ["/admin/settings", "Config. del sitio"],
  ["/admin/legal", "Legal"],
  ["/admin/observability", "Observabilidad"],
  ["/admin/dataset", "Dataset"],
] as const;

/**
 * Shell persistente de /admin -- se monta UNA vez en el layout y sobrevive a
 * las navegaciones entre secciones (antes cada page.tsx renderizaba su propio
 * <AdminShell><AppShell>, asi que sidebar/header se desmontaban y volvian a
 * montar en cada click, y el loading.tsx (sin chrome) quedaba de por medio --
 * eso era el parpadeo). Mismo patron que DashboardLayoutShell.tsx: solo el
 * area de contenido hace fade durante la transicion de navegacion.
 */
export function AdminLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isPending] = useTransition();

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  return (
    <main className="min-h-screen bg-[#fafafa] text-[#0b1220]" style={{ fontFamily: '"Source Sans 3", "Noto Sans", "Segoe UI", Arial, sans-serif' }}>
      <div className="grid min-h-screen lg:grid-cols-[244px_1fr]">
        <aside className="border-b border-[#e1e5ea] bg-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col">
            <div className="flex h-20 items-center px-6">
              <TuLectorLogo href="/admin" />
            </div>

            <nav className="flex-1 space-y-1 px-4 py-4" aria-label="Navegacion de plataforma">
              {ADMIN_NAV.map(([href, label]) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={active
                      ? "flex items-center gap-3 rounded-md bg-[#eef4ff] px-4 py-3 text-sm font-semibold text-[#07305f]"
                      : "flex items-center gap-3 rounded-md px-4 py-3 text-sm font-medium text-[#1f2937] hover:bg-[#f4f6f8] hover:text-[#07305f]"}
                  >
                    <NavIcon active={active} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        <section className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-20 border-b border-[#e1e5ea] bg-white/95 backdrop-blur">
            <div className="flex min-h-20 flex-col gap-3 px-5 py-3 md:px-10 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#07305f] text-sm font-bold text-white" aria-hidden="true">T</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold leading-tight text-[#111827]">TuLector Inc.</span>
                  <span className="block text-[11px] leading-tight text-[#6b7280]">Consola de plataforma</span>
                </span>
              </div>
              <div className="flex items-center justify-end gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#07305f] text-base font-semibold text-white shadow-sm" aria-label="Staff TuLector">TL</span>
              </div>
            </div>
          </header>

          <div className={`flex-1 px-5 py-7 transition-opacity duration-200 md:px-10 ${isPending ? "opacity-60" : "opacity-100"}`}>
            {children}
          </div>

          <footer className="border-t border-[#e1e5ea] bg-white px-5 py-5 md:px-10">
            <div className="flex flex-col gap-3 text-sm text-[#5b6472] md:flex-row md:items-center md:justify-between">
              <TuLectorLogo href="/admin" size="sm" />
              <div className="flex flex-wrap gap-8">
                <Link href="/privacy" className="hover:text-[#07305f]">Privacidad</Link>
                <Link href="/terms" className="hover:text-[#07305f]">Terminos</Link>
                <Link href="/support" className="hover:text-[#07305f]">Soporte</Link>
                <Link href="/security" className="hover:text-[#07305f]">Seguridad</Link>
              </div>
              <p>© 2026 TuLector SpA</p>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}

function NavIcon({ active }: { active: boolean }) {
  return (
    <span className={active ? "grid h-5 w-5 place-items-center text-[#07305f]" : "grid h-5 w-5 place-items-center text-[#111827]"} aria-hidden="true">
      <span className="h-3.5 w-3.5 rounded-sm border-2 border-current" />
    </span>
  );
}
