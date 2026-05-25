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

/** Detectar los 4 cuadrados de esquina (inspirado en ZipGrade: quadrant-based) */
export function findCorners(
  imageData: ImageData,
  config: OMRConfig = DEFAULT_CONFIG
): [number, number][] | null {
  const { width, height, data } = imageData;
  const w = width, h = height;

  // Convertir a grayscale
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < gray.length; i++) {
    const j = i * 4;
    gray[i] = Math.round(data[j] * 0.299 + data[j + 1] * 0.587 + data[j + 2] * 0.114);
  }

  // En vez de flood-fill costoso, buscar regiones oscuras cerca de cada esquina
  // usando escaneo radial desde la esquina de la imagen hacia adentro
  const corners: [number, number][] = [];
  const quadrants: [number, number, number, number][] = [
    [0, 0, w / 2, h / 2],          // TL: top-left
    [w / 2, 0, w, h / 2],           // TR: top-right
    [w / 2, h / 2, w, h],           // BR: bottom-right
    [0, h / 2, w / 2, h],           // BL: bottom-left
  ];

  for (const [qx0, qy0, qx1, qy1] of quadrants) {
    // Direccion de busqueda: desde la esquina de la imagen hacia adentro
    const xDir = qx0 === 0 ? 1 : -1;
    const yDir = qy0 === 0 ? 1 : -1;
    const xStart = qx0 === 0 ? 0 : w - 1;
    const yStart = qy0 === 0 ? 0 : h - 1;
    const xEnd = qx0 === 0 ? w / 2 : w / 2;
    const yEnd = qy0 === 0 ? h / 2 : h / 2;

    let bestX = Math.round((qx0 + qx1) / 2);
    let bestY = Math.round((qy0 + qy1) / 2);
    let bestScore = Infinity;

    // Escanear una cuadricula de puntos en el cuadrante, buscar el mas oscuro
    // que sea razonablemente cuadrado (el corner square)
    for (let cy = Math.min(yStart, yEnd); cy <= Math.max(yStart, yEnd); cy += 4) {
      for (let cx = Math.min(xStart, xEnd); cx <= Math.max(xStart, xEnd); cx += 4) {
        // Calcular densidad de oscuridad en una ventana alrededor de (cx, cy)
        let darkCount = 0, totalCount = 0;
        const winSize = 30;
        for (let dy = -winSize; dy <= winSize; dy += 2) {
          for (let dx = -winSize; dx <= winSize; dx += 2) {
            const px = cx + dx, py = cy + dy;
            if (px >= 0 && px < w && py >= 0 && py < h) {
              totalCount++;
              if (gray[py * w + px] < 100) darkCount++;
            }
          }
        }
        const darkRatio = totalCount > 0 ? darkCount / totalCount : 0;

        // Un corner square debe tener alta densidad oscura pero no 100%
        // (los corners son cuadrados huecos = borde oscuro + centro blanco)
        if (darkRatio > 0.08 && darkRatio < 0.5) {
          // Score: preferir puntos cercanos a la esquina con alta densidad
          const cornerDist = Math.hypot(cx - xStart, cy - yStart);
          const score = cornerDist - darkRatio * 500;
          if (score < bestScore) {
            bestScore = score;
            bestX = cx;
            bestY = cy;
          }
        }
      }
    }

    corners.push([bestX, bestY]);
  }

  // Validar que las 4 esquinas formen un cuadrilatero razonable
  const [tl, tr, br, bl] = corners;
  const diag1 = Math.hypot(tr[0] - tl[0], tr[1] - tl[1]);
  const diag2 = Math.hypot(br[0] - bl[0], br[1] - bl[1]);
  const ratio = Math.max(diag1, diag2) / Math.min(diag1, diag2);

  if (ratio > 3) return null; // esquinas demasiado asimetricas

  return corners as [number, number][];
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
