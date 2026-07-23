/**
 * Prefijos de /dashboard permitidos dentro del APK (fuente unica: la usan
 * dashboard/layout.tsx en el servidor -- via User-Agent -- y
 * NativeDashboardGuard en el cliente -- via isNativeApp() -- para el MISMO
 * criterio de enrutamiento nativo. Mantener una sola lista evita que ambos
 * mecanismos se desincronicen.
 *
 * Excepciones a "todo lo demas -> /app" (fallback de acciones avanzadas que
 * las pantallas nativas todavia no cubren):
 *  - /dashboard/quizzes: editar/duplicar/archivar ensayos.
 *  - /dashboard/students: crear/editar cursos e importar CSV.
 *  - /dashboard/settings: configuracion avanzada.
 *  - /dashboard/billing: vista de solo lectura en nativo (el pago NUNCA se
 *    hace dentro del APK, reglas de Apple/Google sobre compras in-app).
 *  - /dashboard/onboarding: usuario nativo sin colegio aun (recien
 *    registrado). getDashboardContext() SIEMPRE redirige aca cuando falta
 *    membership; si esta ruta no esta permitida, el usuario rebota
 *    /app -> onboarding -> /app en loop infinito y ve pantalla en blanco.
 */
export const NATIVE_ALLOWED_DASHBOARD_PREFIXES = [
  "/dashboard/quizzes",
  "/dashboard/students",
  "/dashboard/settings",
  "/dashboard/billing",
  "/dashboard/onboarding",
] as const;

export function isNativeAllowedDashboardPath(pathname: string): boolean {
  return NATIVE_ALLOWED_DASHBOARD_PREFIXES.some((p) => pathname.startsWith(p));
}
