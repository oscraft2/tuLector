"use client";

import { useEffect } from "react";
import { applyNativeChrome } from "@/lib/native/capacitor";
import { setupOnlineListener } from "@/lib/offline_sync";
import { syncOfflineQueue } from "@/lib/offline_sync";
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
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
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
