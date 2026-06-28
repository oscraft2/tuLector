/**
 * Motor OMR - TuLector
 * Pipeline de escaneo OMR:
 *   1. Deteccion de 4 esquinas (blob denso en grilla via imagen integral,
 *      fallback a centro de masa por cuadrante).
 *   2. Correccion de perspectiva (homografia 8-DOF, eliminacion gaussiana 8x8).
 *   3. Registro local de la grilla (offset dx/dy que maximiza la marca) +
 *      clasificador multi-feature por burbuja.
 *   4. Lectura de ID de estudiante (umbral de oscuridad por burbuja).
 *
 * Las constantes de calibracion (CALIB) son la UNICA fuente de verdad y deben
 * mantenerse identicas en el motor nativo (mobile/native/omr_engine.cpp).
 */

import * as L from "./sheet_layout";
import { decodeSheetCode, type SheetCodeData } from "./sheet_code";

export interface OMRConfig {
  numQuestions: number; numOptions: number; optionLabels: string;
  idRows: number; idCols: number;
  sheetWidth: number; sheetHeight: number;
  margin: number; cornerSize: number;
}

export interface BubbleResult {
  question: number; answer: string; scores: number[]; correct: boolean | null;
}

export interface GradeDiag {
  usedTiming: boolean;   // true si el registro uso la pista de temporizacion
  timingRows: number;    // marcas de temporizacion detectadas
  gridDx: number;        // offset horizontal aplicado
}

export interface GradeReport {
  results: BubbleResult[]; valid: boolean; reason?: string; diag?: GradeDiag;
}

// ─── Configuracion ─────────────────────────────────────────────
// Las posiciones canonicas viven en sheet_layout.ts (compartidas con la hoja).
// margin/cornerSize se conservan para la deteccion de esquinas; el grading usa
// directamente los helpers de L (optX, rowCY, idX, idY).
const DEFAULT_CONFIG: OMRConfig = {
  numQuestions: L.NUM_QUESTIONS, numOptions: L.NUM_OPTIONS, optionLabels: L.OPTION_LABELS,
  idRows: L.ID_ROWS, idCols: L.ID_COLS,
  sheetWidth: L.SHEET_W, sheetHeight: L.SHEET_H,
  margin: 50, cornerSize: L.ANCHOR_SIZE,
};
function findCornersByMass(gray: Uint8Array, w: number, h: number): [number, number][] | null {
  const zones: [number, number, number, number][] = [
    [0, 0, Math.floor(w * 0.08), Math.floor(h * 0.06)],
    [Math.floor(w * 0.92), 0, w, Math.floor(h * 0.06)],
    [Math.floor(w * 0.92), Math.floor(h * 0.92), w, h],
    [0, Math.floor(h * 0.92), Math.floor(w * 0.08), h],
  ];

  const corners: [number, number][] = [];
  for (const [x0, y0, x1, y1] of zones) {
    let sx = 0, sy = 0, c = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (gray[y * w + x] < 100) { sx += x; sy += y; c++; }
      }
    }
    if (c < 120) return null;
    corners.push([Math.round(sx / c), Math.round(sy / c)]);
  }

  const [tl, tr, br, bl] = corners;
  const topW = Math.hypot(tr[0] - tl[0], tr[1] - tl[1]);
  const botW = Math.hypot(br[0] - bl[0], br[1] - bl[1]);
  const leftH = Math.hypot(bl[0] - tl[0], bl[1] - tl[1]);
  const rightH = Math.hypot(br[0] - tr[0], br[1] - tr[1]);
  const avgW = (topW + botW) / 2;
  const avgH = (leftH + rightH) / 2;
  const aspect = avgW / Math.max(avgH, 1);
  if (aspect < 0.45 || aspect > 1.2) return null;
  if (topW / Math.max(botW, 1) < 0.3 || botW / Math.max(topW, 1) < 0.3) return null;
  if (leftH / Math.max(rightH, 1) < 0.3 || rightH / Math.max(leftH, 1) < 0.3) return null;
  const area = Math.abs((tr[0] - tl[0]) * (br[1] - tl[1]) - (tr[1] - tl[1]) * (br[0] - tl[0]));
  if (area < 15000) return null;
  if (Math.abs(tl[1] - tr[1]) > h * 0.12) return null;
  if (Math.abs(bl[1] - br[1]) > h * 0.12) return null;

  return corners;
}

/** Umbral de Otsu sobre el histograma de luminancia (binarizacion adaptativa). */
function otsuThreshold(gray: Uint8Array): number {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, maxVar = -1, thr = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) { maxVar = between; thr = t; }
  }
  return thr;
}

function validateQuad(c: [number, number][]): boolean {
  const [tl, tr, br, bl] = c;
  const topW = Math.hypot(tr[0] - tl[0], tr[1] - tl[1]);
  const botW = Math.hypot(br[0] - bl[0], br[1] - bl[1]);
  const leftH = Math.hypot(bl[0] - tl[0], bl[1] - tl[1]);
  const rightH = Math.hypot(br[0] - tr[0], br[1] - tr[1]);
  const aspect = ((topW + botW) / 2) / Math.max((leftH + rightH) / 2, 1);
  if (aspect < 0.45 || aspect > 1.2) return false;
  if (topW / Math.max(botW, 1) < 0.4 || botW / Math.max(topW, 1) < 0.4) return false;
  if (leftH / Math.max(rightH, 1) < 0.4 || rightH / Math.max(leftH, 1) < 0.4) return false;
  const area = Math.abs((tr[0] - tl[0]) * (br[1] - tl[1]) - (tr[1] - tl[1]) * (br[0] - tl[0]));
  return area >= 15000;
}

/**
 * Detector robusto por COMPONENTES CONECTADOS: busca los 4 cuadrados negros de
 * esquina por forma (blob solido, cuadrado, tamaño plausible) en vez de "lo mas
 * oscuro por zona". Robusto a que la hoja no llene el cuadro, a fondos y a
 * perspectiva moderada. Reemplaza el detector que fallaba en fotos reales.
 */
