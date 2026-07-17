import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isMissingTableError } from "@/lib/supabase_errors";

export type WhatsappButtonConfig = {
  enabled: boolean;
  phone: string;
  default_message: string;
  position: "bottom-right" | "bottom-left";
};

export type BannerConfig = {
  enabled: boolean;
  text: string;
  link_url: string;
  link_label: string;
  variant: "info" | "warning" | "promo";
};

const DEFAULT_WHATSAPP: WhatsappButtonConfig = {
  enabled: false,
  phone: "",
  default_message: "Hola, quiero informacion sobre TuLector",
  position: "bottom-right",
};

const DEFAULT_BANNER: BannerConfig = {
  enabled: false,
  text: "",
  link_url: "",
  link_label: "",
  variant: "info",
};

/**
 * Lee una fila de site_config. Si la migracion 20260717000000_site_config.sql
 * todavia no se aplico en produccion (tabla ausente), degrada a los valores
 * por defecto en vez de romper el layout raiz -- mismo patron defensivo que
 * sendTemplatedEmail con STATIC_TEMPLATES.
 */
async function readSiteConfig(key: string): Promise<{ enabled: boolean; payload: Record<string, unknown> } | null> {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("site_config").select("enabled, payload").eq("key", key).maybeSingle();
    if (error) {
      if (!isMissingTableError(error, "site_config")) {
        console.warn(`[site_config] error al leer "${key}":`, error.message);
      }
      return null;
    }
    return data ? { enabled: Boolean(data.enabled), payload: (data.payload as Record<string, unknown>) ?? {} } : null;
  } catch (err) {
    console.warn(`[site_config] excepcion al leer "${key}":`, err);
    return null;
  }
}

export async function getWhatsappButtonConfig(): Promise<WhatsappButtonConfig> {
  const row = await readSiteConfig("whatsapp_button");
  if (!row) return DEFAULT_WHATSAPP;
  const payload = row.payload as Partial<WhatsappButtonConfig>;
  return {
    enabled: row.enabled,
    phone: String(payload.phone ?? ""),
    default_message: String(payload.default_message ?? DEFAULT_WHATSAPP.default_message),
    position: payload.position === "bottom-left" ? "bottom-left" : "bottom-right",
  };
}

export async function getBannerConfig(): Promise<BannerConfig> {
  const row = await readSiteConfig("banner_home");
  if (!row) return DEFAULT_BANNER;
  const payload = row.payload as Partial<BannerConfig>;
  return {
    enabled: row.enabled,
    text: String(payload.text ?? ""),
    link_url: String(payload.link_url ?? ""),
    link_label: String(payload.link_label ?? ""),
    variant: payload.variant === "warning" || payload.variant === "promo" ? payload.variant : "info",
  };
}
