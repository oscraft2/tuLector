/**
 * Suite del SUB-MOTOR del bloque compacto (Fase 0: localizacion).
 *
 * Separada de test_omr_real.ts a proposito: aquella prueba la hoja completa
 * sobre pagina limpia, que es justo lo que aca NO se quiere probar. El punto de
 * esta suite es que el bloque se encuentre dentro de una pagina con contenido
 * AJENO alrededor (texto, tablas, recuadros, un logo negro como señuelo) y en
 * posiciones/orientaciones arbitrarias.
 *
 * Correr con: npm run test:compact
 */
import { createCanvas, loadImage, ImageData as CanvasImageData } from "canvas";
import { drawCompactBlock } from "./src/tulector/compact_render";
import { detectCompactBlock, warpCompactBlock, readCompactCode, gradeCompactBlock, scoreCompact } from "./src/tulector/compact_block";
import * as C from "./src/tulector/compact_layout";
import { type SheetCodeData } from "./src/tulector/sheet_code";

(globalThis as unknown as { ImageData: typeof CanvasImageData }).ImageData = CanvasImageData;

function fail(message: string): never {
  throw new Error(message);
}

const CODE: SheetCodeData = { version: 2, country: 0, sheetId: 4242, page: 1, pagesTotal: 1 };
const ANSWERS = Array.from({ length: 20 }, (_, i) => i % 5);
const CFG = { numQuestions: 20, numOptions: 5, numColumns: 2 };
/** Respuestas esperadas como letras (lo que debe devolver el sub-motor). */
const ESPERADAS = ANSWERS.map((a) => C.OPTION_LABELS[a]);

// ─── Utilidades de fixture ─────────────────────────────────────

/** Renderiza el bloque canonico a un ImageData de BLOCK_W x BLOCK_H. */
function renderBlock(cfg: C.CompactConfig = CFG, answers: number[] = ANSWERS): ImageData {
  const canvas = createCanvas(C.BLOCK_W, C.BLOCK_H);
  const ctx = canvas.getContext("2d");
  drawCompactBlock(ctx as unknown as Parameters<typeof drawCompactBlock>[0], {
    answers, filled: true, code: CODE,
  }, cfg);
  return ctx.getImageData(0, 0, C.BLOCK_W, C.BLOCK_H) as unknown as ImageData;
}

/**
 * Dibuja una pagina con contenido tipico de una prueba hecha por el profesor:
 * titulo, parrafos, una tabla, un recuadro y un LOGO NEGRO cuadrado del tamaño
 * de un finder — el señuelo que un detector mal tuneado confundiria con una marca.
 */
function drawForeignPage(ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>, w: number, h: number): void {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#000000";

  ctx.font = "bold 26px sans-serif";
  ctx.fillText("Prueba de Matematica - Unidad 3", 60, 60);
  ctx.font = "18px sans-serif";
  const lineas = [
    "1. Resuelve el sistema de ecuaciones y justifica cada paso.",
    "2. Un tren viaja a 80 km/h durante 3 horas. Calcula la distancia.",
    "3. Factoriza la expresion x^2 - 9 e indica sus raices.",
    "4. Explica la diferencia entre media, mediana y moda.",
    "5. Grafica la funcion y = 2x + 1 en el plano cartesiano.",
  ];
  lineas.forEach((t, i) => ctx.fillText(t, 60, 110 + i * 34));

  // Tabla (lineas horizontales y verticales: fuente clasica de falsos cruces)
  const tx = 60, ty = 300, tw = w - 120, th = 160, rows = 4, cols = 5;
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath(); ctx.moveTo(tx, ty + (th / rows) * r); ctx.lineTo(tx + tw, ty + (th / rows) * r); ctx.stroke();
  }
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath(); ctx.moveTo(tx + (tw / cols) * c, ty); ctx.lineTo(tx + (tw / cols) * c, ty + th); ctx.stroke();
  }

  // Recuadro de "respuesta"
  ctx.lineWidth = 3;
  ctx.strokeRect(60, h - 260, tw, 120);

  // SEÑUELO: logo negro solido del porte de un finder.
  ctx.fillStyle = "#000000";
  ctx.fillRect(w - 190, h - 190, 90, 90);
  // SEÑUELO 2: cuadrado con borde grueso (doble borde, como las marcas del
  // competidor) — no debe pasar por finder 1:1:3:1:1.
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#000000";
  ctx.strokeRect(w - 360, h - 185, 80, 80);
}

