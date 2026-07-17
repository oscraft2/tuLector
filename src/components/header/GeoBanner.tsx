"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AR, BR, CL, MX, PE } from "country-flag-icons/react/3x2";
import { locales, localeToCountry, type Locale } from "@/i18n/config";
import { messages } from "@/i18n/messages";
import { isNativeApp } from "@/lib/native/capacitor";
import { hrefForLocale, persistLocaleChoice } from "@/components/header/RegionSelector";
import { CloseIcon } from "@/components/header/icons";

const localeFlags = { "es-MX": MX, "es-PE": PE, "es-AR": AR, "pt-BR": BR, "es-CL": CL } as const;

/**
 * Deteccion por idioma del navegador (100% cliente, sin backend/middleware y
 * sin volver dinamicas las paginas SSG de marketing). Replica las reglas de
 * detectFromAccept del middleware. Tradeoff aprobado: menos preciso que IP.
 */
function detectBrowserLocale(): Locale | null {
  const langs = navigator.languages?.length ? Array.from(navigator.languages) : [navigator.language];
  for (const raw of langs) {
    const lang = (raw ?? "").toLowerCase();
    if (locales.includes(lang as Locale)) return lang as Locale;
    if (lang.startsWith("es-mx")) return "es-MX";
    if (lang.startsWith("es-pe")) return "es-PE";
    if (lang.startsWith("es-ar")) return "es-AR";
    if (lang.startsWith("pt")) return "pt-BR";
    if (lang.startsWith("es-cl")) return "es-CL";
    if (lang.startsWith("es")) return "es-MX";
  }
  return null;
}

type GeoBannerProps = { currentLocale: Locale };

/**
 * Barra superior dismissible que sugiere la version del pais correcto cuando
 * el idioma del navegador no calza con la version actual (caso tipico: link
 * compartido cross-country). Se muestra SOLO si:
 *  (a) ya hidratamos y NO es el APK,
 *  (b) el locale detectado difiere del actual,
 *  (c) el usuario no ha elegido pais manualmente (tl-locale-explicit),
 *  (d) no ha cerrado el aviso antes (tl-geo-dismiss).
 * Estado inicial oculto -> cero hydration mismatch.
 */
export function GeoBanner({ currentLocale }: GeoBannerProps) {
  const [detected, setDetected] = useState<Locale | null>(null);
  const pathname = usePathname();
  const copy = messages[currentLocale].nav.geoBanner;

  useEffect(() => {
    if (isNativeApp()) return;
    let explicit = false;
    let dismissed = false;
    try {
      explicit = localStorage.getItem("tl-locale-explicit") === "1";
      dismissed = localStorage.getItem("tl-geo-dismiss") === "1";
    } catch {
      // storage bloqueado: tratamos como no-explicito/no-dismissed.
    }
    if (explicit || dismissed) return;
    const candidate = detectBrowserLocale();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (candidate && candidate !== currentLocale) setDetected(candidate);
  }, [currentLocale]);

  if (!detected) return null;

  const Flag = localeFlags[detected];
  const country = localeToCountry[detected];

  function dismiss() {
    setDetected(null);
    try {
      localStorage.setItem("tl-geo-dismiss", "1");
    } catch {
      // sin storage: el estado local ya lo oculto para esta sesion.
    }
  }

  return (
    <div className="border-b border-[#dfe5e2] bg-[#eef4ff]">
      <div className="mx-auto flex min-h-10 max-w-7xl items-center justify-between gap-3 px-5 py-1.5 text-xs md:px-8">
        <p className="flex min-w-0 items-center gap-2 text-[#374151]">
          <Flag className="h-3.5 w-5 shrink-0 rounded-[2px] shadow-sm ring-1 ring-black/5" aria-hidden="true" />
          <span className="truncate font-semibold">{copy.text.replace("{country}", country)}</span>
          <Link
            href={hrefForLocale(detected, pathname)}
            onClick={() => persistLocaleChoice(detected)}
            className="shrink-0 font-bold text-[#123b5d] underline decoration-[#123b5d]/40 underline-offset-2 hover:decoration-[#123b5d]"
          >
            {copy.cta.replace("{country}", country)}
          </Link>
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={copy.dismiss}
          className="shrink-0 rounded-md p-1.5 text-[#6b7280] hover:bg-white/70 hover:text-[#111827]"
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
