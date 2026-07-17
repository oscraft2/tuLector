import crypto from "crypto";

export interface DlocalPaymentCreateOptions {
  amount: number;
  currency: string;
  country: string; // ISO2, ej. "CO", "AR", "BR"
  payerEmail: string;
  payerName: string;
  payerDocument: string | null;
  payerDocumentType: string | null;
  orderId: string;
  description: string;
  notificationUrl: string;
  successUrl: string;
}

export function getDlocalConfig() {
  return {
    xLogin: process.env.DLOCAL_X_LOGIN,
    xTransKey: process.env.DLOCAL_X_TRANS_KEY,
    secretKey: process.env.DLOCAL_SECRET_KEY,
    sandbox: process.env.DLOCAL_SANDBOX === "true" || !process.env.DLOCAL_X_LOGIN,
    configured: Boolean(process.env.DLOCAL_X_LOGIN && process.env.DLOCAL_X_TRANS_KEY && process.env.DLOCAL_SECRET_KEY),
  };
}

/**
 * Firma requerida por la API de dLocal (Payins v2): HMAC-SHA256 sobre
 * `xLogin + xDate + body` (body vacio para GET), codificado en hex. Mismo
 * primitivo que Flow (signFlowParameters) pero el string a firmar es distinto
 * -- ver https://docs.dlocal.com/docs/security.
 */
export function signDlocalRequest(xLogin: string, xDate: string, body: string, secretKey: string): string {
  const baseString = `${xLogin}${xDate}${body}`;
  return crypto.createHmac("sha256", secretKey).update(baseString).digest("hex");
}

function dlocalHeaders(xLogin: string, xTransKey: string, secretKey: string, body: string) {
  const xDate = new Date().toISOString();
  const signature = signDlocalRequest(xLogin, xDate, body, secretKey);
  return {
    "Content-Type": "application/json",
    "X-Login": xLogin,
    "X-Trans-Key": xTransKey,
    "X-Version": "2.1",
    "X-Date": xDate,
    Authorization: `V2-HMAC-SHA256, Signature: ${signature}`,
  };
}

/**
 * Crea un pago en dLocal con payment_method_flow "REDIRECT": dLocal aloja su
 * propia pagina con todos los metodos locales habilitados para el pais
 * (tarjeta, PSE, PIX, OXXO, etc.) -- mismo patron que Flow/MercadoPago hoy,
 * sin necesidad de un selector de metodos propio en el checkout de tuLector.
 */
export async function createDlocalPayment(options: DlocalPaymentCreateOptions): Promise<{ url: string; paymentId: string; status: string }> {
  const config = getDlocalConfig();
  const dlocalUrl = config.sandbox ? "https://sandbox.dlocal.com" : "https://api.dlocal.com";

  if (!config.configured) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("dLocal no esta configurado para procesar pagos reales.");
    }
    // Modo simulacion en desarrollo si no hay credenciales reales configuradas
    console.log("[dlocal] MOCK: Creando pago simulacion:", options);
    const mockPaymentId = `mock_dlocal_payment_${Date.now()}`;
    return {
      url: `/api/billing/mock-payment?gateway=dlocal&token=${mockPaymentId}&orderId=${options.orderId}`,
      paymentId: mockPaymentId,
      status: "PENDING",
    };
  }

  const body = JSON.stringify({
    amount: options.amount,
    currency: options.currency.toUpperCase(),
    country: options.country.toUpperCase(),
    payment_method_flow: "REDIRECT",
    payer: {
      name: options.payerName,
      email: options.payerEmail,
      document: options.payerDocument || undefined,
      document_type: options.payerDocumentType || undefined,
      user_reference: options.orderId,
    },
    order_id: options.orderId,
    description: options.description,
    notification_url: options.notificationUrl,
    callback_url: options.successUrl,
  });

  try {
    const res = await fetch(`${dlocalUrl}/payments`, {
      method: "POST",
      headers: dlocalHeaders(config.xLogin!, config.xTransKey!, config.secretKey!, body),
      body,
    });

    const json = await res.json();
    if (!res.ok) {
      console.error("[dlocal] error en creacion de pago:", json);
      throw new Error(json.message || "Error al conectar con dLocal");
    }

    const redirectUrl = json.redirect_url || json.three_dsecure?.redirect_url;
    if (!redirectUrl) {
      throw new Error("dLocal no devolvio una URL de redireccion para el pago");
    }

    return { url: redirectUrl, paymentId: json.id, status: json.status };
  } catch (err: unknown) {
    console.error("[dlocal] excepcion al crear pago:", err);
    throw new Error(err instanceof Error ? err.message : "Excepcion de red al comunicar con dLocal");
  }
}

/**
 * Consulta el estado real de un pago en dLocal a partir de su ID. Igual que
 * en Flow/MercadoPago, el webhook SIEMPRE debe re-consultar este estado antes
 * de confiar en el payload de la notificacion (anti-spoofing).
 */
export async function getDlocalPaymentStatus(paymentId: string): Promise<{
  status: string; // PAID, PENDING, REJECTED, CANCELLED, AUTHORIZED, EXPIRED
  amount: number;
  currency: string;
  orderId: string;
  raw: Record<string, unknown>;
}> {
  const config = getDlocalConfig();
  const dlocalUrl = config.sandbox ? "https://sandbox.dlocal.com" : "https://api.dlocal.com";

  if (!config.configured) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("dLocal no esta configurado para verificar pagos reales.");
    }
    if (paymentId.startsWith("mock_dlocal_payment_")) {
      return {
        status: "PAID",
        amount: 25,
        currency: "USD",
        orderId: paymentId.split("_orderId_")[1] || "",
        raw: { status: "PAID" },
      };
    }
    throw new Error("dLocal no esta configurado y el ID no es mock.");
  }

  try {
    const res = await fetch(`${dlocalUrl}/payments/${paymentId}`, {
      method: "GET",
      headers: dlocalHeaders(config.xLogin!, config.xTransKey!, config.secretKey!, ""),
    });

    const json = await res.json();
    if (!res.ok) {
      console.error("[dlocal] error al consultar pago:", json);
      throw new Error(json.message || "Error al obtener estado de dLocal");
    }

    return {
      status: String(json.status),
      amount: Number(json.amount),
      currency: String(json.currency || "").toLowerCase(),
      orderId: String(json.order_id || ""),
      raw: json,
    };
  } catch (err: unknown) {
    console.error("[dlocal] excepcion en getPaymentStatus:", err);
    throw new Error(err instanceof Error ? err.message : "Excepcion al consultar pago en dLocal");
  }
}
