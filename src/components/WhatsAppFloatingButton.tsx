"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { WhatsappButtonConfig } from "@/lib/site_config";
import { isNativeApp } from "@/lib/native/capacitor";
import { WhatsAppIcon } from "@/components/header/icons";

const HIDDEN_PREFIXES = ["/admin", "/dashboard", "/app", "/scan", "/portal"];

/**
 * Botón flotante de WhatsApp.
 * - Solo se muestra en el sitio público web (fuera de admin, dashboard, scan, portal).
 * - Oculto en APK nativo (regla dura de Apple/Google): patrón mount-reveal + clase tl-wsp.
 * - Abre wa.me con el número y mensaje configurados desde /admin/settings.
 */
export function WhatsAppFloatingButton({ config }: { config: WhatsappButtonConfig }) {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isNativeApp()) setShow(true);
  }, []);

  if (!config.enabled || !config.phone || !show) return null;
  if (HIDDEN_PREFIXES.some((prefix) => pathname?.startsWith(prefix))) return null;

  const digitsOnly = config.phone.replace(/[^\d]/g, "");
  if (!digitsOnly) return null;

  const message = config.default_message || "Hola, quiero información sobre TuLector";
  const href = `https://wa.me/${digitsOnly}?text=${encodeURIComponent(message)}`;
  const positionClass = config.position === "bottom-left" ? "left-5" : "right-5";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar por WhatsApp"
      title="Contactar por WhatsApp"
      className={`tl-wsp fixed bottom-5 ${positionClass} z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 transition-all duration-200 hover:scale-105 hover:bg-[#20bd5a] hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:ring-offset-2`}
    >
      <WhatsAppIcon className="h-7 w-7 text-white" />
    </a>
  );
}
