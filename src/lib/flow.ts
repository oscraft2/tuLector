import crypto from "crypto";

export interface FlowPaymentCreateOptions {
  amount: number;
  email: string;
  subject: string;
  commerceOrder: string;
  urlConfirmation: string;
  urlReturn: string;
}

export function getFlowConfig() {
  return {
    apiKey: process.env.FLOW_API_KEY,
    secretKey: process.env.FLOW_SECRET_KEY,
    sandbox: process.env.FLOW_SANDBOX === "true" || !process.env.FLOW_API_KEY,
    configured: Boolean(process.env.FLOW_API_KEY && process.env.FLOW_SECRET_KEY),
  };
}

/**
 * Genera la firma para Flow ordenando los parámetros alfabéticamente
 * y calculando el HMAC-SHA256 con el Secret Key.
 */
export function signFlowParameters(params: Record<string, string | number>, secretKey: string): string {
  const sortedKeys = Object.keys(params).sort();
  const pairs: string[] = [];

  for (const key of sortedKeys) {
    pairs.push(`${key}=${params[key]}`);
  }

  const baseString = pairs.join("&");
  return crypto.createHmac("sha256", secretKey).update(baseString).digest("hex");
}

/**
 * Llama a la API de Flow para registrar una intención de pago.
 * Devuelve { url, token } o arroja un error.
 */
export async function createFlowPayment(options: FlowPaymentCreateOptions): Promise<{ url: string; token: string }> {
  const config = getFlowConfig();
  const flowUrl = config.sandbox ? "https://sandbox.flow.cl/api" : "https://www.flow.cl/api";

  if (!config.apiKey || !config.secretKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Flow no esta configurado para procesar pagos reales.");
    }
    // Modo simulación en desarrollo si no hay credenciales reales configuradas
    console.log("[flow] MOCK: Creando pago simulación:", options);
    const mockToken = `mock_flow_token_${Date.now()}`;
    return {
      url: `/api/billing/mock-payment?gateway=flow&token=${mockToken}&orderId=${options.commerceOrder}`,
      token: mockToken,
    };
  }

  const params: Record<string, string | number> = {
    apiKey: config.apiKey,
    amount: options.amount,
    currency: "CLP",
    email: options.email,
    subject: options.subject,
    commerceOrder: options.commerceOrder,
    urlConfirmation: options.urlConfirmation,
    urlReturn: options.urlReturn,
  };

  const signature = signFlowParameters(params, config.secretKey);
  params.s = signature;

  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    body.append(k, String(v));
  }

  try {
    const res = await fetch(`${flowUrl}/payment/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const json = await res.json();
    if (!res.ok) {
      console.error("[flow] error en creación de pago:", json);
      throw new Error(json.message || "Error al conectar con Flow");
    }

    return {
      url: `${json.url}?token=${json.token}`,
      token: json.token,
    };
  } catch (err: unknown) {
    console.error("[flow] excepción al crear pago:", err);
    throw new Error(err instanceof Error ? err.message : "Excepción de red al comunicar con Flow");
  }
}

/**
 * Consulta el estado de un pago en Flow a partir de su token.
 */
export async function getFlowPaymentStatus(token: string): Promise<{
  status: number;
  amount: number;
  commerceOrder: string;
  paymentData: Record<string, unknown>;
}> {
  const config = getFlowConfig();
  const flowUrl = config.sandbox ? "https://sandbox.flow.cl/api" : "https://www.flow.cl/api";

  if (!config.apiKey || !config.secretKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Flow no esta configurado para verificar pagos reales.");
    }
    // Modo simulación en desarrollo
    if (token.startsWith("mock_flow_token_")) {
      return {
        status: 2, // Pagado
        amount: 19990,
        commerceOrder: token.split("_orderId_")[1] || "mock_order",
        paymentData: { method: "mock_webpay" },
      };
    }
    throw new Error("Flow no está configurado y el token no es mock.");
  }

  const params: Record<string, string | number> = {
    apiKey: config.apiKey,
    token,
  };

  const signature = signFlowParameters(params, config.secretKey);
  params.s = signature;

  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    query.append(k, String(v));
  }

  try {
    const res = await fetch(`${flowUrl}/payment/getStatus?${query.toString()}`);
    const json = await res.json();

    if (!res.ok) {
      console.error("[flow] error al obtener estado:", json);
      throw new Error(json.message || "Error al obtener estado de Flow");
    }

    return {
      status: Number(json.status), // 1: pendiente, 2: pagado, 3: rechazado, 4: anulado
      amount: Number(json.amount),
      commerceOrder: json.commerceOrder,
      paymentData: json,
    };
  } catch (err: unknown) {
    console.error("[flow] excepción en getStatus:", err);
    throw new Error(err instanceof Error ? err.message : "Excepción al consultar estado en Flow");
  }
}
