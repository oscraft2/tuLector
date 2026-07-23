/**
 * Dibujo de la hoja TuLector v2. Funcion pura sobre un contexto Canvas2D, asi
 * el mismo codigo sirve en el navegador (generador/descarga) y en Node con
 * `canvas` (generacion del fixture de prueba). Esto garantiza que la hoja
 * impresa y la imagen de test sean identicas (no pueden divergir).
 */
import * as L from "./sheet_layout";
import { encodeSheetCode, type SheetCodeData } from "./sheet_code";

// Subconjunto minimo de CanvasRenderingContext2D que usamos (compatible con
// el navegador y con node-canvas).
export interface Ctx2D {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  beginPath(): void;
  arc(x: number, y: number, r: number, a0: number, a1: number): void;
  fill(): void;
  stroke(): void;
}

export interface SheetMarks {
  /** Respuesta marcada por pregunta (indice 0..4) o -1 si en blanco. */
  answers?: number[];
  /** RUT a rellenar (cuerpo + DV, ej. "12345678-5" o "123456785"; DV puede ser K). */
  rut?: string;
  /** Si true, rellena las marcas (para el fixture de prueba). */
  filled?: boolean;
  /** Código de hoja a imprimir (versión, id de prueba, página). */
  code?: SheetCodeData;
}

const BLACK = "#000000";
const GRAY = "#b8b8b8";   // contorno/letras de burbuja: gris claro, no negro
// Instruccion de pregunta abierta: gris medio, legible impreso pero muy por
// encima de los umbrales de tinta del motor (DARK_THRESH=70, timing<100), asi
// el texto no existe para el registro ni puede leerse como marca.
const OPEN_GRAY = "#9a9a9a";

function solidSquare(ctx: Ctx2D, cx: number, cy: number, size: number) {
  ctx.fillStyle = BLACK;
  ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
}

