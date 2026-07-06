// Config del contenedor nativo (Capacitor). Ver docs/apk-plan.md.
// Sin importar el tipo de @capacitor/cli para no romper el build web mientras
// Capacitor no esté instalado; al instalarlo puedes añadir:
//   import type { CapacitorConfig } from '@capacitor/cli';
// y tipar `config`.
const config = {
  appId: "cl.tulector.app",
  appName: "TuLector",
  // Requerido por el CLI, pero NUNCA se sirve (server.url abajo carga la web
  // remota). Antes apuntaba a "public" (el proyecto web completo — imagenes
  // de marketing, ~2MB) y ese peso se bundleaba sin uso real en cada
  // `cap sync`. capacitor-www/ es un placeholder minimo dedicado a esto.
  webDir: "capacitor-www",
  // Token en el User-Agent → la web detecta que corre en el APK de forma fiable
  // (window.Capacitor puede no inyectarse a tiempo con server.url remota).
  appendUserAgent: "TuLectorApp",
  server: {
    // El APK abre DIRECTO en /auth (login), sin la landing de marketing.
    url: "https://tulector.vercel.app/auth",
    androidScheme: "https",
    iosScheme: "https",
    // Sin esto, Capacitor genera config.xml/network config con acceso "*"
    // (cualquier origen) — acotado a los dominios que la app realmente llama.
    // Ver SECURITY_PROMPT_APK.md Tarea E.
    allowNavigation: [
      "tulector.vercel.app",
      "*.supabase.co",
      "api.mercadopago.com",
      "www.flow.cl",
      "sandbox.flow.cl",
      "api.resend.com",
    ],
  },
  ios: {
    // El CSS propio ya maneja el safe-area con env(safe-area-inset-*)
    // (.safe-pt/.safe-pb en globals.css) → "never" evita que el WebView
    // sume SU PROPIO padding automatico encima (doble espacio arriba/abajo).
    contentInset: "never",
  },
  plugins: {
    // autoHide:false + hide() manual (NativeBootstrap -> applyNativeChrome(),
    // src/lib/native/capacitor.ts) en vez de un timer fijo. Con
    // launchShowDuration:800 el splash se ocultaba solo a los 800ms sin
    // importar si la pagina remota (server.url) ya cargo — en redes lentas
    // eso destapaba una pantalla en blanco mientras el WebView seguia
    // descargando/hidratando. El hide() manual ya corria desde antes, pero
    // el timer automatico competia y solia ganar.
    SplashScreen: { launchAutoHide: false, backgroundColor: "#111827" },
    // Google (Credential Manager en Android, GoogleSignIn nativo en iOS) y
    // Apple (Sign in with Apple nativo en iOS; en Android no aplica — usa
    // Custom Tabs via openExternalUrl, no este plugin) bundleados. Facebook y
    // Twitter no se compilan → app mas liviana. Los client IDs reales se pasan
    // en runtime via SocialLogin.initialize() (ver src/lib/native/capacitor.ts).
    SocialLogin: {
      providers: { google: true, apple: true, facebook: false, twitter: false },
    },
  },
};

export default config;
