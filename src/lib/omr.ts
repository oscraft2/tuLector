/**
 * Motor OMR - Corre en el navegador usando Canvas API.
 * Inspirado en el pipeline de ZipGrade:
 *   1. Deteccion de 4 esquinas
 *   2. Correccion de perspectiva
 *   3. Analisis de grilla de burbujas
 *   4. Lectura de ID de estudiante
 */

export interface OMRConfig {
  numQuestions: number;
  numOptions: number;
  optionLabels: string;
  idRows: number;
  idCols: number;
  sheetWidth: number;
  sheetHeight: number;
  margin: number;
  cornerSize: number;
}

export interface BubbleResult {
  question: number;
  answer: string;
  scores: number[];
  correct: boolean | null;
}

const DEFAULT_CONFIG: OMRConfig = {
  numQuestions: 20,
  numOptions: 5,
  optionLabels: "ABCDE",
  idRows: 3,
  idCols: 10,
  sheetWidth: 1200,
  sheetHeight: 1650,
  margin: 40,
  cornerSize: 50,
};

/** Layout precalculado (debe coincidir con el generador de hojas) */
function getLayout(config: OMRConfig) {
  const { margin: M, cornerSize: CS, idRows } = config;
  const NAME_TOP = M + CS + 10;       // 100 - bajo la esquina TL
  const NAME_H = 35;
  const NAME_BOTTOM = NAME_TOP + NAME_H; // 135
  const ID_START = NAME_BOTTOM + 15;    // 150 - primera fila de burbujas ID
  const Q_TOP = ID_START + idRows * 28 + 30; // 264 - primera fila de preguntas
  return { NAME_TOP, NAME_BOTTOM, ID_START, Q_TOP };
}

/** Detectar los 4 cuadrados de esquina */
export function findCorners(
  imageData: ImageData,
  config: OMRConfig = DEFAULT_CONFIG
): [number, number][] | null {
  const { width, height, data } = imageData;
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }

  // Otsu threshold
  const hist = new Int32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;
  let sumB = 0, wB = 0, maxVariance = 0, threshold = 128;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVariance) { maxVariance = between; threshold = t; }
  }

  const binary = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    binary[i] = gray[i] < threshold ? 1 : 0;
  }

  // Flood-fill para encontrar componentes conectados (blobs oscuros)
  const visited = new Uint8Array(width * height);
  const blobs: { cx: number; cy: number; area: number; bbox: number[] }[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (binary[idx] === 0 || visited[idx] === 1) continue;

      const stack: [number, number][] = [[x, y]];
      visited[idx] = 1;
      let area = 0;
      let minX = x, maxX = x, minY = y, maxY = y;

      while (stack.length > 0) {
        const [cx, cy] = stack.pop()!;
        area++;
        if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;

        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const ni = ny * width + nx;
            if (binary[ni] === 1 && visited[ni] === 0) {
              visited[ni] = 1;
              stack.push([nx, ny]);
            }
          }
        }
      }

      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      if (area > 80 && bw > 6 && bh > 6 && bw < 200 && bh < 200) {
        const aspect = bw / Math.max(bh, 1);
        if (aspect > 0.5 && aspect < 2.0) {
          blobs.push({ cx: Math.round((minX + maxX) / 2), cy: Math.round((minY + maxY) / 2), area, bbox: [minX, minY, maxX, maxY] });
        }
      }
    }
  }

  // Cuadrantes: elegir el blob mas cercano a cada esquina de la imagen
  const quadrants: Record<string, { cx: number; cy: number; score: number }> = {};
  for (const blob of blobs) {
    const qx = blob.cx < width / 2 ? 0 : 1;
    const qy = blob.cy < height / 2 ? 0 : 1;
    const key = `${qx},${qy}`;
    const cornerX = qx === 0 ? 0 : width;
    const cornerY = qy === 0 ? 0 : height;
    const dist = Math.hypot(blob.cx - cornerX, blob.cy - cornerY);
    const score = dist - blob.area * 0.01;
    if (!quadrants[key] || score < quadrants[key].score) {
      quadrants[key] = { cx: blob.cx, cy: blob.cy, score };
    }
  }

  if (Object.keys(quadrants).length !== 4) return null;

  return [
    [quadrants["0,0"].cx, quadrants["0,0"].cy],
    [quadrants["1,0"].cx, quadrants["1,0"].cy],
    [quadrants["1,1"].cx, quadrants["1,1"].cy],
    [quadrants["0,1"].cx, quadrants["0,1"].cy],
  ];
}

