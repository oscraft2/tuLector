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
 *
 * IMPORTANTE: el plugin @aparajita/capacitor-biometric-auth se registra en
 * Capacitor como "BiometricAuthNative" (NO "BiometricAuth") — ver
 * node_modules/.../dist/esm/index.js registerPlugin('BiometricAuthNative').
 * Usar "BiometricAuth" aqui retorna undefined y el gate cae al fallback
 * silenciosamente (sintoma: "la huella aparece pero no funciona").
 */
export async function biometricAvailable(): Promise<"fingerprint" | "face" | "iris" | null> {
  const Bio = plugin<{
    checkBiometry: () => Promise<{ isAvailable: boolean; biometryType: number; biometryTypes: number[]; strongBiometryTypes: number[]; reason: string; code: string }>;
  }>("BiometricAuthNative");
  if (!Bio) return null;
  try {
    const result = await Bio.checkBiometry();
    if (!result.isAvailable) return null;
    // BiometryType enum del plugin: 0=none, 1=touchId, 2=faceId,
    // 3=fingerprintAuthentication, 4=faceAuthentication, 5=irisAuthentication.
    const map: Record<number, "fingerprint" | "face" | "iris"> = {
      1: "fingerprint", // touchId (iOS)
      2: "face",         // faceId (iOS)
      3: "fingerprint", // fingerprintAuthentication (Android)
      4: "face",          // faceAuthentication (Android)
      5: "iris",          // irisAuthentication (Android)
    };
    return map[result.biometryType] ?? "fingerprint";
  } catch {
    return null;
  }
}

/**
 * Solicita verificación biométrica. Retorna true si el usuario se autentica,
 * false si cancela o falla.
 *
 * El metodo del plugin es `authenticate` (NO `verifyIdentity` — ese no existe
 * y la llamada lanza, por lo que el gate siempre cae al fallback). Resuelve
 * con void; cualquier fallo se reporta via excepción.
 */
export async function biometricVerify(reason: string): Promise<boolean> {
  const Bio = plugin<{
    authenticate: (o: {
      reason: string;
      cancelTitle: string;
      allowDeviceCredential: boolean;
      androidConfirmationRequired: boolean;
    }) => Promise<void>;
  }>("BiometricAuthNative");
  if (!Bio) return false;
  try {
    await Bio.authenticate({
      reason,
      cancelTitle: "Cancelar",
      allowDeviceCredential: false,
      androidConfirmationRequired: false,
    });
    return true;
  } catch {
    return false; // cancelado por el usuario, falla o lockout
  }
}

// NOTA push: el plugin @capacitor/push-notifications se RETIRÓ del APK porque
// sin proyecto Firebase (google-services.json) `register()` crashea la app con
// IllegalStateException. Para reactivar push: crear proyecto Firebase, poner
// google-services.json en android/app/, reinstalar el plugin y restaurar el
// registro (historial git de este archivo). El endpoint /api/push/register y
// push_server.ts quedan intactos (no-op sin FCM_SERVER_KEY).

/**
 * Deep link con el que Supabase vuelve al APK tras el OAuth externo (Apple en
 * Android). Android App Link HTTPS verificado (autoVerify en el manifest +
 * public/.well-known/assetlinks.json), NO un scheme custom — un scheme
 * custom no es exclusivo de esta app, cualquier otra puede registrar el mismo
 * e interceptar el ?code=. Reusa /auth/callback (la misma ruta que ya usa el
 * flujo web) como fallback: si la verificacion del App Link aun no propago,
 * el SO abre esto en un navegador normal y esa ruta ya sabe manejarlo.
 */
export const OAUTH_DEEP_LINK = "https://tulector.vercel.app/auth/callback";

/** Web Client ID de Google (mismo que usa el proveedor Google en Supabase Auth). */
const GOOGLE_WEB_CLIENT_ID = "390355977468-k6fr90qikaor197g7rslrmo36ei1bur3.apps.googleusercontent.com";

// Client ID tipo "iOS" (distinto del Android/Web): se crea en el MISMO
// proyecto de Google Cloud (docentelab-12b2b) que el Web Client ID de arriba,
// como "ID de cliente de OAuth" -> tipo iOS -> Bundle ID cl.tulector.app.
// Sin API para crearlo por CLI, es un paso manual en Google Cloud Console.
// Hasta que exista, el login con Google en iOS queda deshabilitado (Android
// no se ve afectado, sigue usando solo GOOGLE_WEB_CLIENT_ID).
const GOOGLE_IOS_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID || "";

let googleSignInReady: Promise<boolean> | null = null;

/**
 * Inicializa Credential Manager (Android) / GoogleSignIn nativo (iOS) una vez.
 * Idempotente: llamadas repetidas reutilizan la misma promesa. Debe llamarse
 * antes de googleNativeSignIn().
 */
export function initGoogleSignIn(): Promise<boolean> {
  if (googleSignInReady) return googleSignInReady;
  googleSignInReady = (async () => {
    const SocialLogin = plugin<{ initialize: (o: unknown) => Promise<void> }>("SocialLogin");
    if (!SocialLogin) return false;
    try {
      const isIOS = nativePlatform() === "ios";
      if (isIOS && !GOOGLE_IOS_CLIENT_ID) return false; // falta crear el cliente iOS en Google Cloud
      await SocialLogin.initialize({
        google: isIOS
          ? { iOSClientId: GOOGLE_IOS_CLIENT_ID, iOSServerClientId: GOOGLE_WEB_CLIENT_ID }
          : { webClientId: GOOGLE_WEB_CLIENT_ID },
      });
      return true;
    } catch {
      return false;
    }
  })();
  return googleSignInReady;
}

