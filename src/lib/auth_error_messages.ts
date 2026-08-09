/**
 * Los mensajes de error de Supabase Auth (AuthError.message) vienen SIEMPRE
 * en ingles, sin importar el idioma del sitio -- Supabase no los traduce.
 * Esta funcion mapea los mas comunes a espanol claro. Si no reconoce el
 * mensaje, devuelve un generico en vez de mostrar el ingles crudo.
 */
export function translateAuthError(rawMessage: string | undefined | null): string {
  const msg = (rawMessage ?? "").trim();
  if (!msg) return "No se pudo completar la accion. Intenta nuevamente.";

  const lower = msg.toLowerCase();

  const lengthMatch = lower.match(/password should be at least (\d+) character/);
  if (lengthMatch) return `La contrasena debe tener al menos ${lengthMatch[1]} caracteres.`;

  if (lower.includes("invalid login credentials")) return "Correo o contrasena incorrectos.";
  if (lower.includes("email not confirmed")) return "Debes confirmar tu correo antes de iniciar sesion. Revisa tu bandeja de entrada (y spam).";
  if (lower.includes("user already registered") || (lower.includes("already") && lower.includes("regist"))) return "Ya existe una cuenta con este correo. Inicia sesion en vez de crear una nueva.";
  if (lower.includes("signup requires a valid password") || lower.includes("password is required")) return "Ingresa una contrasena valida.";
  if (lower.includes("unable to validate email address") || lower.includes("invalid email")) return "Ese correo no es valido.";
  if (lower.includes("email rate limit") || lower.includes("rate limit")) return "Se enviaron demasiados correos en poco tiempo. Espera unos minutos e intenta de nuevo.";
  if (lower.includes("for security purposes") && lower.includes("after")) return "Por seguridad, espera unos segundos antes de intentar de nuevo.";
  if (lower.includes("token has expired") || lower.includes("invalid or expired") || lower.includes("expired")) return "Este enlace ya vencio. Pide uno nuevo.";
  if (lower.includes("network") || lower.includes("fetch failed")) return "No se pudo conectar. Revisa tu conexion e intenta de nuevo.";
  if (lower.includes("weak password") || lower.includes("password is too weak")) return "Esa contrasena es muy debil. Prueba con otra.";
  if (lower.includes("same password") || lower.includes("should be different")) return "La contrasena nueva debe ser distinta a la anterior.";

  return msg;
}

const INVITATION_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  accepted: "Aceptada",
  revoked: "Eliminada",
  expired: "Expirada",
};

export function invitationStatusLabel(status: string): string {
  return INVITATION_STATUS_LABELS[status] ?? status;
}