function findCornersByBlobs(gray: Uint8Array, w: number, h: number): [number, number][] | null {
  const otsu = otsuThreshold(gray);
  const thr = Math.min(otsu, 150); // dark = gray < thr
  const minDim = Math.min(w, h);
  const minArea = (minDim * 0.018) * (minDim * 0.018);
  const maxArea = (minDim * 0.10) * (minDim * 0.10);

  const visited = new Uint8Array(w * h);
  const stack: number[] = [];
  const cands: { x: number; y: number; area: number }[] = [];

  for (let start = 0; start < w * h; start++) {
    if (visited[start] || gray[start] >= thr) continue;
    let minx = w, miny = h, maxx = 0, maxy = 0, count = 0, sx = 0, sy = 0;
    stack.length = 0; stack.push(start); visited[start] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      const px = p % w, py = (p / w) | 0;
      count++; sx += px; sy += py;
      if (px < minx) minx = px; if (px > maxx) maxx = px;
      if (py < miny) miny = py; if (py > maxy) maxy = py;
      if (px > 0 && !visited[p - 1] && gray[p - 1] < thr) { visited[p - 1] = 1; stack.push(p - 1); }
      if (px < w - 1 && !visited[p + 1] && gray[p + 1] < thr) { visited[p + 1] = 1; stack.push(p + 1); }
      if (py > 0 && !visited[p - w] && gray[p - w] < thr) { visited[p - w] = 1; stack.push(p - w); }
      if (py < h - 1 && !visited[p + w] && gray[p + w] < thr) { visited[p + w] = 1; stack.push(p + w); }
    }
    if (count < minArea || count > maxArea) continue;
    const bw = maxx - minx + 1, bh = maxy - miny + 1;
    const aspect = bw / Math.max(bh, 1);
    if (aspect < 0.5 || aspect > 2.0) continue;     // cuadrado-ish
    if (count / (bw * bh) < 0.78) continue;          // solido (excluye circulos ~0.78)
    cands.push({ x: sx / count, y: sy / count, area: count });
  }

  if (cands.length < 4) return null;

  // Asignacion por puntos extremos: las 4 esquinas del conjunto de cuadrados.
  let tl = cands[0], tr = cands[0], br = cands[0], bl = cands[0];
  for (const c of cands) {
    if (c.x + c.y < tl.x + tl.y) tl = c;
    if (c.x + c.y > br.x + br.y) br = c;
    if (c.x - c.y > tr.x - tr.y) tr = c;
    if (c.x - c.y < bl.x - bl.y) bl = c;
  }
  const corners: [number, number][] = [
    [Math.round(tl.x), Math.round(tl.y)],
    [Math.round(tr.x), Math.round(tr.y)],
    [Math.round(br.x), Math.round(br.y)],
    [Math.round(bl.x), Math.round(bl.y)],
  ];
  // Los 4 extremos deben ser distintos y formar un cuadrilatero valido.
  const uniq = new Set(corners.map(c => `${c[0]},${c[1]}`));
  if (uniq.size < 4 || !validateQuad(corners)) return null;
  return corners;
}

