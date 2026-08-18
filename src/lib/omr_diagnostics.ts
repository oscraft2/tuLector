/**
 * Diagnostico de captura (nitidez + esquinas), compartido entre /scan (panel
 * de debug en vivo) y /admin/usage/[id] (re-analisis de un log guardado).
 * Vivia duplicado dentro de src/app/scan/page.tsx -- se extrae aca para
 * poder reusarlo sin copiar/pegar. No cambia comportamiento: mismo codigo,
 * mismos umbrales.
 */
import { findCorners } from "@/lib/omr";

// ─── Laplacian focus detector ─────
export function isFrameSharp(imageData: ImageData): number {
 const { width, height, data } = imageData;
 const gray = new Float32Array(width * height);
 for (let i = 0; i < gray.length; i++) {
  gray[i] = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;
 }
 let sum = 0, count = 0;
 for (let y = 1; y < height - 1; y++) {
  for (let x = 1; x < width - 1; x++) {
   const idx = y * width + x;
   const lap = Math.abs(-4 * gray[idx] + gray[idx - width] + gray[idx + width] + gray[idx - 1] + gray[idx + 1]);
   sum += lap * lap;
   count++;
  }
 }
 return count > 0 ? sum / count : 0;
}

// ─── Simplified diagnostic wrapper around findCorners ───
export interface ZoneDiag {
 name: string;
 bestX: number; bestY: number;
 bestDensity: number;
 bestDarkCount: number;
 winSize: number;
 totalWindows: number;
 passed: boolean;
}

export interface FrameDiag {
 w: number; h: number;
 totalPixels: number;
 darkPixels: number;
 darkRatio: number;
 sharpScore: number;
 sharpPassed: boolean;
 zones: ZoneDiag[];
 cornersFound: boolean;
 corners: [number, number][] | null;
}

export function diagnoseFrame(imageData: ImageData): FrameDiag {
 const w = imageData.width, h = imageData.height;

 // Overall dark pixel count
 const data = imageData.data;
 let totalDark = 0;
 for (let i = 0; i < data.length; i += 4) {
  const g = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
  if (g < 80) totalDark++;
 }

 const sharp = isFrameSharp(imageData);
 const corners = findCorners(imageData);

 return {
  w, h, totalPixels: w * h,
  darkPixels: totalDark,
  darkRatio: (w * h) > 0 ? totalDark / (w * h) : 0,
  sharpScore: sharp,
  sharpPassed: sharp > 40,
  zones: corners ? [
   { name: "TL", bestX: corners[0][0], bestY: corners[0][1], bestDensity: 0, bestDarkCount: 0, winSize: 0, totalWindows: 0, passed: true },
   { name: "TR", bestX: corners[1][0], bestY: corners[1][1], bestDensity: 0, bestDarkCount: 0, winSize: 0, totalWindows: 0, passed: true },
   { name: "BR", bestX: corners[2][0], bestY: corners[2][1], bestDensity: 0, bestDarkCount: 0, winSize: 0, totalWindows: 0, passed: true },
   { name: "BL", bestX: corners[3][0], bestY: corners[3][1], bestDensity: 0, bestDarkCount: 0, winSize: 0, totalWindows: 0, passed: true },
  ] : [],
  cornersFound: corners !== null,
  corners,
 };
}

/** Frase-resumen del motivo mas probable de un fallo de deteccion, a partir
 *  del mismo diagnostico -- para no obligar a leer numeros crudos. */
export function summarizeFrameDiag(diag: FrameDiag): string {
 if (diag.cornersFound && diag.sharpPassed) return "Esquinas detectadas y nitidez OK -- geometria no explica el fallo.";
 if (!diag.cornersFound && !diag.sharpPassed) return `Esquinas no detectadas y nitidez baja (${Math.round(diag.sharpScore)}, minimo 40) -- probablemente foto borrosa o mal encuadrada.`;
 if (!diag.cornersFound) return "Esquinas no detectadas (nitidez OK) -- revisar encuadre, iluminacion o que la hoja este completa en la foto.";
 return `Esquinas detectadas pero nitidez baja (${Math.round(diag.sharpScore)}, minimo 40) -- puede fallar el muestreo de burbujas.`;
}
