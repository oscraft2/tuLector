/**
 * SUB-MOTOR OMR del bloque compacto.
 *
 * Separado de omr.ts a proposito: el motor de hoja completa esta en produccion
 * con su propia suite (npm run test:omr) y no se toca. De omr.ts solo se
 * IMPORTAN funciones puras (matematica de homografia y muestreo); su
 * comportamiento no cambia.
 *
 * Por que un detector nuevo y no findCorners(): las 3 estrategias de omr.ts
 * (blobs extremos, zonas al 45%, franjas al 8%x6% del borde) asumen que la hoja
 * fotografiada ocupa casi todo el encuadre — buscan extremos globales o marcas
 * pegadas al borde de la FOTO. El bloque compacto vive en cualquier parte de una
 * pagina con contenido ajeno alrededor, asi que hay que localizarlo por la FORMA
 * de su marca, no por su posicion. De ahi los finder patterns 1:1:3:1:1 (la
 * misma tecnica que usan los QR para aparecer en escenas reales).
 */
import * as C from "./compact_layout";
import {
  solveHomography, sampleBilinear,
  classifyBubble, CALIB, markConfidence,
  type BubbleResult, type MarkFlag,
} from "./omr";
import { decodeSheetCode, type SheetCodeData } from "./sheet_code";

// ─── Binarizacion ──────────────────────────────────────────────

/** Luminancia (misma formula que el motor de hoja completa). */
function toGray(img: ImageData): Uint8Array {
  const { width: w, height: h, data } = img;
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < gray.length; i++) {
    const j = i * 4;
    gray[i] = Math.round(data[j] * 0.299 + data[j + 1] * 0.587 + data[j + 2] * 0.114);
  }
  return gray;
}

/**
 * Umbral ADAPTATIVO por media local (imagen integral). Un umbral global (Otsu)
 * alcanza para la hoja completa, que se fotografia entera y pareja; aca el
 * bloque puede ser una fraccion chica de una pagina con sombra, y un umbral
 * global se come los finders del lado oscuro. Devuelve 1 = pixel oscuro.
 */
function binarizeAdaptive(gray: Uint8Array, w: number, h: number): Uint8Array {
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += gray[y * w + x];
      integral[(y + 1) * (w + 1) + (x + 1)] = integral[y * (w + 1) + (x + 1)] + rowSum;
    }
  }
  const half = Math.max(8, Math.round(Math.min(w, h) / 24));
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - half), y1 = Math.min(h - 1, y + half);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - half), x1 = Math.min(w - 1, x + half);
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum =
        integral[(y1 + 1) * (w + 1) + (x1 + 1)] -
        integral[y0 * (w + 1) + (x1 + 1)] -
        integral[(y1 + 1) * (w + 1) + x0] +
        integral[y0 * (w + 1) + x0];
      const mean = sum / area;
      // Margen fijo bajo la media local: evita que el ruido de una zona
      // uniformemente blanca se binarice como textura.
      out[y * w + x] = gray[y * w + x] < mean - 10 ? 1 : 0;
    }
  }
  return out;
}

// ─── Deteccion de finder patterns (1:1:3:1:1) ──────────────────

interface Candidate { x: number; y: number; module: number; hits: number }

/** true si los 5 runs siguen la proporcion 1:1:3:1:1 dentro de tolerancia. */
function isFinderCross(s: number[]): boolean {
  const total = s[0] + s[1] + s[2] + s[3] + s[4];
  if (total < 7) return false;
  const m = total / 7;
  const maxVar = m / 2;
  return (
    Math.abs(m - s[0]) < maxVar &&
    Math.abs(m - s[1]) < maxVar &&
    Math.abs(3 * m - s[2]) < 3 * maxVar &&
    Math.abs(m - s[3]) < maxVar &&
    Math.abs(m - s[4]) < maxVar
  );
}

/** Centro del run central (el de 3 modulos) dado el final de la secuencia. */
function centerFromEnd(s: number[], end: number): number {
  return end - s[4] - s[3] - s[2] / 2;
}