/** Homografia canonica→pagina a partir del cuadrilatero destino (TL,TR,BR,BL). */
function homographyTo(quad: [number, number][]): number[] {
  // Resolucion directa del sistema 8x8 (mismo planteo que solveHomography, pero
  // aca mapea ORIGEN→DESTINO porque el fixture pinta hacia adelante).
  const srcQuad: [number, number][] = [[0, 0], [C.BLOCK_W, 0], [C.BLOCK_W, C.BLOCK_H], [0, C.BLOCK_H]];
  const A: number[][] = [], b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [sx, sy] = srcQuad[i], [dx, dy] = quad[i];
    A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]); b.push(dx);
    A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]); b.push(dy);
  }
  const n = 8, mat = A.map((r, i) => [...r, b[i]]);
  for (let col = 0; col < n; col++) {
    let max = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(mat[row][col]) > Math.abs(mat[max][col])) max = row;
    [mat[col], mat[max]] = [mat[max], mat[col]];
    for (let row = col + 1; row < n; row++) {
      const f = mat[row][col] / mat[col][col];
      for (let j = col; j <= n; j++) mat[row][j] -= f * mat[col][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { x[i] = mat[i][n]; for (let j = i + 1; j < n; j++) x[i] -= mat[i][j] * x[j]; x[i] /= mat[i][i]; }
  return x;
}

function applyHom(hm: number[], x: number, y: number): [number, number] {
  const d = hm[6] * x + hm[7] * y + 1;
  return [(hm[0] * x + hm[1] * y + hm[2]) / d, (hm[3] * x + hm[4] * y + hm[5]) / d];
}

/**
 * Pega el bloque en la pagina segun un cuadrilatero destino arbitrario
 * (traslacion + escala + rotacion + perspectiva). Devuelve la pagina y las
 * esquinas de verdad-terreno (los centros de marca ya proyectados).
 */
function pasteBlock(
  pageW: number, pageH: number, quad: [number, number][],
  cfg: C.CompactConfig = CFG, answers: number[] = ANSWERS,
  blockImg?: ImageData,
): { page: ImageData; truth: [number, number][] } {
  const block = blockImg ?? renderBlock(cfg, answers);
  const canvas = createCanvas(pageW, pageH);
  const ctx = canvas.getContext("2d");
  drawForeignPage(ctx, pageW, pageH);
  const page = ctx.getImageData(0, 0, pageW, pageH) as unknown as ImageData;

  const fwd = homographyTo(quad);
  const xs = quad.map((p) => p[0]), ys = quad.map((p) => p[1]);
  const x0 = Math.max(0, Math.floor(Math.min(...xs)) - 2), x1 = Math.min(pageW - 1, Math.ceil(Math.max(...xs)) + 2);
  const y0 = Math.max(0, Math.floor(Math.min(...ys)) - 2), y1 = Math.min(pageH - 1, Math.ceil(Math.max(...ys)) + 2);

  // Homografia destino→origen: se resuelve invirtiendo el rol de los quads.
  const back = homographyToFrom(quad);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const [bx, by] = applyHom(back, x, y);
      if (bx < 0 || bx >= C.BLOCK_W || by < 0 || by >= C.BLOCK_H) continue;
      const sxi = Math.round(bx), syi = Math.round(by);
      const si = (syi * C.BLOCK_W + sxi) * 4, di = (y * pageW + x) * 4;
      page.data[di] = block.data[si];
      page.data[di + 1] = block.data[si + 1];
      page.data[di + 2] = block.data[si + 2];
      page.data[di + 3] = 255;
    }
  }

  const truth = C.BLOCK_CORNERS.map(([cx, cy]) => applyHom(fwd, cx, cy)) as [number, number][];
  return { page, truth };
}

