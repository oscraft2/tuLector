// Config del contenedor nativo (Capacitor). Ver docs/apk-plan.md.
// Sin importar el tipo de @capacitor/cli para no romper el build web mientras
// Capacitor no esté instalado; al instalarlo puedes añadir:
//   import type { CapacitorConfig } from '@capacitor/cli';
// y tipar `config`.
const config = {
  appId: "cl.tulector.app",
  appName: "TuLector",
  webDir: "public", // requerido por el CLI; no se usa porque cargamos server.url
  server: {
    // El APK carga la web real desplegada (un solo código).
    url: "https://tulector.vercel.app",
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: { launchShowDuration: 800, backgroundColor: "#111827" },
  },
};

export default config;