/**
 * Verifica la firma 1:1:3:1:1 en VERTICAL sobre la columna `cx`, partiendo de
 * `cy`. Un cruce horizontal solo no basta: cualquier raya de una tabla o un
 * subrayado puede producirlo por casualidad. Exigir ambos ejes es lo que
 * descarta el contenido del profesor.
 */
function crossCheckVertical(
  bin: Uint8Array, w: number, h: number,
  cx: number, cy: number, maxCount: number, originalTotal: number,
): number | null {
  const s = [0, 0, 0, 0, 0];
  let y = cy;
  // Centro (negro) hacia arriba
  while (y >= 0 && bin[y * w + cx]) { s[2]++; y--; }
  if (y < 0) return null;
  while (y >= 0 && !bin[y * w + cx] && s[1] <= maxCount) { s[1]++; y--; }
  if (y < 0 || s[1] > maxCount) return null;
  while (y >= 0 && bin[y * w + cx] && s[0] <= maxCount) { s[0]++; y--; }
  if (s[0] > maxCount) return null;

  // Centro hacia abajo
  y = cy + 1;
  while (y < h && bin[y * w + cx]) { s[2]++; y++; }
  if (y >= h) return null;
  while (y < h && !bin[y * w + cx] && s[3] <= maxCount) { s[3]++; y++; }
  if (y >= h || s[3] > maxCount) return null;
  while (y < h && bin[y * w + cx] && s[4] <= maxCount) { s[4]++; y++; }
  if (s[4] > maxCount) return null;

  const total = s[0] + s[1] + s[2] + s[3] + s[4];
  // El alto detectado debe parecerse al ancho: un finder es cuadrado.
  if (5 * Math.abs(total - originalTotal) >= 2 * originalTotal) return null;
  return isFinderCross(s) ? centerFromEnd(s, y) : null;
}

/** Acumula un centro detectado, promediando con el candidato cercano si ya existe. */
function pushCandidate(list: Candidate[], x: number, y: number, module: number): void {
  for (const c of list) {
    if (Math.abs(c.x - x) <= c.module && Math.abs(c.y - y) <= c.module) {
      c.x = (c.x * c.hits + x) / (c.hits + 1);
      c.y = (c.y * c.hits + y) / (c.hits + 1);
      c.module = (c.module * c.hits + module) / (c.hits + 1);
      c.hits++;
      return;
    }
  }
  list.push({ x, y, module, hits: 1 });
}

/**
 * Barre la imagen COMPLETA (no solo bordes) buscando finder patterns. Recorre
 * filas con una maquina de estados de runs claro/oscuro y confirma cada
 * candidato horizontal con un cruce vertical.
 */
function findFinderCandidates(bin: Uint8Array, w: number, h: number): Candidate[] {
  const out: Candidate[] = [];
  const step = Math.max(1, Math.floor(h / 400));
  for (let y = 0; y < h; y += step) {
    const s = [0, 0, 0, 0, 0];
    let state = 0;
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (bin[row + x]) {
        // Pixel oscuro: si veniamos contando claro, avanza de estado.
        if ((state & 1) === 1) state++;
        s[state]++;
      } else {
        if ((state & 1) === 0) {
          if (state === 4) {
            if (isFinderCross(s)) {
              const total = s[0] + s[1] + s[2] + s[3] + s[4];
              const mod = total / 7;
              const cx = Math.round(centerFromEnd(s, x));
              const vy = crossCheckVertical(bin, w, h, cx, y, mod * 2, total);
              if (vy !== null) pushCandidate(out, cx, vy, mod);
              s[0] = 0; s[1] = 0; s[2] = 0; s[3] = 0; s[4] = 0;
              state = 0;
            } else {
              // Corrimiento de 2: el 3er run pasa a ser el 1ro y se sigue.
              s[0] = s[2]; s[1] = s[3]; s[2] = s[4]; s[3] = 1; s[4] = 0;
              state = 3;
            }
          } else {
            state++;
            s[state]++;
          }
        } else {
          s[state]++;
        }
      }
    }
  }
  return out;
}

// ─── Seleccion del triple y orientacion ────────────────────────

