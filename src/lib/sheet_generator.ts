/**
 * Lógica del GENERADOR de hojas (fuera del motor). Usa drawSheet del motor para
 * la parte funcional y agrega branding SOLO en zonas libres (no toca el motor).
 * Ver docs/generador-hojas-spec.md y docs/plan-pruebas-lector.md.
 */
import { drawSheet, drawSheetCode, type Ctx2D } from "@/lib/sheet_render";
import { computeRutDV } from "@/lib/omr";
import { SHEET_H, SHEET_W, CORNER_CENTERS, ANCHOR_SIZE, type SheetConfig } from "@/lib/sheet_layout";
import { type SheetCodeData } from "@/lib/sheet_code";
import { resolveIdBlock, resolveIdReadConfig } from "@/lib/country_id_blocks";
import { QUIZ_MAX_PAGES } from "@/lib/quiz_constraints";

export interface Branding {
  title?: string;     // título del ensayo
  school?: string;    // nombre del colegio
  logo?: HTMLImageElement | null; // logo (opcional)
  pageInfo?: string;  // "Página 2 de 3 — Preguntas 101–200" (multipágina, opcional)
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
  if (b.pageInfo) {
    ctx.textAlign = "right";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText(b.pageInfo, SHEET_W - 20, 14);
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

/** ID nacional aleatorio VÁLIDO para el país dado (cuerpo + DV según el
 * algoritmo de checksum de ese país; motor ya generalizado a 7 países — ver
 * plan-multipais-motor.md). Chile delega en randomValidRut (largo variable
 * 7-8, sin cambios). El resto usa el ancho fijo del bloque del motor. */
export function randomValidNationalId(countryCode?: string | null): string {
  if (!countryCode || countryCode.toUpperCase() === "CL") return randomValidRut();
  const idBlock = resolveIdBlock(countryCode);
  const idRead = resolveIdReadConfig(countryCode);
  const body = Array.from({ length: idBlock.idDigits }, () => Math.floor(Math.random() * 10));
  if (body[0] === 0) body[0] = 1 + Math.floor(Math.random() * 9); // sin cero a la izquierda
  if (idBlock.checkDigits === 0 || !idRead.checkDigit) return body.join("");
  const dv = idRead.checkDigit(body).map((d) => (d === 10 ? "K" : String(d))).join("");
  return `${body.join("")}-${dv}`;
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

// ─── Reverso para preguntas de desarrollo (abiertas) ───────────────────────
// Pagina SOLO impresa (sin anclas ni OMR): recuadros grandes numerados donde el
// estudiante escribe su desarrollo. Se intercala despues de cada pagina frontal
// en el PDF (calza con impresion duplex). Vive aqui, fuera del motor, porque no
// participa de la lectura.

/** Maximo de recuadros por pagina de reverso (menos = recuadros mas grandes).
 *  6 cubre con margen el maximo real de los presets DIA (5 abiertas en
 *  dia_5b_matematica/dia_7b_matematica, ver dia_presets.ts) -- con 4 esas dos
 *  hojas partian el reverso en 2 paginas de mas (1 frontal + 2 reversos = 3
 *  hojas para un ensayo que cabe en 1 frontal + 1 reverso = 2). */
export const OPEN_BOXES_PER_PAGE = 6;

/** Reparte las preguntas abiertas en paginas de reverso. */
export function chunkOpenQuestions(open: number[], maxPerPage: number = OPEN_BOXES_PER_PAGE): number[][] {
  const pages: number[][] = [];
  for (let i = 0; i < open.length; i += maxPerPage) pages.push(open.slice(i, i + maxPerPage));
  return pages;
}

// ─── Reverso ESCANEABLE (Fase 1, correccion IA de abiertas) ───────────────
// Convencion de "pagina reverso" que reusa el MISMO codec del codigo de hoja
// (src/tulector/sheet_code.ts) SIN tocarlo: una pagina frontal real usa
// page=1..QUIZ_MAX_PAGES; un reverso usa page=QUIZ_MAX_PAGES+paginaFrontal
// (nunca choca con una pagina frontal real) y reusa el campo pagesTotal para
// guardar el nº de CHUNK de reverso (1-indexado) de esa pagina frontal, no el
// total de paginas. El lector no necesita saber QUE preguntas trae este chunk
// desde el codigo: vuelve a correr chunkOpenQuestions(openQuestions) de la BD
// (funcion pura, mismo resultado que al imprimir) e indexa por chunkIndex-1.
export function isReversoPage(page: number): boolean {
  return page > QUIZ_MAX_PAGES;
}
export function reversoFrontPage(page: number): number {
  return page - QUIZ_MAX_PAGES;
}
export function reversoSheetCode(
  frontPage: number,
  chunkIndex: number,
  base: Omit<SheetCodeData, "page" | "pagesTotal">,
): SheetCodeData {
  return { ...base, page: QUIZ_MAX_PAGES + frontPage, pagesTotal: chunkIndex };
}

/** Rectangulo (x,y,w,h) del recuadro `index` (0-indexado) de `count` totales
 *  en una pagina de reverso -- MISMA fuente de verdad para dibujar (abajo) y
 *  para recortar al leer (src/lib/open_answer_capture.ts). */
export function openAnswerBoxRect(index: number, count: number): { x: number; y: number; w: number; h: number } {
  const top = 200, bottom = SHEET_H - 40, gap = 24;
  const n = Math.max(1, count);
  const boxH = Math.floor((bottom - top - gap * (n - 1)) / n);
  return { x: 80, y: top + index * (boxH + gap), w: SHEET_W - 160, h: boxH };
}

/**
 * Dibuja UNA pagina de reverso (1200x1650, igual que la hoja OMR): 4 anclas de
 * esquina + codigo de hoja (si se pasa `opts.code`, la hace ESCANEABLE — sin
 * eso, queda como antes: solo impresa, sin registro), encabezado con titulo +
 * linea manuscrita de Nombre/ID (respaldo visual, no OMR), y un recuadro
 * grande por pregunta repartiendo el alto util via openAnswerBoxRect.
 * `questions` en numeracion GLOBAL del ensayo.
 */
export function renderOpenAnswersSheet(
  ctx: CanvasRenderingContext2D,
  questions: number[],
  branding: Branding = {},
  opts: { pageInfo?: string; code?: SheetCodeData } = {},
): void {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, SHEET_W, SHEET_H);
  ctx.fillStyle = "#000000";
  ctx.textBaseline = "alphabetic";

  // Anclas de esquina: solo 4 (no las 12 de la hoja frontal) -- este reverso
  // solo necesita perspectiva plana para recortar recuadros grandes, no la
  // precision de burbuja del warp por bloques.
  for (const [cx, cy] of CORNER_CENTERS) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(cx - ANCHOR_SIZE / 2, cy - ANCHOR_SIZE / 2, ANCHOR_SIZE, ANCHOR_SIZE);
  }
  if (opts.code) drawSheetCode(ctx as unknown as Ctx2D, opts.code);

  // Encabezado (y=0..190; el codigo de hoja ocupa la franja y≈172-188 bajo el
  // titulo, misma banda que en la hoja frontal -- el texto de instruccion se
  // sube a y=155 para no compartir esa franja con la tinta del codigo).
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.font = "bold 26px sans-serif";
  ctx.fillText("HOJA DE DESARROLLO", SHEET_W / 2, 52);
  if (branding.title) {
    ctx.font = "16px sans-serif";
    ctx.fillText(branding.title.slice(0, 70), SHEET_W / 2, 82);
  }
  ctx.textAlign = "left";
  ctx.font = "15px sans-serif";
  ctx.fillText("Nombre:", 80, 118);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(150, 122); ctx.lineTo(720, 122); ctx.stroke();
  ctx.fillText("RUT / ID:", 760, 118);
  ctx.beginPath(); ctx.moveTo(845, 122); ctx.lineTo(1120, 122); ctx.stroke();
  ctx.font = "12px sans-serif";
  ctx.fillStyle = "#555555";
  ctx.fillText("Escribe tu desarrollo dentro del recuadro de cada pregunta.", 80, 150);
  if (opts.pageInfo) {
    ctx.textAlign = "right";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText(opts.pageInfo, SHEET_W - 20, 24);
    ctx.textAlign = "left";
  }

  // Recuadros: reparto del area util y=200..1610 (openAnswerBoxRect).
  questions.forEach((q, i) => {
    const box = openAnswerBoxRect(i, questions.length);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    ctx.fillStyle = "#000000";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText(`Pregunta ${q}`, box.x + 16, box.y + 30);
  });
  ctx.restore();
}

export interface GroundTruthEntry {
  index: number;   // 1..N
  rut: string;     // clave de emparejamiento con scan_logs
  answers: string[]; // letras ("A".."E")
}

export interface QuizPage {
  page: number;    // 1-indexado
  from: number;    // primera pregunta GLOBAL de esta pagina (1-indexada)
  to: number;      // ultima pregunta GLOBAL de esta pagina (inclusive)
  count: number;   // to - from + 1
}

/**
 * Reparte un ensayo de N preguntas en paginas de tamano fijo (MAX_QUESTIONS,
 * el mismo sobre validado por test:omr). Para 1 pagina devuelve un array de
 * 1 elemento (from=1, to=numQuestions) -- el caso de hoy, sin multipagina.
 * Ver docs/plan-multipagina-fase1.md: cada pagina se imprime/lee como hoja
 * fisicamente independiente de MAX_QUESTIONS preguntas, sin tocar el motor.
 */
export function paginateQuiz(numQuestions: number): QuizPage[] {
  const total = Math.max(0, Math.floor(numQuestions));
  if (total <= 0) return [];
  const pagesTotal = Math.max(1, Math.ceil(total / MAX_QUESTIONS));
  return Array.from({ length: pagesTotal }, (_, i) => {
    const from = i * MAX_QUESTIONS + 1;
    const to = Math.min(total, (i + 1) * MAX_QUESTIONS);
    return { page: i + 1, from, to, count: to - from + 1 };
  });
}