/** Homografia DESTINO→ORIGEN (pagina→bloque). */
function homographyToFrom(quad: [number, number][]): number[] {
  const dstQuad: [number, number][] = [[0, 0], [C.BLOCK_W, 0], [C.BLOCK_W, C.BLOCK_H], [0, C.BLOCK_H]];
  const A: number[][] = [], b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [sx, sy] = quad[i], [dx, dy] = dstQuad[i];
    A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]); b.push(dx);
    A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]); b.push(dy);
  }
  const n = 8, mat = A.map((r, i) => [...r, b[i]]);
  for (let col = 0; col < n; col++) {
    let max = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(mat[row][col]) > Math.abs(mat[max][col])) max = row;
    [mat[col], mat[max]] = [mat[max], mat[col]];
    for (let row = col + 1; row < n; row++) {
      const f = mat[row][col] / mat[col][col];
      for (let j = col; j <= n; j++) mat[row][j] -= f * mat[col][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { x[i] = mat[i][n]; for (let j = i + 1; j < n; j++) x[i] -= mat[i][j] * x[j]; x[i] /= mat[i][i]; }
  return x;
}

/** Cuadrilatero de un bloque colocado con esquina (x,y), escala s y rotacion deg. */
function placedQuad(x: number, y: number, s: number, deg = 0): [number, number][] {
  const w = C.BLOCK_W * s, h = C.BLOCK_H * s;
  const rad = (deg * Math.PI) / 180;
  const cx = x + w / 2, cy = y + h / 2;
  const pts: [number, number][] = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  return pts.map(([px, py]) => {
    const dx = px - cx, dy = py - cy;
    return [cx + dx * Math.cos(rad) - dy * Math.sin(rad), cy + dx * Math.sin(rad) + dy * Math.cos(rad)] as [number, number];
  });
}

// ─── Casos ─────────────────────────────────────────────────────

interface Caso { nombre: string; quad: [number, number][]; pageW: number; pageH: number; tol: number }

const PAGE_W = 1700, PAGE_H = 2200;

const CASOS: Caso[] = [
  {
    nombre: "centro de la pagina, escala 1.0",
    quad: placedQuad(300, 900, 1.0), pageW: PAGE_W, pageH: PAGE_H, tol: 6,
  },
  {
    nombre: "arriba-izquierda, escala 0.8",
    quad: placedQuad(80, 620, 0.8), pageW: PAGE_W, pageH: PAGE_H, tol: 6,
  },
  {
    nombre: "abajo-derecha (junto al logo señuelo), escala 0.7",
    quad: placedQuad(760, 1500, 0.7), pageW: PAGE_W, pageH: PAGE_H, tol: 6,
  },
  {
    nombre: "rotado 6 grados",
    quad: placedQuad(300, 950, 0.9, 6), pageW: PAGE_W, pageH: PAGE_H, tol: 8,
  },
  {
    nombre: "rotado -12 grados",
    quad: placedQuad(320, 980, 0.85, -12), pageW: PAGE_W, pageH: PAGE_H, tol: 8,
  },
  {
    nombre: "rotado 180 grados (prueba de orientacion)",
    quad: placedQuad(300, 950, 0.9, 180), pageW: PAGE_W, pageH: PAGE_H, tol: 8,
  },
  {
    nombre: "perspectiva (trapecio)",
    quad: [[330, 940], [1290, 1010], [1230, 1690], [280, 1620]], pageW: PAGE_W, pageH: PAGE_H, tol: 12,
  },
  {
    nombre: "bloque chico (escala 0.5, ocupa ~1/9 de la pagina)",
    quad: placedQuad(700, 1450, 0.5), pageW: PAGE_W, pageH: PAGE_H, tol: 6,
  },
];

function maxCornerError(got: [number, number][], truth: [number, number][]): number {
  let worst = 0;
  for (let i = 0; i < 4; i++) {
    worst = Math.max(worst, Math.hypot(got[i][0] - truth[i][0], got[i][1] - truth[i][1]));
  }
  return worst;
}

// ─── Degradaciones (Fase 0.5) ──────────────────────────────────

/** Desenfoque de caja: simula foto ligeramente fuera de foco / pulso. */
function blur(img: ImageData, radius: number): ImageData {
  const { width: w, height: h } = img;
  const out = new ImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const py = y + dy; if (py < 0 || py >= h) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const px = x + dx; if (px < 0 || px >= w) continue;
          const i = (py * w + px) * 4;
          r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++;
        }
      }
      const o = (y * w + x) * 4;
      out.data[o] = r / n; out.data[o + 1] = g / n; out.data[o + 2] = b / n; out.data[o + 3] = 255;
    }
  }
  return out;
}

