"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition, useState, useEffect, useRef, type ReactNode, type RefObject } from "react";
import { TuLectorLogo } from "@/components/TuLectorLogo";
import { GlobalSearch } from "@/components/dashboard/GlobalSearch";
import { createClient } from "@/lib/supabase";
import { NotificationBell } from "@/components/dashboard/NotificationBell";

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
  notifCount?: number;
};

export function DashboardLayoutShell({
  nav,
  organizationName,
  userInitials,
  userName,
  children,
  userSchools,
  activeSchoolId,
  notifCount = 0,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending] = useTransition();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const desktopMenuRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const clickedMobileMenu = mobileMenuRef.current?.contains(target);
      const clickedDesktopMenu = desktopMenuRef.current?.contains(target);

      if (!clickedMobileMenu && !clickedDesktopMenu) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#fafafa] text-[#0b1220]" style={{ fontFamily: '"Source Sans 3", "Noto Sans", "Segoe UI", Arial, sans-serif' }}>
      <div className={`grid min-h-screen grid-cols-1 transition-all duration-300 ease-in-out ${isCollapsed ? "lg:grid-cols-[72px_minmax(0,1fr)]" : "lg:grid-cols-[244px_minmax(0,1fr)]"}`}>
        <aside className="hidden overflow-hidden border-r border-[#e1e5ea] bg-white transition-all duration-300 ease-in-out lg:sticky lg:top-0 lg:block lg:h-screen">
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
                      : "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-[#1f2937] transition-all duration-150 hover:bg-[#f4f6f8] hover:text-[#07305f]"}
                  >
                    <NavIcon active={active} />
                    {!isCollapsed && <span className="truncate transition-opacity duration-300">{item.label}</span>}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-[#e1e5ea] px-3 py-4">
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="flex w-full items-center justify-center rounded-md px-3 py-2 text-[#4b5563] transition-all duration-150 hover:bg-[#f4f6f8]"
                aria-label={isCollapsed ? "Expandir menu" : "Contraer menu"}
              >
                <span className="text-xl font-bold leading-none">{isCollapsed ? ">" : "<"}</span>
              </button>
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-30 border-b border-[#e1e5ea] bg-white/95 backdrop-blur">
            <div className="flex min-h-16 flex-col gap-3 px-4 py-3 md:px-8 lg:min-h-20 lg:px-10">
              <div className="flex items-center justify-between gap-3 lg:hidden">
                <TuLectorLogo href="/dashboard" size="sm" />
                <div className="flex items-center gap-2">
                  <NotificationBell />
                  <ProfileMenu userInitials={userInitials} userName={userName} showProfileMenu={showProfileMenu} setShowProfileMenu={setShowProfileMenu} menuRef={mobileMenuRef} handleLogout={handleLogout} />
                </div>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
                  <SchoolIdentity userSchools={userSchools} activeSchoolId={activeSchoolId} organizationName={organizationName} />
                  <div className="hidden w-full md:block md:max-w-[365px]">
                    <GlobalSearch />
                  </div>
                </div>

                <div className="hidden items-center justify-end gap-5 lg:flex">
                  <NotificationBell />
                  <ProfileMenu userInitials={userInitials} userName={userName} showProfileMenu={showProfileMenu} setShowProfileMenu={setShowProfileMenu} menuRef={desktopMenuRef} handleLogout={handleLogout} />
                </div>
              </div>
            </div>
          </header>

          <div className={`flex-1 px-4 pb-28 pt-5 transition-opacity duration-200 md:px-8 md:py-7 lg:px-10 lg:pb-7 ${isPending ? "opacity-60" : "opacity-100"}`}>
            {children}
          </div>

          <footer className="border-t border-[#e1e5ea] bg-white px-4 py-5 pb-24 md:px-8 lg:px-10 lg:pb-5">
            <div className="flex flex-col gap-3 text-sm text-[#5b6472] md:flex-row md:items-center md:justify-between">
              <TuLectorLogo href="/dashboard" size="sm" />
              <div className="flex flex-wrap gap-5 md:gap-8">
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

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#d8dde3] bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden" aria-label="Navegacion movil">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {nav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={active
                  ? "flex min-w-[92px] flex-col items-center justify-center rounded-md bg-[#eef4ff] px-3 py-2 text-center text-[11px] font-bold text-[#07305f]"
                  : "flex min-w-[92px] flex-col items-center justify-center rounded-md px-3 py-2 text-center text-[11px] font-semibold text-[#4b5563] hover:bg-[#f4f6f8]"}
              >
                <NavIcon active={active} />
                <span className="mt-1 max-w-[76px] truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </main>
  );
}

