// Preferencia "login con huella" del usuario, persistida en localStorage.
// Funciona en web y en el APK (el WebView comparte storage con el dominio
// tulector.vercel.app). Cuando esta desactivada, el BiometricGate hace fallback
// inmediato sin mostrar el modal de huella.

const KEY = "tulector_biometric_login_enabled";

export function isBiometricLoginEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setBiometricLoginEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled) {
      window.localStorage.setItem(KEY, "1");
    } else {
      window.localStorage.removeItem(KEY);
    }
  } catch {
    // localStorage puede estar bloqueado (modo privado) — no-op
  }
}
