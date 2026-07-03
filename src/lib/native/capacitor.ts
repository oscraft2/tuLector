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

/**
 * true si corremos dentro del contenedor nativo (APK), false en web.
 * Detecta por `window.Capacitor` Y por el token del User-Agent (lo agrega
 * capacitor.config `appendUserAgent`). El token es FIABLE e INMEDIATO incluso
 * cuando se carga una server.url remota (donde window.Capacitor puede no estar
 * inyectado a tiempo) → evita el "flash" web y el redirect equivocado.
 */
export function isNativeApp(): boolean {
  const c = cap();
  if (c) {
    if (typeof c.isNativePlatform === "function" && c.isNativePlatform()) return true;
    if (c.isNative) return true;
  }
  if (typeof navigator !== "undefined" && /TuLectorApp/i.test(navigator.userAgent)) return true;
  return false;
}

/** Plataforma actual: "android" | "ios" | "web". */
export function nativePlatform(): string {
  const c = cap();
  return c?.getPlatform?.() ?? "web";
}

export function plugin<T = Record<string, (...args: unknown[]) => Promise<unknown>>>(name: string): T | undefined {
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
 * Abre el share sheet nativo (compartir PDF/PNG por WhatsApp, guardar, etc.).
 * Recibe un dataURL de imagen/png, lo convierte a base64 y lo comparte via la
 * API Capacitor Share. null si no es nativo o el plugin no está disponible.
 */
export async function shareNativeImage(dataUrl: string, title: string): Promise<boolean> {
  const Share = plugin<{ share: (o: unknown) => Promise<{ activityType?: string }> }>("Share");
  if (!Share) return false;
  try {
    const base64 = dataUrl.split(",")[1];
    if (!base64) return false;
    await Share.share({
      title,
      files: [base64],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Activa/desactiva la linterna (torch) si el dispositivo la soporta.
 * Usa applyConstraints sobre el track de video; funciona en Android WebView
 * (Chrome >=59). Retorna el nuevo estado (true=encendido).
 */
export async function toggleTorch(stream: MediaStream | null, current: boolean): Promise<boolean> {
  if (!stream) return false;
  const track = stream.getVideoTracks()[0];
  if (!track) return false;
  try {
    await track.applyConstraints({
      advanced: [{ torch: !current } as unknown as MediaTrackConstraintSet],
    });
    return !current;
  } catch {
    return current;
  }
}

/**
 * Verifica si el dispositivo soporta autenticación biométrica (huella, FaceID).
 * Retorna el tipo de biometría disponible o null si no hay.
 */
export async function biometricAvailable(): Promise<"fingerprint" | "face" | "iris" | null> {
  const Bio = plugin<{
    checkBiometry: () => Promise<{ isAvailable: boolean; biometryType: number; biometryTypes: number[]; strongBiometryTypes: number[]; reason: string; code: string }>;
  }>("BiometricAuth");
  if (!Bio) return null;
  try {
    const result = await Bio.checkBiometry();
    if (!result.isAvailable) return null;
    const map: Record<number, "fingerprint" | "face" | "iris"> = {
      1: "fingerprint",
      2: "face",
      3: "iris",
    };
    return map[result.biometryType] ?? "fingerprint";
  } catch {
    return null;
  }
}

/**
 * Solicita verificación biométrica. Retorna true si el usuario se autentica,
 * false si cancela o falla.
 */
export async function biometricVerify(reason: string): Promise<boolean> {
  const Bio = plugin<{
    verifyIdentity: (o: { reason: string }) => Promise<{ verified: boolean }>;
  }>("BiometricAuth");
  if (!Bio) return false;
  try {
    const result = await Bio.verifyIdentity({ reason });
    return result.verified === true;
  } catch {
    return false;
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
