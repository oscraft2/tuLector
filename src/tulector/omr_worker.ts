/**
 * Compatibilidad: antes esto corría el warp en un Web Worker con su PROPIA copia
 * de la homografía. Esa copia (a) se colgaba si solve8x8 fallaba (el onmessage no
 * manejaba "error") y (b) dejaba el borde fuera-del-quad en NEGRO en vez de blanco,
 * divergiendo de omr.ts/omr_engine.cpp (auditorías P1-3 / P1-4).
 *
 * Ahora delega en warpImageData (única implementación). El warp solo corre al
 * disparar un escaneo (no en el loop de preview), así que ejecutarlo en el hilo
 * principal es imperceptible y elimina la duplicación.
 */
import { warpImageData, DEFAULT_CONFIG } from "./omr";

export function warpAsync(
  imageData: ImageData,
  corners: [number, number][],
  config?: { sheetWidth: number; sheetHeight: number; margin: number; cornerSize: number }
): Promise<ImageData> {
  const cfg = config
    ? { ...DEFAULT_CONFIG, ...config }
    : DEFAULT_CONFIG;
  return Promise.resolve(warpImageData(imageData, corners, cfg));
}

export function terminateWorker() {
  /* no-op: ya no hay worker */
}
