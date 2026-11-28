// Vercel inyecta este SHA público durante el build. Compartirlo entre la UI y
// /api/version permite identificar exactamente el despliegue cargado.
export const APP_VERSION = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "b-0811l";
