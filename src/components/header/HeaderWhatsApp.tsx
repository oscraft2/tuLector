"use client";

import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/native/capacitor";
import { WhatsAppIcon } from "@/components/header/icons";

export type WhatsappHeaderConfig = { enabled: boolean; phone: string };

type HeaderWhatsAppProps = {
  config: WhatsappHeaderConfig;
  /** Mensaje localizado (messages[locale].nav.whatsappMessage) - NO el global
   * de site_config, para que Brasil reciba portugues. */
  message: string;
  label: string;
  className?: string;
};

/**
 * CTA de WhatsApp del topbar/drawer. La fuente del numero es site_config
 * (admin /admin/settings) via PublicHeaderServer - cero backend nuevo.
 *
 * REGLA DURA (APK): mount-reveal. El estado inicial es oculto y solo se
 * muestra tras hidratar Y confirmar que NO estamos en el contenedor nativo
 * -> nunca existe en el DOM del APK (ni un frame). Cinturon adicional:
 * clase `tl-wsp` + regla `html.cap-native .tl-wsp` en globals.css.
 */
export function HeaderWhatsApp({ config, message, label, className }: HeaderWhatsAppProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Regla montaje-revelado: solo mostrar en web, nunca en APK
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isNativeApp()) setShow(true);
  }, []);

  if (!config.enabled || !config.phone || !show) return null;

  const digitsOnly = config.phone.replace(/[^\d]/g, "");
  const href = `https://wa.me/${digitsOnly}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className ? `tl-wsp ${className}` : "tl-wsp inline-flex items-center gap-1.5 font-bold text-[#128C4A] hover:text-[#0d6e3a]"}
    >
      <WhatsAppIcon className="h-4 w-4" />
      {label}
    </a>
  );
}
