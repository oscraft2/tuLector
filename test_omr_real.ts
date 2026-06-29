/**
 * Headless smoke test for the production OMR module.
 *
 * This uses src/lib/omr.ts directly. It intentionally avoids the older
 * self-contained test pipeline in test_omr.ts.
 */
import { createCanvas, ImageData as CanvasImageData, loadImage } from "canvas";
import { TEST_IMAGE_BASE64, EXPECTED_ANSWERS, EXPECTED_RUT, EXPECTED_CODE } from "./src/app/test/test_image";
import { findCorners, gradeBubbles, readRut, readSheetCode, warpImageData, warpSheet, DEFAULT_CONFIG } from "./src/lib/omr";
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
  const warped = warpSheet(frame, corners); // warp por bloques (12 anclas) con fallback
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

  // ─── Guardia de WARP POR BLOQUES (12 anclas): deforma la hoja con un "pandeo"
  // NO lineal (paper bow) que la homografia de 4 esquinas no puede corregir.
  // warpSheet (12 anclas) debe recuperar el RUT; el de 4 esquinas falla. ───
  const bow = (s: globalThis.ImageData, amp: number): globalThis.ImageData => {
    const bw = s.width, bh = s.height, sdat = s.data;
    const out = new CanvasImageData(bw, bh) as unknown as globalThis.ImageData;
    const od = out.data;
    for (let y = 0; y < bh; y++) {
      const shift = amp * Math.sin((Math.PI * y) / bh); // 0 en bordes, max al centro
      for (let x = 0; x < bw; x++) {
        const sx = Math.round(x - shift);
        const di = (y * bw + x) * 4;
        if (sx >= 0 && sx < bw) {
          const si = (y * bw + sx) * 4;
          od[di] = sdat[si]; od[di + 1] = sdat[si + 1]; od[di + 2] = sdat[si + 2]; od[di + 3] = 255;
        } else { od[di] = 255; od[di + 1] = 255; od[di + 2] = 255; od[di + 3] = 255; }
      }
    }
    return out;
  };
  const bowed = bow(frame, 45);
  const cBow = findCorners(bowed) ?? fail("pandeo: esquinas no detectadas");
  const rutBow4 = readRut(warpImageData(bowed, cBow)); // 4 esquinas: deberia fallar
  const rutBow12 = readRut(warpSheet(bowed, cBow));    // 12 anclas: deberia recuperar
  if (rutBow12.rut !== EXPECTED_RUT) fail(`bloque: warpSheet no recupero el RUT bajo pandeo (${rutBow12.rut})`);
  if (rutBow4.rut === EXPECTED_RUT) console.warn(`  (nota: 4-esquinas tambien leyo bien con amp=45; subir para contraste)`);
  console.log(`Block-warp guard passed: pandeo amp=45 → 4-esquinas="${rutBow4.rut}" vs 12-anclas="${rutBow12.rut}" ✓`);

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

  // ─── Guardia MULTI-COLUMNA (Fase C+): 40 preguntas en 2 columnas. Prueba el
  // layout de 2 columnas de punta a punta (render → warp → lectura). La columna
  // derecha vive bajo el RUT; el riel de temporizacion (rowsPerCol) ancla ambas. ───
  const ans40 = Array.from({ length: 40 }, (_, i) => i % 4);
  const cfg40 = { numQuestions: 40, numOptions: 4, numColumns: 2 };
  const sheet40 = createCanvas(SHEET_W, SHEET_H);
  drawSheet(sheet40.getContext("2d") as unknown as Ctx2D, { answers: ans40, rut: "12345678-5", filled: true }, cfg40);
  const img40 = await loadImage(sheet40.toDataURL("image/png"));
  const cap40 = createCanvas(img40.width, img40.height);
  cap40.getContext("2d").drawImage(img40, 0, 0);
  const frame40 = cap40.getContext("2d").getImageData(0, 0, cap40.width, cap40.height) as unknown as globalThis.ImageData;
  const corners40 = findCorners(frame40) ?? fail("multicolumna: esquinas no detectadas");
  const warped40 = warpImageData(frame40, corners40);
  const config40 = { ...DEFAULT_CONFIG, numQuestions: 40, numOptions: 4, optionLabels: "ABCD", numColumns: 2 };
  const report40 = gradeBubbles(warped40, config40, corners40);
  if (!report40.valid) fail(`multicolumna 40q/2col invalido: ${report40.reason}`);
  const exp40 = ans40.map((a) => "ABCD"[a]);
  const miss40 = report40.results.filter((r, i) => r.answer !== exp40[i]);
  if (miss40.length > 0) {
    const first = report40.results.findIndex((r, i) => r.answer !== exp40[i]);
    fail(`multicolumna 40q/2col: ${miss40.length} erradas (ej q${first + 1}: leyo '${report40.results[first].answer}' esperaba '${exp40[first]}')`);
  }
  console.log(`Multi-column guard passed: 40 preguntas / 2 columnas leidas OK (${report40.results.length}/40)`);

  // ─── Guardia de SOMBRA (umbral adaptativo): oscurece fuerte la mitad inferior
  // de la hoja (papel de fondo cae por debajo de 70). Con umbral FIJO ese papel
  // sombreado se contaria como tinta (falsos positivos); el adaptativo lo evita. ───
  const ansSh = Array.from({ length: 20 }, (_, i) => i % 5);
  const sheetSh = createCanvas(SHEET_W, SHEET_H);
  drawSheet(sheetSh.getContext("2d") as unknown as Ctx2D, { answers: ansSh, rut: "12345678-5", filled: true });
  const imgSh = await loadImage(sheetSh.toDataURL("image/png"));
  const capSh = createCanvas(imgSh.width, imgSh.height);
  capSh.getContext("2d").drawImage(imgSh, 0, 0);
  const frameSh = capSh.getContext("2d").getImageData(0, 0, capSh.width, capSh.height) as unknown as globalThis.ImageData;
  const cornersSh = findCorners(frameSh) ?? fail("sombra: esquinas no detectadas");
  const warpedSh = warpImageData(frameSh, cornersSh);
  // Sombra: oscurece SOLO la zona de burbujas (x 175-485) de la mitad inferior
  // (papel 255 → ~65, por debajo de DARK_THRESH). Deja intacto el riel de
  // temporizacion (x~120) y las anclas, para aislar el efecto en el muestreo.
  const dSh = warpedSh.data;
  for (let y = Math.floor(warpedSh.height / 2); y < warpedSh.height; y++) {
    for (let x = 175; x < 485 && x < warpedSh.width; x++) {
      const i = (y * warpedSh.width + x) * 4;
      dSh[i] = Math.max(0, dSh[i] - 190); dSh[i + 1] = Math.max(0, dSh[i + 1] - 190); dSh[i + 2] = Math.max(0, dSh[i + 2] - 190);
    }
  }
  const reportSh = gradeBubbles(warpedSh);
  if (!reportSh.valid) fail(`sombra: invalido ${reportSh.reason}`);
  const expSh = ansSh.map((a) => "ABCDE"[a]);
  const missSh = reportSh.results.filter((r, i) => r.answer !== expSh[i]);
  if (missSh.length > 2) fail(`sombra: ${missSh.length}/20 erradas bajo sombra (umbral adaptativo no aguanto)`);
  console.log(`Shade guard passed: lectura bajo sombra fuerte OK (${20 - missSh.length}/20, mitad inferior oscurecida)`);

  // ─── Guardia de BARRIDO: lee TODA combinación que el generador puede crear
  // (nº preguntas × opciones × columnas). Es el "blindaje" — si una config no
  // lee 100%, aquí se ve y se sabe el sobre seguro del generador. ───
  // Sobre SEGURO (validado por este barrido): 1 col 6-40 preguntas; 2 col 12-50.
  // Fuera de eso las filas quedan muy juntas o faltan marcas de timing → el
  // generador se restringe a este rango (ver sheet_generator.safeColumns/MAX).
  const sweepConfigs: { nq: number; no: number; nc: number }[] = [];
  for (const no of [3, 4, 5]) {
    for (const nq of [6, 10, 15, 20, 25, 30, 40]) sweepConfigs.push({ nq, no, nc: 1 });
    for (const nq of [12, 20, 30, 40, 50]) sweepConfigs.push({ nq, no, nc: 2 });
  }
  let sweepOk = 0;
  const sweepFail: string[] = [];
  for (const { nq, no, nc } of sweepConfigs) {
    const cfg = { numQuestions: nq, numOptions: no, numColumns: nc };
    const ans = Array.from({ length: nq }, (_, i) => (i * 7 + 3) % no); // pseudo-aleatorio determinista
    const sheet = createCanvas(SHEET_W, SHEET_H);
    drawSheet(sheet.getContext("2d") as unknown as Ctx2D, { answers: ans, rut: "12345678-5", filled: true }, cfg);
    const img = await loadImage(sheet.toDataURL("image/png"));
    const cap = createCanvas(img.width, img.height);
    cap.getContext("2d").drawImage(img, 0, 0);
    const frame = cap.getContext("2d").getImageData(0, 0, cap.width, cap.height) as unknown as globalThis.ImageData;
    const corners = findCorners(frame);
    const tag = `${nq}q/${no}o/${nc}c`;
    if (!corners) { sweepFail.push(`${tag}: sin esquinas`); continue; }
    const warped = warpImageData(frame, corners);
    const config = { ...DEFAULT_CONFIG, numQuestions: nq, numOptions: no, optionLabels: "ABCDE".slice(0, no), numColumns: nc };
    const report = gradeBubbles(warped, config, corners);
    if (!report.valid) { sweepFail.push(`${tag}: invalido (${report.reason})`); continue; }
    const exp = ans.map((a) => "ABCDE"[a]);
    const miss = report.results.filter((r, i) => r.answer !== exp[i]).length;
    if (miss > 0) { sweepFail.push(`${tag}: ${miss}/${nq} erradas`); continue; }
    sweepOk++;
  }
  const sweepTotal = sweepConfigs.length;
  if (sweepFail.length > 0) {
    console.log(`⚠ Config sweep: ${sweepOk}/${sweepTotal} OK. Fallaron:\n  ${sweepFail.join("\n  ")}`);
    fail(`Barrido de configs: ${sweepFail.length}/${sweepTotal} no leyeron 100% (ver arriba)`);
  }
  console.log(`Config sweep guard passed: ${sweepOk}/${sweepTotal} configuraciones (preg×opc×col) leídas 100%`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});