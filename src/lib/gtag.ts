const GA4_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function gtag(...args: unknown[]) {
  if (typeof window === "undefined" || !window.gtag || !GA4_ID) return;
  window.gtag(...args);
}

type GtagEvent = {
  action: string;
  category?: string;
  label?: string;
  value?: number;
  [key: string]: unknown;
};

export function event({ action, ...params }: GtagEvent) {
  gtag("event", action, params);
}

/** Registro completado (login /auth?mode=register) */
export function eventSignUp() {
  event({ action: "sign_up", category: "auth" });
}

/** Login exitoso */
export function eventLogin() {
  event({ action: "login", category: "auth" });
}

/** Inicio de checkout Flow (plan Pro o School) */
export function eventBeginCheckout(plan: string) {
  event({ action: "begin_checkout", category: "billing", plan });
}

/** Checkout completado (Flow vuelve con order_id) */
export function eventPurchase(plan: string, orderId: string) {
  event({ action: "purchase", category: "billing", plan, transaction_id: orderId });
}

/** Clic en "Exportar Formato DIA" en resultados de ensayo */
export function eventExportDia() {
  event({ action: "export_dia", category: "quiz" });
}

/** Escaneo completado de una hoja */
export function eventScanComplete(preguntas: number) {
  event({ action: "scan_complete", category: "scan", value: preguntas });
}
