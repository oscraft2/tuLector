"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/app", label: "Inicio" },
  { href: "/app/results", label: "Resultados" },
  { href: "/app/scan", label: "Escanear", featured: true },
  { href: "/app/students", label: "Alumnos" },
];

/** Barra inferior fija de las pantallas nativas (Escanear/Resultados/Alumnos/Inicio). */
export function NativeBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="safe-pb fixed inset-x-0 bottom-0 z-40 border-t border-[#d8dde3] bg-white/95 px-3 pb-2 pt-2 shadow-[0_-16px_35px_rgba(15,23,42,0.1)] backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-4 items-end gap-1">
        {items.map((item) => {
          const active = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={item.featured
                ? "-mt-7 flex flex-col items-center justify-center gap-1 text-center text-[10px] font-black uppercase tracking-[0.08em] text-[#07305f]"
                : active
                  ? "flex min-h-14 flex-col items-center justify-center rounded-2xl bg-[#eef4ff] px-1.5 py-2 text-center text-[11px] font-bold text-[#07305f]"
                  : "flex min-h-14 flex-col items-center justify-center rounded-2xl px-1.5 py-2 text-center text-[11px] font-semibold text-[#64748b] active:bg-[#f4f7fa]"}
            >
              <span className={item.featured ? "grid h-14 w-14 place-items-center rounded-2xl bg-[#07305f] text-white shadow-lg shadow-[#07305f]/25 ring-4 ring-white" : undefined}>
                <NavIcon item={item.href} active={item.featured ? false : active} />
              </span>
              <span className={item.featured ? "text-[#07305f]" : "mt-1"}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function NavIcon({ item, active }: { item: string; active: boolean }) {
  const props = { className: active ? "h-5 w-5 shrink-0 text-[#07305f]" : "h-5 w-5 shrink-0 text-current", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

  if (item === "/app") {
    return <svg {...props}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></svg>;
  }
  if (item === "/app/results") {
    return <svg {...props}><path d="M3 3v18h18" /><path d="M18.7 8 13 13.7 9.5 10.2 3 16.7" /></svg>;
  }
  if (item === "/app/scan") {
    return <svg {...props} stroke="white"><path d="M4 7V5a2 2 0 0 1 2-2h2" /><path d="M16 3h2a2 2 0 0 1 2 2v2" /><path d="M20 17v2a2 2 0 0 1-2 2h-2" /><path d="M8 21H6a2 2 0 0 1-2-2v-2" /><path d="M7 12h10" /></svg>;
  }
  return <svg {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
}
