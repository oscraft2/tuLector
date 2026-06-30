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
 * Las constantes de calibracion (CALIB) son la UNICA fuente de verdad. La app
 * movil usa Capacitor y reutiliza ESTE motor TS (el motor C++/Flutter quedo
 * deprecado y eliminado; ver docs/apk-plan.md).
 */

import * as L from "./sheet_layout";
import { decodeSheetCode, type SheetCodeData } from "./sheet_code";
import { bubbleProbability } from "./classifier";

export interface OMRConfig {
  numQuestions: number; numOptions: number; optionLabels: string;
  numColumns?: number; // 1 (default) | 2
  idRows: number; idCols: number;
  sheetWidth: number; sheetHeight: number;
  margin: number; cornerSize: number;
}

export interface BubbleResult {
  question: number; answer: string; scores: number[]; correct: boolean | null;
  features?: number[][]; // por opción: [darkRatio, contrast, variance, edgeDensity] — para entrenar (FASE 5)
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
/** Encuentra todos los blobs cuadrados sólidos (anclas) por componentes conectados. */
function findAnchorBlobs(gray: Uint8Array, w: number, h: number): { x: number; y: number; area: number }[] {
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
  return cands;
}

function findCornersByBlobs(gray: Uint8Array, w: number, h: number): [number, number][] | null {
  const cands = findAnchorBlobs(gray, w, h);
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
  const sd = sourceData.data, od = outData.data;
  for (let dy = 0; dy < H; dy++) {
    for (let dx = 0; dx < W; dx++) {
      const denom = h[6] * dx + h[7] * dy + 1;
      const sx = (h[0] * dx + h[1] * dy + h[2]) / denom;
      const sy = (h[3] * dx + h[4] * dy + h[5]) / denom;
      const di = (dy * W + dx) * 4;
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      if (x0 >= 0 && x0 < srcW - 1 && y0 >= 0 && y0 < srcH - 1) {
        // Interpolacion BILINEAL de los 4 vecinos. Mejor que vecino-mas-cercano,
        // sobre todo al agrandar una captura de baja resolucion: la burbuja queda
        // pareja en vez de "pixelada" → score mas fiable.
        const fx = sx - x0, fy = sy - y0;
        const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
        const i00 = (y0 * srcW + x0) * 4, i10 = i00 + 4, i01 = i00 + srcW * 4, i11 = i01 + 4;
        od[di]     = (sd[i00]     * w00 + sd[i10]     * w10 + sd[i01]     * w01 + sd[i11]     * w11) | 0;
        od[di + 1] = (sd[i00 + 1] * w00 + sd[i10 + 1] * w10 + sd[i01 + 1] * w01 + sd[i11 + 1] * w11) | 0;
        od[di + 2] = (sd[i00 + 2] * w00 + sd[i10 + 2] * w10 + sd[i01 + 2] * w01 + sd[i11 + 2] * w11) | 0;
        od[di + 3] = 255;
      } else if (sx >= 0 && sx < srcW && sy >= 0 && sy < srcH) {
        const si = (Math.round(sy) * srcW + Math.round(sx)) * 4; // borde: vecino mas cercano
        od[di] = sd[si]; od[di + 1] = sd[si + 1]; od[di + 2] = sd[si + 2]; od[di + 3] = 255;
      } else {
        od[di] = 255; od[di + 1] = 255; od[di + 2] = 255; od[di + 3] = 255;
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

// ─── Registro por bloques: 12 anclas + warp bilineal (etapa 4) ────────────────
/** Homografía que mapea los 4 puntos `dst` (canónicos) → `src` (en la foto). */
function solveHomography(dst: number[], src: number[]): number[] | null {
  const A: number[][] = [], b: number[] = [];
  for (let i = 0; i < 4; i++) {
    A.push([dst[i * 2], dst[i * 2 + 1], 1, 0, 0, 0, -src[i * 2] * dst[i * 2], -src[i * 2] * dst[i * 2 + 1]]);
    A.push([0, 0, 0, dst[i * 2], dst[i * 2 + 1], 1, -src[i * 2 + 1] * dst[i * 2], -src[i * 2 + 1] * dst[i * 2 + 1]]);
    b.push(src[i * 2]); b.push(src[i * 2 + 1]);
  }
  return solve8x8(A, b);
}

function applyH(h: number[], x: number, y: number): [number, number] {
  const denom = h[6] * x + h[7] * y + 1;
  return [(h[0] * x + h[1] * y + h[2]) / denom, (h[3] * x + h[4] * y + h[5]) / denom];
}

/**
 * Detecta las 12 anclas en la foto: parte de la homografía de 4 esquinas para
 * PREDECIR dónde cae cada ancla canónica, y se "engancha" al blob real más cercano.
 * Los blobs reales capturan la deformación que el warp global no corrige (es el
 * punto del registro por bloques). Devuelve 12 posiciones (orden de GRID_ANCHORS)
 * o null si no se puede estimar.
 */
function findAllAnchors(imageData: ImageData, corners: [number, number][]): [number, number][] | null {
  const { width: w, height: h, data } = imageData;
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < gray.length; i++) {
    const j = i * 4;
    gray[i] = Math.round(data[j] * 0.299 + data[j + 1] * 0.587 + data[j + 2] * 0.114);
  }
  const blobs = findAnchorBlobs(gray, w, h);
  const dst: number[] = [], src: number[] = [];
  for (let i = 0; i < 4; i++) { dst.push(L.CORNER_CENTERS[i][0], L.CORNER_CENTERS[i][1]); src.push(corners[i][0], corners[i][1]); }
  const H = solveHomography(dst, src);
  if (!H) return null;

  const tol = Math.min(w, h) * 0.06; // ventana de snap (±6% del lado menor; < separación entre anclas)
  const tol2 = tol * tol;
  const out: [number, number][] = [];
  for (const [cx, cy] of L.GRID_ANCHORS) {
    const [px, py] = applyH(H, cx, cy); // posición predicha por la homografía global
    let best: { x: number; y: number } | null = null, bestD = tol2;
    for (const bcand of blobs) {
      const ddx = bcand.x - px, ddy = bcand.y - py, d = ddx * ddx + ddy * ddy;
      if (d < bestD) { bestD = d; best = bcand; }
    }
    out.push(best ? [best.x, best.y] : [px, py]); // fallback a la predicción si no hay blob
  }
  return out;
}

/** Muestrea (bilineal) el píxel fuente `(sx,sy)` en `od[di..]`. */
function sampleBilinear(sd: Uint8ClampedArray, srcW: number, srcH: number, sx: number, sy: number, od: Uint8ClampedArray, di: number): void {
  const x0 = Math.floor(sx), y0 = Math.floor(sy);
  if (x0 >= 0 && x0 < srcW - 1 && y0 >= 0 && y0 < srcH - 1) {
    const fx = sx - x0, fy = sy - y0;
    const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
    const i00 = (y0 * srcW + x0) * 4, i10 = i00 + 4, i01 = i00 + srcW * 4, i11 = i01 + 4;
    od[di]     = (sd[i00]     * w00 + sd[i10]     * w10 + sd[i01]     * w01 + sd[i11]     * w11) | 0;
    od[di + 1] = (sd[i00 + 1] * w00 + sd[i10 + 1] * w10 + sd[i01 + 1] * w01 + sd[i11 + 1] * w11) | 0;
    od[di + 2] = (sd[i00 + 2] * w00 + sd[i10 + 2] * w10 + sd[i01 + 2] * w01 + sd[i11 + 2] * w11) | 0;
    od[di + 3] = 255;
  } else if (sx >= 0 && sx < srcW && sy >= 0 && sy < srcH) {
    const si = (Math.round(sy) * srcW + Math.round(sx)) * 4;
    od[di] = sd[si]; od[di + 1] = sd[si + 1]; od[di + 2] = sd[si + 2]; od[di + 3] = 255;
  } else {
    od[di] = 255; od[di + 1] = 255; od[di + 2] = 255; od[di + 3] = 255;
  }
}

/**
 * Warp POR BLOQUES: cada celda de la grilla 3×4 se rectifica con una HOMOGRAFÍA
 * propia (perspectiva exacta), no interpolación bilineal. La bilineal era
 * aproximada en el INTERIOR de una celda con perspectiva → los puntos de muestreo
 * del RUT (interior de una celda grande) no caían justo en las burbujas. La
 * homografía por celda es exacta → registro correcto en toda la celda.
 */
export function warpBilinear(sourceData: ImageData, anchors: [number, number][], config: OMRConfig = DEFAULT_CONFIG): ImageData {
  const { sheetWidth: W, sheetHeight: H } = config;
  const gx = L.ANCHOR_GRID_X, gy = L.ANCHOR_GRID_Y;
  const nx = gx.length, ny = gy.length;
  const outData = new ImageData(W, H);
  const srcW = sourceData.width, srcH = sourceData.height;
  const sd = sourceData.data, od = outData.data;

  // Precomputa la homografía canónica→fuente de cada celda (orden TL,TR,BR,BL).
  const cellH: (number[] | null)[] = [];
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a00 = anchors[j * nx + i], a10 = anchors[j * nx + i + 1], a01 = anchors[(j + 1) * nx + i], a11 = anchors[(j + 1) * nx + i + 1];
      const dst = [gx[i], gy[j], gx[i + 1], gy[j], gx[i + 1], gy[j + 1], gx[i], gy[j + 1]];
      const src = [a00[0], a00[1], a10[0], a10[1], a11[0], a11[1], a01[0], a01[1]];
      cellH[j * (nx - 1) + i] = solveHomography(dst, src);
    }
  }

  for (let dy = 0; dy < H; dy++) {
    let j = 0; while (j < ny - 2 && dy > gy[j + 1]) j++;
    for (let dx = 0; dx < W; dx++) {
      let i = 0; while (i < nx - 2 && dx > gx[i + 1]) i++;
      const h = cellH[j * (nx - 1) + i];
      const di = (dy * W + dx) * 4;
      if (!h) { od[di] = 255; od[di + 1] = 255; od[di + 2] = 255; od[di + 3] = 255; continue; }
      const denom = h[6] * dx + h[7] * dy + 1;
      const sx = (h[0] * dx + h[1] * dy + h[2]) / denom;
      const sy = (h[3] * dx + h[4] * dy + h[5]) / denom;
      sampleBilinear(sd, srcW, srcH, sx, sy, od, di);
    }
  }
  return outData;
}

/**
 * Punto de entrada del rectificado: intenta el warp por bloques (12 anclas);
 * si no logra estimar las anclas, cae al warp clásico de 4 esquinas.
 */
export function warpSheet(imageData: ImageData, corners: [number, number][], config: OMRConfig = DEFAULT_CONFIG): ImageData {
  const anchors = findAllAnchors(imageData, corners);
  if (!anchors) return warpImageData(imageData, corners, config);
  return warpBilinear(imageData, anchors, config);
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

/** Calibracion del clasificador. UNICA fuente de verdad (motor TS; ver docs/apk-plan.md). */
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

  const h = gray.length / w;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const px = cx + dx, py = cy + dy;
      if (px >= 0 && px < w && py >= 0 && py < h) {
        const v = gray[py * w + px];
        total++;
        sum += v; sumSq += v * v;
        if (v > GLARE_THRESH) bright++;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < r * 0.45) centerVals.push(v);
        else if (dist > r * 0.65) edgeVals.push(v);
      }
    }
  }

  if (total === 0) return { score: 0, glare: false, features: [0, 0, 0, 0] };

  const centerAvg = centerVals.length > 0 ? centerVals.reduce((a, b) => a + b, 0) / centerVals.length : 255;
  const edgeAvg = edgeVals.length > 0 ? edgeVals.reduce((a, b) => a + b, 0) / edgeVals.length : 255;

  // Umbral ADAPTATIVO de tinta: en luz normal (papel claro) = DARK_THRESH (70),
  // identico a antes. En zonas oscuras (papel de fondo bajo por sombra), BAJA para
  // no contar el papel sombreado como tinta (falsos positivos). Nunca sube de 70 →
  // cero cambio en el caso bien iluminado / en el test sintetico.
  const localThresh = Math.max(40, Math.min(DARK_THRESH, edgeAvg * 0.45));
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const px = cx + dx, py = cy + dy;
      if (px >= 0 && px < w && py >= 0 && py < h && gray[py * w + px] < localThresh) dark++;
    }
  }

  const darkRatio = dark / total;
  const contrast = edgeAvg > 0 ? (edgeAvg - centerAvg) / edgeAvg : 0;
  const mean = sum / total;
  const variance = sumSq / total - mean * mean;
  const edgeDensity = edgeVals.length > 0 ? edgeVals.filter(v => v < 100).length / edgeVals.length : 0;
  const score = darkRatio * 0.40 + contrast * 0.25 + Math.min(variance / 10000, 1) * 0.15 + edgeDensity * 0.20;
  const brightRatio = bright / total;
  const glare = brightRatio > 0.85 && darkRatio < 0.02 && edgeDensity < 0.02;

  const features = [darkRatio, contrast, variance, edgeDensity];
  // Si hay clasificador entrenado (FASE 5), su probabilidad reemplaza al score
  // heurístico; si no (default), se usa el score de pesos a mano.
  const learned = bubbleProbability(features);
  return { score: learned !== null ? learned : score, glare, features };
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
function rowsFromTiming(centers: number[], numRows: number, ql: L.QLayout): number[] | null {
  const minPts = Math.max(6, Math.floor(numRows * 0.6));
  if (centers.length < minPts) return null;

  // Cada centro → indice de fila teorico mas cercano (dedup por indice).
  const byIndex = new Map<number, number>();
  for (const c of centers) {
    const i = Math.round((c - ql.rowCY(0)) / ql.rowH);
    if (i < 0 || i >= numRows) continue;
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
  for (let row = 0; row < numRows; row++) rowY.push(Math.round(a * row + b));
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
  const ql = L.questionLayout({ numQuestions: config.numQuestions, numOptions: config.numOptions, numColumns: config.numColumns });
  const rows = readTimingRows(gray, w, h);
  if (!rowsFromTiming(rows, ql.rowsPerCol, ql)) {
    return { valid: false, reason: `Pista de temporizacion insuficiente (${rows.length}/${ql.rowsPerCol})` };
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
function darkAtBubbles(gray: Float32Array, w: number, h: number, rowY: number[], ql: L.QLayout, dx: number): number {
  let darkSum = 0;
  for (const cy of rowY) {
    for (let col = 0; col < ql.numColumns; col++) {
      for (let o = 0; o < ql.numOptions; o++) {
        const cx = ql.optX(o, col) + dx;
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
  }
  return darkSum;
}

/** Fallback software cuando la pista de temporizacion no se lee: offset (dx,dy). */
function findGridOffset(gray: Float32Array, w: number, h: number, config: OMRConfig): { dx: number; dy: number } {
  const ql = L.questionLayout({ numQuestions: config.numQuestions, numOptions: config.numOptions, numColumns: config.numColumns });
  let bestDx = 0, bestDy = 0, bestDark = -1;
  for (let dy = -CALIB.gridSearchDy; dy <= CALIB.gridSearchDy; dy += CALIB.gridSearchStep) {
    const rowY = Array.from({ length: ql.rowsPerCol }, (_, r) => ql.rowCY(r) + dy);
    for (let dx = -CALIB.gridSearchDx; dx <= CALIB.gridSearchDx; dx += CALIB.gridSearchStep) {
      const darkSum = darkAtBubbles(gray, w, h, rowY, ql, dx);
      if (darkSum > bestDark) { bestDark = darkSum; bestDx = dx; bestDy = dy; }
    }
  }
  return { dx: bestDx, dy: bestDy };
}

/** Con los Y de fila ya anclados por la temporizacion, solo refina el offset X. */
function findColumnOffset(gray: Float32Array, w: number, h: number, rowY: number[], ql: L.QLayout): number {
  let bestDx = 0, bestDark = -1;
  for (let dx = -CALIB.gridSearchDx; dx <= CALIB.gridSearchDx; dx += CALIB.gridSearchStep) {
    const darkSum = darkAtBubbles(gray, w, h, rowY, ql, dx);
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

  // Layout parametrico (default 20/5/1col reproduce la hoja actual).
  const ql = L.questionLayout({ numQuestions, numOptions, numColumns: config.numColumns });

  // Registro de filas: preferimos los Y fisicos de la pista de temporizacion;
  // si no se leen las marcas, caemos al offset software. La pista tiene una marca
  // por FILA (rowsPerCol); cada columna comparte esos Y.
  const timingRows = readTimingRows(gray, width, height);
  const fitted = rowsFromTiming(timingRows, ql.rowsPerCol, ql); // tolera marcas faltantes
  let rowY: number[];
  let gridDx: number;
  if (fitted) {
    rowY = fitted;
    gridDx = findColumnOffset(gray, width, height, rowY, ql);
  } else {
    const off = findGridOffset(gray, width, height, config);
    gridDx = off.dx;
    rowY = Array.from({ length: ql.rowsPerCol }, (_, r) => ql.rowCY(r) + off.dy);
  }
  const diag: GradeDiag = { usedTiming: !!fitted, timingRows: timingRows.length, gridDx };

  const results: BubbleResult[] = [];
  const sameCount: Record<string, number> = {};
  let glareWarnings = 0;

  for (let q = 0; q < numQuestions; q++) {
    const cy = rowY[ql.rowOf(q)];
    const col = ql.colOf(q);
    const scores: number[] = [];
    const glares: boolean[] = [];
    const feats: number[][] = [];

    for (let o = 0; o < numOptions; o++) {
      const cx = ql.optX(o, col) + gridDx;
      const { score, glare, features } = classifyBubble(gray, width, cx, cy, ql.gradeR);
      scores.push(score);
      glares.push(glare);
      feats.push(features.map((f) => Math.round(f * 1000) / 1000));
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
      features: feats,
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
  timing?: number;        // marcas de la pista del RUT detectadas (11=ancla Y activa; 0=fallback)
}

export interface RutResult {
  rut: string;          // "17517808-2" o "" si incompleto
  dvOk: boolean;        // true si el DV LEIDO coincide con el calculado (verificado)
  complete: boolean;    // true si todas las columnas del cuerpo se leyeron
  dvComputed?: boolean; // true si el DV se relleno por calculo (no se leyo de la hoja)
  diag?: RutDiag;       // registro local + scores por columna (para analisis remoto)
}

/** Y de la fila d del RUT: el detectado por la pista de temporizacion, o el canonico. */
function rutRowYat(d: number, rowYs: number[] | null): number {
  return rowYs ? rowYs[d] : L.rutRowY(d);
}

/**
 * Lee la pista de temporizacion PROPIA del RUT (marcas solidas a la izquierda de
 * la grilla) → el Y de cada fila (0..9 + K). Ancla el Y igual que las preguntas,
 * eliminando las lecturas parciales en frames movidos. Devuelve los 11 centros,
 * o null si no detecta la cantidad exacta (hoja vieja sin pista → fallback a Y
 * canonico, sin regresion).
 */
function readRutTimingY(gray: Float32Array, w: number, h: number): number[] | null {
  const x0 = Math.max(0, Math.round(L.RUT_TIMING_X - L.RUT_TIMING_W / 2 - 3));
  const x1 = Math.min(w - 1, Math.round(L.RUT_TIMING_X + L.RUT_TIMING_W / 2 + 3));
  // Banda Y acotada al bloque RUT (ignora la franja del codigo y las preguntas).
  const yLo = Math.max(0, L.rutRowY(0) - L.RUT_ROW_STEP);
  const yHi = Math.min(h - 1, L.rutRowY(L.RUT_TIMING_ROWS - 1) + L.RUT_ROW_STEP);
  // Gris promedio por fila en la banda.
  const rowAvg: number[] = [];
  for (let y = yLo; y <= yHi; y++) {
    let sum = 0, n = 0;
    for (let x = x0; x <= x1; x++) { sum += gray[y * w + x]; n++; }
    rowAvg.push(n > 0 ? sum / n : 255);
  }
  // Umbral RELATIVO al papel local (punto medio marca↔papel), adaptado al
  // contraste real. Asi la pista se engancha aunque el warp este lavado (marca
  // impresa gris ~110 sobre papel ~185), donde el umbral fijo <70 daba rut_timing=0.
  const paper = Math.max(...rowAvg);
  const darkest = Math.min(...rowAvg);
  if (paper - darkest < 25) return null; // banda plana → sin marcas
  const thresh = (paper + darkest) / 2;
  const centers: number[] = [];
  let runStart = -1, runSum = 0, runW = 0;
  for (let i = 0; i < rowAvg.length; i++) {
    const y = yLo + i;
    if (rowAvg[i] < thresh) {
      const wgt = paper - rowAvg[i]; // peso por oscuridad
      if (runStart < 0) { runStart = y; runSum = 0; runW = 0; }
      runSum += y * wgt; runW += wgt;
    } else if (runStart >= 0) {
      if (y - runStart >= 3) centers.push(Math.round(runSum / Math.max(runW, 1)));
      runStart = -1;
    }
  }
  if (runStart >= 0) centers.push(Math.round(runSum / Math.max(runW, 1)));

  // Tolerante: en vez de exigir exactamente 11 marcas (frágil en foto real con
  // ruido), ajusta una recta desde las que se detectaron (≥7) y reconstruye las
  // 11 filas — igual que la pista de las preguntas. Así el RUT se ancla aunque
  // una o dos marcas se pierdan o se peguen.
  if (centers.length < 7) return null;
  const byIndex = new Map<number, number>();
  for (const c of centers) {
    const i = Math.round((c - L.rutRowY(0)) / L.RUT_ROW_STEP);
    if (i < 0 || i >= L.RUT_TIMING_ROWS) continue;
    const expected = L.rutRowY(i);
    const prev = byIndex.get(i);
    if (prev === undefined || Math.abs(c - expected) < Math.abs(prev - expected)) byIndex.set(i, c);
  }
  const pts = [...byIndex.entries()];
  if (pts.length < 7) return null;
  let si = 0, sc = 0, sii = 0, sic = 0;
  for (const [i, c] of pts) { si += i; sc += c; sii += i * i; sic += i * c; }
  const denom = pts.length * sii - si * si;
  if (Math.abs(denom) < 1e-6) return null;
  const a = (pts.length * sic - si * sc) / denom;
  const b = (sc - a * si) / pts.length;
  if (a < L.RUT_ROW_STEP * 0.7 || a > L.RUT_ROW_STEP * 1.3) return null; // pendiente sana
  return Array.from({ length: L.RUT_TIMING_ROWS }, (_, i) => Math.round(a * i + b));
}

/** Oscuridad concentrada en los centros de burbuja del RUT para un offset (dx,dy). */
function darkAtRut(gray: Float32Array, w: number, h: number, dx: number, dy: number, rowYs: number[] | null): number {
  const r = L.RUT_R;
  let darkSum = 0;
  for (let c = 0; c < L.RUT_COLS; c++) {
    const rowCount = c === L.RUT_COLS - 1 ? L.RUT_ROWS + 1 : L.RUT_ROWS;
    for (let d = 0; d < rowCount; d++) {
      const cx = L.rutColX(c) + dx, cy = rutRowYat(d, rowYs) + dy;
      for (let yy = -r; yy <= r; yy++) {
        const py = cy + yy;
        if (py < 0 || py >= h) continue;
        for (let xx = -r; xx <= r; xx++) {
          const px = cx + xx;
          // Oscuridad CONTINUA (255-gris) en vez de contar <umbral fijo: así el
          // óptimo se centra en la tinta aunque el warp esté lavado (tinta gris).
          if (px >= 0 && px < w) darkSum += 255 - gray[py * w + px];
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
function findRutOffset(gray: Float32Array, w: number, h: number, rowYs: number[] | null): { dx: number; dy: number } {
  let bestDx = 0, bestDy = 0, bestDark = -1;
  for (let dy = -CALIB.rutSearchDy; dy <= CALIB.rutSearchDy; dy += CALIB.rutSearchStep) {
    for (let dx = -CALIB.rutSearchDx; dx <= CALIB.rutSearchDx; dx += CALIB.rutSearchStep) {
      const darkSum = darkAtRut(gray, w, h, dx, dy, rowYs);
      if (darkSum > bestDark) { bestDark = darkSum; bestDx = dx; bestDy = dy; }
    }
  }
  return { dx: bestDx, dy: bestDy };
}

/** Oscuridad sobre los centros de burbuja de UNA columna del RUT (para refinarla). */
function darkAtRutCol(gray: Float32Array, w: number, h: number, c: number, dx: number, dy: number, rowYs: number[] | null): number {
  const r = L.RUT_R;
  const rowCount = c === L.RUT_COLS - 1 ? L.RUT_ROWS + 1 : L.RUT_ROWS;
  let darkSum = 0;
  for (let d = 0; d < rowCount; d++) {
    const cx = L.rutColX(c) + dx, cy = rutRowYat(d, rowYs) + dy;
    for (let yy = -r; yy <= r; yy++) {
      const py = cy + yy;
      if (py < 0 || py >= h) continue;
      for (let xx = -r; xx <= r; xx++) {
        const px = cx + xx;
        // Oscuridad continua (ver darkAtRut): robusto a warp lavado.
        if (px >= 0 && px < w) darkSum += 255 - gray[py * w + px];
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
function refineRutCol(gray: Float32Array, w: number, h: number, c: number, baseDx: number, baseDy: number, rowYs: number[] | null): { dx: number; dy: number } {
  let bestDx = baseDx, bestDy = baseDy, bestDark = -1;
  for (let ddy = -CALIB.rutColRefine; ddy <= CALIB.rutColRefine; ddy += 2) {
    for (let ddx = -CALIB.rutColRefine; ddx <= CALIB.rutColRefine; ddx += 2) {
      const dk = darkAtRutCol(gray, w, h, c, baseDx + ddx, baseDy + ddy, rowYs);
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

  // Pista de temporizacion del RUT: ancla el Y de cada fila (0..9 + K). Si la hoja
  // la trae y se detecta, el RUT deja de fallar en frames movidos. Hoja vieja sin
  // pista → rowYs=null → fallback al Y canonico (sin regresion).
  const rowYs = readRutTimingY(gray, width, height);

  // Registro local del bloque RUT antes de muestrear (las preguntas se anclan
  // con la pista de temporizacion; el RUT busca su offset, ahora con Y anclado).
  const { dx: regDx, dy: regDy } = findRutOffset(gray, width, height, rowYs);

  const r = L.RUT_R;
  // Para cada columna: refina su offset propio y elige la fila (digito) marcada.
  // Registro ACUMULATIVO: cada columna se refina partiendo del offset de la
  // anterior, no del global → sigue la deriva de escala a lo ancho del bloque
  // (col0 lee bien pero la derecha se corre: error de escala horizontal del warp).
  const picked: (number | null)[] = [];
  const cols: RutColDiag[] = [];
  let baseDx = regDx, baseDy = regDy;
  for (let c = 0; c < L.RUT_COLS; c++) {
    const isDV = c === L.RUT_COLS - 1;
    const rowCount = isDV ? L.RUT_ROWS + 1 : L.RUT_ROWS; // la columna DV tiene K
    const { dx: colDx, dy: colDy } = refineRutCol(gray, width, height, c, baseDx, baseDy, rowYs);
    baseDx = colDx; baseDy = colDy; // la siguiente columna arranca desde aqui
    // Gris promedio del centro de cada fila (burbuja).
    const avgs: number[] = [];
    for (let d = 0; d < rowCount; d++) {
      const cx = L.rutColX(c) + colDx, cy = rutRowYat(d, rowYs) + colDy;
      let sum = 0, tot = 0;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const px = cx + dx, py = cy + dy;
        if (px >= 0 && px < width && py >= 0 && py < height) { tot++; sum += gray[py * width + px]; }
      }
      avgs.push(tot > 0 ? sum / tot : 255);
    }
    // Umbral RELATIVO al papel local: la marca es la burbuja mas oscura que el
    // papel de la columna (que en un warp lavado puede ser gris ~180, no blanco).
    // Asi lee marcas a mano de bajo contraste igual que las preguntas; el umbral
    // fijo <70 fallaba porque NADA bajaba de 70 en un warp gris. En imagen limpia
    // (marca ~0, papel ~255) da ~1.0 igual que antes → sin regresion.
    const paper = Math.max(...avgs);
    const scores = avgs.map((a) => Math.max(0, Math.min(1, (paper - a) / (paper * 0.30))));
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
  return { rut, dvOk, complete, dvComputed, diag: { dx: regDx, dy: regDy, dvComputed, cols, timing: rowYs ? rowYs.length : 0 } };
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

