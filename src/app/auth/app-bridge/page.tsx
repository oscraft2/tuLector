"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Puente para cuando el correo de confirmacion de un registro nuevo desde el
 * APK se abrio en Chrome (fuera de la app) porque el App Link todavia no
 * verifico en ese dispositivo, o el usuario lo abrio en otro telefono/PC.
 * La confirmacion del correo YA ocurrio (Supabase la procesa en su propio
 * endpoint /auth/v1/verify antes de llegar aca) -- esta pagina solo ofrece
 * volver a abrir la app para completar el inicio de sesion. Deliberadamente
 * simple: sin llamadas a Supabase, sin dependencias del dashboard.
 *
 * Ver auth/callback/route.ts (redirige aca con ?code= cuando from=app y el
 * request no viene del APK) y src/app/auth/page.tsx (signUp con
 * emailRedirectTo = OAUTH_DEEP_LINK + "?from=app").
 */
export default function AppBridgePage() {
  return (
    <Suspense fallback={null}>
      <AppBridgeContent />
    </Suspense>
  );
}

function AppBridgeContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "";

  // Fuerza abrir el APK aunque el App Link no este verificado en este
  // dispositivo (a diferencia de un link https:// normal, que si no hay
  // verificacion simplemente se queda en Chrome). cl.tulector.app es el
  // applicationId real (android/app/build.gradle).
  const intentUrl = useMemo(() => {
    const target = `tulector.vercel.app/auth/callback?code=${encodeURIComponent(code)}&from=app`;
    return `intent://${target}#Intent;scheme=https;package=cl.tulector.app;end`;
  }, [code]);

  const isAndroid = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#fafafa] px-6 text-center text-[#0b1220]">
      <div className="mx-auto w-full max-w-sm rounded-md border border-[#d8dde3] bg-white p-6">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#eef6ff] text-2xl">✓</div>
        <h1 className="text-xl font-semibold">Cuenta confirmada</h1>
        <p className="mt-2 text-sm leading-6 text-[#5b6472]">
          Continúa en la app tuLector para terminar de configurar tu cuenta.
        </p>

        {isAndroid && code && (
          <a
            href={intentUrl}
            className="mt-5 block rounded-md bg-[#07305f] px-4 py-3 text-sm font-semibold text-white"
          >
            Abrir tuLector
          </a>
        )}

        <p className="mt-4 text-xs text-[#5b6472]">
          Si no se abre automáticamente, abre la app tuLector e inicia sesión con tu correo y contraseña.
        </p>
      </div>
    </main>
  );
}
