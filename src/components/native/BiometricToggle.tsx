"use client";

import { useEffect, useState } from "react";
import { isNativeApp, biometricAvailable } from "@/lib/native/capacitor";
import { isBiometricLoginEnabled, setBiometricLoginEnabled } from "@/lib/native/biometric_pref";

/**
 * Toggle para activar/desactivar el login con huella/FaceID en el APK.
 * En web es un no-op (no se renderiza).
 *
 * Si el dispositivo no tiene biometría disponible, se muestra deshabilitado.
 */
export function BiometricToggle() {
  const [enabled, setEnabled] = useState(false);
  const [available, setAvailable] = useState<"fingerprint" | "face" | "iris" | null>(null);
  const [native, setNative] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const isNative = isNativeApp();
      const isEnabled = isBiometricLoginEnabled();
      const isAvailable = await biometricAvailable();
      if (!active) return;
      setNative(isNative);
      setEnabled(isEnabled);
      setAvailable(isAvailable);
    })();
    return () => { active = false; };
  }, []);

  if (!native) return null;

  const label =
    available === "face"
      ? "reconocimiento facial"
      : available === "iris"
        ? "iris"
        : "huella digital";

  const checked = enabled && available !== null;

  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="flex flex-col">
        <span className="text-sm font-semibold text-[#111827]">
          Iniciar sesion con {label}
        </span>
        <span className="mt-0.5 text-xs leading-5 text-[#5b6472]">
          {available
            ? `Pide ${label} al abrir la app en vez del formulario.`
            : "Este dispositivo no tiene biometria disponible o no esta configurada."}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={available === null}
        onClick={() => {
          const next = !checked;
          setBiometricLoginEnabled(next);
          setEnabled(next);
        }}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${
          checked ? "bg-[#07305f]" : "bg-[#cfd6df]"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </label>
  );
}