/**
 * Login nativo con Google via Credential Manager: bottom-sheet del sistema con
 * las cuentas Google del dispositivo, SIN abrir navegador. Retorna el idToken
 * (JWT) para canjear por sesión con `supabase.auth.signInWithIdToken`, o null
 * si el usuario cancela o el plugin no está disponible (web).
 */
export async function googleNativeSignIn(): Promise<string | null> {
  const SocialLogin = plugin<{
    login: (o: { provider: "google"; options: Record<string, never> }) => Promise<{ result?: { idToken?: string | null } }>;
  }>("SocialLogin");
  if (!SocialLogin) return null;

  await initGoogleSignIn();
  try {
    // Sin `scopes`: el plugin ya pide email/profile/openid por defecto.
    // Pasar scopes custom exige modificar MainActivity (no aplica aquí).
    const res = await SocialLogin.login({ provider: "google", options: {} });
    return res?.result?.idToken ?? null;
  } catch {
    return null; // cancelado por el usuario o sin cuenta Google en el dispositivo
  }
}

/**
 * Login nativo con "Sign in with Apple" — SOLO iOS (usa AuthenticationServices
 * del sistema, sin SDK externo). Android NO tiene este SDK nativo; ese caso
 * sigue usando openExternalUrl()+deep link (ver auth/page.tsx), sin tocar.
 * Retorna el idToken para canjear con supabase.auth.signInWithIdToken, o null
 * si el usuario cancela o falta la capability "Sign in with Apple" en el
 * proyecto Xcode (ver ios/App/App/App.entitlements).
 */
export async function appleNativeSignIn(): Promise<string | null> {
  if (nativePlatform() !== "ios") return null;
  const SocialLogin = plugin<{
    login: (o: { provider: "apple"; options: Record<string, never> }) => Promise<{ result?: { idToken?: string | null } }>;
  }>("SocialLogin");
  if (!SocialLogin) return null;
  try {
    const res = await SocialLogin.login({ provider: "apple", options: {} });
    return res?.result?.idToken ?? null;
  } catch {
    return null; // cancelado por el usuario
  }
}

/**
 * Abre una URL en el navegador del sistema (Chrome Custom Tabs). Necesario para
 * OAuth: Google BLOQUEA el login dentro de WebViews (error 403
 * disallowed_useragent), así que el flujo debe salir a un navegador real.
 */
export async function openExternalUrl(url: string): Promise<boolean> {
  const Browser = plugin<{ open: (o: { url: string }) => Promise<void> }>("Browser");
  if (!Browser) return false;
  try {
    await Browser.open({ url });
    return true;
  } catch {
    return false;
  }
}

/** Cierra el Custom Tab abierto por openExternalUrl (al volver por deep link). */
export async function closeExternalBrowser(): Promise<void> {
  const Browser = plugin<{ close: () => Promise<void> }>("Browser");
  try {
    await Browser?.close();
  } catch {
    // en Android el Custom Tab puede ya estar cerrado; ignorar
  }
}

// NOTA compras iOS (RevenueCat): Apple exige compra integrada (StoreKit) para
// suscripciones — por eso Android sigue 100% externo (Flow, sin comision) y
// SOLO iOS usara @revenuecat/purchases-capacitor (ver docs/apk-plan.md, plan
// de tiendas). Falta, antes de poder construir el paywall real:
//   1. Crear cuenta en RevenueCat y el proyecto para cl.tulector.app.
//   2. Crear los productos IAP en App Store Connect (mismos planes/packs que
//      ya existen en src/lib/billing_catalog.ts) y mapearlos en RevenueCat.
//   3. Pegar la Public API Key de RevenueCat (iOS) en
//      NEXT_PUBLIC_REVENUECAT_IOS_API_KEY.
// Sin eso, initRevenueCat() no hace nada (no hay API key) y no se muestra
// ningun paywall — /dashboard/billing sigue con la vista de solo lectura.
const REVENUECAT_IOS_API_KEY = process.env.NEXT_PUBLIC_REVENUECAT_IOS_API_KEY || "";

let revenueCatReady: Promise<boolean> | null = null;

/** Inicializa RevenueCat (una vez, solo iOS). Debe llamarse antes de comprar. */
export function initRevenueCat(): Promise<boolean> {
  if (revenueCatReady) return revenueCatReady;
  revenueCatReady = (async () => {
    if (nativePlatform() !== "ios" || !REVENUECAT_IOS_API_KEY) return false;
    const Purchases = plugin<{ configure: (o: { apiKey: string }) => Promise<void> }>("Purchases");
    if (!Purchases) return false;
    try {
      await Purchases.configure({ apiKey: REVENUECAT_IOS_API_KEY });
      return true;
    } catch {
      return false;
    }
  })();
  return revenueCatReady;
}

/**
 * Escucha deep links entrantes (appUrlOpen del plugin App). Retorna una función
 * para cancelar la suscripción. En web es un no-op.
 */
export function onAppUrlOpen(handler: (url: string) => void): () => void {
  const App = plugin<{
    addListener: (event: string, fn: (data: { url?: string }) => void) => Promise<{ remove: () => Promise<void> }>;
  }>("App");
  if (!App) return () => {};

  const subscription = App.addListener("appUrlOpen", (data) => {
    if (data?.url) handler(data.url);
  });

  return () => {
    subscription.then((s) => s.remove()).catch(() => {});
  };
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
