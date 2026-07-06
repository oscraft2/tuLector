"use client";

import { useEffect, useState } from "react";
import { isNativeApp, biometricAvailable, biometricVerify } from "@/lib/native/capacitor";
import { isBiometricLoginEnabled } from "@/lib/native/biometric_pref";
import { createClient } from "@/lib/supabase";

interface Props {
  onFallback: () => void;
  onSuccess: (path: string) => void;
  homePath: string;
}

export function BiometricGate({ onFallback, onSuccess, homePath }: Props) {
  const [checking, setChecking] = useState(true);
  const [bioLabel, setBioLabel] = useState("");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!isNativeApp()) {
        if (!cancelled) { setChecking(false); onFallback(); }
        return;
      }

      // Si el usuario desactivo el login con huella, no mostramos el gate:
      // fallback directo al formulario de auth.
      if (!isBiometricLoginEnabled()) {
        if (!cancelled) { setChecking(false); onFallback(); }
        return;
      }

      const client = createClient();
      const { data: { session } } = await client.auth.getSession();
      if (!session) {
        if (!cancelled) { setChecking(false); onFallback(); }
        return;
      }

      const bioType = await biometricAvailable();
      if (!bioType) {
        if (!cancelled) { setChecking(false); onFallback(); }
        return;
      }

      const labelMap: Record<string, string> = {
        fingerprint: "huella digital",
        face: "reconocimiento facial",
        iris: "iris",
      };
      setBioLabel(labelMap[bioType] || "biometria");

      const verified = await biometricVerify("Accede a TuLector con tu " + (labelMap[bioType] || "biometria"));
      if (cancelled) return;
      if (verified) {
        onSuccess(homePath);
      } else {
        setChecking(false);
        onFallback();
      }
    };

    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!checking) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#111827] flex items-center justify-center">
      <div className="text-center space-y-4 px-8">
        <div className="w-16 h-16 mx-auto rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a7.464 7.464 0 01-1.15 3.993m1.989 3.559A11.209 11.209 0 008.25 10.5a3.75 3.75 0 117.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 01-3.6 9.75m6.633-4.596a18.666 18.666 0 01-2.485 5.33" />
          </svg>
        </div>
        <p className="text-white text-lg font-bold">Verifica tu identidad</p>
        <p className="text-zinc-400 text-sm">
          Usa tu {bioLabel || "biometria"} para acceder sin escribir la clave.
        </p>
        <p className="text-zinc-500 text-xs animate-pulse">Esperando...</p>
      </div>
    </div>
  );
}
