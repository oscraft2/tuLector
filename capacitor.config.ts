// Config del contenedor nativo (Capacitor). Ver docs/apk-plan.md.
// Sin importar el tipo de @capacitor/cli para no romper el build web mientras
// Capacitor no esté instalado; al instalarlo puedes añadir:
//   import type { CapacitorConfig } from '@capacitor/cli';
// y tipar `config`.
const config = {
  appId: "cl.tulector.app",
  appName: "TuLector",
  webDir: "public", // requerido por el CLI; no se usa porque cargamos server.url
  // Token en el User-Agent → la web detecta que corre en el APK de forma fiable
  // (window.Capacitor puede no inyectarse a tiempo con server.url remota).
  appendUserAgent: "TuLectorApp",
  server: {
    // El APK abre DIRECTO en /auth (login), sin la landing de marketing.
    url: "https://tulector.vercel.app/auth",
    androidScheme: "https",
    iosScheme: "https",
  },
  ios: {
    // El CSS propio ya maneja el safe-area con env(safe-area-inset-*)
    // (.safe-pt/.safe-pb en globals.css) → "never" evita que el WebView
    // sume SU PROPIO padding automatico encima (doble espacio arriba/abajo).
    contentInset: "never",
  },
  plugins: {
    SplashScreen: { launchShowDuration: 800, backgroundColor: "#111827" },
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
