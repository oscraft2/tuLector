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
  },
  plugins: {
    SplashScreen: { launchShowDuration: 800, backgroundColor: "#111827" },
  },
};

export default config;
