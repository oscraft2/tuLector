/**
 * URL base del sitio, normalizada. Usar SIEMPRE en vez de leer
 * `process.env.NEXT_PUBLIC_SITE_URL` directo -- un espacio de mas en la
 * variable de entorno (frecuente al copiar/pegar en Vercel) generaba
 * enlaces invalidos tipo "https://tulector.app /auth?..." (el navegador
 * codifica el espacio como %20 antes del "/", Google Redirect lo detecta
 * y bloquea la pagina con "URL no valida"). trim() + sacar "/" final
 * evita ese bug y tambien enlaces con "//" si el caller ya agrega "/".
 */
export function getSiteUrl(fallback = "http://localhost:3000") {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) return fallback;
  return raw.trim().replace(/\/+$/, "");
}
