/**
 * Layout canonico de la hoja TuLector v2 (diseño propio, principios OMR robustos).
 *
 * UNICA fuente de verdad de posiciones. La usan:
 *   - el generador de hoja (src/app/sheet/page.tsx via sheet_render.ts)
 *   - el motor (src/lib/omr.ts)
 *   - el generador de fixture de prueba (scripts/gen_fixture.ts)
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

// Pista de temporizacion PROPIA del RUT: una marca solida por fila (0..9 + K),
// a la izquierda de la grilla. Ancla el Y de cada fila igual que la pista de las
// preguntas → el RUT deja de fallar en frames movidos (lecturas parciales).
export const RUT_TIMING_X = 588;        // centro X de la columna de marcas del RUT
export const RUT_TIMING_W = 18;         // ancho de cada marca
export const RUT_TIMING_H = 14;         // alto de cada marca
export const RUT_TIMING_ROWS = RUT_ROWS + 1; // 11: digitos 0..9 + fila K

/** Centro X de la columna c del RUT (0..RUT_COLS-1; la ultima es el DV). */
export function rutColX(c: number): number {
  return RUT_X0 + c * RUT_COL_STEP;
}

/** Centro Y de la fila del digito d (0..9, o 10 para la K del DV). */
export function rutRowY(d: number): number {
  return RUT_Y0 + d * RUT_ROW_STEP;
}

// ─── Bloque de ID nacional PARAMÉTRICO (multi-país) ────────────
// La grilla (rutColX/rutRowY, misma separacion de pixeles) es comun a todos los
// paises; lo que cambia es CUANTAS columnas/filas se dibujan y cuantos digitos
// verificadores tiene. RUT (Chile) es el caso por defecto: 8 digitos + 1 DV con
// K. CPF (Brasil) necesita DOS columnas de digito verificador (no una) — de ahi
// que sea un contador y no un boolean.
export interface IdBlockConfig {
  idLabel: string;          // etiqueta impresa ("R.U.T.", "DNI", "CPF", ...)
  idDigits: number;         // digitos del cuerpo (columnas de digito puro)
  checkDigits: number;      // 0, 1 (RUT/CPF chileno-style) o 2 (CPF) columnas de DV
  hasLetterDigit: boolean;  // la ULTIMA columna de DV admite letra (K chilena) ademas de 0-9
}

export const ID_BLOCK_CL: IdBlockConfig = {
  idLabel: "R.U.T.", idDigits: RUT_DIGITS, checkDigits: 1, hasLetterDigit: true,
};

// Argentina: DNI de 7-8 digitos, SIN digito verificador (investigacion-argentina.md).
export const ID_BLOCK_AR: IdBlockConfig = {
  idLabel: "DNI", idDigits: 8, checkDigits: 0, hasLetterDigit: false,
};

// Brasil: CPF de 9 digitos de cuerpo + 2 digitos verificadores modulo-11 en
// dos pasadas (investigacion-brasil.md:134-155) — algoritmo distinto al RUT.
export const ID_BLOCK_BR: IdBlockConfig = {
  idLabel: "CPF", idDigits: 9, checkDigits: 2, hasLetterDigit: false,
};

// Peru: DNI de 8 digitos, SIN digito verificador (investigacion-peru.md:15,135-160).
export const ID_BLOCK_PE: IdBlockConfig = {
  idLabel: "DNI", idDigits: 8, checkDigits: 0, hasLetterDigit: false,
};

// Colombia: CC de 6-10 digitos (largo variable), SIN digito verificador
// (investigacion-colombia.md:139-148). 10 columnas, igual que Argentina admite
// largo variable dentro de la grilla (los digitos que faltan quedan sin marcar
// a la izquierda, alineado a la derecha).
export const ID_BLOCK_CO: IdBlockConfig = {
  idLabel: "CC", idDigits: 10, checkDigits: 0, hasLetterDigit: false,
};

// Ecuador: Cedula de 10 digitos = 9 de cuerpo + 1 digito verificador modulo-10
// con coeficientes [2,1,2,1,2,1,2,1,2] (investigacion-ecuador.md:150-179).
export const ID_BLOCK_EC: IdBlockConfig = {
  idLabel: "Cedula", idDigits: 9, checkDigits: 1, hasLetterDigit: false,
};

// Uruguay: CI de 8 digitos = 7 de cuerpo + 1 digito verificador modulo-10 con
// multiplicadores [2,9,8,7,6,3,4,1] (investigacion-uruguay.md:107-127).
export const ID_BLOCK_UY: IdBlockConfig = {
  idLabel: "CI", idDigits: 7, checkDigits: 1, hasLetterDigit: false,
};

export function idBlockCols(cfg: IdBlockConfig): number {
  return cfg.idDigits + cfg.checkDigits;
}

/** Filas (digitos posibles) de la columna c: 10, u 11 si es la ULTIMA columna de DV y admite letra. */
export function idBlockRowsForCol(cfg: IdBlockConfig, c: number): number {
  const isLastCheckCol = cfg.checkDigits > 0 && c === idBlockCols(cfg) - 1;
  return isLastCheckCol && cfg.hasLetterDigit ? RUT_ROWS + 1 : RUT_ROWS;
}