function ProfileMenu({
  userInitials,
  userName,
  showProfileMenu,
  setShowProfileMenu,
  menuRef,
  handleLogout,
}: {
  userInitials: string;
  userName: string;
  showProfileMenu: boolean;
  setShowProfileMenu: (value: boolean) => void;
  menuRef: RefObject<HTMLDivElement | null>;
  handleLogout: () => void;
}) {
  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setShowProfileMenu(!showProfileMenu)}
        className="flex items-center gap-3 focus:outline-none"
        aria-label={`Cuenta de ${userName}`}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#07305f] text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 lg:h-12 lg:w-12 lg:text-base">
          {userInitials}
        </span>
        <span className="hidden text-[#111827] md:block" aria-hidden="true">⌄</span>
      </button>

      {showProfileMenu && (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-md border border-[#e1e5ea] bg-white shadow-lg divide-y divide-[#eef0f3]">
          <div className="px-4 py-3 text-sm text-[#111827]">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#5b6472]">Usuario activo</p>
            <p className="mt-1 truncate font-medium">{userName}</p>
          </div>
          <div className="py-1">
            <Link href="/dashboard/settings" onClick={() => setShowProfileMenu(false)} className="block px-4 py-2 text-sm text-[#1f2937] hover:bg-[#f4f6f8] hover:text-[#07305f]">
              Configuracion
            </Link>
            <Link href="/dashboard/billing" onClick={() => setShowProfileMenu(false)} className="block px-4 py-2 text-sm text-[#1f2937] hover:bg-[#f4f6f8] hover:text-[#07305f]">
              Planes y Cuotas
            </Link>
          </div>
          <div className="py-1">
            <button onClick={handleLogout} className="flex w-full px-4 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50">
              Cerrar sesion
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SchoolIdentity({ userSchools, activeSchoolId, organizationName }: { userSchools?: UserSchool[]; activeSchoolId?: string; organizationName: string }) {
  const active = userSchools?.find((s) => s.id === activeSchoolId);
  const name = active?.name ?? organizationName;
  const roleLabel = active
    ? active.role === "admin" ? "Administrador" : active.role === "teacher" ? "Profesor" : "Observador"
    : "Institución";
  const initial = name.trim().charAt(0).toUpperCase() || "T";
  return (
    <div className="flex w-full items-center gap-3 rounded-md border border-[#e1e5ea] bg-white px-3 py-2 md:max-w-[345px]" aria-label={`Institución activa: ${name}`}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#07305f] text-sm font-bold text-white" aria-hidden="true">{initial}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold leading-tight text-[#111827]">{name}</span>
        <span className="block text-[11px] leading-tight text-[#6b7280]">{roleLabel}</span>
      </span>
    </div>
  );
}

function NavIcon({ active }: { active: boolean }) {
  return (
    <span className={active ? "grid h-5 w-5 shrink-0 place-items-center text-[#07305f]" : "grid h-5 w-5 shrink-0 place-items-center text-[#111827]"} aria-hidden="true">
      <span className="h-3.5 w-3.5 rounded-sm border-2 border-current" />
    </span>
  );
}