"use client";

import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/native/capacitor";
import { APP_VERSION } from "@/lib/version";

const POLL_INTERVAL_MS = 5 * 60 * 1000; // cada 5 minutos

export function UpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isNativeApp()) return;

    const check = async () => {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { version?: string };
        if (data.version && data.version !== APP_VERSION) {
          setUpdateAvailable(true);
        }
      } catch {
        // sin red → no hay nada que actualizar
      }
    };

    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  if (!updateAvailable || dismissed) return null;

  const handleUpdate = () => {
    if ("caches" in window) {
      caches.keys().then((names) => {
        for (const name of names) caches.delete(name);
      }).catch(() => {});
    }
    window.location.reload();
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between px-4 py-2 bg-indigo-600 text-white text-sm font-semibold shadow-lg animate-in slide-in-from-top duration-300">
      <span>Hay una version nueva &mdash; Actualizar</span>
      <div className="flex items-center gap-2">
        <button
          onClick={handleUpdate}
          className="px-3 py-1 bg-white text-indigo-700 rounded-lg text-xs font-bold active:scale-95"
        >
          Actualizar
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="px-2 py-1 text-white/70 text-xs hover:text-white"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
