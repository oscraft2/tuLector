/**
 * Motor OMR - TuLector
 * Inspirado en el pipeline de ZipGrade:
 *   1. Deteccion de 4 esquinas (centro de masa por cuadrante)
 *   2. Correccion de perspectiva (homografia 8x8)
 *   3. Analisis de grilla de burbujas (umbral adaptativo)
 *   4. Lectura de ID de estudiante (burbujas binarias)
 */

export interface OMRConfig {
  numQuestions: number; numOptions: number; optionLabels: string;
  idRows: number; idCols: number;
  sheetWidth: number; sheetHeight: number;
  margin: number; cornerSize: number;
}

export interface BubbleResult {
  question: number; answer: string; scores: number[]; correct: boolean | null;
}

export interface GradeReport {
  results: BubbleResult[]; valid: boolean; reason?: string;
}

// ─── Configuracion ─────────────────────────────────────────────
const DEFAULT_CONFIG: OMRConfig = {
  numQuestions: 20, numOptions: 5, optionLabels: "ABCDE",
  idRows: 3, idCols: 10,
  sheetWidth: 1200, sheetHeight: 1650,
  margin: 40, cornerSize: 50,
};

function getLayout(config: OMRConfig) {
  const { margin: M, cornerSize: CS, idRows } = config;
  const NAME_TOP = M + CS + 10;
  const NAME_H = 35;
  const NAME_BOTTOM = NAME_TOP + NAME_H;
  const ID_START = NAME_BOTTOM + 15;
  const Q_TOP = ID_START + idRows * 28 + 30;
  return { NAME_TOP, NAME_BOTTOM, ID_START, Q_TOP };
}

// ─── 1. Deteccion de esquinas ──────────────────────────────────
export function findCorners(imageData: ImageData, config: OMRConfig = DEFAULT_CONFIG): [number, number][] | null {
  const w = imageData.width, h = imageData.height;
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < gray.length; i++) {
    const j = i * 4;
    gray[i] = Math.round(imageData.data[j] * 0.299 + imageData.data[j + 1] * 0.587 + imageData.data[j + 2] * 0.114);
  }
  const zones: [number, number, number, number, number, number][] = [
    [0, 0, w * 0.08, h * 0.06, 0, 0],           // TL: expected near (0,0)
    [w * 0.92, 0, w, h * 0.06, w, 0],             // TR: expected near (w,0)
    [w * 0.92, h * 0.92, w, h, w, h],             // BR: expected near (w,h)
    [0, h * 0.92, w * 0.08, h, 0, h],             // BL: expected near (0,h)
  ];
  const corners: [number, number][] = [];
  for (const [x0, y0, x1, y1, ex, ey] of zones) {
    let sx = 0, sy = 0, c = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (gray[y * w + x] < 80) { sx += x; sy += y; c++; }
      }
    }
    // Cada zona debe tener suficientes pixeles oscuros (el corner square)
    if (c < 50) return null;
    corners.push([Math.round(sx / c), Math.round(sy / c)]);
  }

  // Validar que las 4 esquinas formen un cuadrilatero valido
  const [tl, tr, br, bl] = corners;
  const topW = Math.hypot(tr[0] - tl[0], tr[1] - tl[1]);
  const botW = Math.hypot(br[0] - bl[0], br[1] - bl[1]);
  const leftH = Math.hypot(bl[0] - tl[0], bl[1] - tl[1]);
  const rightH = Math.hypot(br[0] - tr[0], br[1] - tr[1]);

  // Ratio de aspecto debe ser cercano a 3:4 (~0.72)
  const avgW = (topW + botW) / 2;
  const avgH = (leftH + rightH) / 2;
  const aspectRatio = avgW / Math.max(avgH, 1);
  if (aspectRatio < 0.4 || aspectRatio > 2.0) return null;

  // Los lados paralelos deben ser similares (no deformados)
  if (topW / Math.max(botW, 1) < 0.3 || botW / Math.max(topW, 1) < 0.3) return null;
  if (leftH / Math.max(rightH, 1) < 0.3 || rightH / Math.max(leftH, 1) < 0.3) return null;

  // Area minima del cuadrilatero
  const area = Math.abs((tr[0] - tl[0]) * (br[1] - tl[1]) - (tr[1] - tl[1]) * (br[0] - tl[0]));
  if (area < 50000) return null;

  return corners;
}