// ─── 1. Corner detection: blobs conectados (robusto) → grid-blob → centro de masa ──
export function findCorners(imageData: ImageData, config: OMRConfig = DEFAULT_CONFIG): [number, number][] | null {
  const w = imageData.width, h = imageData.height;
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < gray.length; i++) {
    const j = i * 4;
    gray[i] = Math.round(imageData.data[j] * 0.299 + imageData.data[j + 1] * 0.587 + imageData.data[j + 2] * 0.114);
  }

  // Detector robusto por forma (componentes conectados). Si encuentra los 4
  // cuadrados, lo preferimos al metodo por densidad de zona.
  const blobCorners = findCornersByBlobs(gray, w, h);
  if (blobCorners) return blobCorners;

  // Build integral image for fast region sums
  const integral = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += (gray[y * w + x] < 80 ? 1 : 0);
      integral[y * w + x] = (y > 0 ? integral[(y - 1) * w + x] : 0) + rowSum;
    }
  }
  function regionDark(x: number, y: number, sx: number, sy: number): number {
    const x2 = Math.min(x + sx - 1, w - 1);
    const y2 = Math.min(y + sy - 1, h - 1);
    let sum = integral[y2 * w + x2];
    if (x > 0) sum -= integral[y2 * w + (x - 1)];
    if (y > 0) sum -= integral[(y - 1) * w + x2];
    if (x > 0 && y > 0) sum += integral[(y - 1) * w + (x - 1)];
    return sum;
  }

  // Search zones: 45% from each edge
  const zoneDefs: { x0: number; y0: number; x1: number; y1: number; ex: number; ey: number }[] = [
    { x0: 15, y0: 15, x1: Math.floor(w * 0.45), y1: Math.floor(h * 0.45), ex: 15, ey: 15 },
    { x0: Math.floor(w * 0.55), y0: 15, x1: w - 15, y1: Math.floor(h * 0.45), ex: w - 15, ey: 15 },
    { x0: Math.floor(w * 0.55), y0: Math.floor(h * 0.55), x1: w - 15, y1: h - 15, ex: w - 15, ey: h - 15 },
    { x0: 15, y0: Math.floor(h * 0.55), x1: Math.floor(w * 0.45), y1: h - 15, ex: 15, ey: h - 15 },
  ];

  const cellSize = Math.floor(Math.min(w, h) * 0.018); // ~20px for 1080p
  const stride = Math.max(3, Math.floor(cellSize / 3));
  const minCellDensity = 0.35;
  const maxCellDensity = 1.0; // anclas SOLIDAS → densidad ~1.0 (antes huecas: 0.90)
  // Distancia para verificar papel blanco hacia el interior. Debe superar el
  // tamaño del ancla SOLIDA proyectada, si no caeria dentro de la propia ancla.
  const anchorPx = (L.ANCHOR_SIZE / L.SHEET_H) * h;
  const checkGap = Math.floor(Math.max(cellSize * 1.2, anchorPx + cellSize));

  // Directions to check for white paper (2 checks per zone, toward interior of sheet)
  // For each zone: [check1_dx, check1_dy, check2_dx, check2_dy]
  const neighborDirs: number[][] = [
    [checkGap, 0, 0, checkGap],           // TL: check right + below
    [-checkGap, 0, 0, checkGap],          // TR: check left + below
    [-checkGap, 0, 0, -checkGap],         // BR: check left + above
    [checkGap, 0, 0, -checkGap],          // BL: check right + above
  ];

  const corners: [number, number][] = [];

  for (let zi = 0; zi < 4; zi++) {
    const zd = zoneDefs[zi];
    const nd = neighborDirs[zi];
    let bestScore = -1;
    let bestCx = 0, bestCy = 0;

    for (let cy = zd.y0; cy <= zd.y1 - cellSize; cy += stride) {
      for (let cx = zd.x0; cx <= zd.x1 - cellSize; cx += stride) {
        const dark = regionDark(cx, cy, cellSize, cellSize);
        const density = dark / (cellSize * cellSize);
        if (density < minCellDensity || density > maxCellDensity) continue;

        // Check white paper in 2 directions toward sheet interior
        const n1x = Math.max(0, Math.min(w - 10, Math.round(cx + nd[0])));
        const n1y = Math.max(0, Math.min(h - 10, Math.round(cy + nd[1])));
        const n1d = regionDark(n1x, n1y, 10, 10) / 100;
        if (n1d > 0.20) continue;

        const n2x = Math.max(0, Math.min(w - 10, Math.round(cx + nd[2])));
        const n2y = Math.max(0, Math.min(h - 10, Math.round(cy + nd[3])));
        const n2d = regionDark(n2x, n2y, 10, 10) / 100;
        if (n2d > 0.20) continue;

        // Score: prefer high density + proximity to expected corner
        const distToExpected = Math.hypot(cx + cellSize / 2 - zd.ex, cy + cellSize / 2 - zd.ey) / Math.max(w, h);
        const score = density * 0.7 + (1 - Math.min(1, distToExpected)) * 0.3;

        if (score > bestScore) {
          bestScore = score;
          bestCx = cx;
          bestCy = cy;
        }
      }
    }

    if (bestScore < 0) return findCornersByMass(gray, w, h);

    // Refine: center-of-mass in the best cell region
    let sx = 0, sy = 0, c = 0;
    for (let ry = Math.max(0, bestCy - Math.floor(cellSize * 0.5)); ry <= Math.min(h - 1, bestCy + cellSize + Math.floor(cellSize * 0.5)); ry++) {
      for (let rx = Math.max(0, bestCx - Math.floor(cellSize * 0.5)); rx <= Math.min(w - 1, bestCx + cellSize + Math.floor(cellSize * 0.5)); rx++) {
        if (gray[ry * w + rx] < 80) { sx += rx; sy += ry; c++; }
      }
    }
    corners.push([c > 0 ? Math.round(sx / c) : bestCx + Math.floor(cellSize / 2),
                  c > 0 ? Math.round(sy / c) : bestCy + Math.floor(cellSize / 2)]);
  }

  // Validate quadrilateral
  const [tl, tr, br, bl] = corners;
  const topW = Math.hypot(tr[0] - tl[0], tr[1] - tl[1]);
  const botW = Math.hypot(br[0] - bl[0], br[1] - bl[1]);
  const leftH = Math.hypot(bl[0] - tl[0], bl[1] - tl[1]);
  const rightH = Math.hypot(br[0] - tr[0], br[1] - tr[1]);
  const avgW = (topW + botW) / 2;
  const avgH = (leftH + rightH) / 2;
  const aspect = avgW / Math.max(avgH, 1);
  if (aspect < 0.45 || aspect > 1.2) return findCornersByMass(gray, w, h);
  if (topW / Math.max(botW, 1) < 0.3 || botW / Math.max(topW, 1) < 0.3) return findCornersByMass(gray, w, h);
  if (leftH / Math.max(rightH, 1) < 0.3 || rightH / Math.max(leftH, 1) < 0.3) return findCornersByMass(gray, w, h);
  const area = Math.abs((tr[0] - tl[0]) * (br[1] - tl[1]) - (tr[1] - tl[1]) * (br[0] - tl[0]));
  if (area < 15000) return findCornersByMass(gray, w, h);
  // Borde superior e inferior deben ser aproximadamente horizontales (tilt máximo ~12%)
  if (Math.abs(tl[1] - tr[1]) > h * 0.12) return findCornersByMass(gray, w, h);
  if (Math.abs(bl[1] - br[1]) > h * 0.12) return findCornersByMass(gray, w, h);

  return corners;
}

// ─── 2. Correccion de perspectiva ──────────────────────────────
export function warpImageData(
  sourceData: ImageData,
  corners: [number, number][],
  config: OMRConfig = DEFAULT_CONFIG
): ImageData {
  const { sheetWidth: W, sheetHeight: H } = config;
  const [tl, tr, br, bl] = corners;
  // Mapea las 4 esquinas detectadas a los centros de ancla canonicos (sheet_layout).
  const dst = [
    L.CORNER_CENTERS[0][0], L.CORNER_CENTERS[0][1],
    L.CORNER_CENTERS[1][0], L.CORNER_CENTERS[1][1],
    L.CORNER_CENTERS[2][0], L.CORNER_CENTERS[2][1],
    L.CORNER_CENTERS[3][0], L.CORNER_CENTERS[3][1],
  ];
  const src = [...tl, ...tr, ...br, ...bl];
  // Homografia DESTINO→ORIGEN (mapeo inverso): para cada pixel de salida (dx,dy)
  // se obtiene el pixel fuente. Antes se construia ORIGEN→DESTINO y se aplicaba a
  // coordenadas de destino → warp incorrecto en fotos reales (solo se salvaba el
  // fixture porque ya estaba en posicion canonica → homografia ≈ identidad).
  const A: number[][] = [], b: number[] = [];
  for (let i = 0; i < 4; i++) {
    A.push([dst[i * 2], dst[i * 2 + 1], 1, 0, 0, 0, -src[i * 2] * dst[i * 2], -src[i * 2] * dst[i * 2 + 1]]);
    A.push([0, 0, 0, dst[i * 2], dst[i * 2 + 1], 1, -src[i * 2 + 1] * dst[i * 2], -src[i * 2 + 1] * dst[i * 2 + 1]]);
    b.push(src[i * 2]); b.push(src[i * 2 + 1]);
  }
  const h = solve8x8(A, b);
  if (!h) return sourceData;

  const outData = new ImageData(W, H);
  const srcW = sourceData.width, srcH = sourceData.height;
  for (let dy = 0; dy < H; dy++) {
    for (let dx = 0; dx < W; dx++) {
      const denom = h[6] * dx + h[7] * dy + 1;
      const sx = (h[0] * dx + h[1] * dy + h[2]) / denom;
      const sy = (h[3] * dx + h[4] * dy + h[5]) / denom;
      const six = Math.round(sx), siy = Math.round(sy);
      const di = dy * W + dx;
      if (six >= 0 && six < srcW && siy >= 0 && siy < srcH) {
        const si = siy * srcW + six;
        outData.data[di * 4] = sourceData.data[si * 4]; outData.data[di * 4 + 1] = sourceData.data[si * 4 + 1];
        outData.data[di * 4 + 2] = sourceData.data[si * 4 + 2]; outData.data[di * 4 + 3] = 255;
      } else {
        outData.data[di * 4] = 255; outData.data[di * 4 + 1] = 255;
        outData.data[di * 4 + 2] = 255; outData.data[di * 4 + 3] = 255;
      }
    }
  }
  return outData;
}

