"use client";

import { usePathname } from "next/navigation";

const HIDDEN_PREFIXES = ["/admin", "/dashboard", "/app", "/scan", "/portal"];

/**
 * Reemplaza al viejo boton flotante de WhatsApp: mismo lugar/tamano, pero
 * sin marca de terceros ni chat -- solo un link directo a /support. Al ser
 * un simple link (no un canal de contacto/negociacion), no tiene ninguna
 * restriccion de Apple/Google, asi que se muestra igual en web y en el APK
 * (a diferencia de HeaderWhatsApp.tsx, que sigue oculto en nativo aparte).
 */
export function SupportFloatingButton() {
  const pathname = usePathname();
  if (HIDDEN_PREFIXES.some((prefix) => pathname?.startsWith(prefix))) return null;

  return (
    <a
      href="/support"
      aria-label="Ir a soporte"
      className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#07305f] shadow-lg transition-transform hover:scale-105"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="3.2" />
        <path d="M5.2 5.2l3.6 3.6M18.8 5.2l-3.6 3.6M5.2 18.8l3.6-3.6M18.8 18.8l-3.6-3.6" />
      </svg>
    </a>
  );
}
