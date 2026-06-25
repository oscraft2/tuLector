/**
 * Headless smoke test for the production OMR module.
 *
 * This uses src/lib/omr.ts directly. It intentionally avoids the older
 * self-contained test pipeline in test_omr.ts.
 */
import { createCanvas, ImageData as CanvasImageData, loadImage } from "canvas";
import { TEST_IMAGE_BASE64, EXPECTED_ANSWERS, EXPECTED_ID } from "./src/app/test/test_image";
import { findCorners, gradeBubbles, readStudentId, warpImageData } from "./src/lib/omr";

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
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});