export function warpPerspective(
  sourceCtx: CanvasRenderingContext2D,
  corners: [number, number][],
  config: OMRConfig = DEFAULT_CONFIG
): ImageData {
  const srcData = sourceCtx.getImageData(0, 0, sourceCtx.canvas.width, sourceCtx.canvas.height);
  return warpImageData(srcData, corners, config);
}

function solve8x8(A: number[][], b: number[]): number[] | null {
  const n = 8; const mat = A.map((r, i) => [...r, b[i]]);
  for (let col = 0; col < n; col++) {
    let max = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(mat[row][col]) > Math.abs(mat[max][col])) max = row;
    [mat[col], mat[max]] = [mat[max], mat[col]];
    if (Math.abs(mat[col][col]) < 1e-10) return null;
    for (let row = col + 1; row < n; row++) {
      const f = mat[row][col] / mat[col][col];
      for (let j = col; j <= n; j++) mat[row][j] -= f * mat[col][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { x[i] = mat[i][n]; for (let j = i + 1; j < n; j++) x[i] -= mat[i][j] * x[j]; x[i] /= mat[i][i]; }
  return x;
}

// ─── 3. Analisis de burbujas (clasificador multi-feature) ──
const DARK_THRESH = 70;
const GLARE_THRESH = 220;

/**
 * Calibracion del clasificador. UNICA fuente de verdad: debe replicarse
 * byte-a-byte en mobile/native/omr_engine.cpp (constexpr CALIB_*).
 */
const CALIB = {
  bubbleRadius: 10,   // radio de muestreo del ROI por burbuja
  relThresh: 0.55,    // umbral relativo al mejor score de la pregunta
  absThresh: 0.15,    // score minimo absoluto para considerar una opcion marcada
  minPick: 0.05,      // score minimo para elegir el maximo (calibrado con fotos reales)
  dominance: 0.02,    // el ganador debe superar al 2do por este margen (anti falso positivo)
  gridSearchDx: 6,    // rango +-px de busqueda horizontal de la grilla
  gridSearchDy: 8,    // rango +-px de busqueda vertical de la grilla
  gridSearchStep: 2,  // paso de la busqueda de offset
  rutSearchDx: 10,    // rango +-px de busqueda global del bloque RUT (sin ancla propia)
  rutSearchDy: 18,    // rango +-px vertical del RUT (antes 10 se topaba en fotos anguladas)
  rutSearchStep: 2,   // paso de la busqueda de offset del RUT
  rutColRefine: 6,    // rango +-px del ajuste fino POR COLUMNA sobre el offset global
} as const;

/**  multi-feature bubble classifier */
function classifyBubble(gray: Float32Array, w: number, cx: number, cy: number, r: number): { score: number; glare: boolean; features: number[] } {
  let dark = 0, total = 0, bright = 0;
  let sum = 0, sumSq = 0;
  const centerVals: number[] = [];
  const edgeVals: number[] = [];

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const px = cx + dx, py = cy + dy;
      if (px >= 0 && px < w && py >= 0 && py < gray.length / w) {
        const v = gray[py * w + px];
        total++;
        sum += v; sumSq += v * v;
        if (v < DARK_THRESH) dark++;
        if (v > GLARE_THRESH) bright++;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < r * 0.45) centerVals.push(v);
        else if (dist > r * 0.65) edgeVals.push(v);
      }
    }
  }

  if (total === 0) return { score: 0, glare: false, features: [0, 0, 0, 0] };

  const darkRatio = dark / total;
  const centerAvg = centerVals.length > 0 ? centerVals.reduce((a, b) => a + b, 0) / centerVals.length : 255;
  const edgeAvg = edgeVals.length > 0 ? edgeVals.reduce((a, b) => a + b, 0) / edgeVals.length : 255;
  const contrast = edgeAvg > 0 ? (edgeAvg - centerAvg) / edgeAvg : 0;
  const mean = sum / total;
  const variance = sumSq / total - mean * mean;
  const edgeDensity = edgeVals.length > 0 ? edgeVals.filter(v => v < 100).length / edgeVals.length : 0;
  const score = darkRatio * 0.40 + contrast * 0.25 + Math.min(variance / 10000, 1) * 0.15 + edgeDensity * 0.20;
  const brightRatio = bright / total;
  const glare = brightRatio > 0.85 && darkRatio < 0.02 && edgeDensity < 0.02;

  return { score, glare, features: [darkRatio, contrast, variance, edgeDensity] };
}

// Scanner Curve Check (return code 10): detecta papel doblado/curvado
function checkCurve(corners: [number, number][]): boolean {
  const [tl, tr, br, bl] = corners;
  const topLen = Math.hypot(tr[0] - tl[0], tr[1] - tl[1]);
  const botLen = Math.hypot(br[0] - bl[0], br[1] - bl[1]);
  const leftLen = Math.hypot(bl[0] - tl[0], bl[1] - tl[1]);
  const rightLen = Math.hypot(br[0] - tr[0], br[1] - tr[1]);

  // Umbrales aflojados: una foto a mano tiene PERSPECTIVA (lados/diagonales
  // distintos) que la homografia SI corrige; solo rechazamos deformacion extrema
  // (papel realmente doblado), no el angulo normal de captura. (Fase 0.4)
  const hRatio = Math.max(topLen, botLen) / Math.max(Math.min(topLen, botLen), 1);
  const vRatio = Math.max(leftLen, rightLen) / Math.max(Math.min(leftLen, rightLen), 1);
  if (hRatio > 1.9 || vRatio > 1.9) return true;

  const diag1 = Math.hypot(br[0] - tl[0], br[1] - tl[1]);
  const diag2 = Math.hypot(tr[0] - bl[0], tr[1] - bl[1]);
  const dRatio = Math.max(diag1, diag2) / Math.max(Math.min(diag1, diag2), 1);
  if (dRatio > 1.6) return true;

  return false;
}

