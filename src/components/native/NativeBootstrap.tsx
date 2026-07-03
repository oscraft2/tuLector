"use client";

import { useEffect } from "react";
import { applyNativeChrome } from "@/lib/native/capacitor";
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
  return <UpdateBanner />;
}
