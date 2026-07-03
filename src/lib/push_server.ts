// Utilidad server-side para enviar notificaciones push via Firebase Cloud Messaging (FCM).
// REQUIERE config de FCM por el DUEÑO (ver docs al final de este archivo).
//
// Uso:
//   await sendPush(schoolId, { title: "...", body: "..." });
//   Envía push a TODOS los dispositivos registrados de un colegio.
//
// Flujo de registro (cliente):
//   1. pushRegister() en capacitor.ts obtiene el token FCM
//   2. POST /api/push/register con { token } y las cookies de sesión → guarda en BD
//
// Flujo de envío (server, ej. desde /api/scan/result):
//   1. Buscar device_tokens del school_id
//   2. Enviar via Firebase Admin SDK

import { getDashboardContext } from "./supabase_server";

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Envía una notificación push a todos los dispositivos registrados de un colegio.
 * Degrada silenciosamente si FCM no está configurado.
 */
export async function sendPushToSchool(
  schoolId: string,
  payload: PushPayload,
): Promise<{ sent: number; errors: number }> {
  const result = { sent: 0, errors: 0 };

  const fcmKey = process.env.FCM_SERVER_KEY;
  if (!fcmKey) return result; // FCM no configurado → no-op

  try {
    const { supabase } = await getDashboardContext();

    const { data: tokens } = await supabase
      .from("device_tokens")
      .select("token")
      .eq("school_id", schoolId);

    if (!tokens || tokens.length === 0) return result;

    const fcmTokens = tokens.map((t: { token: string }) => t.token).filter(Boolean);

    for (const token of fcmTokens) {
      try {
        const res = await fetch("https://fcm.googleapis.com/fcm/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `key=${fcmKey}`,
          },
          body: JSON.stringify({
            to: token,
            notification: {
              title: payload.title,
              body: payload.body,
            },
            data: payload.data ?? {},
          }),
        });

        if (res.ok) {
          result.sent++;
        } else {
          result.errors++;
          const err = await res.json().catch(() => ({}));
          if ((err as { error?: string })?.error === "NotRegistered") {
            // Token inválido → limpiar
            await supabase.from("device_tokens").delete().eq("token", token);
          }
        }
      } catch {
        result.errors++;
      }
    }
  } catch {
    // Sin supabase/sesión → no-op
  }

  return result;
}

// ─── Documentación para el DUEÑO ──────────────────────────────────────────
//
// Para habilitar notificaciones push se requiere:
//
// 1. Firebase project:
//    - Crear proyecto en https://console.firebase.google.com
//    - Ir a Project Settings > Cloud Messaging
//    - Copiar "Server key" → agregar a .env.local como FCM_SERVER_KEY
//    - Descargar google-services.json → colocar en android/app/
//
// 2. Tabla en Supabase (ejecutar en SQL Editor):
//    CREATE TABLE IF NOT EXISTS device_tokens (
//      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//      school_id uuid NOT NULL REFERENCES schools(id),
//      user_id uuid NOT NULL REFERENCES users(id),
//      token text NOT NULL UNIQUE,
//      platform text,
//      created_at timestamptz DEFAULT now()
//    );
//    ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
//    -- Ajustar RLS según tu política de acceso
//
// 3. Capacitor sync:
//    npx cap sync android
//
// 4. google-services.json:
//    Colocar en android/app/google-services.json
//    El plugin @capacitor/push-notifications lo usa automáticamente.
//
// 5. Verificar en dispositivo:
//    - Instalar APK
//    - Iniciar sesión → el token se registra automáticamente
//    - Desde Firebase Console > Cloud Messaging > Send test message
//    - Debe aparecer la notificación en el dispositivo
//
