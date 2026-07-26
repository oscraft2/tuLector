"use client";

import Link from "next/link";
import type { ReactNode, MouseEvent } from "react";
import { isNativeApp, openExternalUrl } from "@/lib/native/capacitor";

/**
 * Link que, cuando `external` es true Y corremos dentro del APK, sale
 * directo al navegador del sistema (Custom Tabs/Safari, via Browser.open)
 * en vez de navegar dentro del mismo WebView. Pensado para rutas que en
 * nativo son de solo lectura por reglas de compras in-app de Apple/Google
 * (ej. /dashboard/billing, donde el pago real solo se puede hacer desde un
 * navegador) -- asi el profesor llega en un solo tap a la pagina real donde
 * SI puede pagar, en vez de aterrizar en la vista de solo lectura dentro de
 * la app y tener que salir el/ella misma a un navegador.
 *
 * En web (isNativeApp()===false) o cuando `external` no aplica, se comporta
 * exactamente como un <Link> normal -- cero cambio para el dashboard de
 * escritorio.
 */
export function NativeAwareLink({
  href,
  external = false,
  className,
  ariaCurrent,
  children,
}: {
  href: string;
  external?: boolean;
  className?: string;
  ariaCurrent?: boolean | "page";
  children: ReactNode;
}) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!external || !isNativeApp()) return;
    event.preventDefault();
    const url = href.startsWith("http") ? href : `https://tulector.vercel.app${href}`;
    openExternalUrl(url).then((opened) => {
      if (!opened) window.location.href = href; // respaldo: queda en la vista de solo lectura dentro de la app
    });
  };

  return (
    <Link href={href} onClick={handleClick} className={className} aria-current={ariaCurrent}>
      {children}
    </Link>
  );
}
