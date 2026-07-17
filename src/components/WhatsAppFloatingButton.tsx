"use client";

import { usePathname } from "next/navigation";
import type { WhatsappButtonConfig } from "@/lib/site_config";

const HIDDEN_PREFIXES = ["/admin", "/dashboard", "/app", "/scan", "/portal"];

export function WhatsAppFloatingButton({ config }: { config: WhatsappButtonConfig }) {
  const pathname = usePathname();

  if (!config.enabled || !config.phone) return null;
  if (HIDDEN_PREFIXES.some((prefix) => pathname?.startsWith(prefix))) return null;

  const digitsOnly = config.phone.replace(/[^\d]/g, "");
  const href = `https://wa.me/${digitsOnly}?text=${encodeURIComponent(config.default_message)}`;
  const positionClass = config.position === "bottom-left" ? "left-5" : "right-5";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar por WhatsApp"
      className={`fixed bottom-5 ${positionClass} z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-lg transition-transform hover:scale-105`}
    >
      <svg viewBox="0 0 24 24" fill="white" className="h-7 w-7" aria-hidden="true">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.29-1.39a9.9 9.9 0 0 0 4.7 1.2h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0 0 12.04 2Zm0 18.13h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.14.82.84-3.06-.2-.31a8.22 8.22 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.55-3.7 8.25-8.24 8.25Zm4.52-6.17c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.81-.78.97-.15.16-.29.18-.54.06-.25-.12-1.04-.38-1.99-1.22-.73-.66-1.23-1.46-1.37-1.71-.15-.24-.02-.37.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.42-.14-.01-.31-.01-.47-.01a.9.9 0 0 0-.65.31c-.23.24-.86.85-.86 2.06 0 1.22.88 2.4 1 2.56.13.16 1.73 2.64 4.2 3.7.59.25 1.04.4 1.4.52.59.19 1.12.16 1.55.1.47-.07 1.47-.6 1.68-1.19.21-.58.21-1.08.15-1.18-.06-.11-.23-.17-.48-.29Z" />
      </svg>
    </a>
  );
}