/**
 * Elige los 3 finders reales entre los candidatos y los ordena TL, TR, BL.
 *
 * El vertice del angulo recto es el TL (igual que en un QR). Ademas se exige
 * que la relacion entre los dos lados calce con MARK_ASPECT: es la validacion
 * que descarta tripletes accidentales formados por marcas ajenas.
 */
function selectTriple(cands: Candidate[]): [Candidate, Candidate, Candidate] | null {
  const usable = cands.filter((c) => c.hits >= 2);
  const pool = (usable.length >= 3 ? usable : cands).slice().sort((a, b) => b.hits - a.hits).slice(0, 12);
  if (pool.length < 3) return null;

  let best: { score: number; trio: [Candidate, Candidate, Candidate] } | null = null;

  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      for (let k = j + 1; k < pool.length; k++) {
        const trio = [pool[i], pool[j], pool[k]];
        // Los 3 finders del mismo bloque tienen el mismo tamaño de modulo.
        const mods = trio.map((t) => t.module);
        const mSpread = Math.max(...mods) / Math.max(Math.min(...mods), 0.001);
        if (mSpread > 1.6) continue;

        // Prueba cada vertice como TL (el del angulo recto).
        for (let p = 0; p < 3; p++) {
          const tl = trio[p];
          const a = trio[(p + 1) % 3];
          const b = trio[(p + 2) % 3];
          const va = [a.x - tl.x, a.y - tl.y];
          const vb = [b.x - tl.x, b.y - tl.y];
          const la = Math.hypot(va[0], va[1]);
          const lb = Math.hypot(vb[0], vb[1]);
          if (la < tl.module * 4 || lb < tl.module * 4) continue;

          // Angulo recto en TL.
          const cosA = (va[0] * vb[0] + va[1] * vb[1]) / (la * lb);
          const angleErr = Math.abs(cosA);
          if (angleErr > 0.30) continue; // ~±17° de holgura por perspectiva

          // El lado largo es el ancho del bloque; la razon debe dar MARK_ASPECT.
          const ratio = Math.max(la, lb) / Math.min(la, lb);
          const aspectErr = Math.abs(ratio - C.MARK_ASPECT) / C.MARK_ASPECT;
          if (aspectErr > 0.30) continue;

          // TR es el extremo del lado LARGO; BL el del corto.
          let tr = la >= lb ? a : b;
          let bl = la >= lb ? b : a;
          // Orientacion: en el bloque canonico, cross(TL→TR, TL→BL) > 0.
          const cross = (tr.x - tl.x) * (bl.y - tl.y) - (tr.y - tl.y) * (bl.x - tl.x);
          if (cross < 0) { const t = tr; tr = bl; bl = t; }

          const score = angleErr + aspectErr + (mSpread - 1) * 0.5;
          if (!best || score < best.score) best = { score, trio: [tl, tr, bl] };
        }
      }
    }
  }
  return best ? best.trio : null;
}

/**
 * Afina la esquina BR. La estimacion por paralelogramo (TR + BL - TL) es exacta
 * solo sin perspectiva; se corrige buscando el centro de masa oscuro de la marca
 * de alineacion en una ventana chica alrededor de la prediccion.
 */
function refineAlign(
  bin: Uint8Array, w: number, h: number,
  px: number, py: number, module: number,
): [number, number] {
  const win = Math.round(module * 3.5);
  const x0 = Math.max(0, Math.round(px) - win), x1 = Math.min(w - 1, Math.round(px) + win);
  const y0 = Math.max(0, Math.round(py) - win), y1 = Math.min(h - 1, Math.round(py) + win);
  let sx = 0, sy = 0, n = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (bin[y * w + x]) { sx += x; sy += y; n++; }
    }
  }
  // La marca son ~13 modulos^2 de tinta. Muy poco = no se encontro; demasiado =
  // la ventana agarro contenido ajeno. En ambos casos vale mas la prediccion.
  const expected = module * module * 13;
  if (n < expected * 0.25 || n > expected * 4) return [px, py];
  return [sx / n, sy / n];
}

// ─── API publica ───────────────────────────────────────────────

export interface CompactDetection {
  /** Esquinas en orden TL, TR, BR, BL (misma convencion que el motor de hoja). */
  corners: [number, number][];
  /** Tamaño de modulo detectado (px de la foto). Util para HUD y diagnostico. */
  module: number;
  /** Candidatos de finder hallados (diagnostico / tests). */
  candidates: number;
}

