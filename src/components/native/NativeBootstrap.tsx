"use client";

import { useEffect } from "react";
import { applyNativeChrome, pushRegister, pushOnForeground, isNativeApp } from "@/lib/native/capacitor";
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
    const doRegister = async () => {
      const token = await pushRegister();
      if (!token) return;
      try {
        await fetch("/api/push/register", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
      } catch { /* sin red */ }

      pushOnForeground(({ title, body }) => {
        if (typeof window === "undefined") return;
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(title || "TuLector", { body });
        }
      });
    };

    const timeout = setTimeout(doRegister, 3000);
    return () => clearTimeout(timeout);
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
