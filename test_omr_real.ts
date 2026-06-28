/**
 * Headless smoke test for the production OMR module.
 *
 * This uses src/lib/omr.ts directly. It intentionally avoids the older
 * self-contained test pipeline in test_omr.ts.
 */
import { createCanvas, ImageData as CanvasImageData, loadImage } from "canvas";
import { TEST_IMAGE_BASE64, EXPECTED_ANSWERS, EXPECTED_RUT, EXPECTED_CODE } from "./src/app/test/test_image";
import { findCorners, gradeBubbles, readRut, readSheetCode, warpImageData, DEFAULT_CONFIG } from "./src/lib/omr";
import { TIMING_X, rowCY, SHEET_W, SHEET_H } from "./src/lib/sheet_layout";
import { drawSheet, type Ctx2D } from "./src/lib/sheet_render";

(globalThis as unknown as { ImageData: typeof CanvasImageData }).ImageData = CanvasImageData;

function fail(message: string): never {
  throw new Error(message);
}

async function main() {
  const img = await loadImage(TEST_IMAGE_BASE64);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height) as unknown as globalThis.ImageData;
  const corners = findCorners(frame) ?? fail("Corners were not detected");
  const warped = warpImageData(frame, corners);
  const report = gradeBubbles(warped);
  const rutResult = readRut(warped);

  if (!report.valid) fail(`Grade report invalid: ${report.reason ?? "unknown reason"}`);

  // Guardia anti-regresión: la franja del código NO debe contarse como marca de
  // temporización (si cruza la columna, daría 21 y la votación rechaza el frame).
  if (report.diag?.timingRows !== 20) {
    fail(`timingRows=${report.diag?.timingRows} (esperado 20): la franja del código contamina la pista`);
  }

  const missedAnswers = report.results
    .map((result, index) => ({ q: index + 1, got: result.answer, expected: EXPECTED_ANSWERS[index] }))
    .filter((row) => row.got !== row.expected);

  if (missedAnswers.length > 0) {
    console.log(JSON.stringify({ corners, missedAnswers, valid: report.valid, reason: report.reason }, null, 2));
    fail(`OMR fixture failed: ${missedAnswers.length} answer misses`);
  }
  if (rutResult.rut !== EXPECTED_RUT) fail(`RUT mismatch: got ${rutResult.rut}, expected ${EXPECTED_RUT}`);
  if (!rutResult.dvOk) fail(`RUT DV no valido: ${rutResult.rut}`);

  // Código de hoja: leer del warp y verificar guías + CRC + campos.
  const codeRead = readSheetCode(warped);
  if (!codeRead) fail("Código de hoja no leído (null)");
  if (JSON.stringify(codeRead) !== JSON.stringify(EXPECTED_CODE)) {
    fail(`Código de hoja distinto: ${JSON.stringify(codeRead)} vs ${JSON.stringify(EXPECTED_CODE)}`);
  }

  console.log(`OMR production smoke test passed: ${report.results.length}/20 answers, RUT ${rutResult.rut} (DV ${rutResult.dvOk ? "OK" : "FAIL"}), code sheetId=${codeRead.sheetId} p${codeRead.page}/${codeRead.pagesTotal}`);

  // ─── Guardia de timing parcial (Fase 0.3): ocluir 4 marcas y verificar que
  // el registro interpola por regresion y sigue calificando 20/20. ───
  const warped2 = warpImageData(frame, corners);
  const d = warped2.data;
  for (const q of [3, 7, 11, 15]) {
    const cy = rowCY(q);
    for (let dy = -14; dy <= 14; dy++) {
      for (let dx = -20; dx <= 20; dx++) {
        const px = TIMING_X + dx, py = cy + dy;
        if (px >= 0 && px < warped2.width && py >= 0 && py < warped2.height) {
          const i = (py * warped2.width + px) * 4;
          d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = 255;
        }
      }
    }
  }
  const report2 = gradeBubbles(warped2);
  if (!report2.valid) fail(`timing parcial: reporte invalido (${report2.reason})`);
  if (!report2.diag?.usedTiming) fail("timing parcial: no uso registro por temporizacion interpolado");
  const miss2 = report2.results.filter((r, i) => r.answer !== EXPECTED_ANSWERS[i]);
  if (miss2.length > 0) fail(`timing parcial: ${miss2.length} respuestas erradas con 4 marcas ocluidas`);
  console.log(`Partial-timing guard passed: usedTiming=${report2.diag?.usedTiming} con 4 marcas ocluidas (${report2.diag?.timingRows} detectadas)`);

  // ─── Guardia de warp NO-identidad: incrustar la hoja en un lienzo mayor con
  // offset (simula que no llena el cuadro, como una foto real). Atrapa errores de
  // DIRECCION de la homografia que el fixture canonico no ve. ───
  const padX = 220, padY = 320;
  const big = createCanvas(img.width + padX * 2, img.height + padY * 2);
  const bctx = big.getContext("2d");
  bctx.fillStyle = "#ffffff";
  bctx.fillRect(0, 0, big.width, big.height);
  bctx.drawImage(img, padX, padY);
  const bigFrame = bctx.getImageData(0, 0, big.width, big.height) as unknown as globalThis.ImageData;

  const c2 = findCorners(bigFrame) ?? fail("offset: esquinas no detectadas");
  const w2 = warpImageData(bigFrame, c2);
  const r2 = gradeBubbles(w2, undefined, c2);
  if (!r2.valid) fail(`offset warp invalido: ${r2.reason}`);
  const offMiss = r2.results.filter((x, i) => x.answer !== EXPECTED_ANSWERS[i]);
  if (offMiss.length > 0) fail(`offset warp: ${offMiss.length} respuestas erradas`);
  console.log(`Offset-warp guard passed: hoja no-canonica recuperada (esquinas TL=${c2[0]})`);

  // ─── Guardia de DERIVA horizontal (registro acumulativo por columna): warpea
  // con las esquinas derechas movidas hacia adentro → el bloque RUT se corre
  // progresivamente (error de escala horizontal, como en fotos reales). Sin
  // registro acumulativo las columnas de la derecha caen en blanco. ───
  const driftCorners: [number, number][] = [
    [corners[0][0], corners[0][1]],
    [corners[1][0] - 16, corners[1][1]],   // TR hacia adentro
    [corners[2][0] - 16, corners[2][1]],   // BR hacia adentro
    [corners[3][0], corners[3][1]],
  ];
  const warpedDrift = warpImageData(frame, driftCorners);
  const rutDrift = readRut(warpedDrift);
  if (rutDrift.rut !== EXPECTED_RUT) fail(`deriva: RUT leido ${rutDrift.rut} != ${EXPECTED_RUT}`);
  console.log(`Drift guard passed: RUT ${rutDrift.rut} recuperado con escala horizontal perturbada (dvComputed=${rutDrift.dvComputed})`);

  // ─── Guardia PARAMÉTRICO (Fase C): generar y leer una hoja con OTRO config
  // (30 preguntas / 3 opciones, formato tipo EXANI México). Prueba que el layout
  // paramétrico funciona de punta a punta. ───
  const ans30 = Array.from({ length: 30 }, (_, i) => i % 3);
  const cfg30 = { numQuestions: 30, numOptions: 3 };
  const sheet30 = createCanvas(SHEET_W, SHEET_H);
  drawSheet(sheet30.getContext("2d") as unknown as Ctx2D, { answers: ans30, rut: "12345678-5", filled: true }, cfg30);
  const img30 = await loadImage(sheet30.toDataURL("image/png"));
  const cap30 = createCanvas(img30.width, img30.height);
  cap30.getContext("2d").drawImage(img30, 0, 0);
  const frame30 = cap30.getContext("2d").getImageData(0, 0, cap30.width, cap30.height) as unknown as globalThis.ImageData;
  const corners30 = findCorners(frame30) ?? fail("parametrico: esquinas no detectadas");
  const warped30 = warpImageData(frame30, corners30);
  const config30 = { ...DEFAULT_CONFIG, numQuestions: 30, numOptions: 3, optionLabels: "ABC" };
  const report30 = gradeBubbles(warped30, config30, corners30);
  if (!report30.valid) fail(`parametrico 30q/3opt invalido: ${report30.reason}`);
  const exp30 = ans30.map((a) => "ABC"[a]);
  const miss30 = report30.results.filter((r, i) => r.answer !== exp30[i]);
  if (miss30.length > 0) fail(`parametrico 30q/3opt: ${miss30.length} respuestas erradas`);
  console.log(`Parametric guard passed: 30 preguntas / 3 opciones leidas OK (${report30.results.length}/30)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});