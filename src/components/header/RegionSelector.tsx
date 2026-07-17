"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AR, BR, CL, MX, PE } from "country-flag-icons/react/3x2";
import { locales, localeToCountry, localeToCurrency, localeToLanguage, type Locale } from "@/i18n/config";
import { messages } from "@/i18n/messages";
import { CheckIcon, ChevronIcon } from "@/components/header/icons";

const localeFlags = { "es-MX": MX, "es-PE": PE, "es-AR": AR, "pt-BR": BR, "es-CL": CL } as const;

/**
 * Preserva la pagina actual al cambiar de pais: si la URL empieza con un
 * locale conocido (/es-CL/precios), se reemplaza solo el prefijo
 * (/es-MX/precios). Si la pagina no es localizada (ej. /scan, herramienta),
 * se cae al home del pais destino.
 */
export function hrefForLocale(target: Locale, pathname: string | null): string {
  const p = pathname ?? "/";
  const seg = p.split("/")[1];
  if (locales.includes(seg as Locale)) {
    const rest = p.slice(seg.length + 1);
    return `/${target}${rest === "" ? "" : rest}`;
  }
  return `/${target}`;
}

/**
 * Persiste la eleccion manual de pais: cookie que el middleware ya lee en "/"
 * (NO se modifica el middleware) + flag local que silencia el GeoBanner (el
 * usuario ya eligio a proposito, no hay que "corregirlo").
 */
export function persistLocaleChoice(target: Locale) {
  document.cookie = `tulector-locale=${target}; max-age=${60 * 60 * 24 * 365}; path=/; samesite=lax`;
  try {
    localStorage.setItem("tl-locale-explicit", "1");
  } catch {
    // storage bloqueado (modo privado estricto): la cookie ya quedo, suficiente.
  }
}

type RegionSelectorProps = {
  currentLocale: Locale;
  /** "menu" = dentro del drawer movil (ancho completo); "bar" = barra principal (dropdown absoluto). */
  variant?: "bar" | "menu";
};

export function RegionSelector({ currentLocale, variant = "bar" }: RegionSelectorProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const ActiveFlag = localeFlags[currentLocale];
  const label = messages[currentLocale].nav.region.label;

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const items = locales.map((item) => {
    const Flag = localeFlags[item];
    const isActive = item === currentLocale;
    return (
      <Link
        key={item}
        href={hrefForLocale(item, pathname)}
        role="menuitem"
        aria-current={isActive ? "page" : undefined}
        onClick={() => {
          persistLocaleChoice(item);
          setOpen(false);
        }}
        className={isActive
          ? "flex items-center gap-3 rounded-lg bg-[#f0f4f2] px-3 py-2.5"
          : "flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-[#f7f8f6]"}
      >
        <Flag title={localeToCountry[item]} className="h-4 w-6 shrink-0 rounded-[2px] shadow-sm ring-1 ring-black/5" />
        <span className="min-w-0 flex-1">
          <span className={isActive ? "block text-sm font-bold text-[#111827]" : "block text-sm font-semibold text-[#374151]"}>
            {localeToCountry[item]}
          </span>
          <span className="block text-xs text-[#6b7280]">
            {localeToLanguage[item]} · {localeToCurrency[item]}
          </span>
        </span>
        {isActive ? <CheckIcon className="h-4 w-4 shrink-0 text-[#2f6f5e]" /> : null}
      </Link>
    );
  });

  return (
    <div ref={rootRef} className={variant === "menu" ? "relative w-full" : "relative"}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label}: ${localeToCountry[currentLocale]}`}
        className={variant === "menu"
          ? "flex w-full items-center gap-2 rounded-md border border-[#d8e0dc] bg-white px-3 py-2.5 text-sm font-bold text-[#111827] hover:bg-[#f7f8f6]"
          : "inline-flex items-center gap-2 rounded-md border border-[#d8e0dc] bg-white px-3 py-2 text-sm font-bold text-[#111827] hover:bg-[#f7f8f6]"}
      >
        <ActiveFlag className="h-4 w-6 rounded-[2px] shadow-sm ring-1 ring-black/5" aria-hidden="true" />
        <span className="flex-1 text-left">{localeToCountry[currentLocale]}</span>
        <ChevronIcon className={open ? "h-4 w-4 text-[#6b7280] transition-transform rotate-180" : "h-4 w-4 text-[#6b7280] transition-transform"} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={label}
          className={variant === "menu"
            ? "mt-2 w-full rounded-xl border border-[#e8eee9] bg-white p-2 shadow-lg tl-anim-menu"
            : "absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-[#e8eee9] bg-white p-2 shadow-xl shadow-black/10 tl-anim-menu"}
        >
          <p className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7280]">{label}</p>
          {items}
        </div>
      )}
    </div>
  );
}
