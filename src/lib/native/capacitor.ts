// Puente nativo (Capacitor) — detección y plugins en runtime SIN importar el
// paquete (se accede por `window.Capacitor.Plugins`, que solo existe en el APK).
// Así el mismo código sirve web/app y NO rompe el build de la web aunque
// Capacitor no esté instalado. Ver docs/apk-plan.md.

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  isNative?: boolean;
  getPlatform?: () => string;
  Plugins?: Record<string, unknown>;
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

function plugin<T = Record<string, (...args: unknown[]) => Promise<unknown>>>(name: string): T | undefined {
  return cap()?.Plugins?.[name] as T | undefined;
}

/**
 * Captura una foto de ALTA resolución con la cámara nativa y la devuelve como
 * dataURL (para pasarla al mismo pipeline de upload del lector). null si no hay
 * cámara nativa (web) o el usuario cancela.
 */
export async function captureNativePhoto(): Promise<string | null> {
  const Camera = plugin<{ getPhoto: (o: unknown) => Promise<{ dataUrl?: string }> }>("Camera");
  if (!Camera) return null;
  try {
    const photo = await Camera.getPhoto({
      quality: 92,
      resultType: "dataUrl",   // CameraResultType.DataUrl
      source: "CAMERA",         // CameraSource.Camera
      correctOrientation: true,
      // alta resolución: sin width/height fijos → resolución de sensor
    });
    return photo?.dataUrl ?? null;
  } catch {
    return null; // el usuario canceló o no dio permiso
  }
}

/**
 * Ajusta el "chrome" nativo al arrancar: marca <html> con `cap-native` (CSS que
 * mata el olor a web) y configura la status bar si el plugin existe.
 */
export function applyNativeChrome(): void {
  if (!isNativeApp() || typeof document === "undefined") return;
  document.documentElement.classList.add("cap-native");
  const StatusBar = plugin<{ setStyle: (o: unknown) => Promise<unknown>; setBackgroundColor: (o: unknown) => Promise<unknown> }>("StatusBar");
  StatusBar?.setStyle?.({ style: "DARK" }).catch(() => {});
  StatusBar?.setBackgroundColor?.({ color: "#111827" }).catch(() => {});
  const SplashScreen = plugin<{ hide: () => Promise<unknown> }>("SplashScreen");
  SplashScreen?.hide?.().catch(() => {});
}