/** Filas de la pista de temporizacion compartida (la mas larga de todas las columnas). */
export function idBlockTimingRows(cfg: IdBlockConfig): number {
  return cfg.checkDigits > 0 && cfg.hasLetterDigit ? RUT_ROWS + 1 : RUT_ROWS;
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
// Soporta 1 o 2 columnas. numColumns=1 (default) reproduce EXACTAMENTE la hoja
// actual (RUT arriba-derecha, preguntas arriba-izquierda, Q_TOP=340). En 2
// columnas la columna derecha chocaria con el bloque RUT, asi que las preguntas
// arrancan DEBAJO del RUT (ancho completo) → mas preguntas (hasta ~60).
export interface SheetConfig {
  numQuestions: number;   // 1..~60
  numOptions: number;     // 3 | 4 | 5
  numColumns?: number;    // 1 (default) | 2 | 3 | 4
  idBlock?: IdBlockConfig; // ID nacional a dibujar (default ID_BLOCK_CL = RUT)
  /** Preguntas de desarrollo (1-indexadas, numeracion LOCAL de ESTA hoja):
   *  la fila conserva numero y marca de temporizacion pero SIN burbujas —
   *  imprime la instruccion "resolver al reverso". Ausente/vacio = hoja
   *  100% de alternativas (render identico al actual). */
  openQuestions?: number[];
}

export const DEFAULT_SHEET: SheetConfig = { numQuestions: NUM_QUESTIONS, numOptions: NUM_OPTIONS };

export interface QLayout {
  numQuestions: number;
  numOptions: number;
  numColumns: number;
  rowsPerCol: number;  // filas por columna (= nº de marcas de temporizacion)
  labels: string;
  rowH: number;        // separacion entre filas (ajustada al nº de filas)
  bubbleR: number;     // radio de burbuja en la hoja
  gradeR: number;      // radio de muestreo del motor
  qTop: number;
  colOf(q: number): number;   // columna de la pregunta q (column-major)
  rowOf(q: number): number;   // fila (0..rowsPerCol-1) de la pregunta q
  rowCY(row: number): number; // centro Y de la fila (0..rowsPerCol-1)
  optX(o: number, col?: number): number; // centro X de la opcion o en la columna col
  qnumX(col: number): number; // X del numero de pregunta de la columna col
}

const Q_BOTTOM = 1540;          // borde inferior del area de preguntas
const Q_MULTICOL_TOP = 620;     // las preguntas multi-columna arrancan bajo el RUT

// Geometria horizontal por nº de columnas (evita las 3 anclas verticales en
// x=70, x=580, x=1130 — cada una ocupa ±20px). Hay 2 franjas libres entre
// anclas: [90,560] y [600,1110]. 1 y 2 columnas usan 1 columna por franja
// (espaciado holgado, igual que hoy). 3 y 4 columnas SUBDIVIDEN cada franja en
// 2 sub-columnas con paso mas angosto (38px) — la densidad VERTICAL (filas,
// radio de burbuja) no cambia nada, sigue viniendo de rowsPerCol como siempre;
// esto es prueba de que 4 columnas x 25 filas = 100 preguntas en 1 hoja, con
// la MISMA fila/burbuja ya validada por el barrido en 50q/2col (ver guardia
// "100-question / 4-column" en test_omr_real.ts).
const COL_GEOM: Record<number, { qnum: number[]; optX0: number[]; optStep: number }> = {
  1: { qnum: [QNUM_X], optX0: [OPT_X0], optStep: OPT_STEP },
  2: { qnum: [150, 648], optX0: [195, 700], optStep: 58 },
  3: { qnum: [150, 355, 620], optX0: [178, 383, 648], optStep: 34 },
  4: { qnum: [150, 355, 620, 855], optX0: [178, 383, 648, 883], optStep: 34 },
};

/** Layout de la grilla de preguntas calculado desde el config. */
export function questionLayout(cfg: SheetConfig = DEFAULT_SHEET): QLayout {
  const numColumns = Math.max(1, Math.min(4, cfg.numColumns ?? 1));
  const n = Math.max(1, cfg.numQuestions);
  const rowsPerCol = Math.ceil(n / numColumns);
  const qTop = numColumns === 1 ? Q_TOP : Q_MULTICOL_TOP;
  const qArea = Q_BOTTOM - qTop;                                            // 1 col → 1200
  const rowH = Math.max(30, Math.min(ROW_H, Math.floor(qArea / rowsPerCol))); // 20 filas → 60
  const bubbleR = Math.max(10, Math.min(BUBBLE_R, Math.round(rowH / 2) - 3));
  const gradeR = Math.max(6, Math.min(10, bubbleR - 5));
  const rowOff = Math.round(rowH * 0.23);
  const g = COL_GEOM[numColumns];
  return {
    numQuestions: n,
    numOptions: cfg.numOptions,
    numColumns, rowsPerCol,
    labels: OPTION_LABELS.slice(0, cfg.numOptions),
    rowH, bubbleR, gradeR, qTop,
    colOf: (q) => Math.floor(q / rowsPerCol),
    rowOf: (q) => q % rowsPerCol,
    rowCY: (row) => qTop + row * rowH + rowOff,
    optX: (o, col = 0) => g.optX0[col] + o * g.optStep,
    qnumX: (col) => g.qnum[col],
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
