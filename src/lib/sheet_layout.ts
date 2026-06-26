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

// Esquinas en orden TL, TR, BR, BL (coincide con el orden del motor).
export const CORNER_CENTERS: [number, number][] = [
  [70, 70],
  [SHEET_W - 70, 70],
  [SHEET_W - 70, SHEET_H - 70],
  [70, SHEET_H - 70],
];

// Anclas intermedias: RETIRADAS. El motor nunca las usaba (auditorías P1-6) y,
// peor, las laterales caen dentro de las zonas de búsqueda de esquinas (28% y 72%
// de alto) y el detector las confundía con esquinas → cuadriláteros falsos en
// fotos reales. Se vuelve a 4 esquinas + pista de temporización (que sí registra).
// Para registro por bloques futuro habría que detectarlas explícitamente (Fase 4).
export const EDGE_ANCHORS: [number, number][] = [];

export const ALL_ANCHORS: [number, number][] = [...CORNER_CENTERS, ...EDGE_ANCHORS];

// ─── Cabecera ───
export const NAME_X = 130, NAME_Y = 110, NAME_W = 430, NAME_H = 44;

// ─── Grilla de ID (3 filas x 10 col) ───
export const ID_X0 = 200;     // centro de la primera columna
export const ID_Y0 = 210;     // centro de la primera fila
export const ID_STEP = 30;
export const ID_R = 9;

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

/** Centro X de la columna c de la grilla de ID. */
export function idX(c: number): number {
  return ID_X0 + c * ID_STEP;
}

/** Centro Y de la fila r de la grilla de ID. */
export function idY(r: number): number {
  return ID_Y0 + r * ID_STEP;
}
