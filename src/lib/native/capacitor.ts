// Puente nativo (Capacitor) — detección en runtime SIN depender del paquete.
// Cuando la app corra envuelta en Capacitor, `window.Capacitor` existe y
// `isNativePlatform()` devuelve true. En la web normal → false. Así el mismo
// código sirve para web y app, y no rompe el build aunque Capacitor no esté
// instalado todavía. Ver docs/apk-plan.md.

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  isNative?: boolean;
  getPlatform?: () => string;
}

function cap(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

/** true si corremos dentro del contenedor nativo (APK), false en web. */
export function isNativeApp(): boolean {
  const c = cap();
  if (!c) return false;
  if (typeof c.isNativePlatform === "function") return c.isNativePlatform();
  return !!c.isNative;
}

/** Plataforma actual: "android" | "ios" | "web". */
export function nativePlatform(): string {
  const c = cap();
  return c?.getPlatform?.() ?? "web";
}
