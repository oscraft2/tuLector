"use client";

import { useCallback, useEffect, useRef } from "react";

export type SensoryEvent = "lock" | "captureStart" | "success" | "error" | "warning";

interface SensoryPrefs {
 sound: boolean;
 vibration: boolean;
}

// Patrones de vibración por evento (ms on/off). navigator.vibrate no existe en
// iOS WKWebView (Safari nunca implementó la Vibration API) -- ahí esto es un
// no-op silencioso; @capacitor/haptics quedaría como mejora futura (requiere
// rebuild nativo, ver docs/plan-mejora-scan-zipgrade.md).
const VIBRATION_PATTERNS: Record<SensoryEvent, number[]> = {
 lock: [20],
 captureStart: [30],
 success: [15, 30, 15],
 error: [80, 40, 80],
 warning: [40, 40, 40],
};

// Tonos sintetizados (Web Audio) por evento: [frecuencia Hz, duración ms][].
// Sin assets .mp3/.wav -- cero infraestructura de audio que mantener.
const TONE_PATTERNS: Record<SensoryEvent, { freq: number; ms: number }[]> = {
 lock: [{ freq: 880, ms: 40 }],
 captureStart: [{ freq: 660, ms: 60 }],
 success: [{ freq: 880, ms: 70 }, { freq: 1320, ms: 90 }],
 error: [{ freq: 220, ms: 90 }, { freq: 165, ms: 120 }],
 warning: [{ freq: 440, ms: 80 }, { freq: 440, ms: 80 }],
};

/**
 * Feedback sonoro/háptico por evento de escaneo. `unlock()` debe llamarse en
 * un gesto de usuario real (iOS/Chrome suspenden AudioContext sin eso).
 */
export function useSensoryFeedback(prefs: SensoryPrefs) {
 const ctxRef = useRef<AudioContext | null>(null);
 const prefsRef = useRef(prefs);
 useEffect(() => { prefsRef.current = prefs; }, [prefs]);

 const getCtx = useCallback((): AudioContext | null => {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctxRef.current) ctxRef.current = new Ctor();
  return ctxRef.current;
 }, []);

 const unlock = useCallback(() => {
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") void ctx.resume();
 }, [getCtx]);

 const playTones = useCallback((event: SensoryEvent) => {
  const ctx = getCtx();
  if (!ctx || ctx.state === "suspended") return; // no desbloqueado aun -> silencioso, no falla
  let t = ctx.currentTime;
  for (const { freq, ms } of TONE_PATTERNS[event]) {
   const osc = ctx.createOscillator();
   const gain = ctx.createGain();
   osc.type = "sine";
   osc.frequency.value = freq;
   gain.gain.setValueAtTime(0.0001, t);
   gain.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
   gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
   osc.connect(gain).connect(ctx.destination);
   osc.start(t);
   osc.stop(t + ms / 1000 + 0.02);
   t += ms / 1000;
  }
 }, [getCtx]);

 const fire = useCallback((event: SensoryEvent) => {
  if (prefsRef.current.sound) playTones(event);
  if (prefsRef.current.vibration && typeof navigator !== "undefined" && navigator.vibrate) {
   navigator.vibrate(VIBRATION_PATTERNS[event]);
  }
 }, [playTones]);

 return { fire, unlock };
}

const SENSORY_PREFS_KEY = "tulector_sensory_prefs";

export interface SensoryStoredPrefs extends SensoryPrefs {
 burstMode: boolean;
 /** Saltar solo a /scan/reverso tras guardar un frente con preguntas de
  *  desarrollo. APAGADO por defecto: el salto automático corta la ráfaga (te
  *  saca de la cámara entre hoja y hoja) y hoy el reverso no se detecta de
  *  forma confiable. Se enciende desde el drawer de configuración de /scan. */
 autoReverso: boolean;
}

const DEFAULT_SENSORY_PREFS: SensoryStoredPrefs = { sound: true, vibration: true, burstMode: true, autoReverso: false };

export function loadSensoryPrefs(): SensoryStoredPrefs {
 if (typeof window === "undefined") return DEFAULT_SENSORY_PREFS;
 try {
  const raw = localStorage.getItem(SENSORY_PREFS_KEY);
  if (!raw) return DEFAULT_SENSORY_PREFS;
  const parsed = JSON.parse(raw);
  return {
   sound: typeof parsed.sound === "boolean" ? parsed.sound : DEFAULT_SENSORY_PREFS.sound,
   vibration: typeof parsed.vibration === "boolean" ? parsed.vibration : DEFAULT_SENSORY_PREFS.vibration,
   burstMode: typeof parsed.burstMode === "boolean" ? parsed.burstMode : DEFAULT_SENSORY_PREFS.burstMode,
   autoReverso: typeof parsed.autoReverso === "boolean" ? parsed.autoReverso : DEFAULT_SENSORY_PREFS.autoReverso,
  };
 } catch {
  return DEFAULT_SENSORY_PREFS;
 }
}

export function saveSensoryPrefs(prefs: SensoryStoredPrefs) {
 try { localStorage.setItem(SENSORY_PREFS_KEY, JSON.stringify(prefs)); } catch { /* sin storage */ }
}