/** Cuenta pixeles oscuros (gray<thr) en una caja centrada en (cx,cy). */
function darkInBox(gray: Float32Array, w: number, h: number, cx: number, cy: number, half: number, thr = 100): number {
  let dark = 0;
  for (let dy = -half; dy <= half; dy++) {
    const py = cy + dy;
    if (py < 0 || py >= h) continue;
    for (let dx = -half; dx <= half; dx++) {
      const px = cx + dx;
      if (px >= 0 && px < w && gray[py * w + px] < thr) dark++;
    }
  }
  return dark;
}

/**
 * Lee la pista de temporizacion del margen izquierdo: devuelve el centro Y de
 * cada marca solida, en orden. En una hoja bien warpeada hay NUM_QUESTIONS
 * marcas. Es el ancla fisica que da el registro robusto por fila.
 */
function readTimingRows(gray: Float32Array, w: number, h: number): number[] {
  const x0 = Math.max(0, Math.round(L.TIMING_X - L.TIMING_W / 2 - 4));
  const x1 = Math.min(w - 1, Math.round(L.TIMING_X + L.TIMING_W / 2 + 4));
  const bandW = x1 - x0 + 1;
  const minDark = Math.max(6, Math.round(L.TIMING_W * 0.4));

  // Solo la banda de las filas de preguntas: ignora la cabecera y la franja del
  // código de hoja (que cruza la columna de temporización por arriba y, si no, se
  // contaria como una marca extra → conteo != numQuestions, frames rechazados).
  const yStart = Math.max(0, Math.round((L.Q_TOP - L.ROW_H) / L.SHEET_H * h));

  const centers: number[] = [];
  let runStart = -1, runSum = 0, runW = 0;
  for (let y = yStart; y < h; y++) {
    let dark = 0;
    for (let x = x0; x <= x1; x++) if (gray[y * w + x] < 100) dark++;
    const isMark = dark >= minDark;
    if (isMark) {
      if (runStart < 0) { runStart = y; runSum = 0; runW = 0; }
      runSum += y * dark; runW += dark;
    } else if (runStart >= 0) {
      // fin de una marca: centro ponderado por oscuridad
      if (y - runStart >= 4) centers.push(Math.round(runSum / Math.max(runW, 1)));
      runStart = -1;
    }
  }
  if (runStart >= 0 && h - runStart >= 4) centers.push(Math.round(runSum / Math.max(runW, 1)));
  void bandW;
  return centers;
}

/**
 * Ajusta los centros de temporizacion detectados a las NUM_QUESTIONS filas por
 * regresion lineal. Tolera marcas faltantes (sombra/glare/baja resolucion):
 * interpola las filas no detectadas en vez de descartar el registro. (Fase 0.3)
 * Devuelve los Y de las N filas, o null si el ajuste no es fiable.
 *
 * validateFormat y gradeBubbles usan ESTA misma funcion → el criterio de
 * "formato valido" y "registro por temporizacion" siempre concuerdan (antes
 * validaba con >=80% pero solo registraba con ==100%, auditoria A2).
 */
function rowsFromTiming(centers: number[], numQuestions: number, ql: L.QLayout): number[] | null {
  const minPts = Math.max(6, Math.floor(numQuestions * 0.6));
  if (centers.length < minPts) return null;

  // Cada centro → indice de fila teorico mas cercano (dedup por indice).
  const byIndex = new Map<number, number>();
  for (const c of centers) {
    const i = Math.round((c - ql.rowCY(0)) / ql.rowH);
    if (i < 0 || i >= numQuestions) continue;
    const expected = ql.rowCY(i);
    const prev = byIndex.get(i);
    if (prev === undefined || Math.abs(c - expected) < Math.abs(prev - expected)) byIndex.set(i, c);
  }
  const pts = [...byIndex.entries()];
  if (pts.length < minPts) return null;

  // Regresion lineal c = a*i + b.
  const n = pts.length;
  let si = 0, sc = 0, sii = 0, sic = 0;
  for (const [i, c] of pts) { si += i; sc += c; sii += i * i; sic += i * c; }
  const denom = n * sii - si * si;
  if (Math.abs(denom) < 1e-6) return null;
  const a = (n * sic - si * sc) / denom;
  const b = (sc - a * si) / n;

  // Sanidad: la pendiente debe parecerse al paso de fila real.
  if (a < ql.rowH * 0.7 || a > ql.rowH * 1.3) return null;

  const rowY: number[] = [];
  for (let q = 0; q < numQuestions; q++) rowY.push(Math.round(a * q + b));
  return rowY;
}

// Scanner Format Validation (return code 30): verifica que la hoja sea la correcta
function validateFormat(gray: Float32Array, w: number, h: number, config: OMRConfig): { valid: boolean; reason?: string } {
  // 1. Las 4 anclas de esquina deben ser solidas (blob denso de negro).
  //    El conteo va en la razon para diagnosticar en remoto (~0 = warp mal,
  //    ~600 = cerca, solo umbral).
  for (const [cx, cy] of L.CORNER_CENTERS) {
    const d = darkInBox(gray, w, h, cx, cy, 25);
    if (d < 800) {
      return { valid: false, reason: `Falta ancla en (${cx},${cy}) [oscuro=${d}/800]` };
    }
  }

  // 2. La pista de temporizacion debe poder ajustarse a las numQuestions filas
  //    (mismo criterio que el registro en gradeBubbles).
  const ql = L.questionLayout({ numQuestions: config.numQuestions, numOptions: config.numOptions });
  const rows = readTimingRows(gray, w, h);
  if (!rowsFromTiming(rows, config.numQuestions, ql)) {
    return { valid: false, reason: `Pista de temporizacion insuficiente (${rows.length}/${config.numQuestions})` };
  }

  return { valid: true };
}

/**
 * Registro local de la grilla de preguntas.
 *
 * La homografia de 4 esquinas solo corrige perspectiva plana; el pandeo del
 * papel, la distorsion del lente o un error sub-pixel en una esquina desplazan
 * las burbujas del centro de pagina respecto a las coordenadas teoricas. Esta
 * busqueda barata prueba un rango de offsets (dx,dy) y elige el que maximiza la
 * oscuridad concentrada en las posiciones de burbuja esperadas. En una imagen
 * perfecta el optimo es (0,0), por lo que no degrada el caso ideal.
 */
