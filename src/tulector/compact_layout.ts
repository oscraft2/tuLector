/**
 * Layout canonico del BLOQUE COMPACTO (sub-motor OMR embebible).
 *
 * Es el espejo de sheet_layout.ts para un canvas CHICO que el profesor pega
 * dentro de su propia prueba (Word/Canva) junto a contenido que TuLector no
 * conoce. NO comparte geometria con la hoja completa: aquella asume pagina
 * entera con 12 anclas solidas en offsets absolutos de 1200x1650.
 *
 * Diferencias de diseño respecto de la hoja completa (y por que):
 *   - Marcas de esquina = FINDER PATTERNS tipo QR (1:1:3:1:1) en vez de
 *     cuadrados solidos. Un cuadrado solido es indistinguible de un logo o de
 *     una celda de tabla rellena; la firma concentrica 1:1:3:1:1 es la tecnica
 *     estandar para localizar una marca dentro de una imagen con contenido
 *     arbitrario alrededor (es lo que hace funcionar a los QR).
 *   - 3 finders (TL, TR, BL) + 1 marca de ALINEACION mas chica en BR. Con 4
 *     marcas identicas la orientacion es ambigua (el bloque pegado en Word
 *     puede quedar rotado 180°); con el esquema 3+1 la orientacion se deduce
 *     sola, igual que en un QR.
 *   - Canvas de tamaño FIJO. El detector valida el cuadrilatero candidato
 *     contra UNA relacion de aspecto conocida; permitir tamaños variables
 *     debilitaria esa validacion, que es justo la defensa contra falsos
 *     positivos (logos, recuadros) en la hoja del profesor.
 *
 * UNICA fuente de verdad de posiciones del bloque. La usan el render
 * (compact_render.ts), el sub-motor (compact_block.ts) y los tests.
 */

// ─── Canvas canonico ───────────────────────────────────────────
// Tamaño fijo. A 300 DPI son 98.2 x 76.2 mm: aprox. media pagina de ancho y un
// cuarto de alto, que es lo que cabe comodo pegado en una prueba de Word.
export const BLOCK_W = 1160;
export const BLOCK_H = 900;

/** DPI al que se declara el PNG exportado (chunk pHYs) para que Word no reescale. */
export const BLOCK_DPI = 300;

/** Milimetros impresos de una medida en px canonicos (a BLOCK_DPI). */
export function pxToMm(px: number): number {
  return (px / BLOCK_DPI) * 25.4;
}

export const BLOCK_W_MM = pxToMm(BLOCK_W); // 98.2
export const BLOCK_H_MM = pxToMm(BLOCK_H); // 76.2

// ─── Finder patterns (marcas de localizacion) ──────────────────
// Un finder son 7 modulos de lado: negro(1) blanco(1) negro(3) blanco(1) negro(1)
// medido por cualquier linea que pase por su centro. El detector busca justamente
// esa secuencia de proporciones, que es invariante a escala y (casi) a rotacion.
export const FINDER_MODULE = 12;
export const FINDER_SIZE = FINDER_MODULE * 7;   // 84 px = 7.1 mm impresos
export const FINDER_HALF = FINDER_SIZE / 2;

// Marca de alineacion (BR): 5 modulos, negro(1) blanco(1) negro(1) blanco(1) negro(1).
// Deliberadamente DISTINTA de un finder para que la esquina BR no se confunda
// con las otras tres y la orientacion quede determinada.
export const ALIGN_MODULE = 12;
export const ALIGN_SIZE = ALIGN_MODULE * 5;     // 60 px
export const ALIGN_HALF = ALIGN_SIZE / 2;

// Centro de las marcas respecto del borde del bloque. Deja 38 px (~3.2 modulos)
// de zona blanca alrededor de cada finder DENTRO del propio bloque: el render
// pinta siempre ese fondo, asi el aislamiento de la marca no depende de que el
// profesor deje espacio al pegarlo en su documento.
export const MARK_INSET = 80;

/** Aislamiento minimo que hay que respetar alrededor de cualquier marca. */
export const QUIET_ZONE = 38;

/** Centros de los 3 finders, en orden TL, TR, BL. */
export const FINDER_CENTERS: [number, number][] = [
  [MARK_INSET, MARK_INSET],                 // TL
  [BLOCK_W - MARK_INSET, MARK_INSET],       // TR
  [MARK_INSET, BLOCK_H - MARK_INSET],       // BL
];

