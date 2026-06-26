/**
 * TuLector - Configuracion del motor de escaneo.
 * Constantes de procesamiento de imagen y control de camara.
 */

export const SCAN_CODES = {
  GRADED: 1,           // Hoja calificada con exito
  BRIGHT: 5,           // Brillo/reflejo detectado
  CURVE_FAIL: 10,      // Papel curvado/doblado
  WRONG_FORMAT: 30,    // Formato de hoja incorrecto
  ALIGN_START: 100,    // Problema de alineacion
  ALIGN_END: 106,
  OUT_OF_FOCUS: 1001,  // Fuera de foco
} as const;

export const SCAN_PREFS = {
  focusReq: { default: 50, min: 1, max: 100 },
  brightDetect: { default: true },
  resolutionSelection: { default: "0" },
  playShutterSound: { default: true },
  vibrateOnScan: { default: true },
  showPaperOnScan: { default: false },
  betweenGrading: { default: "0" },
  onePaperPerStudent: { default: true },
  warnBeforeOverwriting: { default: true },
} as const;

export const SCAN_THRESHOLDS = {
  scanCooldownMs: 2500,
  badPaperThreshold: 45,
  outOfFocusThreshold: 50,
  debugFramesLogCount: 4,
} as const;

export const SCAN_MESSAGES: Record<number, string> = {
  100: "Alinea los 4 cuadrados en los visores",
  101: "Alinea los 4 cuadrados en los visores",
  102: "Alinea los 4 cuadrados en los visores",
  103: "Alinea los 4 cuadrados en los visores",
  104: "Alinea los 4 cuadrados en los visores",
  105: "Alinea los 4 cuadrados en los visores",
  106: "Esperando foco...",
  30:  "Verifica el formato de la hoja",
  10:  "Papel curvado detectado - alisa la hoja",
  5:   "Brillo detectado - cambia el angulo",
  1001:"Fuera de foco - ajusta la distancia",
};

export function selectCameraResolution(outputSizes: {width:number,height:number}[]): {width:number,height:number} | null {
  let best: {width:number,height:number} | null = null;
  let bestDiff = Infinity;

  for (const size of outputSizes) {
    if (size.height < 720 || size.height >= 3000 || size.width >= 3000) continue;
    const diff = Math.abs(1.333 - size.width / size.height);
    if (diff < bestDiff) { bestDiff = diff; best = size; }
  }

  if (!best) {
    let maxH = 0;
    for (const size of outputSizes) {
      if (size.width > size.height && size.height > maxH) { maxH = size.height; best = size; }
    }
  }
  return best;
}

export function extractCompactYUV(
  yPlane: Uint8Array, uPlane: Uint8Array, vPlane: Uint8Array,
  yRowStride: number, uRowStride: number, vRowStride: number,
  yPixelStride: number, uPixelStride: number, vPixelStride: number,
  width: number, height: number
): ArrayBuffer {
  const ySize = width * height;
  const uvSize = (width / 2) * (height / 2);
  const buffer = new ArrayBuffer(ySize + uvSize * 2);
  const yDest = new Uint8Array(buffer, 0, ySize);
  const uDest = new Uint8Array(buffer, ySize, uvSize);
  const vDest = new Uint8Array(buffer, ySize + uvSize, uvSize);

  if (yPixelStride === 1) {
    for (let row = 0; row < height; row++) {
      yDest.set(yPlane.subarray(row * yRowStride, row * yRowStride + width), row * width);
    }
  }

  const uvH = height / 2, uvW = width / 2;
  for (let row = 0; row < uvH; row++) {
    const srcOff = row * uRowStride;
    const dstOff = row * uvW;
    for (let col = 0; col < uvW; col++) {
      uDest[dstOff + col] = uPlane[srcOff + col * uPixelStride];
      vDest[dstOff + col] = vPlane[srcOff + col * vPixelStride];
    }
  }
  return buffer;
}

export function normalizeRotation(sensorOrientation: number): number {
  return (360 - sensorOrientation) % 360;
}

export function calculateCooldownProgress(lastScanTime: number): number {
  return Math.min(100, ((Date.now() - lastScanTime) / SCAN_THRESHOLDS.scanCooldownMs) * 100);
}

export function isInCooldown(lastScanTime: number): boolean {
  return (Date.now() - lastScanTime) < SCAN_THRESHOLDS.scanCooldownMs;
}
