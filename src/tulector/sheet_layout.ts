/**
 * Layout canonico de la hoja TuLector v2 (diseño propio, principios OMR robustos).
 *
 * UNICA fuente de verdad de posiciones. La usan:
 *   - el generador de hoja (src/app/sheet/page.tsx via sheet_render.ts)
 *   - el motor (src/lib/omr.ts)
 *   - el generador de fixture de prueba (scripts/gen_fixture.ts)
 *   - el motor nativo (mobile/native/omr_engine.cpp) replica estos numeros.
 *
 * Diseño (inspirado en principios OMR, NO copiado):
 *   - 4 anclas de esquina SOLIDAS (blob denso e inequivoco para detectar).
 *   - 8 anclas intermedias SOLIDAS (12 zonas en total) que enmarcan la grilla
 *     → permiten validar formato y registro local por bloque.
 *   - Pista de temporizacion: una marca solida por fila de pregunta en el margen
 *     izquierdo → ancla fisicamente el Y de cada fila (registro robusto).
 *   - Letra de opcion en GRIS CLARO dentro de la burbuja (no contamina el score).
 */

export const SHEET_W = 1200;
export const SHEET_H = 1650;

export const NUM_QUESTIONS = 20;
export const NUM_OPTIONS = 5;
export const OPTION_LABELS = "ABCDE";

export const ID_ROWS = 3;
export const ID_COLS = 10;

// ─── Anclas solidas ───
export const ANCHOR_SIZE = 40;   // lado del cuadrado solido de esquina/borde
export const ANCHOR_HALF = ANCHOR_SIZE / 2;

// ─── Grilla de anclas 3×4 (12 zonas) para registro POR BLOQUES (warp bilineal) ──
// Las 4 esquinas + 8 anclas intermedias en una grilla. Posiciones elegidas para
// caer en zonas en blanco (no chocan con NOMBRE, RUT ni preguntas). El warp por
// bloques rectifica cada celda con sus 4 anclas locales → corrige la deformación
// del centro/arriba que el warp de 4 esquinas dejaba (donde se perdía el RUT).
export const ANCHOR_GRID_X = [70, 580, SHEET_W - 70];          // 3 columnas: 70, 580, 1130
export const ANCHOR_GRID_Y = [70, 640, 1100, SHEET_H - 70];    // 4 filas: 70, 640, 1100, 1580

// Las 12 anclas en orden FILA-mayor (fila 0 izq→der, luego fila 1, ...).
export const GRID_ANCHORS: [number, number][] = (() => {
  const out: [number, number][] = [];
  for (const y of ANCHOR_GRID_Y) for (const x of ANCHOR_GRID_X) out.push([x, y]);
  return out;
})();

// Esquinas en orden TL, TR, BR, BL (lo que consume el motor: warp/validateFormat).
export const CORNER_CENTERS: [number, number][] = [
  [ANCHOR_GRID_X[0], ANCHOR_GRID_Y[0]],                        // TL
  [ANCHOR_GRID_X[2], ANCHOR_GRID_Y[0]],                        // TR
  [ANCHOR_GRID_X[2], ANCHOR_GRID_Y[3]],                        // BR
  [ANCHOR_GRID_X[0], ANCHOR_GRID_Y[3]],                        // BL
];

// Las 8 anclas intermedias (no esquina).
const isCornerAnchor = (x: number, y: number) =>
  (x === ANCHOR_GRID_X[0] || x === ANCHOR_GRID_X[2]) && (y === ANCHOR_GRID_Y[0] || y === ANCHOR_GRID_Y[3]);
export const EDGE_ANCHORS: [number, number][] = GRID_ANCHORS.filter(([x, y]) => !isCornerAnchor(x, y));

// El render dibuja las 12.
export const ALL_ANCHORS: [number, number][] = GRID_ANCHORS;

// ─── Cabecera ───
export const NAME_X = 130, NAME_Y = 110, NAME_W = 430, NAME_H = 44;

// ─── Código de hoja (franja OMR-nativa; ver docs/codigo-hoja-spec.md) ───
// Banda superior, bajo las esquinas y la caja de NOMBRE; 46 celdas a lo ancho.
export const CODE_Y = 180;      // centro Y de la franja
export const CODE_X0 = 110;     // centro X de la primera celda
export const CODE_CELL = 16;    // lado del cuadrado impreso
export const CODE_STEP = 22;    // separacion horizontal entre celdas (centro a centro)
export const CODE_R = 6;        // radio de muestreo del motor por celda (interior a la celda)
export const CODE_CELLS = 46;   // total de celdas (ver sheet_code.ts)

/** Centro X de la celda i del código de hoja. */
export function codeCellX(i: number): number {
  return CODE_X0 + i * CODE_STEP;
}

// ─── Grilla de ID (3 filas x 10 col) — LEGADO, reemplazado por RUT ───
export const ID_X0 = 200;     // centro de la primera columna
export const ID_Y0 = 210;     // centro de la primera fila
export const ID_STEP = 30;
export const ID_R = 9;

