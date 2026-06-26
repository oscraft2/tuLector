/**
 * Guardado y consulta de escaneos en Supabase (tabla scan_logs).
 *
 * scan_logs: { id, user_agent, log JSONB, created_at } con RLS publico de
 * insert/select (ver migracion init). Cada escaneo guarda foto reescalada,
 * warp, scores por burbuja, respuestas, ID y diagnostico → base para analizar
 * y, mas adelante, entrenar (training_plan.json).
 */
import { createClient } from "../lib/supabase";

export const SCAN_LOG_VERSION = 2;

export interface ScanLogPayload {
  v: number;
  type: "scan" | "scan_fail" | "diagnostic";
  source: "camera" | "upload";
  sheet: string;
  ts: string;
  frame?: { w: number; h: number };
  diag?: Record<string, unknown>;
  corners?: [number, number][] | null;
  result?: { valid: boolean; code?: number; reason?: string };
  answers?: { q: number; a: string; s: number[] }[];
  id?: string[];
  rut?: string;       // RUT leido (ej. "12345678-5")
  dvOk?: boolean;     // true si el digito verificador valida
  photo?: string | null;   // foto original reescalada (dataURL JPEG)
  warp?: string | null;    // warp reescalado (dataURL JPEG)
  corrected?: { q: number; a: string }[]; // correcciones del profesor (futuro)
}

export interface ScanLogRow {
  id: string;
  user_agent: string | null;
  log: ScanLogPayload;
  created_at: string;
}

const MAX_IMG_CHARS = 250_000; // ~180 KB base64; descarta imagenes anomalas

/** Inserta un escaneo. Devuelve true/false y loguea el error (no en silencio). */
export async function saveScanLog(payload: ScanLogPayload): Promise<boolean> {
  try {
    // Tope de tamaño: evita inflar el JSONB con imagenes anomalas (Fase 1.1).
    if (payload.photo && payload.photo.length > MAX_IMG_CHARS) payload.photo = null;
    if (payload.warp && payload.warp.length > MAX_IMG_CHARS) payload.warp = null;
    const supabase = createClient();
    const { error } = await supabase.from("scan_logs").insert({
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      log: payload,
    });
    if (error) {
      console.warn("[scan_log] insert error:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[scan_log] excepcion:", e);
    return false;
  }
}

/** Lee los escaneos mas recientes para la pagina de analisis. */
export async function fetchScanLogs(limit = 100): Promise<ScanLogRow[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("scan_logs")
      .select("id, user_agent, log, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.warn("[scan_log] select error:", error.message);
      return [];
    }
    return (data ?? []) as ScanLogRow[];
  } catch (e) {
    console.warn("[scan_log] excepcion select:", e);
    return [];
  }
}

/** Reescala un canvas a un dataURL JPEG de ancho maximo maxW (ahorra storage). */
export function downscaleCanvas(src: HTMLCanvasElement, maxW: number, quality = 0.6): string | null {
  try {
    const scale = Math.min(1, maxW / src.width);
    const w = Math.max(1, Math.round(src.width * scale));
    const h = Math.max(1, Math.round(src.height * scale));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.drawImage(src, 0, 0, w, h);
    return c.toDataURL("image/jpeg", quality);
  } catch {
    return null;
  }
}

/** Reescala una ImageData a dataURL JPEG (para guardar la foto original). */
export function imageDataToThumb(frame: ImageData, maxW: number, quality = 0.6): string | null {
  try {
    const full = document.createElement("canvas");
    full.width = frame.width;
    full.height = frame.height;
    full.getContext("2d")!.putImageData(frame, 0, 0);
    return downscaleCanvas(full, maxW, quality);
  } catch {
    return null;
  }
}