function darkAtBubbles(gray: Float32Array, w: number, h: number, rowY: number[], numOptions: number, dx: number): number {
  let darkSum = 0;
  for (const cy of rowY) {
    for (let o = 0; o < numOptions; o++) {
      const cx = L.optX(o) + dx;
      for (let yy = -6; yy <= 6; yy++) {
        const py = cy + yy;
        if (py < 0 || py >= h) continue;
        for (let xx = -6; xx <= 6; xx++) {
          const px = cx + xx;
          if (px >= 0 && px < w && gray[py * w + px] < DARK_THRESH) darkSum++;
        }
      }
    }
  }
  return darkSum;
}

/** Fallback software cuando la pista de temporizacion no se lee: offset (dx,dy). */
function findGridOffset(gray: Float32Array, w: number, h: number, config: OMRConfig): { dx: number; dy: number } {
  const { numQuestions, numOptions } = config;
  const ql = L.questionLayout({ numQuestions, numOptions });
  let bestDx = 0, bestDy = 0, bestDark = -1;
  for (let dy = -CALIB.gridSearchDy; dy <= CALIB.gridSearchDy; dy += CALIB.gridSearchStep) {
    const rowY = Array.from({ length: numQuestions }, (_, q) => ql.rowCY(q) + dy);
    for (let dx = -CALIB.gridSearchDx; dx <= CALIB.gridSearchDx; dx += CALIB.gridSearchStep) {
      const darkSum = darkAtBubbles(gray, w, h, rowY, numOptions, dx);
      if (darkSum > bestDark) { bestDark = darkSum; bestDx = dx; bestDy = dy; }
    }
  }
  return { dx: bestDx, dy: bestDy };
}

/** Con los Y de fila ya anclados por la temporizacion, solo refina el offset X. */
function findColumnOffset(gray: Float32Array, w: number, h: number, rowY: number[], numOptions: number): number {
  let bestDx = 0, bestDark = -1;
  for (let dx = -CALIB.gridSearchDx; dx <= CALIB.gridSearchDx; dx += CALIB.gridSearchStep) {
    const darkSum = darkAtBubbles(gray, w, h, rowY, numOptions, dx);
    if (darkSum > bestDark) { bestDark = darkSum; bestDx = dx; }
  }
  return bestDx;
}

export function gradeBubbles(imageData: ImageData, config: OMRConfig = DEFAULT_CONFIG, corners?: [number, number][]): GradeReport {
  const { width, height, data } = imageData;
  const { numQuestions, numOptions } = config;
  const labels = config.optionLabels.split("");

  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) gray[i] = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;

  // Validacion pre: el warp debe tener pixeles oscuros
  let td = 0; for (let i = 0; i < gray.length; i++) { if (gray[i] < DARK_THRESH) td++; }
  if (td / gray.length < 0.003) return { results: [], valid: false, reason: "Warp vacio" };

  // Scanner Curve Check: detecta papel doblado/curvado
  if (corners && checkCurve(corners)) {
    return { results: [], valid: false, reason: "Papel curvado - alisa la hoja" };
  }

  // Scanner Format Validation: verifica que la hoja sea correcta
  const formatCheck = validateFormat(gray, width, height, config);
  if (!formatCheck.valid) {
    return { results: [], valid: false, reason: formatCheck.reason };
  }

  // Layout parametrico (default 20/5 reproduce la hoja actual).
  const ql = L.questionLayout({ numQuestions, numOptions });

  // Registro de filas: preferimos los Y fisicos de la pista de temporizacion;
  // si no se leen las marcas, caemos al offset software.
  const timingRows = readTimingRows(gray, width, height);
  const fitted = rowsFromTiming(timingRows, numQuestions, ql); // tolera marcas faltantes
  let rowY: number[];
  let gridDx: number;
  if (fitted) {
    rowY = fitted;
    gridDx = findColumnOffset(gray, width, height, rowY, numOptions);
  } else {
    const off = findGridOffset(gray, width, height, config);
    gridDx = off.dx;
    rowY = Array.from({ length: numQuestions }, (_, q) => ql.rowCY(q) + off.dy);
  }
  const diag: GradeDiag = { usedTiming: !!fitted, timingRows: timingRows.length, gridDx };

  const results: BubbleResult[] = [];
  const sameCount: Record<string, number> = {};
  let glareWarnings = 0;

  for (let q = 0; q < numQuestions; q++) {
    const cy = rowY[q];
    const scores: number[] = [];
    const glares: boolean[] = [];

    for (let o = 0; o < numOptions; o++) {
      const cx = L.optX(o) + gridDx;
      const { score, glare } = classifyBubble(gray, width, cx, cy, ql.gradeR);
      scores.push(score);
      glares.push(glare);
    }

    // Umbral adaptativo + deteccion de marcas multiples
    const maxS = Math.max(...scores);
    const maxIdx = scores.indexOf(maxS);
    const thresh = Math.max(CALIB.absThresh, maxS * CALIB.relThresh);
    const marked = scores.map((s, i) => (s > thresh && !glares[i]) ? i : -1).filter(i => i >= 0);

    // El glare solo invalida la pregunta cuando tapa la opcion mas probable
    // (un reflejo sobre la marca ganadora). Las opciones en blanco que "parecen
    // brillantes" NO deben convertir toda la pregunta en "?" (Bug 4).
    const winnerGlare = glares[maxIdx] && maxS >= CALIB.absThresh;
    if (winnerGlare) glareWarnings++;

    let answer = "-";
    const sorted = [...scores].sort((a, b) => b - a);
    const dominates = sorted[0] - sorted[1] > CALIB.dominance;
    if (winnerGlare) {
      answer = "?"; // marca probable bajo reflejo
    } else if (marked.length === 0 && maxS > CALIB.minPick && dominates) {
      answer = labels[maxIdx];
    } else if (marked.length > 0 && marked.length <= 3) {
      // Soporte combinado: hasta 3 letras
      answer = marked.map(i => labels[i]).join("");
    }

    results.push({
      question: q + 1, answer,
      scores: scores.map(s => Math.round(s * 1000) / 1000),
      correct: null,
    });
    sameCount[answer] = (sameCount[answer] || 0) + 1;
  }

  // Validaciones post
  if (glareWarnings > 10) {
    return { results, valid: false, reason: `Demasiado brillo: ${glareWarnings} burbujas con reflejo`, diag };
  }

  const answeredCount = results.filter(r => r.answer !== "-" && r.answer !== "?").length;
  if (answeredCount === 0) {
    return { results, valid: false, reason: "Sin respuestas detectadas", diag };
  }

  const maxSame = Math.max(...Object.values(sameCount));
  if (maxSame >= 18 && answeredCount >= 18) {
    const dominant = Object.entries(sameCount).find(([, v]) => v === maxSame)?.[0];
    return { results, valid: false, reason: `${maxSame}/20 respuestas "${dominant}" - posible mal warp`, diag };
  }

  return { results, valid: true, diag };
}

