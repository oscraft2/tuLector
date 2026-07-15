"use client";

import { useState } from "react";

export function PortalLinkCard({ baseUrl }: { baseUrl: string }) {
  const [copied, setCopied] = useState(false);
  const portalUrl = `${baseUrl}/portal/auth`;

  const copyLink = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-md border border-[#e1e5ea] bg-[#f8fafc] p-3">
      <p className="text-sm font-semibold text-[#111827]">Enlace para apoderados</p>
      <p className="mt-1 text-sm leading-6 text-[#5b6472]">
        Comparte este enlace con las familias: ingresan el ID del alumno (RUT u otro segun el pais) y su correo,
        y reciben un acceso propio con el historial completo de resultados.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="flex-1 truncate rounded-md border border-[#cfd6df] bg-white px-3 py-2 text-xs text-[#374151]">
          {portalUrl}
        </code>
        <button
          onClick={copyLink}
          className="rounded-md border border-[#07305f] px-3 py-2 text-xs font-semibold text-[#07305f] hover:bg-[#eef4ff]"
        >
          {copied ? "Copiado!" : "Copiar enlace"}
        </button>
      </div>
    </div>
  );
}
