"use client";

import Link from "next/link";
import { useState, type ReactNode, type MouseEvent } from "react";
import { isNativeApp, openExternalUrl } from "@/lib/native/capacitor";
import { createBillingHandoffLink } from "@/app/dashboard/actions";

/**
 * "Mi plan" desde el APK.
 *
 * El pago no puede procesarse dentro de la app (reglas de compra in-app), asi
 * que hay que salir al navegador. El problema era que el navegador no comparte
 * la sesion con el WebView: el profesor tenia que iniciar sesion de nuevo, y
 * ese login fallaba con "PKCE code verifier not found in storage" porque el App
 * Link verificado sobre /auth/callback hace que Android le quite el callback a
 * Chrome y lo entregue al APK.
 *
 * Solucion: pedirle al servidor un enlace de traspaso que ya deja la sesion
 * abierta en el navegador y aterriza directo en Mi plan. Sin login nuevo no hay
 * PKCE que pueda fallar.
 *
 * En web se comporta como un <Link> normal: cero cambios para el escritorio.
 */
export function BillingHandoffLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleClick = async (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isNativeApp()) return; // web: navegacion normal
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setNotice(null);
    try {
      const { url } = await createBillingHandoffLink();
      if (url) {
        const opened = await openExternalUrl(url);
        if (opened) return;
      }

      // Respaldo: se abre igual la pagina en el navegador, avisando que puede
      // pedir iniciar sesion. Nunca se deja al profesor sin camino para pagar.
      setNotice("Abriendo el navegador. Es posible que te pida iniciar sesion.");
      const plain = href.startsWith("http") ? href : `${window.location.origin}${href}`;
      const opened = await openExternalUrl(plain);
      if (!opened) window.location.href = href; // ultimo recurso: vista de solo lectura dentro de la app
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Link href={href} onClick={handleClick} className={className} aria-busy={busy}>
        {children}
      </Link>
      {notice && (
        <p className="mt-2 rounded-xl bg-[#fff7ed] px-3 py-2 text-xs font-semibold text-[#b45309]">
          {notice}
        </p>
      )}
    </>
  );
}