function bubble(ctx: Ctx2D, cx: number, cy: number, r: number, fill: boolean) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = BLACK;
    ctx.fill();
  } else {
    ctx.strokeStyle = GRAY;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

/** Normaliza un ID a { body: number[right-aligned], dv: number[] (0..10, 10=K) — un valor por columna de DV. */
export function parseRut(rut: string, checkDigits: number = 1): { body: number[]; dv: number[] } {
  const clean = rut.replace(/[.\-\s]/g, "").toUpperCase();
  if (checkDigits <= 0) {
    const body = clean.replace(/\D/g, "").split("").map(Number);
    return { body, dv: [] };
  }
  const dvChars = clean.slice(-checkDigits).split("");
  const dv = dvChars.map((ch) => (ch === "K" ? 10 : /\d/.test(ch) ? Number(ch) : -1));
  const body = clean.slice(0, -checkDigits).replace(/\D/g, "").split("").map(Number);
  return { body, dv };
}

function drawRut(ctx: Ctx2D, marks: SheetMarks, idCfg: L.IdBlockConfig = L.ID_BLOCK_CL): void {
  const cols = L.idBlockCols(idCfg);
  const timingRows = L.idBlockTimingRows(idCfg);

  ctx.fillStyle = BLACK;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = "bold 15px sans-serif";
  ctx.fillText(idCfg.idLabel, L.rutColX(0) - 14, L.rutRowY(0) - 22);

  // Etiquetas de fila 0-9 y K (si el pais la usa) a la izquierda de la grilla
  ctx.font = "11px sans-serif";
  for (let d = 0; d <= 9; d++) ctx.fillText(String(d), L.rutColX(0) - 28, L.rutRowY(d) + 4);
  if (idCfg.hasLetterDigit) ctx.fillText("K", L.rutColX(0) - 28, L.rutRowY(L.RUT_ROWS) + 4);

  // Pista de temporizacion del bloque: una marca solida por fila.
  ctx.fillStyle = BLACK;
  for (let d = 0; d < timingRows; d++) {
    ctx.fillRect(L.RUT_TIMING_X - L.RUT_TIMING_W / 2, L.rutRowY(d) - L.RUT_TIMING_H / 2, L.RUT_TIMING_W, L.RUT_TIMING_H);
  }

  const parsed = marks.rut ? parseRut(marks.rut, idCfg.checkDigits) : { body: [], dv: [] };
  const bodyOffset = idCfg.idDigits - parsed.body.length; // alinear a la derecha

  for (let c = 0; c < cols; c++) {
    const isDvCol = idCfg.checkDigits > 0 && c >= idCfg.idDigits;
    const dvIdx = c - idCfg.idDigits;
    const rows = L.idBlockRowsForCol(idCfg, c);
    for (let d = 0; d < rows; d++) {
      let filled = false;
      if (marks.filled) {
        if (isDvCol) filled = d === parsed.dv[dvIdx];
        else {
          const digitIdx = c - bodyOffset;
          if (digitIdx >= 0 && digitIdx < parsed.body.length) filled = parsed.body[digitIdx] === d;
        }
      }
      bubble(ctx, L.rutColX(c), L.rutRowY(d), L.RUT_R, filled);
    }
  }
}

/** Dibuja la franja del código de hoja (celdas llenas=1, contorno tenue=0). */
function drawSheetCode(ctx: Ctx2D, data: SheetCodeData): void {
  const bits = encodeSheetCode(data);
  const s = L.CODE_CELL, half = s / 2;
  for (let i = 0; i < bits.length; i++) {
    const x = L.codeCellX(i), y = L.CODE_Y;
    if (bits[i]) {
      ctx.fillStyle = BLACK;
      ctx.fillRect(x - half, y - half, s, s);
    } else {
      // Contorno tenue: marca visualmente la celda sin contaminar el muestreo
      // (el motor muestrea solo el interior, radio CODE_R < half).
      ctx.strokeStyle = GRAY;
      ctx.lineWidth = 1;
      ctx.strokeRect(x - half, y - half, s, s);
    }
  }
}

export function drawSheet(ctx: Ctx2D, marks: SheetMarks = {}, cfg: L.SheetConfig = L.DEFAULT_SHEET): void {
  // Fondo blanco
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, L.SHEET_W, L.SHEET_H);

  // ─── Anclas solidas (12 zonas) ───
  for (const [cx, cy] of L.ALL_ANCHORS) {
    solidSquare(ctx, cx, cy, L.ANCHOR_SIZE);
  }

  // ─── Cabecera ───
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 2;
  ctx.strokeRect(L.NAME_X, L.NAME_Y, L.NAME_W, L.NAME_H);
  ctx.fillStyle = BLACK;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText("NOMBRE", L.NAME_X + 6, L.NAME_Y - 8);

  // ─── Código de hoja (franja superior) ───
  if (marks.code) drawSheetCode(ctx, marks.code);

  // ─── Grilla de ID nacional (RUT por defecto: 8 dígitos + DV con K) ───
  drawRut(ctx, marks, cfg.idBlock ?? L.ID_BLOCK_CL);

  // ─── Pista de temporizacion + grilla de preguntas (parametrica, multi-columna) ───
  const ql = L.questionLayout(cfg);
  const numFont = Math.max(11, Math.round(ql.rowH * 0.27));
  const lblFont = Math.max(9, Math.round(ql.bubbleR * 0.85));

  // Pista de temporizacion: UNA marca por fila (rowsPerCol). Todas las columnas
  // comparten esos Y, asi un solo riel ancla las filas de toda la hoja.
  ctx.fillStyle = BLACK;
  for (let row = 0; row < ql.rowsPerCol; row++) {
    const cy = ql.rowCY(row);
    ctx.fillRect(L.TIMING_X - L.TIMING_W / 2, cy - L.TIMING_H / 2, L.TIMING_W, L.TIMING_H);
  }

  const openSet = new Set(cfg.openQuestions ?? []);
  // Texto de la instruccion segun el ancho disponible del area de opciones
  // (COL_GEOM: 1-2 col ~260-290px, 3-4 col ~160px).
  const openLabel = ql.numColumns >= 3 ? "→ reverso" : "Resolver al reverso →";
  const openFont = ql.numColumns >= 3 ? 11 : 13;

  for (let q = 0; q < ql.numQuestions; q++) {
    const col = ql.colOf(q), cy = ql.rowCY(ql.rowOf(q));

    // numero de pregunta (alineado a su columna)
    ctx.fillStyle = BLACK;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = `${numFont}px sans-serif`;
    ctx.fillText(`${q + 1}`, ql.qnumX(col), cy + 6);

    // Pregunta de desarrollo: fila (numero + marca de timing) intacta, pero sin
    // burbujas — se imprime la instruccion centrada en el area de opciones.
    if (openSet.has(q + 1)) {
      const x0 = ql.optX(0, col) - ql.bubbleR;
      const x1 = ql.optX(ql.numOptions - 1, col) + ql.bubbleR;
      ctx.fillStyle = OPEN_GRAY;
      ctx.font = `italic ${openFont}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(openLabel, (x0 + x1) / 2, cy);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      continue;
    }

    // burbujas de opciones
    for (let o = 0; o < ql.numOptions; o++) {
      const marked = !!(marks.filled && marks.answers?.[q] === o);
      const cx = ql.optX(o, col);
      bubble(ctx, cx, cy, ql.bubbleR, marked);
      if (!marked) {
        // letra en gris claro dentro de la burbuja
        ctx.fillStyle = GRAY;
        ctx.font = `${lblFont}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(ql.labels[o], cx, cy);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }
    }
  }
}
