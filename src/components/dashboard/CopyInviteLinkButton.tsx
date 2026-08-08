"use client";

import { useState } from "react";

export function CopyInviteLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* portapapeles no disponible (permiso denegado, contexto no seguro, etc.) */
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-md border border-[#cfd6df] px-3 py-1.5 text-xs font-semibold hover:border-[#07305f] hover:text-[#07305f]"
    >
      {copied ? "Copiado" : "Copiar enlace"}
    </button>
  );
}
