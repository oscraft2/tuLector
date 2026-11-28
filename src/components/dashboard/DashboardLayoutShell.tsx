"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
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
  userRole?: string;
  children: ReactNode;
  userSchools?: UserSchool[];
  activeSchoolId?: string;
};

const SIDEBAR_STORAGE_KEY = "tl_sidebar_collapsed";
const SIDEBAR_EVENT = "tl-sidebar-collapsed-change";
const MOBILE_PRIMARY_NAV = [
  { href: "/dashboard", label: "Inicio" },
  { href: "/dashboard/quizzes", label: "Ensayos" },
  { href: "/scan", label: "Escanear", featured: true },
  { href: "/dashboard/students", label: "Alumnos" },
] as const;

function subscribeSidebarCollapsed(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(SIDEBAR_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(SIDEBAR_EVENT, callback);
  };
}

function getSidebarCollapsedSnapshot(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function DashboardLayoutShell({
  nav,
  organizationName,
  userInitials,
  userName,
  userRole,
  children,
  userSchools,
  activeSchoolId,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const isCollapsed = useSyncExternalStore(subscribeSidebarCollapsed, getSidebarCollapsedSnapshot, () => false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const mobileMoreRef = useRef<HTMLDivElement>(null);

  const mobileMoreNav = nav.filter((item) => !MOBILE_PRIMARY_NAV.some((primary) => primary.href === item.href));

  // Resuelve un único ítem activo por coincidencia de prefijo más largo,
  // evitando que /dashboard/quizzes/compartidos marque también "Ensayos".
  const activeHref = useMemo(() => {
    let best = "";
    const allHrefs = [...nav.map((i) => i.href), ...MOBILE_PRIMARY_NAV.map((i) => i.href)];
    for (const href of allHrefs) {
      const matches = href === "/dashboard"
        ? pathname === "/dashboard"
        : pathname === href || pathname.startsWith(`${href}/`);
      if (matches && href.length > best.length) {
        best = href;
      }
    }
    return best;
  }, [nav, pathname]);

  const isActive = (href: string) => activeHref === href;
  const moreActive = mobileMoreNav.some((item) => isActive(item.href));

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (!profileMenuRef.current?.contains(target)) {
        setShowProfileMenu(false);
      }
      if (!mobileMoreRef.current?.contains(target)) {
        setShowMoreMenu(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowProfileMenu(false);
        setShowMoreMenu(false);
        setMobileSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function toggleCollapsed() {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, isCollapsed ? "0" : "1");
      window.dispatchEvent(new Event(SIDEBAR_EVENT));
    } catch {
      /* sin storage disponible */
    }
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#1c1917]">
      <div
        className={`grid min-h-screen grid-cols-1 ${
          isCollapsed ? "lg:grid-cols-[72px_minmax(0,1fr)]" : "lg:grid-cols-[236px_minmax(0,1fr)]"
        }`}
      >
        <aside className="hidden overflow-hidden border-r border-[#e7e5df] bg-white lg:sticky lg:top-0 lg:block lg:h-screen">
          <div className="flex h-full flex-col">
            <div className="flex h-[72px] items-center px-4">
              <TuLectorLogo href="/dashboard" collapsed={isCollapsed} />
            </div>

            <nav className="flex-1 space-y-1 px-3 py-3" aria-label="Navegación principal">
              {nav.map((item) => {
                const active = isActive(item.href);
                return (
                  <NavSidebarLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    active={active}
                    collapsed={isCollapsed}
                  />
                );
              })}
            </nav>

            <div className="border-t border-[#e7e5df] px-3 py-3">
              <button
                type="button"
                onClick={toggleCollapsed}
                title={isCollapsed ? "Expandir menú" : "Contraer menú"}
                className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-[#57534e] transition hover:bg-[#f7f6f2] hover:text-[#07305f]"
                aria-label={isCollapsed ? "Expandir menú" : "Contraer menú"}
              >
                <svg
                  className={`h-4 w-4 transition-transform ${isCollapsed ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
                </svg>
                {!isCollapsed && <span>Contraer</span>}
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-30 border-b border-[#e7e5df] bg-white/95 backdrop-blur">
            <div className="flex min-h-16 flex-col gap-2.5 px-4 py-2.5 md:px-8 lg:min-h-[72px] lg:justify-center lg:px-10">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="lg:hidden">
                    <TuLectorLogo href="/dashboard" size="sm" />
                  </div>
                  <div className="hidden lg:block">
                    <SchoolIdentity
                      userSchools={userSchools}
                      activeSchoolId={activeSchoolId}
                      organizationName={organizationName}
                      userRole={userRole}
                    />
                  </div>
                  <div className="hidden w-full md:block md:max-w-[365px]">
                    <GlobalSearch />
                  </div>
                </div>

                {/* Un único NotificationBell y ProfileMenu montados en todo momento */}
                <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setMobileSearchOpen((v) => !v)}
                    aria-expanded={mobileSearchOpen}
                    aria-label="Buscar alumno o ensayo"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e7e5df] bg-white text-[#57534e] transition hover:bg-[#f7f6f2] md:hidden"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <circle cx="11" cy="11" r="7" />
                      <path strokeLinecap="round" d="m20 20-3.5-3.5" />
                    </svg>
                  </button>
                  <NotificationBell />
                  <ProfileMenu
                    userInitials={userInitials}
                    userName={userName}
                    showProfileMenu={showProfileMenu}
                    setShowProfileMenu={setShowProfileMenu}
                    menuRef={profileMenuRef}
                    handleLogout={handleLogout}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 lg:hidden">
                <SchoolIdentity
                  userSchools={userSchools}
                  activeSchoolId={activeSchoolId}
                  organizationName={organizationName}
                  userRole={userRole}
                />
              </div>

              {mobileSearchOpen && (
                <div className="pb-1 md:hidden">
                  <GlobalSearch autoFocus onNavigate={() => setMobileSearchOpen(false)} />
                </div>
              )}
            </div>
          </header>

          <main className="flex-1 px-4 pb-28 pt-5 md:px-8 md:py-7 lg:px-10 lg:pb-8">
            {children}
          </main>

          <footer className="border-t border-[#e7e5df] bg-white px-4 py-5 pb-24 md:px-8 lg:px-10 lg:pb-5">
            <div className="flex flex-col gap-3 text-sm text-[#78716c] md:flex-row md:items-center md:justify-between">
              <TuLectorLogo href="/dashboard" size="sm" />
              <div className="flex flex-wrap gap-5 md:gap-8">
                <Link href="/privacy" className="hover:text-[#07305f]">Privacidad</Link>
                <Link href="/terms" className="hover:text-[#07305f]">Términos</Link>
                <Link href="/support" className="hover:text-[#07305f]">Soporte</Link>
                <Link href="/security" className="hover:text-[#07305f]">Seguridad</Link>
              </div>
              <p>© 2026 TuLector SpA</p>
            </div>
          </footer>
        </div>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e7e5df] bg-white/95 px-3 pb-[max(env(safe-area-inset-bottom),0.6rem)] pt-2 shadow-[0_-12px_30px_rgba(28,25,23,0.08)] backdrop-blur lg:hidden"
        aria-label="Navegación móvil"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 items-end gap-1">
          {MOBILE_PRIMARY_NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <MobilePrimaryLink
                key={item.href}
                href={item.href}
                label={item.label}
                featured={"featured" in item ? item.featured : false}
                active={active}
              />
            );
          })}
          <div className="relative" ref={mobileMoreRef}>
            {showMoreMenu && (
              <div className="absolute bottom-[calc(100%+0.8rem)] right-0 w-64 overflow-hidden rounded-2xl border border-[#e7e5df] bg-white p-2 shadow-xl">
                <p className="px-3 pb-2 pt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#78716c]">Más opciones</p>
                <div className="grid gap-1">
                  {mobileMoreNav.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setShowMoreMenu(false)}
                        aria-current={active ? "page" : undefined}
                        className={
                          active
                            ? "flex min-h-11 items-center gap-3 rounded-xl bg-[#eef4ff] px-3 text-sm font-bold text-[#07305f]"
                            : "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[#44403c] hover:bg-[#f7f6f2] hover:text-[#07305f]"
                        }
                      >
                        <NavIcon href={item.href} active={active} />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowMoreMenu((value) => !value)}
              aria-expanded={showMoreMenu}
              aria-haspopup="menu"
              className={
                moreActive || showMoreMenu
                  ? "flex min-h-14 w-full flex-col items-center justify-center rounded-2xl bg-[#eef4ff] px-1.5 py-2 text-center text-[11px] font-bold text-[#07305f]"
                  : "flex min-h-14 w-full flex-col items-center justify-center rounded-2xl px-1.5 py-2 text-center text-[11px] font-semibold text-[#78716c] hover:bg-[#f7f6f2] hover:text-[#07305f]"
              }
            >
              <NavIcon href="more" active={moreActive || showMoreMenu} />
              <span className="mt-1 max-w-[62px] truncate">Más</span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
}

function LinkPendingDot() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-label="Cargando"
      className="ml-auto h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#07305f]"
    />
  );
}

function NavSidebarLink({
  href,
  label,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "flex items-center gap-3 rounded-lg bg-[#eef4ff] px-3 py-2.5 text-sm font-semibold text-[#07305f] transition-colors"
          : "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#44403c] transition-colors hover:bg-[#f7f6f2] hover:text-[#07305f]"
      }
    >
      <NavIcon href={href} active={active} />
      {!collapsed && <span className="truncate">{label}</span>}
      {!collapsed && <LinkPendingDot />}
    </Link>
  );
}

function MobilePrimaryLink({
  href,
  label,
  featured,
  active,
}: {
  href: string;
  label: string;
  featured?: boolean;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        featured
          ? "-mt-7 flex flex-col items-center justify-center gap-1 text-center text-[10px] font-black uppercase tracking-[0.08em] text-[#07305f]"
          : active
            ? "relative flex min-h-14 flex-col items-center justify-center rounded-2xl bg-[#eef4ff] px-1.5 py-2 text-center text-[11px] font-bold text-[#07305f]"
            : "relative flex min-h-14 flex-col items-center justify-center rounded-2xl px-1.5 py-2 text-center text-[11px] font-semibold text-[#78716c] hover:bg-[#f7f6f2] hover:text-[#07305f]"
      }
    >
      <span
        className={
          featured
            ? "grid h-14 w-14 place-items-center rounded-2xl bg-[#07305f] text-white shadow-lg shadow-[#07305f]/25 ring-4 ring-white"
            : undefined
        }
      >
        <NavIcon href={href} active={featured ? false : active} />
      </span>
      <span className={featured ? "max-w-[64px] truncate text-[#07305f]" : "mt-1 max-w-[62px] truncate"}>
        {label}
      </span>
      <MobileLinkDot />
    </Link>
  );
}

function MobileLinkDot() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <span className="absolute right-2 top-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-[#07305f]" />;
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
        type="button"
        onClick={() => setShowProfileMenu(!showProfileMenu)}
        aria-expanded={showProfileMenu}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#07305f]"
        aria-label={`Cuenta de ${userName}`}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#07305f] text-xs font-bold text-white shadow-xs transition-opacity hover:opacity-90 lg:h-10 lg:w-10 lg:text-sm">
          {userInitials}
        </span>
        <span className="hidden text-[#57534e] md:block" aria-hidden="true">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>

      {showProfileMenu && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 divide-y divide-[#efede8] rounded-xl border border-[#e7e5df] bg-white shadow-lg"
        >
          <div className="px-4 py-3 text-sm text-[#1c1917]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#78716c]">Usuario activo</p>
            <p className="mt-0.5 truncate font-semibold">{userName}</p>
          </div>
          <div className="py-1">
            <Link
              href="/dashboard/settings"
              role="menuitem"
              onClick={() => setShowProfileMenu(false)}
              className="block px-4 py-2 text-sm text-[#44403c] hover:bg-[#faf9f6] hover:text-[#07305f]"
            >
              Configuración
            </Link>
            <Link
              href="/dashboard/billing"
              role="menuitem"
              onClick={() => setShowProfileMenu(false)}
              className="block px-4 py-2 text-sm text-[#44403c] hover:bg-[#faf9f6] hover:text-[#07305f]"
            >
              Planes y cuotas
            </Link>
          </div>
          <div className="py-1">
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="flex w-full px-4 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SchoolIdentity({
  userSchools,
  activeSchoolId,
  organizationName,
  userRole,
}: {
  userSchools?: UserSchool[];
  activeSchoolId?: string;
  organizationName: string;
  userRole?: string;
}) {
  const active = userSchools?.find((s) => s.id === activeSchoolId);
  const name = active?.name ?? organizationName;
  const role = active?.role ?? userRole;
  const roleLabel =
    role === "admin"
      ? "Administrador"
      : role === "teacher"
        ? "Profesor"
        : role === "viewer"
          ? "Observador"
          : "Institución";

  return (
    <div
      className="flex w-full items-center gap-2.5 rounded-lg border border-[#e7e5df] bg-[#faf9f6] px-2.5 py-1.5 md:max-w-[300px]"
      aria-label={`Institución activa: ${name}`}
    >
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#eef4ff] text-base ring-1 ring-[#d5e3fb]"
        aria-hidden="true"
      >
        🏫
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold leading-tight text-[#1c1917]">{name}</span>
        <span className="block text-[11px] leading-tight text-[#78716c]">{roleLabel}</span>
      </span>
    </div>
  );
}

function NavIcon({ href, active }: { href: string; active: boolean }) {
  const iconClass = active ? "h-5 w-5 shrink-0 text-[#07305f]" : "h-5 w-5 shrink-0 text-current";
  const props = {
    className: iconClass,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (href === "/dashboard") {
    return <svg {...props}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></svg>;
  }
  if (href.includes("/compartidos")) {
    return <svg {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8v6" /><path d="M23 11h-6" /></svg>;
  }
  if (href.includes("/quizzes")) {
    return <svg {...props}><path d="M9 5h11" /><path d="M9 12h11" /><path d="M9 19h11" /><path d="m4 5 1 1 2-2" /><path d="m4 12 1 1 2-2" /><path d="m4 19 1 1 2-2" /></svg>;
  }
  if (href === "/scan") {
    return <svg {...props}><path d="M4 7V5a2 2 0 0 1 2-2h2" /><path d="M16 3h2a2 2 0 0 1 2 2v2" /><path d="M20 17v2a2 2 0 0 1-2 2h-2" /><path d="M8 21H6a2 2 0 0 1-2-2v-2" /><path d="M7 12h10" /></svg>;
  }
  if (href.includes("/students")) {
    return <svg {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
  }
  if (href.includes("/courses")) {
    return <svg {...props}><path d="M4 19.5V5a2 2 0 0 1 2-2h11" /><path d="M8 7h8" /><path d="M8 11h8" /><path d="M6 21h13a1 1 0 0 0 1-1V6" /></svg>;
  }
  if (href.includes("/papers")) {
    return <svg {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8" /><path d="M8 17h5" /></svg>;
  }
  if (href.includes("/billing")) {
    return <svg {...props}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /><path d="M6 15h4" /></svg>;
  }
  if (href.includes("/settings")) {
    return <svg {...props}><circle cx="12" cy="12" r="3" /><path d="M12 2v3" /><path d="M12 19v3" /><path d="M2 12h3" /><path d="M19 12h3" /><path d="m4.93 4.93 2.12 2.12" /><path d="m16.95 16.95 2.12 2.12" /><path d="m4.93 19.07 2.12-2.12" /><path d="m16.95 7.05 2.12-2.12" /></svg>;
  }
  if (href.includes("/support")) {
    return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>;
  }
  return <svg {...props}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></svg>;
}
