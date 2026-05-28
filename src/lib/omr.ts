/**
 * Motor OMR - TuLector
 * Pipeline de escaneo OMR:
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

// ─── 1. Corner detection: grid-based dense-blob with 2-direction white neighbor check ──
export function findCorners(imageData: ImageData, config: OMRConfig = DEFAULT_CONFIG): [number, number][] | null {
  const w = imageData.width, h = imageData.height;
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < gray.length; i++) {
    const j = i * 4;
    gray[i] = Math.round(imageData.data[j] * 0.299 + imageData.data[j + 1] * 0.587 + imageData.data[j + 2] * 0.114);
  }

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
  const maxCellDensity = 0.90;
  const checkGap = Math.floor(cellSize * 1.2); // distance to check paper whiteness

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

    if (bestScore < 0) return null;

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
  if (aspect < 0.35 || aspect > 2.8) return null;
  if (topW / Math.max(botW, 1) < 0.3 || botW / Math.max(topW, 1) < 0.3) return null;
  if (leftH / Math.max(rightH, 1) < 0.3 || rightH / Math.max(leftH, 1) < 0.3) return null;
  const area = Math.abs((tr[0] - tl[0]) * (br[1] - tl[1]) - (tr[1] - tl[1]) * (br[0] - tl[0]));
  if (area < 15000) return null;
  // Borde superior e inferior deben ser aproximadamente horizontales (tilt máximo ~12%)
  if (Math.abs(tl[1] - tr[1]) > h * 0.12) return null;
  if (Math.abs(bl[1] - br[1]) > h * 0.12) return null;

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

// ─── 3. Analisis de burbujas (SVM-like multi-feature classifier) ──
const DARK_THRESH = 70;
const GLARE_THRESH = 220;

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
  const glare = bright / total > 0.25;

  return { score, glare, features: [darkRatio, contrast, variance, edgeDensity] };
}

// Scanner Curve Check (return code 10): detecta papel doblado/curvado
function checkCurve(corners: [number, number][]): boolean {
  const [tl, tr, br, bl] = corners;
  const topLen = Math.hypot(tr[0] - tl[0], tr[1] - tl[1]);
  const botLen = Math.hypot(br[0] - bl[0], br[1] - bl[1]);
  const leftLen = Math.hypot(bl[0] - tl[0], bl[1] - tl[1]);
  const rightLen = Math.hypot(br[0] - tr[0], br[1] - tr[1]);

  // Papel curvado: lados opuestos muy diferentes (>40% diferencia)
  const hRatio = Math.max(topLen, botLen) / Math.max(Math.min(topLen, botLen), 1);
  const vRatio = Math.max(leftLen, rightLen) / Math.max(Math.min(leftLen, rightLen), 1);
  if (hRatio > 1.4 || vRatio > 1.4) return true;

  // Verificar que las diagonales son similares (papel plano = diagonales iguales)
  const diag1 = Math.hypot(br[0] - tl[0], br[1] - tl[1]);
  const diag2 = Math.hypot(tr[0] - bl[0], tr[1] - bl[1]);
  const dRatio = Math.max(diag1, diag2) / Math.max(Math.min(diag1, diag2), 1);
  if (dRatio > 1.3) return true;

  return false;
}

// Scanner Format Validation (return code 30): verifica que la hoja sea la correcta
function validateFormat(gray: Float32Array, w: number, h: number, config: OMRConfig): { valid: boolean; reason?: string } {
  const { margin: M } = config;
  const { Q_TOP } = getLayout(config);

  // 1. Verificar que las esquinas tienen marcas oscuras (corner squares)
  const cornersToCheck: [number, number][] = [
    [M + 25, M + 25],
    [w - M - 25, M + 25],
    [w - M - 25, h - M - 25],
    [M + 25, h - M - 25],
  ];
  for (const [cx, cy] of cornersToCheck) {
    let dark = 0, total = 0;
    for (let dy = -15; dy <= 15; dy++) {
      for (let dx = -15; dx <= 15; dx++) {
        const px = cx + dx, py = cy + dy;
        if (px >= 0 && px < w && py >= 0 && py < h) {
          total++;
          if (gray[py * w + px] < DARK_THRESH) dark++;
        }
      }
    }
    if (total > 0 && dark / total < 0.08) return { valid: false, reason: `Falta marca de esquina en (${cx},${cy})` };
  }

  // 2. Verificar que hay burbujas en las posiciones esperadas (grid pattern)
  // Muestrear 5 posiciones de burbujas distribuidas
  const sampleQuestions = [0, 5, 10, 15, 19]; // Q1, Q6, Q11, Q16, Q20
  let bubbleChecks = 0, bubblePassed = 0;
  for (const q of sampleQuestions) {
    const qy = Q_TOP + q * 42;
    for (let o = 0; o < 5; o++) {
      const cx = M + 188 + o * 50, cy = qy + 16;
      let ring = 0, total = 0;
      // Verificar que hay un anillo (circulo vacio) en la posicion de la burbuja
      for (let dy = -12; dy <= 12; dy++) {
        for (let dx = -12; dx <= 12; dx++) {
          const px = cx + dx, py = cy + dy;
          if (px >= 0 && px < w && py >= 0 && py < h) {
            total++;
            const dist = Math.sqrt(dx * dx + dy * dy);
            // El borde del circulo (anillo) debe tener pixeles oscuros
            if (dist > 9 && dist < 13 && gray[py * w + px] < 100) ring++;
          }
        }
      }
      bubbleChecks++;
      if (total > 0 && ring / total > 0.01) bubblePassed++;
    }
  }
  const bubbleRatio = bubblePassed / bubbleChecks;
  if (bubbleRatio < 0.5) return { valid: false, reason: `Solo ${Math.round(bubbleRatio * 100)}% burbujas detectadas - formato incorrecto` };

  // 3. Verificar que el area de ID tiene estructura de burbujas
  const { ID_START } = getLayout(config);
  let idChecks = 0, idPassed = 0;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) { // solo primeras 5 columnas
      const cx = M + 30 + col * 28, cy = ID_START + 10 + row * 28;
      let ring = 0, total = 0;
      for (let dy = -8; dy <= 8; dy++) {
        for (let dx = -8; dx <= 8; dx++) {
          const px = cx + dx, py = cy + dy;
          if (px >= 0 && px < w && py >= 0 && py < h) {
            total++;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 6 && dist < 9 && gray[py * w + px] < 100) ring++;
          }
        }
      }
      idChecks++;
      if (total > 0 && ring / total > 0.005) idPassed++;
    }
  }
  if (idChecks > 0 && idPassed / idChecks < 0.3) return { valid: false, reason: "Zona de ID no detectada - formato incorrecto" };

  return { valid: true };
}

export function gradeBubbles(imageData: ImageData, config: OMRConfig = DEFAULT_CONFIG, corners?: [number, number][]): GradeReport {
  const { width, height, data } = imageData;
  const { numQuestions, numOptions, margin: M } = config;
  const labels = config.optionLabels.split("");
  const { Q_TOP } = getLayout(config);
  const qH = 42;

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

  const results: BubbleResult[] = [];
  const sameCount: Record<string, number> = {};
  let glareWarnings = 0;

  for (let q = 0; q < numQuestions; q++) {
    const qy = Q_TOP + q * qH;
    const scores: number[] = [];
    const glares: boolean[] = [];

    for (let o = 0; o < numOptions; o++) {
      const cx = M + 188 + o * 50, cy = qy + 16;
      const { score, glare } = classifyBubble(gray, width, cx, cy, 10);
      scores.push(score);
      glares.push(glare);
      if (glare) glareWarnings++;
    }

    // : umbral adaptativo + deteccion de marcas multiples
    const maxS = Math.max(...scores);
    const minValidScore = 0.25; // minimo absoluto para considerar marcado
    const thresh = Math.max(minValidScore, maxS * 0.55);
    const marked = scores.map((s, i) => (s > thresh && !glares[i]) ? i : -1).filter(i => i >= 0);

    // Si hay glare en varias opciones, la pregunta es no confiable
    const hasGlare = glares.filter(g => g).length >= 3;

    let answer = "-";
    if (hasGlare) {
      answer = "?"; // no confiable por brillo
    } else if (marked.length === 0 && maxS > 0.12) {
      answer = labels[scores.indexOf(maxS)];
    } else if (marked.length > 0 && marked.length <= 3) {
      // Soporte combinado: hasta 3 letras (como Scanner combo)
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
    return { results, valid: false, reason: `Demasiado brillo: ${glareWarnings} burbujas con reflejo` };
  }

  const answeredCount = results.filter(r => r.answer !== "-" && r.answer !== "?").length;
  if (answeredCount === 0) {
    return { results, valid: false, reason: "Sin respuestas detectadas" };
  }

  const maxSame = Math.max(...Object.values(sameCount));
  if (maxSame >= 18 && answeredCount >= 18) {
    const dominant = Object.entries(sameCount).find(([, v]) => v === maxSame)?.[0];
    return { results, valid: false, reason: `${maxSame}/20 respuestas "${dominant}" - posible mal warp` };
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
        if (px >= 0 && px < width && py >= 0 && py < height) { tot++; if (gray[py * width + px] < DARK_THRESH) dk++; }
      }
      s += (tot > 0 && dk / tot > 0.12) ? "1" : "0";
    }
    rows.push(s);
  }
  return rows;
}

export { DEFAULT_CONFIG };