/**
 * Localiza el bloque compacto dentro de una foto que puede tener cualquier
 * contenido alrededor. Devuelve null si no lo encuentra con confianza.
 */
export function detectCompactBlock(imageData: ImageData): CompactDetection | null {
  const { width: w, height: h } = imageData;
  const gray = toGray(imageData);
  const bin = binarizeAdaptive(gray, w, h);

  const cands = findFinderCandidates(bin, w, h);
  if (cands.length < 3) return null;

  const trio = selectTriple(cands);
  if (!trio) return null;
  const [tl, tr, bl] = trio;

  const mod = (tl.module + tr.module + bl.module) / 3;
  const predBr: [number, number] = [tr.x + bl.x - tl.x, tr.y + bl.y - tl.y];
  const br = refineAlign(bin, w, h, predBr[0], predBr[1], mod);

  const corners: [number, number][] = [
    [tl.x, tl.y],
    [tr.x, tr.y],
    br,
    [bl.x, bl.y],
  ];
  return { corners, module: mod, candidates: cands.length };
}

/** Igual que detectCompactBlock pero devolviendo solo las esquinas. */
export function findCompactBlockCorners(imageData: ImageData): [number, number][] | null {
  return detectCompactBlock(imageData)?.corners ?? null;
}

/**
 * Rectifica el bloque al canvas canonico BLOCK_W x BLOCK_H.
 *
 * No se puede reusar warpSheet/warpImageData de omr.ts: ambas fijan como destino
 * la geometria de la hoja completa (CORNER_CENTERS y la grilla de 12 anclas).
 * Lo que si se reusa es la matematica — solveHomography y sampleBilinear.
 */
export function warpCompactBlock(sourceData: ImageData, corners: [number, number][]): ImageData {
  const W = C.BLOCK_W, H = C.BLOCK_H;
  const dst: number[] = [], src: number[] = [];
  for (let i = 0; i < 4; i++) {
    dst.push(C.BLOCK_CORNERS[i][0], C.BLOCK_CORNERS[i][1]);
    src.push(corners[i][0], corners[i][1]);
  }
  const out = new ImageData(W, H);
  // Homografia DESTINO→ORIGEN (mapeo inverso): para cada pixel de salida se
  // busca su pixel fuente.
  const hm = solveHomography(dst, src);
  if (!hm) return out;

  const srcW = sourceData.width, srcH = sourceData.height;
  const sd = sourceData.data, od = out.data;
  for (let dy = 0; dy < H; dy++) {
    for (let dx = 0; dx < W; dx++) {
      const denom = hm[6] * dx + hm[7] * dy + 1;
      const sx = (hm[0] * dx + hm[1] * dy + hm[2]) / denom;
      const sy = (hm[3] * dx + hm[4] * dy + hm[5]) / denom;
      sampleBilinear(sd, srcW, srcH, sx, sy, od, (dy * W + dx) * 4);
    }
  }
  return out;
}

// ─── Codigo de hoja del bloque ─────────────────────────────────

/** Oscuridad concentrada en los centros de celda del codigo para un offset (dx,dy). */
function darkAtCompactCode(gray: Float32Array, w: number, h: number, dx: number, dy: number): number {
  const r = C.CODE_R;
  let darkSum = 0;
  for (let i = 0; i < C.CODE_ROWS * C.CODE_PER_ROW; i++) {
    const [bx, by] = C.codeCell(i);
    const cx = bx + dx, cy = by + dy;
    for (let yy = -r; yy <= r; yy++) {
      const py = cy + yy;
      if (py < 0 || py >= h) continue;
      for (let xx = -r; xx <= r; xx++) {
        const px = cx + xx;
        // Oscuridad CONTINUA (255-gris), no conteo bajo umbral fijo: el registro
        // se centra en la tinta incluso con un warp lavado.
        if (px >= 0 && px < w) darkSum += 255 - gray[py * w + px];
      }
    }
  }
  return darkSum;
}