// ─── 4. ID de estudiante ───────────────────────────────────────
export function readStudentId(imageData: ImageData, config: OMRConfig = DEFAULT_CONFIG): string[] {
  const { width, height, data } = imageData;
  const { idRows, idCols } = config;

  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) gray[i] = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;

  const rows: string[] = [];
  for (let row = 0; row < idRows; row++) {
    let s = "";
    for (let col = 0; col < idCols; col++) {
      const cx = L.idX(col), cy = L.idY(row); let dk = 0, tot = 0;
      for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
        const px = cx + dx, py = cy + dy;
        if (px >= 0 && px < width && py >= 0 && py < height) { tot++; if (gray[py * width + px] < DARK_THRESH) dk++; }
      }
      s += (tot > 0 && dk / tot > 0.12) ? "1" : "0";
    }
    rows.push(s);
  }
  return rows;
}

// ─── 5. RUT (Chile): columna por digito + validacion del digito verificador ───
export interface RutColDiag {
  picked: number | null;  // digito elegido (10 = K en la columna DV) o null si no se leyo
  top: number;            // score del mas oscuro (0..1)
  margin: number;         // top - 2do score (dominancia; <0.10 → descartado)
  cdx: number;            // ajuste X fino propio de la columna (sobre el offset global)
  cdy: number;            // ajuste Y fino propio de la columna
}
export interface RutDiag {
  dx: number;             // offset X global aplicado al bloque RUT
  dy: number;             // offset Y global aplicado al bloque RUT
  dvComputed: boolean;    // true si el DV se calculo (cuerpo confiable, DV no legible)
  cols: RutColDiag[];     // diagnostico por columna (cuerpo + DV)
}

export interface RutResult {
  rut: string;          // "17517808-2" o "" si incompleto
  dvOk: boolean;        // true si el DV LEIDO coincide con el calculado (verificado)
  complete: boolean;    // true si todas las columnas del cuerpo se leyeron
  dvComputed?: boolean; // true si el DV se relleno por calculo (no se leyo de la hoja)
  diag?: RutDiag;       // registro local + scores por columna (para analisis remoto)
}

/** Oscuridad concentrada en los centros de burbuja del RUT para un offset (dx,dy). */
function darkAtRut(gray: Float32Array, w: number, h: number, dx: number, dy: number): number {
  const r = L.RUT_R;
  let darkSum = 0;
  for (let c = 0; c < L.RUT_COLS; c++) {
    const rowCount = c === L.RUT_COLS - 1 ? L.RUT_ROWS + 1 : L.RUT_ROWS;
    for (let d = 0; d < rowCount; d++) {
      const cx = L.rutColX(c) + dx, cy = L.rutRowY(d) + dy;
      for (let yy = -r; yy <= r; yy++) {
        const py = cy + yy;
        if (py < 0 || py >= h) continue;
        for (let xx = -r; xx <= r; xx++) {
          const px = cx + xx;
          if (px >= 0 && px < w && gray[py * w + px] < DARK_THRESH) darkSum++;
        }
      }
    }
  }
  return darkSum;
}

/**
 * Registro local del bloque RUT. A diferencia de las preguntas (que se anclan
 * con la pista de temporizacion), el RUT no tiene anclas propias y se comia
 * entero el error residual de la homografia → lectura inestable. Busca el offset
 * (dx,dy) que maximiza la oscuridad sobre los centros de burbuja esperados. En
 * un warp perfecto el optimo es (0,0), por lo que no degrada el caso ideal.
 */
function findRutOffset(gray: Float32Array, w: number, h: number): { dx: number; dy: number } {
  let bestDx = 0, bestDy = 0, bestDark = -1;
  for (let dy = -CALIB.rutSearchDy; dy <= CALIB.rutSearchDy; dy += CALIB.rutSearchStep) {
    for (let dx = -CALIB.rutSearchDx; dx <= CALIB.rutSearchDx; dx += CALIB.rutSearchStep) {
      const darkSum = darkAtRut(gray, w, h, dx, dy);
      if (darkSum > bestDark) { bestDark = darkSum; bestDx = dx; bestDy = dy; }
    }
  }
  return { dx: bestDx, dy: bestDy };
}

/** Oscuridad sobre los centros de burbuja de UNA columna del RUT (para refinarla). */
function darkAtRutCol(gray: Float32Array, w: number, h: number, c: number, dx: number, dy: number): number {
  const r = L.RUT_R;
  const rowCount = c === L.RUT_COLS - 1 ? L.RUT_ROWS + 1 : L.RUT_ROWS;
  let darkSum = 0;
  for (let d = 0; d < rowCount; d++) {
    const cx = L.rutColX(c) + dx, cy = L.rutRowY(d) + dy;
    for (let yy = -r; yy <= r; yy++) {
      const py = cy + yy;
      if (py < 0 || py >= h) continue;
      for (let xx = -r; xx <= r; xx++) {
        const px = cx + xx;
        if (px >= 0 && px < w && gray[py * w + px] < DARK_THRESH) darkSum++;
      }
    }
  }
  return darkSum;
}

/**
 * Refina el offset de UNA columna alrededor del global. El offset unico corrige
 * el grueso, pero una columna del extremo (p.ej. el DV) puede quedar fuera por
 * un leve error de escala/cizalla; cada columna engancha su propia grilla de
 * anillos. Columnas ya bien registradas devuelven ~(0,0): no degrada el caso ideal.
 */
function refineRutCol(gray: Float32Array, w: number, h: number, c: number, baseDx: number, baseDy: number): { dx: number; dy: number } {
  let bestDx = baseDx, bestDy = baseDy, bestDark = -1;
  for (let ddy = -CALIB.rutColRefine; ddy <= CALIB.rutColRefine; ddy += 2) {
    for (let ddx = -CALIB.rutColRefine; ddx <= CALIB.rutColRefine; ddx += 2) {
      const dk = darkAtRutCol(gray, w, h, c, baseDx + ddx, baseDy + ddy);
      if (dk > bestDark) { bestDark = dk; bestDx = baseDx + ddx; bestDy = baseDy + ddy; }
    }
  }
  return { dx: bestDx, dy: bestDy };
}

