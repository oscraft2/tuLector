/**
 * Lógica del GENERADOR de hojas (fuera del motor). Usa drawSheet del motor para
 * la parte funcional y agrega branding SOLO en zonas libres (no toca el motor).
 * Ver docs/generador-hojas-spec.md y docs/plan-pruebas-lector.md.
 */
import { drawSheet, type Ctx2D } from "@/lib/sheet_render";
import { computeRutDV } from "@/lib/omr";
import { SHEET_W, type SheetConfig } from "@/lib/sheet_layout";
import { type SheetCodeData } from "@/lib/sheet_code";

export interface Branding {
  title?: string;     // título del ensayo
  school?: string;    // nombre del colegio
  logo?: HTMLImageElement | null; // logo (opcional)
}

export interface SheetMarks {
  answers?: number[];
  rut?: string;
  filled?: boolean;
  code?: SheetCodeData; // codigo de hoja (ata la hoja a su ensayo). Ver sheet_code.
}

// Zona segura de branding: banda superior y=0..48 (las anclas están en y≥50).
const SAFE_TOP = 48;

/** Dibuja el branding SOLO en la banda superior libre. No toca zonas de lectura. */
export function drawBranding(ctx: CanvasRenderingContext2D, b: Branding): void {
  ctx.save();
  ctx.fillStyle = "#000000";

  // Logo (izquierda), ajustado dentro de 90×40 conservando proporción.
  if (b.logo && b.logo.width > 0) {
    const boxW = 90, boxH = 40, x = 110, y = 4;
    const scale = Math.min(boxW / b.logo.width, boxH / b.logo.height);
    const w = b.logo.width * scale, h = b.logo.height * scale;
    ctx.drawImage(b.logo, x + (boxW - w) / 2, y + (boxH - h) / 2, w, h);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  if (b.title) {
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(b.title.slice(0, 60), SHEET_W / 2, 24);
  }
  if (b.school) {
    ctx.font = "14px sans-serif";
    ctx.fillText(b.school.slice(0, 70), SHEET_W / 2, 42);
  }
  ctx.restore();
  void SAFE_TOP;
}

/** Dibuja la hoja completa: motor (drawSheet) + branding en zona libre. */
export function renderSheet(
  ctx: CanvasRenderingContext2D,
  marks: SheetMarks,
  cfg: SheetConfig,
  branding: Branding = {},
): void {
  drawSheet(ctx as unknown as Ctx2D, marks, cfg);
  drawBranding(ctx, branding);
}

/** RUT chileno aleatorio VÁLIDO (cuerpo 7-8 dígitos + DV mod-11 correcto). */
export function randomValidRut(): string {
  const len = Math.random() < 0.5 ? 7 : 8;
  const body = Array.from({ length: len }, () => Math.floor(Math.random() * 10));
  if (body[0] === 0) body[0] = 1 + Math.floor(Math.random() * 9); // sin cero a la izquierda
  const dv = computeRutDV(body);
  return body.join("") + "-" + (dv === 10 ? "K" : String(dv));
}

/** Respuestas aleatorias (índice de opción 0..numOptions-1) por pregunta. */
export function randomAnswers(numQuestions: number, numOptions: number): number[] {
  return Array.from({ length: numQuestions }, () => Math.floor(Math.random() * numOptions));
}

/** Respuestas MIXTAS: las primeras `markUpTo` preguntas quedan premarcadas
 * (aleatorias, Fase A ideal); el resto queda en -1 (sentinel del motor para
 * "en blanco", ver SheetMarks en sheet_render.ts) para marcarse A MANO (Fase B
 * real). Permite probar en una misma hoja el piso del sistema y la robustez al
 * marcado humano. Ver docs/plan-pruebas-lector.md. */
export function randomPartialAnswers(numQuestions: number, numOptions: number, markUpTo: number): number[] {
  const limit = Math.max(0, Math.min(markUpTo, numQuestions));
  return Array.from({ length: numQuestions }, (_, i) => (i < limit ? Math.floor(Math.random() * numOptions) : -1));
}

// Sobre SEGURO validado por test:omr (guard "Config sweep"): fuera de este rango
// las filas quedan muy juntas o faltan marcas de timing → no lee 100%. 3-4
// columnas (jul 2026) llegan a nivel ZipGrade (100 preguntas en 1 hoja) —
// reutilizan la MISMA densidad de fila que 1-2 columnas, solo agregan
// geometría horizontal nueva subdividiendo las 2 franjas libres entre anclas.
export const MIN_QUESTIONS = 6;
export const MAX_QUESTIONS = 100;

/** Columnas VÁLIDAS para un nº de preguntas (cada rango es el sobre validado por barrido). */
export function allowedColumns(numQuestions: number): number[] {
  const cols: number[] = [];
  if (numQuestions <= 40) cols.push(1);
  if (numQuestions >= 12 && numQuestions <= 50) cols.push(2);
  if (numQuestions >= 18 && numQuestions <= 90) cols.push(3);
  if (numQuestions >= 21 && numQuestions <= 100) cols.push(4);
  return cols.length ? cols : [1];
}

/** Ajusta el nº de columnas pedido al sobre seguro para ese nº de preguntas. */
export function safeColumns(numQuestions: number, requested: number): number {
  const allowed = allowedColumns(numQuestions);
  return allowed.includes(requested) ? requested : allowed[allowed.length - 1];
}

/** Columnas sugeridas por defecto, ya dentro del sobre seguro. */
export function suggestColumns(numQuestions: number): number {
  return safeColumns(numQuestions, numQuestions > 25 ? 2 : 1);
}

export interface GroundTruthEntry {
  index: number;   // 1..N
  rut: string;     // clave de emparejamiento con scan_logs
  answers: string[]; // letras ("A".."E")
}