/**
 * Lee el mini codigo del bloque ya rectificado. Misma tecnica que readSheetCode
 * del motor de hoja completa (registro local + umbral relativo al papel), sobre
 * la disposicion de 2 filas x 23 celdas del bloque. El codec es el MISMO de
 * sheet_code.ts, con guias y CRC — por eso sirve tambien como verificacion de
 * que lo detectado es realmente un bloque TuLector y no un cuadrado cualquiera.
 */
export function readCompactCode(imageData: ImageData): SheetCodeData | null {
  const { width, height, data } = imageData;
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;
  }

  let bestDx = 0, bestDy = 0, bestDark = -1;
  for (let dy = -6; dy <= 6; dy += 2) {
    for (let dx = -6; dx <= 6; dx += 2) {
      const dk = darkAtCompactCode(gray, width, height, dx, dy);
      if (dk > bestDark) { bestDark = dk; bestDx = dx; bestDy = dy; }
    }
  }

  const r = C.CODE_R;
  const avgs: number[] = [];
  for (let i = 0; i < C.CODE_ROWS * C.CODE_PER_ROW; i++) {
    const [bx, by] = C.codeCell(i);
    const cx = bx + bestDx, cy = by + bestDy;
    let sum = 0, tot = 0;
    for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) {
      const px = cx + xx, py = cy + yy;
      if (px >= 0 && px < width && py >= 0 && py < height) { tot++; sum += gray[py * width + px]; }
    }
    avgs.push(tot > 0 ? sum / tot : 255);
  }
  // Umbral RELATIVO al papel local: la celda vacia mas clara es el papel (que en
  // un warp lavado es gris, no blanco) y la llena es la que se oscurece respecto
  // de el. Un umbral fijo daria todos los bits en 0 sobre una foto lavada.
  const paper = Math.max(...avgs);
  const bits = avgs.map((a) => ((paper - a) / (paper * 0.30) > 0.35 ? 1 : 0));
  return decodeSheetCode(bits);
}

// ─── Calificacion del bloque ───────────────────────────────────

/**
 * Lee la pista de temporizacion del bloque: centro Y de cada marca solida.
 * Mismo principio que la hoja completa (ancla FISICA de cada fila, mas robusta
 * que confiar en la posicion teorica), pero sobre la columna del bloque.
 */
function readCompactTimingRows(gray: Float32Array, w: number, h: number): number[] {
  const x0 = Math.max(0, Math.round(C.TIMING_X - C.TIMING_W / 2 - 4));
  const x1 = Math.min(w - 1, Math.round(C.TIMING_X + C.TIMING_W / 2 + 4));
  const minDark = Math.max(6, Math.round(C.TIMING_W * 0.4));

  const centers: number[] = [];
  let runStart = -1, runSum = 0, runW = 0;
  for (let y = 0; y < h; y++) {
    let dark = 0;
    for (let x = x0; x <= x1; x++) if (gray[y * w + x] < 100) dark++;
    if (dark >= minDark) {
      if (runStart < 0) { runStart = y; runSum = 0; runW = 0; }
      runSum += y * dark; runW += dark;
    } else if (runStart >= 0) {
      if (y - runStart >= 3) centers.push(Math.round(runSum / Math.max(runW, 1)));
      runStart = -1;
    }
  }
  if (runStart >= 0 && h - runStart >= 3) centers.push(Math.round(runSum / Math.max(runW, 1)));
  return centers;
}

/**
 * Ajusta los centros detectados a las N filas por regresion lineal. Tolera
 * marcas faltantes (sombra, baja resolucion): interpola la fila no vista en vez
 * de descartar el registro completo.
 */
function rowsFromCompactTiming(centers: number[], numRows: number, ql: C.CompactQLayout): number[] | null {
  const minPts = Math.max(3, Math.floor(numRows * 0.6));
  if (centers.length < minPts) return null;

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

  const n = pts.length;
  let si = 0, sc = 0, sii = 0, sic = 0;
  for (const [i, c] of pts) { si += i; sc += c; sii += i * i; sic += i * c; }
  const denom = n * sii - si * si;
  if (Math.abs(denom) < 1e-6) {
    // Una sola fila: no hay pendiente que estimar, pero el centro si sirve.
    return numRows === 1 ? [pts[0][1]] : null;
  }
  const a = (n * sic - si * sc) / denom;
  const b = (sc - a * si) / n;
  if (a < ql.rowH * 0.7 || a > ql.rowH * 1.3) return null;

  const rowY: number[] = [];
  for (let row = 0; row < numRows; row++) rowY.push(Math.round(a * row + b));
  return rowY;
}

