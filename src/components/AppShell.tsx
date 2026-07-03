import Link from "next/link";
import { TuLectorLogo } from "@/components/TuLectorLogo";

type NavItem = {
  href: string;
  label: string;
  active?: boolean;
};

type UserSchool = {
  id: string;
  name: string;
  role: string;
};

type AppShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  nav: NavItem[];
  mode: "client" | "admin";
  organizationName?: string;
  userName?: string;
  userInitials?: string;
  children: React.ReactNode;
  userSchools?: UserSchool[];
  activeSchoolId?: string;
};

export function AppShell({
  eyebrow,
  title,
  description,
  nav,
  mode,
  organizationName = mode === "admin" ? "TuLector Inc." : "Institucion",
  userName = mode === "admin" ? "Admin" : "Usuario",
  userInitials = mode === "admin" ? "TL" : "MP",
  children,
  userSchools,
  activeSchoolId,
}: AppShellProps) {
  return (
    <main className="min-h-screen bg-[#fafafa] text-[#0b1220]" style={{ fontFamily: '"Source Sans 3", "Noto Sans", "Segoe UI", Arial, sans-serif' }}>
      <div className="grid min-h-screen lg:grid-cols-[244px_1fr]">
        <aside className="border-b border-[#e1e5ea] bg-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col">
            <div className="flex h-20 items-center px-6">
              <TuLectorLogo href={mode === "admin" ? "/admin" : "/dashboard"} />
            </div>

            <nav className="flex-1 space-y-1 px-4 py-4" aria-label="Navegacion principal">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={item.active ? "page" : undefined}
                  className={item.active
                    ? "flex items-center gap-3 rounded-md bg-[#eef4ff] px-4 py-3 text-sm font-semibold text-[#07305f]"
                    : "flex items-center gap-3 rounded-md px-4 py-3 text-sm font-medium text-[#1f2937] hover:bg-[#f4f6f8] hover:text-[#07305f]"}
                >
                  <NavIcon active={Boolean(item.active)} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>

            <div className="border-t border-[#e1e5ea] px-4 py-4">
              <button className="flex w-full items-center justify-center rounded-md px-3 py-2 text-[#4b5563] hover:bg-[#f4f6f8]" aria-label="Contraer menu">
                <span className="text-xl leading-none">&laquo;</span>
              </button>
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-20 border-b border-[#e1e5ea] bg-white/95 backdrop-blur">
            <div className="flex min-h-20 flex-col gap-3 px-5 py-3 md:px-10 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
                <SchoolIdentity userSchools={userSchools} activeSchoolId={activeSchoolId} organizationName={organizationName} />
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

          <div className="flex-1 px-5 py-7 md:px-10">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6b7280]">{eyebrow}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5b6472]">{description}</p>
            </div>
            {children}
          </div>

          <footer className="border-t border-[#e1e5ea] bg-white px-5 py-5 md:px-10">
            <div className="flex flex-col gap-3 text-sm text-[#5b6472] md:flex-row md:items-center md:justify-between">
              <TuLectorLogo href={mode === "admin" ? "/admin" : "/dashboard"} size="sm" />
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
    <span className={active ? "grid h-5 w-5 place-items-center text-[#07305f]" : "grid h-5 w-5 place-items-center text-[#111827]"} aria-hidden="true">
      <span className="h-3.5 w-3.5 rounded-sm border-2 border-current" />
    </span>
  );
}

export function StatGrid({ items }: { items: readonly { label: string; value: string; delta: string }[] }) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <article key={item.label} className="rounded-md border border-[#e1e5ea] bg-white p-5">
          <p className="text-sm font-medium text-[#6b7280]">{item.label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">{item.value}</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#4b5563]">{item.delta}</p>
        </article>
      ))}
    </section>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      {action ? <button className="rounded-md border border-[#cfd6df] px-3 py-2 text-sm font-semibold text-[#07305f] hover:bg-[#f4f6f8]">{action}</button> : null}
    </div>
  );
}

export function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-md bg-[#eaf2ff] px-2.5 py-1 text-xs font-semibold text-[#07305f]">
      {children}
    </span>
  );
}