/** Ruido gaussiano-ish: sensor de celular con poca luz. */
function noise(img: ImageData, amount: number): ImageData {
  const out = new ImageData(img.width, img.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 2 * amount;
    out.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    out.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    out.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
    out.data[i + 3] = 255;
  }
  return out;
}

/**
 * Iluminacion despareja: gradiente multiplicativo diagonal fuerte (sombra de la
 * mano/telefono sobre la hoja). Es el caso que rompe un umbral global.
 */
function shade(img: ImageData, minFactor: number): ImageData {
  const { width: w, height: h } = img;
  const out = new ImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = (x / w + y / h) / 2;               // 0..1 diagonal
      const f = 1 - (1 - minFactor) * t;
      const i = (y * w + x) * 4;
      out.data[i] = img.data[i] * f;
      out.data[i + 1] = img.data[i + 1] * f;
      out.data[i + 2] = img.data[i + 2] * f;
      out.data[i + 3] = 255;
    }
  }
  return out;
}

/** Round-trip JPEG real (compresion del insert de imagen de Word / de la camara). */
async function jpeg(img: ImageData, quality: number): Promise<ImageData> {
  const c = createCanvas(img.width, img.height);
  const cx = c.getContext("2d");
  cx.putImageData(img as unknown as CanvasImageData, 0, 0);
  const buf = c.toBuffer("image/jpeg", { quality });
  const loaded = await loadImage(buf);
  const c2 = createCanvas(img.width, img.height);
  const cx2 = c2.getContext("2d");
  cx2.drawImage(loaded, 0, 0);
  return cx2.getImageData(0, 0, img.width, img.height) as unknown as ImageData;
}

/** Remuestreo: baja a `factor` y vuelve a subir (Word reescalando + reimprimiendo). */
function resample(img: ImageData, factor: number): ImageData {
  const w = img.width, h = img.height;
  const sw = Math.max(1, Math.round(w * factor)), sh = Math.max(1, Math.round(h * factor));
  const c = createCanvas(w, h);
  const cx = c.getContext("2d");
  cx.putImageData(img as unknown as CanvasImageData, 0, 0);
  const small = createCanvas(sw, sh);
  small.getContext("2d").drawImage(c, 0, 0, sw, sh);
  const back = createCanvas(w, h);
  back.getContext("2d").drawImage(small, 0, 0, w, h);
  return back.getContext("2d").getImageData(0, 0, w, h) as unknown as ImageData;
}

async function faseDegradacion(): Promise<void> {
  console.log("\nFase 0.5 — degradacion realista (base: bloque a escala 0.8, rotado 4°)");
  const quad = placedQuad(300, 950, 0.8, 4);
  const base = pasteBlock(PAGE_W, PAGE_H, quad);

  const casos: { nombre: string; make: () => Promise<ImageData> | ImageData; tol: number }[] = [
    { nombre: "JPEG q=0.5", make: () => jpeg(base.page, 0.5), tol: 8 },
    { nombre: "JPEG q=0.3 (compresion agresiva)", make: () => jpeg(base.page, 0.3), tol: 10 },
    { nombre: "desenfoque radio 2", make: () => blur(base.page, 2), tol: 8 },
    { nombre: "ruido ±28", make: () => noise(base.page, 28), tol: 8 },
    { nombre: "sombra diagonal al 45%", make: () => shade(base.page, 0.45), tol: 8 },
    { nombre: "remuestreo 0.6x (Word reescala)", make: () => resample(base.page, 0.6), tol: 10 },
    {
      nombre: "combinado: sombra + JPEG + ruido",
      make: async () => noise(await jpeg(shade(base.page, 0.55), 0.5), 14),
      tol: 10,
    },
    {
      nombre: "combinado: remuestreo + desenfoque + JPEG",
      make: async () => jpeg(blur(resample(base.page, 0.7), 1), 0.6),
      tol: 12,
    },
  ];

  let ok = 0;
  const fallos: string[] = [];
  for (const caso of casos) {
    const img = await caso.make();
    const det = detectCompactBlock(img);
    if (!det) { fallos.push(`${caso.nombre}: NO DETECTADO`); continue; }
    const err = maxCornerError(det.corners, base.truth);
    if (err > caso.tol) { fallos.push(`${caso.nombre}: error ${err.toFixed(1)}px > tol ${caso.tol}px`); continue; }
    const warped = warpCompactBlock(img, det.corners);
    const code = readCompactCode(warped);
    if (JSON.stringify(code) !== JSON.stringify(CODE)) {
      fallos.push(`${caso.nombre}: codigo ilegible/distinto (${JSON.stringify(code)})`);
      continue;
    }
    const grade = gradeCompactBlock(warped, CFG);
    const malas = grade.results.filter((r, i) => r.answer !== ESPERADAS[i]).length;
    if (!grade.valid || malas > 0) {
      fallos.push(`${caso.nombre}: ${malas} respuesta(s) mal${grade.valid ? "" : ` (${grade.reason})`}`);
      continue;
    }
    console.log(`  ✓ ${caso.nombre} — error max ${err.toFixed(1)}px, 20/20 respuestas`);
    ok++;
  }

  console.log(`Degradacion: ${ok}/${casos.length} casos OK`);
  if (fallos.length) {
    for (const f of fallos) console.log(`  ✗ ${f}`);
    fail(`${fallos.length} caso(s) de degradacion fallaron`);
  }
}