/** Oscuridad concentrada en los centros de burbuja para un offset horizontal dx. */
function darkAtCompactBubbles(
  gray: Float32Array, w: number, h: number, rowY: number[], ql: C.CompactQLayout, dx: number,
): number {
  const r = ql.gradeR;
  let sum = 0;
  for (let q = 0; q < ql.numQuestions; q++) {
    const cy = rowY[ql.rowOf(q)], col = ql.colOf(q);
    for (let o = 0; o < ql.numOptions; o++) {
      const cx = ql.optX(o, col) + dx;
      for (let yy = -r; yy <= r; yy++) {
        const py = cy + yy;
        if (py < 0 || py >= h) continue;
        for (let xx = -r; xx <= r; xx++) {
          const px = cx + xx;
          if (px >= 0 && px < w) sum += 255 - gray[py * w + px];
        }
      }
    }
  }
  return sum;
}

export interface CompactGradeReport {
  results: BubbleResult[];
  valid: boolean;
  reason?: string;
  /** true si el registro uso la pista de temporizacion (no la posicion teorica). */
  usedTiming: boolean;
  timingRows: number;
  gridDx: number;
}

/**
 * Califica el bloque ya rectificado.
 *
 * No se reusa gradeBubbles() de omr.ts porque esa funcion esta atada a la hoja
 * completa: valida las 12 anclas solidas, lee la temporizacion en L.TIMING_X y
 * usa questionLayout() con X/Y absolutos de una pagina de 1200x1650. Lo que SI
 * se reusa —y es lo que importa para que las dos lecturas sean consistentes— es
 * el clasificador de burbuja y su calibracion: classifyBubble, CALIB, CONF y
 * markConfidence son los mismos objetos, no una copia.
 */
