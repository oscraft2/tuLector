"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isNativeApp } from "@/lib/native/capacitor";
import { isNativeAllowedDashboardPath } from "@/lib/native/routes";

/**
 * Cinturon de seguridad para APK instalados con builds viejos que no mandan
 * el token TuLectorApp en el User-Agent (por eso dashboard/layout.tsx no
 * puede detectarlos server-side y redirigir a /app). isNativeApp() SI puede
 * verlos en el cliente via `window.Capacitor`, asi que si detecta que
 * estamos dentro del APK en una ruta de /dashboard no permitida para nativo,
 * manda de vuelta al menu de la app.
 *
 * En web es no-op total (isNativeApp() da false, nunca redirige). Reintenta
 * a los 2s porque con server.url remota `window.Capacitor` a veces se
 * inyecta tarde (mismo patron que auth/page.tsx).
 */
export function NativeDashboardGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    const check = () => {
      if (!active) return;
      if (!isNativeApp()) return;
      if (isNativeAllowedDashboardPath(pathname)) return;
      router.replace("/app");
    };
    check();
    const timer = setTimeout(check, 2000);
    return () => { active = false; clearTimeout(timer); };
  }, [pathname, router]);

  return null;
}
