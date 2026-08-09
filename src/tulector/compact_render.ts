/**
 * Dibujo del BLOQUE COMPACTO. Funcion pura sobre un contexto Canvas2D, igual
 * que sheet_render.ts: el mismo codigo sirve en el navegador (generador de la
 * imagen que el profesor pega en su prueba) y en Node con `canvas` (fixtures de
 * test). Asi el bloque impreso y el de los tests no pueden divergir.
 *
 * Reusa la interfaz Ctx2D de sheet_render.ts (ya exportada) y el codec de
 * sheet_code.ts SIN modificarlos.
 */
import * as C from "./compact_layout";
import { type Ctx2D } from "./sheet_render";
import { encodeSheetCode, type SheetCodeData } from "./sheet_code";

const BLACK = "#000000";
const WHITE = "#ffffff";
const GRAY = "#b8b8b8";  // contorno/letra de burbuja: no contamina el score del motor

export interface CompactMarks {
  /** Respuesta marcada por pregunta (indice 0..numOptions-1) o -1 si en blanco. */
  answers?: number[];
  /** Si true, rellena las marcas (fixtures de test / vista previa). */
  filled?: boolean;
  /** Codigo de hoja a imprimir (ata el bloque a su ensayo). */
  code?: SheetCodeData;
}

/**
 * Finder pattern tipo QR: cuadrados concentricos en proporcion 1:1:3:1:1
 * (7 modulos de lado). Cualquier linea que pase por el centro devuelve esa
 * secuencia de runs — es lo que busca findCompactBlockCorners().
 */
function drawFinder(ctx: Ctx2D, cx: number, cy: number): void {
  const m = C.FINDER_MODULE;
  const box = (halfModules: number, color: string) => {
    const s = halfModules * m * 2;
    ctx.fillStyle = color;
    ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
  };
  box(3.5, BLACK);  // 7m: anillo exterior negro
  box(2.5, WHITE);  // 5m: anillo blanco
  box(1.5, BLACK);  // 3m: nucleo negro
}

/**
 * Marca de alineacion (esquina BR): 5 modulos, deliberadamente distinta de un
 * finder. Es lo que rompe la simetria de las 4 esquinas y fija la orientacion.
 */
function drawAlign(ctx: Ctx2D, cx: number, cy: number): void {
  const m = C.ALIGN_MODULE;
  const box = (halfModules: number, color: string) => {
    const s = halfModules * m * 2;
    ctx.fillStyle = color;
    ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
  };
  box(2.5, BLACK);  // 5m
  box(1.5, WHITE);  // 3m
  box(0.5, BLACK);  // 1m
}

function bubble(ctx: Ctx2D, cx: number, cy: number, r: number, fill: boolean): void {
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

/** Franja del codigo de hoja: 46 celdas en 2 filas de 23 (llena=1, contorno tenue=0). */
export function drawCompactCode(ctx: Ctx2D, data: SheetCodeData): void {
  const bits = encodeSheetCode(data);
  const s = C.CODE_CELL, half = s / 2;
  for (let i = 0; i < bits.length; i++) {
    const [x, y] = C.codeCell(i);
    if (bits[i]) {
      ctx.fillStyle = BLACK;
      ctx.fillRect(x - half, y - half, s, s);
    } else {
      // Contorno tenue: marca la celda visualmente sin contaminar el muestreo
      // (el motor muestrea solo el interior, radio CODE_R < half).
      ctx.strokeStyle = GRAY;
      ctx.lineWidth = 1;
      ctx.strokeRect(x - half, y - half, s, s);
    }
  }
}

/**
 * Dibuja el bloque compacto completo sobre un canvas de BLOCK_W x BLOCK_H.
 * El fondo blanco es parte del bloque (garantiza la zona de aislamiento de los
 * finders aunque el profesor pegue texto pegado al borde).
 */
export function drawCompactBlock(
  ctx: Ctx2D,
  marks: CompactMarks = {},
  cfg: C.CompactConfig = C.DEFAULT_COMPACT,
): void {
  ctx.fillStyle = WHITE;
  ctx.fillRect(0, 0, C.BLOCK_W, C.BLOCK_H);

  // ─── Marcas de localizacion: 3 finders + 1 alineacion ───
  for (const [cx, cy] of C.FINDER_CENTERS) drawFinder(ctx, cx, cy);
  drawAlign(ctx, C.ALIGN_CENTER[0], C.ALIGN_CENTER[1]);

  // ─── Codigo de hoja ───
  if (marks.code) drawCompactCode(ctx, marks.code);

  // ─── Grilla de preguntas + pista de temporizacion ───
  const ql = C.compactQuestionLayout(cfg);
  const numFont = Math.max(11, Math.round(ql.rowH * 0.27));
  const lblFont = Math.max(9, Math.round(ql.bubbleR * 0.85));

  // Una marca solida por fila; todas las columnas comparten esos Y.
  ctx.fillStyle = BLACK;
  for (let row = 0; row < ql.rowsPerCol; row++) {
    const cy = ql.rowCY(row);
    ctx.fillRect(C.TIMING_X - C.TIMING_W / 2, cy - C.TIMING_H / 2, C.TIMING_W, C.TIMING_H);
  }

  for (let q = 0; q < ql.numQuestions; q++) {
    const col = ql.colOf(q), cy = ql.rowCY(ql.rowOf(q));

    ctx.fillStyle = BLACK;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = `${numFont}px sans-serif`;
    ctx.fillText(`${q + 1}`, ql.qnumX(col), cy + 6);

    for (let o = 0; o < ql.numOptions; o++) {
      const marked = !!(marks.filled && marks.answers?.[q] === o);
      const cx = ql.optX(o, col);
      bubble(ctx, cx, cy, ql.bubbleR, marked);
      if (!marked) {
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
