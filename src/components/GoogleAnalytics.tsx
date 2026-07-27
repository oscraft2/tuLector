"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const GA4_ID = "G-WGRG4DCH5D";

/**
 * Carga el snippet de Google Analytics 4 y dispara page_view en cada
 * navegacion. No hace nada si corre dentro del APK nativo (TuLectorApp).
 *
 * send_page_view: false evita el page_view automatico de la carga inicial;
 * lo disparamos manualmente desde el useEffect para trackear SPA (Next.js
 * client-side navigation) y rutas con query string.
 *
 * El measurement ID de GA4 es publico (va en el HTML); no requiere env var.
 */
export function GoogleAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const native = typeof navigator !== "undefined" && /TuLectorApp/i.test(navigator.userAgent);

  if (!GA4_ID || native) return null;

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA4_ID}', { send_page_view: false });
          `,
        }}
      />
      <GtagPageView pathname={pathname} searchParams={searchParams.toString()} />
    </>
  );
}

function GtagPageView({ pathname, searchParams }: { pathname: string; searchParams: string }) {
  useEffect(() => {
    if (!GA4_ID || typeof window === "undefined" || !(window as { gtag?: (...args: unknown[]) => void }).gtag) return;
    const url = pathname + (searchParams ? `?${searchParams}` : "");
    (window as { gtag?: (...args: unknown[]) => void }).gtag!("config", GA4_ID, {
      page_path: url,
      page_location: window.location.href,
    });
  }, [pathname, searchParams]);

  return null;
}
