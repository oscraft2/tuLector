/**
 * Dibujo de la hoja TuLector v2. Funcion pura sobre un contexto Canvas2D, asi
 * el mismo codigo sirve en el navegador (generador/descarga) y en Node con
 * `canvas` (generacion del fixture de prueba). Esto garantiza que la hoja
 * impresa y la imagen de test sean identicas (no pueden divergir).
 */
import * as L from "./sheet_layout";

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
  /** ID: para cada fila, set de columnas marcadas (0..9). */
  idMarks?: number[][];
  /** Si true, rellena las marcas (para el fixture de prueba). */
  filled?: boolean;
}

const BLACK = "#000000";
const GRAY = "#b8b8b8";   // contorno/letras de burbuja: gris claro, no negro

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

export function drawSheet(ctx: Ctx2D, marks: SheetMarks = {}): void {
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

  // ─── Grilla de ID (3 x 10) ───
  ctx.font = "14px sans-serif";
  ctx.fillStyle = BLACK;
  ctx.fillText("ID", L.ID_X0 - 60, L.ID_Y0 + 5);
  for (let r = 0; r < L.ID_ROWS; r++) {
    ctx.fillStyle = BLACK;
    ctx.fillText(String(r), L.idX(0) - 28, L.idY(r) + 5);
    for (let c = 0; c < L.ID_COLS; c++) {
      const marked = !!(marks.filled && marks.idMarks?.[r]?.includes(c));
      bubble(ctx, L.idX(c), L.idY(r), L.ID_R, marked);
    }
  }

  // ─── Pista de temporizacion + grilla de preguntas ───
  for (let q = 0; q < L.NUM_QUESTIONS; q++) {
    const cy = L.rowCY(q);

    // marca de temporizacion (solida) alineada a la fila
    ctx.fillStyle = BLACK;
    ctx.fillRect(L.TIMING_X - L.TIMING_W / 2, cy - L.TIMING_H / 2, L.TIMING_W, L.TIMING_H);

    // numero de pregunta
    ctx.fillStyle = BLACK;
    ctx.font = "16px sans-serif";
    ctx.fillText(`${q + 1}`, L.QNUM_X, cy + 6);

    // burbujas de opciones
    for (let o = 0; o < L.NUM_OPTIONS; o++) {
      const marked = !!(marks.filled && marks.answers?.[q] === o);
      const cx = L.optX(o);
      bubble(ctx, cx, cy, L.BUBBLE_R, marked);
      if (!marked) {
        // letra en gris claro dentro de la burbuja
        ctx.fillStyle = GRAY;
        ctx.font = "13px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(L.OPTION_LABELS[o], cx, cy);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      }
    }
  }
}