/**
 * Barrido de configuraciones (Fase 1): cada combinacion de nº de preguntas,
 * opciones y columnas debe leerse al 100%. Es el equivalente compacto de la
 * guardia "Config sweep" del motor de hoja completa.
 */
function barridoDeConfiguraciones(): void {
  console.log("\nFase 1 — barrido de configuraciones (lectura de respuestas)");
  const fallos: string[] = [];
  let ok = 0, total = 0;

  for (const numColumns of [1, 2, 3]) {
    for (const numOptions of [3, 4, 5]) {
      for (const numQuestions of [1, 5, 12, 20, 27, 30]) {
        total++;
        const cfg: C.CompactConfig = { numQuestions, numOptions, numColumns };
        const answers = Array.from({ length: numQuestions }, (_, i) => i % numOptions);
        const esperadas = answers.map((a) => C.OPTION_LABELS[a]);
        const { page } = pasteBlock(PAGE_W, PAGE_H, placedQuad(300, 900, 0.9), cfg, answers);

        const det = detectCompactBlock(page);
        if (!det) { fallos.push(`${numQuestions}q/${numOptions}op/${numColumns}col: no detectado`); continue; }
        const grade = gradeCompactBlock(warpCompactBlock(page, det.corners), cfg);
        if (!grade.valid) { fallos.push(`${numQuestions}q/${numOptions}op/${numColumns}col: ${grade.reason}`); continue; }
        const malas = grade.results
          .map((r, i) => ({ q: i + 1, got: r.answer, exp: esperadas[i] }))
          .filter((r) => r.got !== r.exp);
        if (malas.length) {
          fallos.push(`${numQuestions}q/${numOptions}op/${numColumns}col: ${malas.length} mal — ${JSON.stringify(malas.slice(0, 3))}`);
          continue;
        }
        ok++;
      }
    }
  }

  console.log(`Barrido: ${ok}/${total} configuraciones leidas al 100%`);
  if (fallos.length) {
    for (const f of fallos) console.log(`  ✗ ${f}`);
    fail(`${fallos.length} configuracion(es) fallaron`);
  }

  // Guardia de capacidad: el bloque tiene un limite fisico de filas. Pedir mas
  // preguntas de las que caben en las columnas indicadas NO debe desbordar la
  // grilla fuera del bloque (pisaria las marcas de localizacion); el layout sube
  // solo al minimo de columnas que si alcanza.
  if (C.maxQuestionsFor(1) !== C.MAX_ROWS) fail(`maxQuestionsFor(1)=${C.maxQuestionsFor(1)} != MAX_ROWS=${C.MAX_ROWS}`);
  if (C.minColumnsFor(C.MAX_ROWS) !== 1) fail("minColumnsFor: MAX_ROWS deberia caber en 1 columna");
  if (C.minColumnsFor(C.MAX_ROWS + 1) !== 2) fail("minColumnsFor: MAX_ROWS+1 deberia exigir 2 columnas");

  const apretado = C.compactQuestionLayout({ numQuestions: 30, numOptions: 5, numColumns: 1 });
  if (apretado.numColumns < 2) fail("30 preguntas en 1 columna deberian promoverse a 2+");
  const ultimaFilaY = apretado.rowCY(apretado.rowsPerCol - 1) + apretado.bubbleR;
  if (ultimaFilaY > C.BLOCK_H - 110) {
    fail(`la ultima fila (y=${ultimaFilaY}) invade la banda de marcas inferior`);
  }
  console.log(`Guardia de capacidad passed: max ${C.MAX_ROWS} filas/columna; 30q/1col → ${apretado.numColumns} columnas, ultima fila y=${ultimaFilaY}`);
}

