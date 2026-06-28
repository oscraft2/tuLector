"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition, useState, type ReactNode } from "react";
import { SchoolSelectSwitcher } from "@/components/dashboard/SchoolSelectSwitcher";
import { TuLectorLogo } from "@/components/TuLectorLogo";

type NavItem = { href: string; label: string };
type UserSchool = { id: string; name: string; role: string };

type Props = {
  nav: NavItem[];
  organizationName: string;
  userInitials: string;
  userName: string;
  children: ReactNode;
  userSchools?: UserSchool[];
  activeSchoolId?: string;
};

export function DashboardLayoutShell({
  nav,
  organizationName,
  userInitials,
  userName,
  children,
  userSchools,
  activeSchoolId,
}: Props) {
  const pathname = usePathname();
  const [isPending] = useTransition();
  const [isCollapsed, setIsCollapsed] = useState(false);

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <main className="min-h-screen bg-[#fafafa] text-[#0b1220]" style={{ fontFamily: '"Source Sans 3", "Noto Sans", "Segoe UI", Arial, sans-serif' }}>
      <div 
        className="grid min-h-screen transition-all duration-300 ease-in-out"
        style={{
          gridTemplateColumns: isCollapsed ? "72px 1fr" : "244px 1fr"
        }}
      >
        {/* ── Sidebar ── */}
        <aside className="border-b border-[#e1e5ea] bg-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r overflow-hidden transition-all duration-300 ease-in-out">
          <div className="flex h-full flex-col">
            <div className="flex h-20 items-center px-4 transition-all duration-300 ease-in-out">
              <TuLectorLogo href="/dashboard" collapsed={isCollapsed} />
            </div>

            <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Navegacion principal">
              {nav.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={isCollapsed ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={active
                      ? "flex items-center gap-3 rounded-md bg-[#eef4ff] px-3 py-3 text-sm font-semibold text-[#07305f] transition-all duration-150"
                      : "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-[#1f2937] hover:bg-[#f4f6f8] hover:text-[#07305f] transition-all duration-150"}
                  >
                    <NavIcon active={active} />
                    {!isCollapsed && (
                      <span className="truncate transition-opacity duration-300">{item.label}</span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-[#e1e5ea] px-3 py-4">
              <button 
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="flex w-full items-center justify-center rounded-md px-3 py-2 text-[#4b5563] hover:bg-[#f4f6f8] transition-all duration-150" 
                aria-label={isCollapsed ? "Expandir menu" : "Contraer menu"}
              >
                <span className="text-xl leading-none font-bold">
                  {isCollapsed ? "»" : "«"}
                </span>
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main content area ── */}
        <section className="flex min-w-0 flex-col">
          {/* Header */}
          <header className="sticky top-0 z-20 border-b border-[#e1e5ea] bg-white/95 backdrop-blur">
            <div className="flex min-h-20 flex-col gap-3 px-5 py-3 md:px-10 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
                {userSchools && userSchools.length > 0 && activeSchoolId ? (
                  <SchoolSelectSwitcher userSchools={userSchools} activeSchoolId={activeSchoolId} />
                ) : (
                  <button className="flex w-full items-center justify-between rounded-md border border-[#cfd6df] bg-white px-4 py-3 text-sm font-medium text-[#111827] md:max-w-[345px]" aria-label="Seleccionar institucion">
                    <span className="flex items-center gap-3"><span aria-hidden="true">⌂</span>{organizationName}</span>
                    <span aria-hidden="true">⌄</span>
                  </button>
                )}
                <label className="relative w-full md:max-w-[365px]">
                  <span className="sr-only">Buscar</span>
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#6b7280]" aria-hidden="true">⌕</span>
                  <input className="w-full rounded-md border border-[#cfd6df] bg-white py-3 pl-10 pr-16 text-sm outline-none focus:border-[#07305f]" placeholder="Buscar en TuLector..." />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-[#d8dde3] px-2 py-0.5 text-xs text-[#6b7280]">⌘ K</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-5">
                <button className="relative rounded-full p-2 text-[#111827] hover:bg-[#f4f6f8]" aria-label="Notificaciones">
                  <span aria-hidden="true" className="text-xl">♧</span>
                  <span className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-[#073b7a] text-[11px] font-semibold text-white">3</span>
                </button>
                <button className="flex items-center gap-3" aria-label={`Cuenta de ${userName}`}>
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#07305f] text-base font-semibold text-white shadow-sm">{userInitials}</span>
                  <span className="hidden text-[#111827] md:block" aria-hidden="true">⌄</span>
                </button>
              </div>
            </div>
          </header>

          {/* Page content with smooth transition */}
          <div
            className={`flex-1 px-5 py-7 md:px-10 transition-opacity duration-200 ${isPending ? "opacity-60" : "opacity-100"}`}
          >
            {children}
          </div>

          {/* Footer */}
          <footer className="border-t border-[#e1e5ea] bg-white px-5 py-5 md:px-10">
            <div className="flex flex-col gap-3 text-sm text-[#5b6472] md:flex-row md:items-center md:justify-between">
              <TuLectorLogo href="/dashboard" size="sm" />
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
    <span className={active ? "grid h-5 w-5 place-items-center text-[#07305f] shrink-0" : "grid h-5 w-5 place-items-center text-[#111827] shrink-0"} aria-hidden="true">
      <span className="h-3.5 w-3.5 rounded-sm border-2 border-current" />
    </span>
  );
}