/** Digito verificador chileno (modulo 11). Devuelve 0..10 (10 = K). */
export function computeRutDV(body: number[]): number {
  let sum = 0, mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += body[i] * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const res = 11 - (sum % 11);
  return res === 11 ? 0 : res; // res === 10 → K (se devuelve 10)
}

export function readRut(imageData: ImageData, _config: OMRConfig = DEFAULT_CONFIG): RutResult {
  const { width, height, data } = imageData;
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) gray[i] = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;

  // Registro local del bloque RUT antes de muestrear (las preguntas se anclan
  // con la pista de temporizacion; el RUT no tiene ancla → buscamos su offset).
  const { dx: regDx, dy: regDy } = findRutOffset(gray, width, height);

  const r = L.RUT_R;
  // Para cada columna: refina su offset propio y elige la fila (digito) marcada.
  const picked: (number | null)[] = [];
  const cols: RutColDiag[] = [];
  for (let c = 0; c < L.RUT_COLS; c++) {
    const isDV = c === L.RUT_COLS - 1;
    const rowCount = isDV ? L.RUT_ROWS + 1 : L.RUT_ROWS; // la columna DV tiene K
    const { dx: colDx, dy: colDy } = refineRutCol(gray, width, height, c, regDx, regDy);
    const scores: number[] = [];
    for (let d = 0; d < rowCount; d++) {
      const cx = L.rutColX(c) + colDx, cy = L.rutRowY(d) + colDy;
      let dark = 0, tot = 0;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const px = cx + dx, py = cy + dy;
        if (px >= 0 && px < width && py >= 0 && py < height) { tot++; if (gray[py * width + px] < DARK_THRESH) dark++; }
      }
      scores.push(tot > 0 ? dark / tot : 0);
    }
    const maxS = Math.max(...scores);
    const maxIdx = scores.indexOf(maxS);
    const sorted = [...scores].sort((a, b) => b - a);
    const margin = sorted[0] - (sorted[1] ?? 0);
    const pick = maxS > 0.20 && margin > 0.10 ? maxIdx : null;
    picked.push(pick);
    cols.push({
      picked: pick, top: Math.round(maxS * 1000) / 1000, margin: Math.round(margin * 1000) / 1000,
      cdx: colDx - regDx, cdy: colDy - regDy,
    });
  }

  // Cuerpo (8 columnas, alineado a la derecha): nulos iniciales = RUT mas corto.
  const bodyCols = picked.slice(0, L.RUT_DIGITS);
  const body: number[] = [];
  let started = false, bodyComplete = true;
  for (const d of bodyCols) {
    if (d === null) { if (started) bodyComplete = false; }
    else { started = true; body.push(d); }
  }
  const dvPicked = picked[L.RUT_COLS - 1];

  // El DV es un checksum (modulo 11) del cuerpo. Si el cuerpo se leyo completo y
  // confiable pero la burbuja del DV no se logra leer (columna del borde, foto
  // angulada), lo CALCULAMOS para entregar el RUT completo igual.
  let dvOk = false;
  let dvComputed = false;
  let dvStr = "?";
  if (dvPicked !== null) {
    dvStr = dvPicked === 10 ? "K" : String(dvPicked);
    dvOk = bodyComplete && body.length > 0 && dvPicked === computeRutDV(body);
  } else if (bodyComplete && body.length >= 7) {
    // Cuerpo confiable, DV ilegible → calcular el DV (no verificado por lectura).
    const cdv = computeRutDV(body);
    dvStr = cdv === 10 ? "K" : String(cdv);
    dvComputed = true;
  }

  const complete = bodyComplete && body.length > 0 && (dvPicked !== null || dvComputed);
  const rut = body.length > 0 ? `${body.join("")}-${dvStr}` : "";
  return { rut, dvOk, complete, dvComputed, diag: { dx: regDx, dy: regDy, dvComputed, cols } };
}

// ─── 6. Código de hoja (franja OMR-nativa; ver docs/codigo-hoja-spec.md) ──────
/** Oscuridad concentrada en los centros de celda del código para un offset (dx,dy). */
function darkAtCode(gray: Float32Array, w: number, h: number, dx: number, dy: number): number {
  const r = L.CODE_R;
  let darkSum = 0;
  for (let i = 0; i < L.CODE_CELLS; i++) {
    const cx = L.codeCellX(i) + dx, cy = L.CODE_Y + dy;
    for (let yy = -r; yy <= r; yy++) {
      const py = cy + yy;
      if (py < 0 || py >= h) continue;
      for (let xx = -r; xx <= r; xx++) {
        const px = cx + xx;
        if (px >= 0 && px < w && gray[py * w + px] < DARK_THRESH) darkSum++;
      }
    }
  }
  return darkSum;
}

/**
 * Lee el código de hoja del warp. Registra la franja (las celdas llenas dan el
 * pico), muestrea cada celda y decodifica con verificación de guías + CRC.
 * Devuelve null si no hay código (hoja vieja) o no valida (ilegible).
 */
export function readSheetCode(imageData: ImageData): SheetCodeData | null {
  const { width, height, data } = imageData;
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) gray[i] = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;

  // Registro local de la franja (misma idea que findRutOffset).
  let bestDx = 0, bestDy = 0, bestDark = -1;
  for (let dy = -CALIB.rutSearchDy; dy <= CALIB.rutSearchDy; dy += CALIB.rutSearchStep) {
    for (let dx = -CALIB.rutSearchDx; dx <= CALIB.rutSearchDx; dx += CALIB.rutSearchStep) {
      const dk = darkAtCode(gray, width, height, dx, dy);
      if (dk > bestDark) { bestDark = dk; bestDx = dx; bestDy = dy; }
    }
  }

  const r = L.CODE_R;
  const bits: number[] = [];
  for (let i = 0; i < L.CODE_CELLS; i++) {
    const cx = L.codeCellX(i) + bestDx, cy = L.CODE_Y + bestDy;
    let dark = 0, tot = 0;
    for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) {
      const px = cx + xx, py = cy + yy;
      if (px >= 0 && px < width && py >= 0 && py < height) { tot++; if (gray[py * width + px] < DARK_THRESH) dark++; }
    }
    bits.push(tot > 0 && dark / tot > 0.45 ? 1 : 0);
  }
  return decodeSheetCode(bits);
}

export { DEFAULT_CONFIG };

