export interface MercadoPagoPreferenceOptions {
  title: string;
  unitPrice: number;
  currencyId: string;
  externalReference: string;
  notificationUrl: string;
  backUrl: string;
  schoolId: string;
}

export function getMercadoPagoConfig() {
  return {
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
    webhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET,
    configured: Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN),
  };
}

/**
 * Crea una preferencia de pago en MercadoPago.
 * Retorna la URL de inicio del pago y el ID de la preferencia.
 */
export async function createMercadoPagoPreference(options: MercadoPagoPreferenceOptions): Promise<{ url: string; preferenceId: string }> {
  const config = getMercadoPagoConfig();

  if (!config.accessToken || config.accessToken === "APP_USR-...") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("MercadoPago no esta configurado para procesar pagos reales.");
    }
    // Modo simulación en desarrollo
    console.log("[mercadopago] MOCK: Creando preferencia simulación:", options);
    const mockPrefId = `mock_mp_pref_${Date.now()}`;
    return {
      url: `/api/billing/mock-payment?gateway=mercadopago&token=${mockPrefId}&orderId=${options.externalReference}`,
      preferenceId: mockPrefId,
    };
  }

  try {
    const res = await fetch("https://api.mercadopago.com/v1/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            title: options.title,
            quantity: 1,
            unit_price: options.unitPrice,
            currency_id: options.currencyId,
          },
        ],
        back_urls: {
          success: options.backUrl,
          pending: options.backUrl,
          failure: options.backUrl,
        },
        auto_return: "approved",
        external_reference: options.externalReference,
        notification_url: options.notificationUrl,
        metadata: {
          school_id: options.schoolId,
          order_id: options.externalReference,
        },
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      console.error("[mercadopago] error al crear preferencia:", json);
      throw new Error(json.message || "Error al conectar con MercadoPago");
    }

    // MercadoPago provee init_point (producción) y sandbox_init_point (pruebas)
    const url = process.env.NODE_ENV === "production" ? json.init_point : json.sandbox_init_point;

    return {
      url,
      preferenceId: json.id,
    };
  } catch (err: unknown) {
    console.error("[mercadopago] excepción al crear preferencia:", err);
    throw new Error(err instanceof Error ? err.message : "Excepción de red al comunicar con MercadoPago");
  }
}

/**
 * Obtiene el detalle de una transacción de pago en MercadoPago a partir del ID de pago.
 */
export async function getMercadoPagoPayment(paymentId: string): Promise<{
  status: string; // 'approved', 'pending', 'rejected', etc.
  amount: number;
  externalReference: string;
  paymentMethod: string;
  raw: Record<string, unknown>;
}> {
  const config = getMercadoPagoConfig();

  if (!config.accessToken || config.accessToken === "APP_USR-...") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("MercadoPago no esta configurado para verificar pagos reales.");
    }
    if (paymentId.startsWith("mock_mp_payment_")) {
      return {
        status: "approved",
        amount: 490,
        externalReference: paymentId.split("_orderId_")[1] || "mock_order",
        paymentMethod: "mock_mercadopago",
        raw: { status: "approved" },
      };
    }
    throw new Error("MercadoPago no está configurado y el ID no es mock.");
  }

  try {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        "Authorization": `Bearer ${config.accessToken}`,
      },
    });

    const json = await res.json();
    if (!res.ok) {
      console.error("[mercadopago] error al consultar pago:", json);
      throw new Error(json.message || "Error al obtener estado de MercadoPago");
    }

    return {
      status: json.status,
      amount: Number(json.transaction_amount),
      externalReference: json.external_reference,
      paymentMethod: json.payment_method_id,
      raw: json,
    };
  } catch (err: unknown) {
    console.error("[mercadopago] excepción en getPayment:", err);
    throw new Error(err instanceof Error ? err.message : "Excepción al consultar pago en MercadoPago");
  }
}
