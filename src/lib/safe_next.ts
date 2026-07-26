/**
 * Valida un destino `next` interno (anti open-redirect): solo paths absolutos
 * del propio sitio ("/dashboard/billing?plan=pro"), jamas URLs externas ni
 * protocol-relative ("//evil.com"). Devuelve `fallback` si no es seguro.
 */
export function safeNextPath(next: string | null | undefined, fallback: string): string;
export function safeNextPath(next: string | null | undefined, fallback: null): string | null;
export function safeNextPath(next: string | null | undefined, fallback: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}
