/**
 * Captura de recortes de preguntas abiertas desde un reverso escaneado
 * (Fase 1, docs/plan-correccion-ia-abiertas.md). Consume SOLO API publica
 * del motor (findCorners/warpImageData/readSheetCode) -- no toca
 * src/tulector/**.
 */
import { findCorners, warpImageData, readSheetCode } from "@/lib/omr";
import { isReversoPage, reversoFrontPage, openAnswerBoxRect } from "@/lib/sheet_generator";
import type { SheetCodeData } from "@/lib/sheet_code";

export interface ReversoDetection {
  code: SheetCodeData;
  /** Nº de pagina FRONTAL (1-indexada) de la que este reverso es reverso. */
  frontPage: number;
  /** Indice de chunk de reverso (1-indexado) dentro de esa pagina frontal --
   *  ver reversoSheetCode en sheet_generator.ts (reusa el campo pagesTotal
   *  del codec sin tocarlo). */
  chunkIndex: number;
}

/**
 * Detecta si un frame es un reverso escaneable de tuLector: rectifica con
 * las mismas esquinas que usa el motor y decodifica el codigo de hoja.
 * `null` si no es un reverso reconocible (foto no es de tuLector, o es una
 * hoja FRONTAL normal -- un codigo con page<=QUIZ_MAX_PAGES).
 */
export function detectReverso(frame: ImageData): { warp: ImageData; detection: ReversoDetection } | null {
  const corners = findCorners(frame);
  if (!corners) return null;
  const warp = warpImageData(frame, corners);
  const code = readSheetCode(warp);
  if (!code || !isReversoPage(code.page)) return null;
  return {
    warp,
    detection: { code, frontPage: reversoFrontPage(code.page), chunkIndex: code.pagesTotal },
  };
}

/**
 * Recorta UNA pregunta del warp de un reverso ya detectado. Pixel-copy puro
 * (mismo patron que cropNameBox del motor) -- no depende de Canvas del
 * navegador, funciona igual en Node/tests. `indexInChunk` (0-indexada) y
 * `chunkSize` deben calzar con chunkOpenQuestions(openQuestions) del ensayo
 * corrido con las MISMAS preguntas que se imprimieron (funcion pura, mismo
 * resultado siempre) -- ver detection.chunkIndex para saber que chunk es este.
 */
export function cropOpenAnswerBox(warp: ImageData, indexInChunk: number, chunkSize: number): ImageData | null {
  const { width, height, data } = warp;
  const inset = 4; // saltar el borde impreso del recuadro
  const box = openAnswerBoxRect(indexInChunk, chunkSize);
  const x0 = Math.max(0, Math.round(box.x + inset));
  const y0 = Math.max(0, Math.round(box.y + inset));
  const w = Math.min(width - x0, Math.round(box.w - inset * 2));
  const h = Math.min(height - y0, Math.round(box.h - inset * 2));
  if (w <= 0 || h <= 0) return null;
  const out = new ImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = ((y0 + y) * width + (x0 + x)) * 4;
      const di = (y * w + x) * 4;
      out.data[di] = data[si];
      out.data[di + 1] = data[si + 1];
      out.data[di + 2] = data[si + 2];
      out.data[di + 3] = 255;
    }
  }
  return out;
}