// ─── 2. Correccion de perspectiva ──────────────────────────────
export function warpPerspective(
  sourceCtx: CanvasRenderingContext2D,
  corners: [number, number][],
  config: OMRConfig = DEFAULT_CONFIG
): ImageData {
  const { sheetWidth: W, sheetHeight: H, margin: M, cornerSize: CS } = config;
  const [tl, tr, br, bl] = corners;
  const dst = [M + CS / 2, M + CS / 2, W - M - CS / 2, M + CS / 2, W - M - CS / 2, H - M - CS / 2, M + CS / 2, H - M - CS / 2];
  const src = [...tl, ...tr, ...br, ...bl];
  const A: number[][] = [], b: number[] = [];
  for (let i = 0; i < 4; i++) {
    A.push([src[i * 2], src[i * 2 + 1], 1, 0, 0, 0, -dst[i * 2] * src[i * 2], -dst[i * 2] * src[i * 2 + 1]]);
    A.push([0, 0, 0, src[i * 2], src[i * 2 + 1], 1, -dst[i * 2 + 1] * src[i * 2], -dst[i * 2 + 1] * src[i * 2 + 1]]);
    b.push(dst[i * 2]); b.push(dst[i * 2 + 1]);
  }
  const h = solve8x8(A, b);
  if (!h) return sourceCtx.getImageData(0, 0, W, H);
  const outCtx = document.createElement("canvas").getContext("2d")!;
  const outCanvas = outCtx.canvas; outCanvas.width = W; outCanvas.height = H;
  const outData = outCtx.createImageData(W, H);
  const srcData = sourceCtx.getImageData(0, 0, sourceCtx.canvas.width, sourceCtx.canvas.height);
  for (let dy = 0; dy < H; dy++) {
    for (let dx = 0; dx < W; dx++) {
      const denom = h[6] * dx + h[7] * dy + 1;
      const sx = (h[0] * dx + h[1] * dy + h[2]) / denom;
      const sy = (h[3] * dx + h[4] * dy + h[5]) / denom;
      const si = Math.round(sy) * sourceCtx.canvas.width + Math.round(sx);
      const di = dy * W + dx;
      if (sx >= 0 && sx < sourceCtx.canvas.width && sy >= 0 && sy < sourceCtx.canvas.height) {
        outData.data[di * 4] = srcData.data[si * 4]; outData.data[di * 4 + 1] = srcData.data[si * 4 + 1];
        outData.data[di * 4 + 2] = srcData.data[si * 4 + 2]; outData.data[di * 4 + 3] = 255;
      }
    }
  }
  return outData;
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

// ─── 3. Analisis de burbujas ───────────────────────────────────
export function gradeBubbles(imageData: ImageData, config: OMRConfig = DEFAULT_CONFIG): GradeReport {
  const { width, height, data } = imageData;
  const { numQuestions, numOptions, margin: M } = config;
  const labels = config.optionLabels.split("");
  const { Q_TOP } = getLayout(config);
  const qH = 42;

  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) gray[i] = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;

  // Validacion: el warp debe tener pixeles oscuros
  let td = 0; for (let i = 0; i < gray.length; i++) { if (gray[i] < 80) td++; }
  if (td / gray.length < 0.003) return { results: [], valid: false, reason: "Warp vacio" };

  const results: BubbleResult[] = [];
  // @ts-ignore
  let sameCount: Record<string, number> = {};

  for (let q = 0; q < numQuestions; q++) {
    const qy = Q_TOP + q * qH;
    const scores: number[] = [];
    for (let o = 0; o < numOptions; o++) {
      const cx = M + 50 + o * 50, cy = qy + 16; let dk = 0, tot = 0;
      for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) {
        const px = cx + dx, py = cy + dy;
        if (px >= 0 && px < width && py >= 0 && py < height) { tot++; if (gray[py * width + px] < 80) dk++; }
      }
      scores.push(tot > 0 ? dk / tot : 0);
    }

    const maxS = Math.max(...scores);
    const thresh = Math.max(0.15, maxS * 0.3);
    const marked = scores.map((s, i) => s > thresh && s > 0.06 ? i : -1).filter(i => i >= 0);

    let answer = "-";
    if (marked.length === 0 && maxS > 0.07) answer = labels[scores.indexOf(maxS)];
    else if (marked.length > 0) answer = marked.map(i => labels[i]).join("");

    results.push({ question: q + 1, answer, scores: scores.map(s => Math.round(s * 1000) / 1000), correct: null });
    sameCount[answer] = (sameCount[answer] || 0) + 1;
  }

  // Validacion post: no todas iguales
  const maxSame = Math.max(...Object.values(sameCount));
  if (maxSame >= 18 && maxSame === results.length) {
    return { results, valid: false, reason: `Resultado sospechoso: ${maxSame}/20 respuestas iguales` };
  }

  return { results, valid: true };
}

// ─── 4. ID de estudiante ───────────────────────────────────────
export function readStudentId(imageData: ImageData, config: OMRConfig = DEFAULT_CONFIG): string[] {
  const { width, height, data } = imageData;
  const { idRows, idCols, margin: M } = config;
  const { ID_START } = getLayout(config);
  const xStart = M + 30, yStart = ID_START + 10;

  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) gray[i] = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;

  const rows: string[] = [];
  for (let row = 0; row < idRows; row++) {
    let s = "";
    for (let col = 0; col < idCols; col++) {
      const cx = xStart + col * 28, cy = yStart + row * 28; let dk = 0, tot = 0;
      for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
        const px = cx + dx, py = cy + dy;
        if (px >= 0 && px < width && py >= 0 && py < height) { tot++; if (gray[py * width + px] < 80) dk++; }
      }
      s += (tot > 0 && dk / tot > 0.12) ? "1" : "0";
    }
    rows.push(s);
  }
  return rows;
}

export { DEFAULT_CONFIG };