/** Centro de la marca de alineacion (BR). */
export const ALIGN_CENTER: [number, number] = [BLOCK_W - MARK_INSET, BLOCK_H - MARK_INSET];

/**
 * Las 4 esquinas en el orden que consume el warp: TL, TR, BR, BL — misma
 * convencion que CORNER_CENTERS de la hoja completa, asi el codigo de escaneo
 * que hoy pasa `corners` no cambia de forma.
 */
export const BLOCK_CORNERS: [number, number][] = [
  FINDER_CENTERS[0],  // TL
  FINDER_CENTERS[1],  // TR
  ALIGN_CENTER,       // BR
  FINDER_CENTERS[2],  // BL
];

/** Relacion de aspecto canonica del cuadrilatero de marcas (ancho/alto). */
export const MARK_ASPECT = (BLOCK_W - 2 * MARK_INSET) / (BLOCK_H - 2 * MARK_INSET);

// ─── Franja del codigo de hoja (mini sheet_code) ───────────────
// Se reusa el codec de 46 celdas SIN cambios (sheet_code.ts), pero dispuesto en
// 2 FILAS de 23 celdas. En una sola fila el paso quedaria ~1 mm impreso (contra
// 2.9 mm en la hoja completa) y seria el primer punto de falla al fotografiar;
// en 2 filas el paso se mantiene comodo dentro del ancho disponible.
export const CODE_ROWS = 2;
export const CODE_PER_ROW = 23;
export const CODE_CELL = 18;       // lado del cuadrado impreso
export const CODE_STEP = 26;       // separacion horizontal entre celdas
export const CODE_R = 6;           // radio de muestreo del motor (interior a la celda)
export const CODE_X0 = 200;        // centro X de la primera celda de cada fila
export const CODE_Y0 = 52;         // centro Y de la fila 0
export const CODE_ROW_STEP = 40;   // separacion vertical entre las 2 filas

// ─── Zonas libres para texto del generador ────────────────────
// El generador (src/lib/compact_block_generator.ts) escribe SOLO aca, igual que
// sheet_generator.ts hace con la hoja completa: son las unicas bandas del bloque
// que no tienen marcas, franja de codigo ni burbujas. Se derivan de la geometria
// (no son numeros sueltos) para que sigan siendo validas si el layout cambia.

/** Banda inferior, DEBAJO de las dos marcas de abajo. Para la guia anti-reescalado. */
export const CAPTION_BAND = {
  yTop: BLOCK_H - MARK_INSET + FINDER_HALF + 4,   // 866
  baseline: BLOCK_H - 12,                          // 888
  xFrom: 40,
  xTo: BLOCK_W - 40,
};

/** Hueco superior entre el fin de la franja del codigo y el aislamiento del finder TR. */
export const LABEL_ZONE = {
  xFrom: 800,
  xTo: BLOCK_W - MARK_INSET - FINDER_HALF - QUIET_ZONE, // 1000
  baseline: MARK_INSET - 4,                             // 76
};

/** Centro (x, y) de la celda i (0..45) de la franja del codigo. */
export function codeCell(i: number): [number, number] {
  const row = Math.floor(i / CODE_PER_ROW);
  const col = i % CODE_PER_ROW;
  return [CODE_X0 + col * CODE_STEP, CODE_Y0 + row * CODE_ROW_STEP];
}

// ─── Grilla de preguntas ───────────────────────────────────────
export const COMPACT_MAX_QUESTIONS = 30;

const Q_TOP = 175;      // primera fila arranca bajo la banda de finders/codigo
const Q_BOTTOM = 770;   // ultima fila termina sobre la banda inferior de marcas
export const Q_AREA_H = Q_BOTTOM - Q_TOP;

export const BUBBLE_R = 17;
export const ROW_H = 60;

// Pista de temporizacion: una marca solida por fila, a la izquierda de la grilla.
// Ancla fisicamente el Y de cada fila (mismo principio que la hoja completa).
export const TIMING_X = 90;
export const TIMING_W = 26;
export const TIMING_H = 16;

