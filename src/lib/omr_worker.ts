/**
 * OMR Web Worker - Corre el warp en thread separado para no bloquear UI.
 * Evita bloquear el UI thread durante el procesamiento pesado.
 */

export interface WarpMessage {
  type: "warp";
  imageData: ImageData;
  corners: [number, number][];
  width: number;
  height: number;
  margin: number;
  cornerSize: number;
}

export interface WarpResponse {
  type: "warped" | "error";
  imageData?: ImageData;
  error?: string;
}

// El worker se ejecuta en un hilo separado
const workerCode = `
function solve8x8(A, b) {
  const n = 8;
  const mat = A.map((r, i) => [...r, b[i]]);
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

self.onmessage = function(e) {
  const { type, imageData, corners, width, height, margin, cornerSize } = e.data;
  if (type !== "warp") return;

  try {
    const W = width, H = height, M = margin, CS = cornerSize;
    const [tl, tr, br, bl] = corners;
    const dst = [M+CS/2, M+CS/2, W-M-CS/2, M+CS/2, W-M-CS/2, H-M-CS/2, M+CS/2, H-M-CS/2];
    const src = [...tl, ...tr, ...br, ...bl];
    
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      A.push([src[i*2], src[i*2+1], 1, 0, 0, 0, -dst[i*2]*src[i*2], -dst[i*2]*src[i*2+1]]);
      A.push([0, 0, 0, src[i*2], src[i*2+1], 1, -dst[i*2+1]*src[i*2], -dst[i*2+1]*src[i*2+1]]);
      b.push(dst[i*2]); b.push(dst[i*2+1]);
    }
    
    const h = solve8x8(A, b);
    if (!h) { self.postMessage({ type: "error", error: "solve8x8 failed" }); return; }

    const outData = new ImageData(W, H);
    const srcW = imageData.width, srcH = imageData.height;
    const sd = imageData.data, od = outData.data;

    for (let dy = 0; dy < H; dy++) {
      for (let dx = 0; dx < W; dx++) {
        const denom = h[6]*dx + h[7]*dy + 1;
        const sx = (h[0]*dx + h[1]*dy + h[2]) / denom;
        const sy = (h[3]*dx + h[4]*dy + h[5]) / denom;
        const six = Math.round(sx), siy = Math.round(sy);
        
        if (six >= 0 && six < srcW && siy >= 0 && siy < srcH) {
          const si = (siy * srcW + six) * 4;
          const di = (dy * W + dx) * 4;
          od[di] = sd[si]; od[di+1] = sd[si+1]; od[di+2] = sd[si+2]; od[di+3] = 255;
        }
      }
    }

    self.postMessage({ type: "warped", imageData: outData }, [outData.data.buffer]);
  } catch (err) {
    self.postMessage({ type: "error", error: err.message });
  }
};
`;

let worker: Worker | null = null;
let warpResolver: ((data: ImageData) => void) | null = null;

function getWorker(): Worker {
  if (!worker) {
    const blob = new Blob([workerCode], { type: "application/javascript" });
    worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = (e: MessageEvent<WarpResponse>) => {
      if (e.data.type === "warped" && e.data.imageData && warpResolver) {
        warpResolver(e.data.imageData);
        warpResolver = null;
      }
    };
  }
  return worker;
}

/** Ejecuta warp en Web Worker. Retorna Promise con ImageData corregido. */
export function warpAsync(
  imageData: ImageData,
  corners: [number, number][],
  config: { sheetWidth: number; sheetHeight: number; margin: number; cornerSize: number }
): Promise<ImageData> {
  return new Promise((resolve) => {
    warpResolver = resolve;
    getWorker().postMessage({
      type: "warp",
      imageData,
      corners,
      width: config.sheetWidth,
      height: config.sheetHeight,
      margin: config.margin,
      cornerSize: config.cornerSize,
    } as WarpMessage, [imageData.data.buffer]); // Transfer ownership
  });
}

/** Destruir worker */
export function terminateWorker() {
  if (worker) { worker.terminate(); worker = null; }
}

