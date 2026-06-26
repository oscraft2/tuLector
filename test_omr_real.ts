/**
 * Headless smoke test for the production OMR module.
 *
 * This uses src/lib/omr.ts directly. It intentionally avoids the older
 * self-contained test pipeline in test_omr.ts.
 */
import { createCanvas, ImageData as CanvasImageData, loadImage } from "canvas";
import { TEST_IMAGE_BASE64, EXPECTED_ANSWERS, EXPECTED_ID } from "./src/app/test/test_image";
import { findCorners, gradeBubbles, readStudentId, warpImageData } from "./src/lib/omr";
import { TIMING_X, rowCY } from "./src/lib/sheet_layout";

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
  const idRows = readStudentId(warped);

  if (!report.valid) fail(`Grade report invalid: ${report.reason ?? "unknown reason"}`);

  const missedAnswers = report.results
    .map((result, index) => ({ q: index + 1, got: result.answer, expected: EXPECTED_ANSWERS[index] }))
    .filter((row) => row.got !== row.expected);

  const missedIds = idRows
    .map((got, index) => ({ row: index, got, expected: EXPECTED_ID[index] }))
    .filter((row) => row.got !== row.expected);

  if (missedAnswers.length > 0 || missedIds.length > 0) {
    console.log(JSON.stringify({ corners, missedAnswers, missedIds, valid: report.valid, reason: report.reason }, null, 2));
    fail(`OMR fixture failed: ${missedAnswers.length} answer misses, ${missedIds.length} ID misses`);
  }

  console.log(`OMR production smoke test passed: ${report.results.length}/20 answers, ${idRows.length}/3 ID rows`);

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
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});