/** Correccion de perspectiva via mapeo inverso sobre canvas */
export function warpPerspective(
  sourceCtx: CanvasRenderingContext2D,
  corners: [number, number][],
  config: OMRConfig = DEFAULT_CONFIG
): ImageData {
  const { sheetWidth: W, sheetHeight: H, margin: M, cornerSize: CS } = config;
  const [tl, tr, br, bl] = corners;

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Calcular matriz de transformacion (via solve 8x8)
  const dst = [
    M + CS / 2, M + CS / 2,
    W - M - CS / 2, M + CS / 2,
    W - M - CS / 2, H - M - CS / 2,
    M + CS / 2, H - M - CS / 2,
  ];
  const src = [...tl, ...tr, ...br, ...bl];

  // Construir sistema A*x = b
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    A.push([src[i * 2], src[i * 2 + 1], 1, 0, 0, 0, -dst[i * 2] * src[i * 2], -dst[i * 2] * src[i * 2 + 1]]);
    A.push([0, 0, 0, src[i * 2], src[i * 2 + 1], 1, -dst[i * 2 + 1] * src[i * 2], -dst[i * 2 + 1] * src[i * 2 + 1]]);
    b.push(dst[i * 2]);
    b.push(dst[i * 2 + 1]);
  }

  const h = solve8x8(A, b);
  if (!h) return sourceCtx.getImageData(0, 0, W, H);

  // Mapeo inverso: para cada pixel destino, encontrar fuente
  const outData = ctx.createImageData(W, H);
  const srcData = sourceCtx.getImageData(0, 0, sourceCtx.canvas.width, sourceCtx.canvas.height);

  for (let dy = 0; dy < H; dy++) {
    for (let dx = 0; dx < W; dx++) {
      const denom = h[6] * dx + h[7] * dy + 1;
      const sx = (h[0] * dx + h[1] * dy + h[2]) / denom;
      const sy = (h[3] * dx + h[4] * dy + h[5]) / denom;

      const si = Math.round(sy) * sourceCtx.canvas.width + Math.round(sx);
      const di = dy * W + dx;

      if (sx >= 0 && sx < sourceCtx.canvas.width && sy >= 0 && sy < sourceCtx.canvas.height) {
        outData.data[di * 4] = srcData.data[si * 4];
        outData.data[di * 4 + 1] = srcData.data[si * 4 + 1];
        outData.data[di * 4 + 2] = srcData.data[si * 4 + 2];
        outData.data[di * 4 + 3] = 255;
      }
    }
  }

  return outData;
}

/** Resolver sistema 8x8 para homografia */
function solve8x8(A: number[][], b: number[]): number[] | null {
  const n = 8;
  const mat: number[][] = [];
  for (let i = 0; i < n; i++) {
    mat[i] = [];
    for (let j = 0; j < n; j++) mat[i][j] = A[i][j];
    mat[i].push(b[i]);
  }

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(mat[row][col]) > Math.abs(mat[maxRow][col])) maxRow = row;
    }
    [mat[col], mat[maxRow]] = [mat[maxRow], mat[col]];

    if (Math.abs(mat[col][col]) < 1e-10) return null;

    for (let row = col + 1; row < n; row++) {
      const factor = mat[row][col] / mat[col][col];
      for (let j = col; j <= n; j++) mat[row][j] -= factor * mat[col][j];
    }
  }

  const x: number[] = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = mat[i][n];
    for (let j = i + 1; j < n; j++) x[i] -= mat[i][j] * x[j];
    x[i] /= mat[i][i];
  }
  return x;
}

/** Analizar burbujas en imagen ya corregida */
export function gradeBubbles(
  imageData: ImageData,
  config: OMRConfig = DEFAULT_CONFIG
): BubbleResult[] {
  const { width, height, data } = imageData;
  const { numQuestions, numOptions, margin: M, cornerSize: CS } = config;
  const labels = config.optionLabels.split("");

  const { Q_TOP } = getLayout(config);
  const qH = 42;

  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;
  }

  const results: BubbleResult[] = [];

  for (let q = 0; q < numQuestions; q++) {
    const qy = Q_TOP + q * qH;
    const scores: number[] = [];

    for (let o = 0; o < numOptions; o++) {
      const cx = M + 50 + o * 50;
      const cy = qy + 16;
      const r = 10;
      let dark = 0, total = 0;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const py = cy + dy, px = cx + dx;
          if (px >= 0 && px < width && py >= 0 && py < height) {
            const i = py * width + px;
            total++;
            if (gray[i] < 128) dark++;
          }
        }
      }
      scores.push(total > 0 ? dark / total : 0);
    }

    const maxS = Math.max(...scores);
    const thresh = Math.max(0.10, maxS * 0.35);
    const marked = scores
      .map((s, i) => (s > thresh && s > 0.04 ? i : -1))
      .filter((i) => i >= 0);

    let answer = "-";
    if (marked.length === 0 && maxS > 0.04) {
      answer = labels[scores.indexOf(maxS)];
    } else if (marked.length > 0) {
      answer = marked.map((i) => labels[i]).join("");
    }

    results.push({
      question: q + 1,
      answer,
      scores: scores.map((s) => Math.round(s * 1000) / 1000),
      correct: null,
    });
  }

  return results;
}

/** Leer ID de estudiante */
export function readStudentId(
  imageData: ImageData,
  config: OMRConfig = DEFAULT_CONFIG
): string[] {
  const { width, height, data } = imageData;
  const { idRows, idCols, margin: M, cornerSize: CS } = config;
  const { ID_START } = getLayout(config);

  const xStart = M + 30;
  const yStart = ID_START + 10;

  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;
  }

  const rows: string[] = [];
  for (let row = 0; row < idRows; row++) {
    let rowStr = "";
    for (let col = 0; col < idCols; col++) {
      const cx = xStart + col * 28;
      const cy = yStart + row * 28;
      const r = 6;
      let dark = 0, total = 0;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const px = cx + dx, py = cy + dy;
          if (px >= 0 && px < width && py >= 0 && py < height) {
            total++;
            if (gray[py * width + px] < 128) dark++;
          }
        }
      }
      rowStr += total > 0 && dark / total > 0.12 ? "1" : "0";
    }
    rows.push(rowStr);
  }
  return rows;
}

export { DEFAULT_CONFIG };
