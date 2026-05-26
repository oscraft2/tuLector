/**
 * TuLector OMR - Adaptador ZipGrade
 * Patrones copiados directamente de la ingenieria inversa del APK v3.79.616
 * 
 * Fuentes:
 *   SheetReader.java:89     → ProcessByteFrame (11 params, 7 return codes)
 *   t/I.java:366-424        → ImageAnalysis callback (YUV extraction + grading)
 *   ScanningFragment.java   → CameraX setup, preferences, UX
 *   ImageProcessingUtil.java → YUV handling
 */

// ─── ZipGrade Error Codes (SheetReader.java ProcessByteFrame returns) ───
export const ZIPGRADE_CODES = {
  GRADED: 1,               // Paper graded successfully
  BRIGHT: 5,               // Bright lights / glare detected
  CURVE_FAIL: 10,          // Curve check failed
  WRONG_FORMAT: 30,        // Wrong answer sheet format
  ALIGN_START: 100,        // Viewfinder alignment issues start
  ALIGN_END: 106,          // Viewfinder alignment issues end
  OUT_OF_FOCUS: 1001,      // Out of focus
} as const;

// ─── ZipGrade Preferences (ScanningFragment.java:689-698) ───
export const ZIPGRADE_PREFS = {
  focusReq: { default: 50, min: 1, max: 100 },
  strictReq: { default: 0 },
  brightDetect: { default: true },
  resolutionSelection: { default: "0" },  // "0"=auto, "1"=2576x2576
  playShutterSound: { default: true },
  vibrateOnScan: { default: true },
  showPaperOnScan: { default: false },
  betweenGrading: { default: "0" },
  onePaperPerStudent: { default: true },
  warnBeforeOverwriting: { default: true },
} as const;

// ─── ZipGrade Thresholds (t/I.java:324,409,416) ───
export const ZIPGRADE_THRESHOLDS = {
  scanCooldownMs: 2500,          // t/I.java:324 - 2500ms between scans
  badPaperThreshold: 45,         // t/I.java:409 - 45 bad frames → warning
  outOfFocusThreshold: 50,       // t/I.java:416-419 - 50 unfocused → warning
  debugFramesLogCount: 4,        // t/I.java:340 - log first 4 frames only
} as const;

// ─── ZipGrade Status Messages (ScanningFragment.java:444-461) ───
export const ZIPGRADE_MESSAGES: Record<number, string> = {
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

// ─── ZipGrade Camera Resolution Strategy (ScanningFragment.java:313-348) ───
export function selectCameraResolution(outputSizes: {width:number,height:number}[]): {width:number,height:number} | null {
  // ZipGrade: busca mejor resolucion 4:3 (aspect ~1.333)
  // Altura minima 720, maxima 3000. Ancho maximo 3000.
  let best: {width:number,height:number} | null = null;
  let bestDiff = Infinity;

  for (const size of outputSizes) {
    if (size.height < 720 || size.height >= 3000 || size.width >= 3000) continue;
    const ratio = size.width / size.height;
    const diff = Math.abs(1.333 - ratio);
    if (diff < bestDiff) { bestDiff = diff; best = size; }
  }

  // Fallback: la mas grande con height > 720
  if (!best) {
    let maxH = 0;
    for (const size of outputSizes) {
      if (size.width > size.height && size.height > maxH) { maxH = size.height; best = size; }
    }
  }

  return best;
}

// ─── ZipGrade Frame Processing Pattern (t/I.java:280-424) ───
// Extraer YUV compacto de ImageProxy (eliminando padding/stride)
// Este patron es exactamente como ZipGrade procesa los frames
export function extractCompactYUV(
  yPlane: Uint8Array, uPlane: Uint8Array, vPlane: Uint8Array,
  yRowStride: number, uRowStride: number, vRowStride: number,
  yPixelStride: number, uPixelStride: number, vPixelStride: number,
  width: number, height: number
): ArrayBuffer {
  // ZipGrade: compacta YUV eliminando padding entre filas (t/I.java:260-311)
  const ySize = width * height;
  const uvSize = (width / 2) * (height / 2);
  const buffer = new ArrayBuffer(ySize + uvSize * 2);
  const yDest = new Uint8Array(buffer, 0, ySize);
  const uDest = new Uint8Array(buffer, ySize, uvSize);
  const vDest = new Uint8Array(buffer, ySize + uvSize, uvSize);

  // Copiar Y sin padding
  if (yPixelStride === 1) {
    for (let row = 0; row < height; row++) {
      const srcOff = row * yRowStride;
      const dstOff = row * width;
      yDest.set(yPlane.subarray(srcOff, srcOff + width), dstOff);
    }
  }

  // Copiar U/V sin padding (subsampled 2x2)
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

// ─── ZipGrade Rotation Handling (t/I.java:337) ───
// ZipGrade resta 90 grados al rotation del dispositivo
export function normalizeRotation(deviceRotation: number): number {
  let rotation = deviceRotation - 90;
  if (rotation < 0) rotation += 360;
  return rotation;
}

// ─── ZipGrade Scan Cooldown (t/I.java:324) ───
// 2500ms entre escaneos. Durante el cooldown se muestra progress bar.
export function calculateCooldownProgress(lastScanTime: number): number {
  const elapsed = Date.now() - lastScanTime;
  return Math.min(100, (elapsed / ZIPGRADE_THRESHOLDS.scanCooldownMs) * 100);
}

export function isInCooldown(lastScanTime: number): boolean {
  return (Date.now() - lastScanTime) < ZIPGRADE_THRESHOLDS.scanCooldownMs;
}