async function main() {
  let okCount = 0;
  const fallos: string[] = [];

  for (const caso of CASOS) {
    const { page, truth } = pasteBlock(caso.pageW, caso.pageH, caso.quad);
    const det = detectCompactBlock(page);
    if (!det) { fallos.push(`${caso.nombre}: NO DETECTADO`); continue; }

    const err = maxCornerError(det.corners, truth);
    if (err > caso.tol) {
      fallos.push(`${caso.nombre}: error de esquina ${err.toFixed(1)}px > tol ${caso.tol}px`);
      continue;
    }

    // El warp + codigo es la verificacion fuerte: si la orientacion estuviera
    // invertida o el mapeo corrido, las guias y el CRC del codigo no validarian.
    const warped = warpCompactBlock(page, det.corners);
    const code = readCompactCode(warped);
    if (!code) { fallos.push(`${caso.nombre}: codigo no legible tras el warp`); continue; }
    if (JSON.stringify(code) !== JSON.stringify(CODE)) {
      fallos.push(`${caso.nombre}: codigo distinto ${JSON.stringify(code)}`);
      continue;
    }

    // Lectura de respuestas (Fase 1): el bloque debe devolver las 20 sembradas.
    const grade = gradeCompactBlock(warped, CFG);
    if (!grade.valid) { fallos.push(`${caso.nombre}: calificacion invalida (${grade.reason})`); continue; }
    const malas = grade.results
      .map((r, i) => ({ q: i + 1, got: r.answer, exp: ESPERADAS[i] }))
      .filter((r) => r.got !== r.exp);
    if (malas.length) {
      fallos.push(`${caso.nombre}: ${malas.length} respuesta(s) mal — ${JSON.stringify(malas.slice(0, 4))}`);
      continue;
    }
    const { correct, total } = scoreCompact(grade.results, ESPERADAS);
    if (correct !== total) { fallos.push(`${caso.nombre}: score ${correct}/${total}`); continue; }

    console.log(`  ✓ ${caso.nombre} — error max ${err.toFixed(1)}px, ${det.candidates} candidatos, modulo ${det.module.toFixed(1)}px, ${correct}/${total} respuestas`);
    okCount++;
  }

  console.log(`\nLocalizacion: ${okCount}/${CASOS.length} casos OK`);
  if (fallos.length) {
    for (const f of fallos) console.log(`  ✗ ${f}`);
    fail(`${fallos.length} caso(s) de localizacion fallaron`);
  }

  // ─── Guardia anti-falso-positivo: pagina SIN bloque ───
  const canvas = createCanvas(PAGE_W, PAGE_H);
  const ctx = canvas.getContext("2d");
  drawForeignPage(ctx, PAGE_W, PAGE_H);
  const sinBloque = ctx.getImageData(0, 0, PAGE_W, PAGE_H) as unknown as ImageData;
  const falso = detectCompactBlock(sinBloque);
  if (falso) fail(`Falso positivo: detecto un bloque en una pagina que no lo tiene (${JSON.stringify(falso.corners)})`);
  console.log("Guardia de falso positivo passed: pagina con texto/tabla/logos y sin bloque → null");

  await faseDegradacion();
  barridoDeConfiguraciones();

  console.log("\nSub-motor compacto (Fases 0, 0.5 y 1) OK");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