export function gradeCompactBlock(
  imageData: ImageData,
  cfg: C.CompactConfig = C.DEFAULT_COMPACT,
): CompactGradeReport {
  const { width, height, data } = imageData;
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;
  }

  const ql = C.compactQuestionLayout(cfg);

  // El warp debe tener CONTENIDO: umbral RELATIVO a la media (un bloque lavado
  // sigue teniendo tinta mas oscura que su propio papel; uno fallido es plano).
  let sumG = 0;
  for (let i = 0; i < gray.length; i++) sumG += gray[i];
  const emptyThr = Math.max(70, sumG / gray.length - 25);
  let td = 0;
  for (let i = 0; i < gray.length; i++) if (gray[i] < emptyThr) td++;
  if (td / gray.length < 0.003) {
    return { results: [], valid: false, reason: "Warp vacio", usedTiming: false, timingRows: 0, gridDx: 0 };
  }

  // Registro de filas: Y fisicos de la temporizacion; si no se leen, posicion teorica.
  const timing = readCompactTimingRows(gray, width, height);
  const fitted = rowsFromCompactTiming(timing, ql.rowsPerCol, ql);
  const rowY = fitted ?? Array.from({ length: ql.rowsPerCol }, (_, r) => ql.rowCY(r));

  // Refina solo el offset horizontal (las filas ya quedaron ancladas).
  let gridDx = 0, bestDark = -1;
  for (let dx = -CALIB.gridSearchDx; dx <= CALIB.gridSearchDx; dx += CALIB.gridSearchStep) {
    const dk = darkAtCompactBubbles(gray, width, height, rowY, ql, dx);
    if (dk > bestDark) { bestDark = dk; gridDx = dx; }
  }

  const results: BubbleResult[] = [];
  const sameCount: Record<string, number> = {};
  let glareWarnings = 0;

  for (let q = 0; q < ql.numQuestions; q++) {
    const cy = rowY[ql.rowOf(q)];
    const col = ql.colOf(q);
    const clScores: number[] = [], glares: boolean[] = [], feats: number[][] = [], avgs: number[] = [];

    for (let o = 0; o < ql.numOptions; o++) {
      const cx = ql.optX(o, col) + gridDx;
      const { score, glare, features } = classifyBubble(gray, width, cx, cy, ql.gradeR);
      clScores.push(score);
      glares.push(glare);
      feats.push(features.map((f) => Math.round(f * 1000) / 1000));
      let sum = 0, tot = 0;
      for (let dy = -ql.gradeR; dy <= ql.gradeR; dy++) for (let dx = -ql.gradeR; dx <= ql.gradeR; dx++) {
        const px = cx + dx, py = cy + dy;
        if (px >= 0 && px < width && py >= 0 && py < height) { tot++; sum += gray[py * width + px]; }
      }
      avgs.push(tot > 0 ? sum / tot : 255);
    }

    // Score RELATIVO por pregunta (misma tecnica que el motor de hoja completa):
    // la letra impresa esta en todas las opciones por igual y se cancela, asi que
    // rescata marcas leves que el score absoluto no pesca.
    const paperQ = Math.max(...avgs);
    const scores = clScores.map((s, i) =>
      Math.max(s, Math.max(0, Math.min(1, (paperQ - avgs[i]) / (paperQ * 0.30)))));

    const maxS = Math.max(...scores);
    const maxIdx = scores.indexOf(maxS);
    const thresh = Math.max(CALIB.absThresh, maxS * CALIB.relThresh);
    const marked = scores.map((s, i) => (s > thresh && !glares[i]) ? i : -1).filter((i) => i >= 0);

    const winnerGlare = glares[maxIdx] && maxS >= CALIB.absThresh;
    if (winnerGlare) glareWarnings++;

    let answer = "-";
    const sorted = [...scores].sort((a, b) => b - a);
    const dominates = sorted[0] - sorted[1] > CALIB.dominance;
    if (winnerGlare) {
      answer = "?";
    } else if (marked.length === 0 && maxS > CALIB.minPick && dominates) {
      answer = ql.labels[maxIdx];
    } else if (marked.length > 0 && marked.length <= 3) {
      answer = marked.map((i) => ql.labels[i]).join("");
    }

    const conf = markConfidence(answer, scores);
    const flag: MarkFlag = conf.flag;
    results.push({
      question: q + 1, answer,
      scores: scores.map((s) => Math.round(s * 1000) / 1000),
      correct: null, features: feats,
      flag, flagReason: conf.reason,
    });
    sameCount[answer] = (sameCount[answer] || 0) + 1;
  }

  const diag = { usedTiming: !!fitted, timingRows: timing.length, gridDx };

  if (glareWarnings > Math.max(5, Math.ceil(ql.numQuestions * 0.4))) {
    return { results, valid: false, reason: `Demasiado brillo: ${glareWarnings} burbujas con reflejo`, ...diag };
  }
  const answered = results.filter((r) => r.answer !== "-" && r.answer !== "?").length;
  if (answered === 0) {
    return { results, valid: false, reason: "Sin respuestas detectadas", ...diag };
  }
  // Casi todas las respuestas iguales suele significar warp corrido, no un alumno
  // que marco todo "C". Umbral relativo al nº de preguntas del bloque.
  const maxSame = Math.max(...Object.values(sameCount));
  if (ql.numQuestions >= 10 && maxSame >= Math.ceil(ql.numQuestions * 0.9) && answered >= 10) {
    const dominant = Object.entries(sameCount).find(([, v]) => v === maxSame)?.[0];
    return { results, valid: false, reason: `${maxSame}/${ql.numQuestions} respuestas "${dominant}" - posible mal warp`, ...diag };
  }

  return { results, valid: true, ...diag };
}

/** Nº de correctas sobre el total — el modo base del bloque (sin identificar al alumno). */
export function scoreCompact(results: BubbleResult[], answerKey: string[]): { correct: number; total: number } {
  let correct = 0;
  for (let i = 0; i < answerKey.length && i < results.length; i++) {
    if (answerKey[i] && results[i].answer === answerKey[i]) correct++;
  }
  return { correct, total: answerKey.length };
}