// Geometria horizontal por nº de columnas. Los X arrancan despues de la pista de
// temporizacion (x=90) y terminan antes de la columna de marcas derecha (x≈1048).
const COL_GEOM: Record<number, { qnum: number[]; optX0: number[]; optStep: number }> = {
  1: { qnum: [120], optX0: [200], optStep: 70 },
  2: { qnum: [120, 560], optX0: [175, 615], optStep: 62 },
  3: { qnum: [120, 430, 740], optX0: [165, 475, 785], optStep: 52 },
};

export const OPTION_LABELS = "ABCDE";

// ─── Cuantas filas caben ───────────────────────────────────────
// Alto minimo de fila para que la burbuja siga siendo marcable a mano: por
// debajo de esto la burbuja queda mas chica que la punta del lapiz y el
// muestreo pierde margen. Es un LIMITE FISICO del bloque, no un parametro
// libre — de el sale cuantas preguntas entran por columna.
export const MIN_ROW_H = 30;
export const MAX_ROWS = Math.floor(Q_AREA_H / MIN_ROW_H); // 19

/** Maximo de preguntas que caben con `cols` columnas. */
export function maxQuestionsFor(cols: number): number {
  return Math.min(COMPACT_MAX_QUESTIONS, MAX_ROWS * Math.max(1, Math.min(3, cols)));
}

/** Minimo de columnas necesarias para que entren `n` preguntas. */
export function minColumnsFor(n: number): number {
  for (let cols = 1; cols <= 3; cols++) if (Math.ceil(n / cols) <= MAX_ROWS) return cols;
  return 3;
}

export interface CompactConfig {
  numQuestions: number;    // 1..30
  numOptions: number;      // 2..5
  /** 1 | 2 | 3. Si se omite (o si no alcanza para numQuestions) se usa
   *  minColumnsFor(numQuestions): la grilla NUNCA se desborda del bloque. */
  numColumns?: number;
}

export const DEFAULT_COMPACT: CompactConfig = { numQuestions: 20, numOptions: 5, numColumns: 2 };

export interface CompactQLayout {
  numQuestions: number;
  numOptions: number;
  numColumns: number;
  rowsPerCol: number;
  labels: string;
  rowH: number;
  bubbleR: number;
  gradeR: number;          // radio de muestreo del sub-motor
  colOf(q: number): number;
  rowOf(q: number): number;
  rowCY(row: number): number;
  optX(o: number, col?: number): number;
  qnumX(col: number): number;
}

/** Layout de la grilla de preguntas del bloque, calculado desde el config. */
export function compactQuestionLayout(cfg: CompactConfig = DEFAULT_COMPACT): CompactQLayout {
  const n = Math.max(1, Math.min(COMPACT_MAX_QUESTIONS, cfg.numQuestions));
  // Si el nº de columnas pedido no alcanza para que las filas quepan, se sube al
  // minimo que si alcanza. Sin este ajuste la grilla se dibujaria por debajo de
  // Q_BOTTOM, pisando las marcas de localizacion inferiores y rompiendo la
  // deteccion (no solo la lectura). Render y motor pasan por esta MISMA funcion,
  // asi que nunca pueden discrepar sobre cuantas columnas se usaron.
  const pedido = Math.max(1, Math.min(3, cfg.numColumns ?? minColumnsFor(n)));
  const numColumns = Math.max(pedido, minColumnsFor(n));
  const rowsPerCol = Math.ceil(n / numColumns);
  const rowH = Math.max(MIN_ROW_H, Math.min(ROW_H, Math.floor(Q_AREA_H / rowsPerCol)));
  const bubbleR = Math.max(10, Math.min(BUBBLE_R, Math.round(rowH / 2) - 3));
  const gradeR = Math.max(6, Math.min(10, bubbleR - 5));
  const rowOff = Math.round(rowH * 0.23);
  const g = COL_GEOM[numColumns];
  return {
    numQuestions: n,
    numOptions: cfg.numOptions,
    numColumns, rowsPerCol,
    labels: OPTION_LABELS.slice(0, cfg.numOptions),
    rowH, bubbleR, gradeR,
    colOf: (q) => Math.floor(q / rowsPerCol),
    rowOf: (q) => q % rowsPerCol,
    rowCY: (row) => Q_TOP + row * rowH + rowOff,
    optX: (o, col = 0) => g.optX0[col] + o * g.optStep,
    qnumX: (col) => g.qnum[col],
  };
}