// ─── Grilla de RUT (Chile): 8 columnas de digito + 1 de digito verificador ───
// Columna por digito: el alumno marca un digito (0-9) por columna. La columna DV
// agrega K (cuando el modulo 11 da 10). Ubicada a la derecha (zona libre).
export const RUT_DIGITS = 8;            // columnas de digito (cuerpo del RUT)
export const RUT_COLS = RUT_DIGITS + 1; // + columna del digito verificador (DV)
export const RUT_X0 = 640;              // centro X de la primera columna
export const RUT_COL_STEP = 44;         // (era 40) burbujas mas grandes → mas separacion
export const RUT_Y0 = 252;              // centro Y de la fila del digito 0
export const RUT_ROW_STEP = 34;         // (era 27) holgura entre filas para tolerar jitter de warp
export const RUT_ROWS = 10;             // digitos 0..9 (la columna DV agrega K en la fila 10)
export const RUT_K_ROW = 10;            // fila de la K (solo columna DV)
export const RUT_R = 11;                // (era 8) radio de burbuja y de muestreo; mas robusto al registro

/** Centro X de la columna c del RUT (0..RUT_COLS-1; la ultima es el DV). */
export function rutColX(c: number): number {
  return RUT_X0 + c * RUT_COL_STEP;
}

/** Centro Y de la fila del digito d (0..9, o 10 para la K del DV). */
export function rutRowY(d: number): number {
  return RUT_Y0 + d * RUT_ROW_STEP;
}

// ─── Grilla de preguntas ───
export const Q_TOP = 340;     // Y del centro de la fila 1 (q=0) menos el offset interno
export const ROW_H = 60;      // separacion vertical entre filas
export const BUBBLE_R = 15;
export const OPT_X0 = 200;    // centro de la opcion A
export const OPT_STEP = 64;   // separacion horizontal entre opciones (A..E)
export const QNUM_X = 150;    // numero de pregunta (texto)

// ─── Pista de temporizacion (una marca por fila) ───
export const TIMING_X = 120;  // centro X de la columna de marcas
export const TIMING_W = 26;   // ancho de cada marca
export const TIMING_H = 16;   // alto de cada marca

/** Centro X de la opcion o (0=A .. 4=E). */
export function optX(o: number): number {
  return OPT_X0 + o * OPT_STEP;
}

/** Centro Y de la fila de la pregunta q (teorico, antes del registro por temporizacion). */
export function rowCY(q: number): number {
  return Q_TOP + q * ROW_H + 14;
}

// ─── Layout PARAMÉTRICO (Fase C) ───────────────────────────────
// Una sola columna por ahora; multi-columna es el siguiente incremento.
// El default (20 preguntas / 5 opciones) reproduce EXACTAMENTE la hoja actual.
export interface SheetConfig {
  numQuestions: number;   // 1..~40 en una columna
  numOptions: number;     // 3 | 4 | 5
}

export const DEFAULT_SHEET: SheetConfig = { numQuestions: NUM_QUESTIONS, numOptions: NUM_OPTIONS };

export interface QLayout {
  numQuestions: number;
  numOptions: number;
  labels: string;
  rowH: number;        // separacion entre filas (ajustada al nº de preguntas)
  bubbleR: number;     // radio de burbuja en la hoja
  gradeR: number;      // radio de muestreo del motor
  qTop: number;
  rowCY(q: number): number;
  optX(o: number): number;
}

const Q_AREA = 1200; // espacio vertical para preguntas (340 → 1540). 20*60 = 1200 (default exacto).

/** Layout de la grilla de preguntas calculado desde el config. */
export function questionLayout(cfg: SheetConfig = DEFAULT_SHEET): QLayout {
  const n = Math.max(1, cfg.numQuestions);
  const rowH = Math.max(30, Math.min(ROW_H, Math.floor(Q_AREA / n)));   // n=20 → 60 (exacto)
  const bubbleR = Math.max(10, Math.min(BUBBLE_R, Math.round(rowH / 2) - 3)); // rowH 60 → 15
  const gradeR = Math.max(6, Math.min(10, bubbleR - 5));                 // bubbleR 15 → 10
  const rowOff = Math.round(rowH * 0.23);                                // 60 → 14
  return {
    numQuestions: n,
    numOptions: cfg.numOptions,
    labels: OPTION_LABELS.slice(0, cfg.numOptions),
    rowH, bubbleR, gradeR, qTop: Q_TOP,
    rowCY: (q) => Q_TOP + q * rowH + rowOff,
    optX: (o) => OPT_X0 + o * OPT_STEP,
  };
}

/** Centro X de la columna c de la grilla de ID. */
export function idX(c: number): number {
  return ID_X0 + c * ID_STEP;
}

/** Centro Y de la fila r de la grilla de ID. */
export function idY(r: number): number {
  return ID_Y0 + r * ID_STEP;
}
