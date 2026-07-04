"use client";

import { useEffect } from "react";
import {
  applyNativeChrome,
  isNativeApp,
  onAppUrlOpen,
  closeExternalBrowser,
  OAUTH_DEEP_LINK,
} from "@/lib/native/capacitor";
import { createClient } from "@/lib/supabase";
import { setupOnlineListener, syncOfflineQueue } from "@/lib/offline_sync";
import { getQueueSize } from "@/lib/offline_queue";
import { UpdateBanner } from "./UpdateBanner";

/**
 * Inicialización nativa (Capacitor). Montado una vez en el layout raíz. En web
 * es un no-op; en el APK marca <html class="cap-native"> y configura status bar
 * / splash. Ver docs/apk-plan.md.
 */
export function NativeBootstrap() {
  useEffect(() => {
    applyNativeChrome();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    // SOLO en el APK: el modo offline es del lector nativo. En la web NO registramos
    // service worker → evita que el navegador de los profes quede sirviendo assets
    // viejos (el mismo "pegado en versión vieja" que queremos evitar, pero para todos).
    if (!isNativeApp()) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);

  useEffect(() => {
    // OAuth nativo: el login con Google sale a Chrome Custom Tabs (Google bloquea
    // WebViews) y Supabase vuelve al APK via deep link cl.tulector.app://auth-callback
    // con el ?code= PKCE. Lo intercambiamos por sesión AQUÍ (mismo WebView que
    // inició el flujo, donde vive el code_verifier) y entramos a /app.
    if (!isNativeApp()) return;

    return onAppUrlOpen(async (url) => {
      if (!url.startsWith(OAUTH_DEEP_LINK)) return;
      closeExternalBrowser();

      let code: string | null = null;
      let oauthError: string | null = null;
      try {
        const parsed = new URL(url);
        code = parsed.searchParams.get("code");
        oauthError = parsed.searchParams.get("error_description") || parsed.searchParams.get("error");
      } catch {
        oauthError = "No se pudo leer la respuesta de autenticacion.";
      }

      if (!code) {
        const msg = oauthError || "No se recibio codigo de autenticacion.";
        window.location.assign(`/auth?error=${encodeURIComponent(msg)}`);
        return;
      }

      const { error } = await createClient().auth.exchangeCodeForSession(code);
      window.location.assign(error ? `/auth?error=${encodeURIComponent(error.message)}` : "/app");
    });
  }, []);

  useEffect(() => {
    // Sincronizar cola offline al arrancar y al recuperar conexión.
    const sync = () => {
      getQueueSize().then((size) => {
        if (size > 0) syncOfflineQueue().catch(() => {});
      });
    };
    sync();

    const unsubscribe = setupOnlineListener(() => {
      sync();
    });

    return unsubscribe;
  }, []);

  return <UpdateBanner />;
}
