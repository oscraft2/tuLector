/**
 * Headless smoke test for the production OMR module.
 *
 * This uses src/lib/omr.ts directly. It intentionally avoids the older
 * self-contained test pipeline in test_omr.ts.
 */
import { createCanvas, ImageData as CanvasImageData, loadImage } from "canvas";
import { TEST_IMAGE_BASE64, EXPECTED_ANSWERS, EXPECTED_RUT, EXPECTED_CODE } from "./src/app/test/test_image";
import { findCorners, gradeBubbles, readRut, readSheetCode, warpImageData, warpSheet, cropNameBox, DEFAULT_CONFIG, ID_READ_AR, ID_READ_BR, ID_READ_PE, ID_READ_CO, ID_READ_EC, ID_READ_UY, checkDigitsBr, checkDigitMod10Ec, checkDigitMod10Uy } from "./src/lib/omr";
import { TIMING_X, rowCY, SHEET_W, SHEET_H, ID_BLOCK_AR, ID_BLOCK_BR, ID_BLOCK_PE, ID_BLOCK_CO, ID_BLOCK_EC, ID_BLOCK_UY } from "./src/lib/sheet_layout";
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

  // ─── Guardia de ID NACIONAL (Fase 0, multi-país): genera y lee una hoja con
  // el bloque de Argentina (DNI, 8 dígitos, SIN dígito verificador) en vez del
  // RUT chileno. Prueba que el bloque de ID es de verdad paramétrico (columnas
  // variables + checksum desconectable), no solo el layout de preguntas. ───
  const dniAr = "20345678";
  const cfgAr = { numQuestions: 20, numOptions: 5, idBlock: ID_BLOCK_AR };
  const sheetAr = createCanvas(SHEET_W, SHEET_H);
  drawSheet(sheetAr.getContext("2d") as unknown as Ctx2D, { answers: Array.from({ length: 20 }, (_, i) => i % 5), rut: dniAr, filled: true }, cfgAr);
  const imgAr = await loadImage(sheetAr.toDataURL("image/png"));
  const capAr = createCanvas(imgAr.width, imgAr.height);
  capAr.getContext("2d").drawImage(imgAr, 0, 0);
  const frameAr = capAr.getContext("2d").getImageData(0, 0, capAr.width, capAr.height) as unknown as globalThis.ImageData;
  const cornersAr = findCorners(frameAr) ?? fail("id-nacional-AR: sin esquinas");
  const warpedAr = warpImageData(frameAr, cornersAr);
  const idAr = readRut(warpedAr, undefined, ID_READ_AR);
  if (idAr.rut !== dniAr) fail(`id-nacional-AR: DNI leído "${idAr.rut}" (esperaba "${dniAr}")`);
  if (idAr.dvComputed) fail(`id-nacional-AR: no debería calcular DV (Argentina no tiene dígito verificador)`);
  console.log(`National-ID guard (Argentina/DNI, sin DV) passed: ${idAr.rut}`);

  // ─── Guardia de ID NACIONAL (Fase 0, segundo país): Brasil (CPF, 9 dígitos +
  // 2 dígitos verificadores módulo-11 en dos pasadas, algoritmo distinto al RUT).
  // Prueba que el checksum es de verdad intercambiable (no solo desconectable,
  // como el caso de Argentina) y que el bloque soporta MÁS de una columna de DV. ───
  const bodyBr = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const [d1Br, d2Br] = checkDigitsBr(bodyBr);
  const cpfBr = `${bodyBr.join("")}-${d1Br}${d2Br}`;
  const cfgBr = { numQuestions: 20, numOptions: 5, idBlock: ID_BLOCK_BR };
  const sheetBr = createCanvas(SHEET_W, SHEET_H);
  drawSheet(sheetBr.getContext("2d") as unknown as Ctx2D, { answers: Array.from({ length: 20 }, (_, i) => i % 5), rut: cpfBr, filled: true }, cfgBr);
  const imgBr = await loadImage(sheetBr.toDataURL("image/png"));
  const capBr = createCanvas(imgBr.width, imgBr.height);
  capBr.getContext("2d").drawImage(imgBr, 0, 0);
  const frameBr = capBr.getContext("2d").getImageData(0, 0, capBr.width, capBr.height) as unknown as globalThis.ImageData;
  const cornersBr = findCorners(frameBr) ?? fail("id-nacional-BR: sin esquinas");
  const warpedBr = warpImageData(frameBr, cornersBr);
  const idBr = readRut(warpedBr, undefined, ID_READ_BR);
  if (idBr.rut !== cpfBr) fail(`id-nacional-BR: CPF leído "${idBr.rut}" (esperaba "${cpfBr}")`);
  if (!idBr.dvOk) fail(`id-nacional-BR: los 2 dígitos verificadores no validaron`);
  if (idBr.dvComputed) fail(`id-nacional-BR: no debería calcular DV (ambas burbujas se leyeron)`);
  console.log(`National-ID guard (Brasil/CPF, DV mod-11 x2) passed: ${idBr.rut}`);

  // ─── Guardia de ID NACIONAL (Fase 0, tercer país): Peru (DNI, 8 dígitos, SIN
  // dígito verificador) — mismo patrón que Argentina, confirma el perfil PE. ───
  const dniPe = "44556677";
  const cfgPe = { numQuestions: 20, numOptions: 5, idBlock: ID_BLOCK_PE };
  const sheetPe = createCanvas(SHEET_W, SHEET_H);
  drawSheet(sheetPe.getContext("2d") as unknown as Ctx2D, { answers: Array.from({ length: 20 }, (_, i) => i % 5), rut: dniPe, filled: true }, cfgPe);
  const imgPe = await loadImage(sheetPe.toDataURL("image/png"));
  const capPe = createCanvas(imgPe.width, imgPe.height);
  capPe.getContext("2d").drawImage(imgPe, 0, 0);
  const framePe = capPe.getContext("2d").getImageData(0, 0, capPe.width, capPe.height) as unknown as globalThis.ImageData;
  const cornersPe = findCorners(framePe) ?? fail("id-nacional-PE: sin esquinas");
  const warpedPe = warpImageData(framePe, cornersPe);
  const idPe = readRut(warpedPe, undefined, ID_READ_PE);
  if (idPe.rut !== dniPe) fail(`id-nacional-PE: DNI leído "${idPe.rut}" (esperaba "${dniPe}")`);
  console.log(`National-ID guard (Peru/DNI, sin DV) passed: ${idPe.rut}`);

  // ─── Guardia de ID NACIONAL (Fase 0, cuarto país): Colombia (CC, largo
  // VARIABLE 6-10 dígitos, SIN dígito verificador). A diferencia de AR/PE (que
  // usan el ancho completo de columnas), esta prueba un ID MÁS CORTO que las
  // 10 columnas de la grilla → confirma el alineado a la derecha con columnas
  // vacías a la izquierda. ───
  const ccCo = "1234567"; // 7 de 10 columnas
  const cfgCo = { numQuestions: 20, numOptions: 5, idBlock: ID_BLOCK_CO };
  const sheetCo = createCanvas(SHEET_W, SHEET_H);
  drawSheet(sheetCo.getContext("2d") as unknown as Ctx2D, { answers: Array.from({ length: 20 }, (_, i) => i % 5), rut: ccCo, filled: true }, cfgCo);
  const imgCo = await loadImage(sheetCo.toDataURL("image/png"));
  const capCo = createCanvas(imgCo.width, imgCo.height);
  capCo.getContext("2d").drawImage(imgCo, 0, 0);
  const frameCo = capCo.getContext("2d").getImageData(0, 0, capCo.width, capCo.height) as unknown as globalThis.ImageData;
  const cornersCo = findCorners(frameCo) ?? fail("id-nacional-CO: sin esquinas");
  const warpedCo = warpImageData(frameCo, cornersCo);
  const idCo = readRut(warpedCo, undefined, ID_READ_CO);
  if (idCo.rut !== ccCo) fail(`id-nacional-CO: CC leída "${idCo.rut}" (esperaba "${ccCo}")`);
  console.log(`National-ID guard (Colombia/CC, largo variable, sin DV) passed: ${idCo.rut}`);

  // ─── Guardia de ID NACIONAL (Fase 0, quinto país): Ecuador (Cédula, 9 dígitos
  // de cuerpo + 1 DV módulo-10 con coeficientes propios). Prueba un TERCER
  // algoritmo de checksum distinto a RUT (mod-11) y CPF (mod-11 x2). ───
  const bodyEc = [1, 7, 2, 3, 4, 5, 6, 7, 8]; // provincia "17" (Pichincha, válida 01-24)
  const dvEc = checkDigitMod10Ec(bodyEc);
  const cedulaEc = `${bodyEc.join("")}-${dvEc}`;
  const cfgEc = { numQuestions: 20, numOptions: 5, idBlock: ID_BLOCK_EC };
  const sheetEc = createCanvas(SHEET_W, SHEET_H);
  drawSheet(sheetEc.getContext("2d") as unknown as Ctx2D, { answers: Array.from({ length: 20 }, (_, i) => i % 5), rut: cedulaEc, filled: true }, cfgEc);
  const imgEc = await loadImage(sheetEc.toDataURL("image/png"));
  const capEc = createCanvas(imgEc.width, imgEc.height);
  capEc.getContext("2d").drawImage(imgEc, 0, 0);
  const frameEc = capEc.getContext("2d").getImageData(0, 0, capEc.width, capEc.height) as unknown as globalThis.ImageData;
  const cornersEc = findCorners(frameEc) ?? fail("id-nacional-EC: sin esquinas");
  const warpedEc = warpImageData(frameEc, cornersEc);
  const idEc = readRut(warpedEc, undefined, ID_READ_EC);
  if (idEc.rut !== cedulaEc) fail(`id-nacional-EC: Cédula leída "${idEc.rut}" (esperaba "${cedulaEc}")`);
  if (!idEc.dvOk) fail(`id-nacional-EC: el dígito verificador no validó`);
  console.log(`National-ID guard (Ecuador/Cédula, DV mod-10) passed: ${idEc.rut}`);

  // ─── Guardia de ID NACIONAL (Fase 0, sexto país): Uruguay (CI, 7 dígitos de
  // cuerpo + 1 DV módulo-10 con multiplicadores propios). Cierra la validación
  // de los 6 países numéricos del plan multi-país (queda México/CURP aparte). ───
  const bodyUy = [1, 2, 3, 4, 5, 6, 7];
  const dvUy = checkDigitMod10Uy(bodyUy);
  const ciUy = `${bodyUy.join("")}-${dvUy}`;
  const cfgUy = { numQuestions: 20, numOptions: 5, idBlock: ID_BLOCK_UY };
  const sheetUy = createCanvas(SHEET_W, SHEET_H);
  drawSheet(sheetUy.getContext("2d") as unknown as Ctx2D, { answers: Array.from({ length: 20 }, (_, i) => i % 5), rut: ciUy, filled: true }, cfgUy);
  const imgUy = await loadImage(sheetUy.toDataURL("image/png"));
  const capUy = createCanvas(imgUy.width, imgUy.height);
  capUy.getContext("2d").drawImage(imgUy, 0, 0);
  const frameUy = capUy.getContext("2d").getImageData(0, 0, capUy.width, capUy.height) as unknown as globalThis.ImageData;
  const cornersUy = findCorners(frameUy) ?? fail("id-nacional-UY: sin esquinas");
  const warpedUy = warpImageData(frameUy, cornersUy);
  const idUy = readRut(warpedUy, undefined, ID_READ_UY);
  if (idUy.rut !== ciUy) fail(`id-nacional-UY: CI leída "${idUy.rut}" (esperaba "${ciUy}")`);
  if (!idUy.dvOk) fail(`id-nacional-UY: el dígito verificador no validó`);
  console.log(`National-ID guard (Uruguay/CI, DV mod-10) passed: ${idUy.rut}`);

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

  // ─── Guardia de 3-4 COLUMNAS (exploración: ¿llegamos a ~100 preguntas en 1
  // hoja, como ZipGrade?). Reutiliza la MISMA densidad de fila que el 50q/2col
  // ya validado (25 filas/columna, rowH=36, burbuja r=15) — solo agrega
  // geometría horizontal nueva (COL_GEOM[3]/[4], paso 38px) subdividiendo las
  // 2 franjas libres entre anclas. Si esto lee 100%, baja mucho la necesidad
  // de multipágina para pruebas comunes. ───
  const ans75 = Array.from({ length: 75 }, (_, i) => (i * 7 + 3) % 4);
  const cfg75 = { numQuestions: 75, numOptions: 4, numColumns: 3 };
  const sheet75 = createCanvas(SHEET_W, SHEET_H);
  drawSheet(sheet75.getContext("2d") as unknown as Ctx2D, { answers: ans75, rut: "12345678-5", filled: true }, cfg75);
  const img75 = await loadImage(sheet75.toDataURL("image/png"));
  const cap75 = createCanvas(img75.width, img75.height);
  cap75.getContext("2d").drawImage(img75, 0, 0);
  const frame75 = cap75.getContext("2d").getImageData(0, 0, cap75.width, cap75.height) as unknown as globalThis.ImageData;
  const corners75 = findCorners(frame75) ?? fail("3-columnas: esquinas no detectadas");
  const warped75 = warpImageData(frame75, corners75);
  const config75 = { ...DEFAULT_CONFIG, numQuestions: 75, numOptions: 4, optionLabels: "ABCD", numColumns: 3 };
  const report75 = gradeBubbles(warped75, config75, corners75);
  if (!report75.valid) fail(`3-columnas 75q/3col invalido: ${report75.reason}`);
  const exp75 = ans75.map((a) => "ABCD"[a]);
  const miss75 = report75.results.filter((r, i) => r.answer !== exp75[i]).length;
  if (miss75 > 0) fail(`3-columnas: ${miss75}/75 erradas`);
  console.log(`3-column guard passed: 75 preguntas / 3 columnas leidas OK (${report75.results.length}/75)`);

  const ans100 = Array.from({ length: 100 }, (_, i) => (i * 7 + 3) % 5);
  const cfg100 = { numQuestions: 100, numOptions: 5, numColumns: 4 };
  const sheet100 = createCanvas(SHEET_W, SHEET_H);
  drawSheet(sheet100.getContext("2d") as unknown as Ctx2D, { answers: ans100, rut: "12345678-5", filled: true }, cfg100);
  const img100 = await loadImage(sheet100.toDataURL("image/png"));
  const cap100 = createCanvas(img100.width, img100.height);
  cap100.getContext("2d").drawImage(img100, 0, 0);
  const frame100 = cap100.getContext("2d").getImageData(0, 0, cap100.width, cap100.height) as unknown as globalThis.ImageData;
  const corners100 = findCorners(frame100) ?? fail("4-columnas: esquinas no detectadas");
  const warped100 = warpImageData(frame100, corners100);
  const config100 = { ...DEFAULT_CONFIG, numQuestions: 100, numOptions: 5, optionLabels: "ABCDE", numColumns: 4 };
  const report100 = gradeBubbles(warped100, config100, corners100);
  if (!report100.valid) fail(`4-columnas 100q/4col invalido: ${report100.reason}`);
  const exp100 = ans100.map((a) => "ABCDE"[a]);
  const miss100 = report100.results.filter((r, i) => r.answer !== exp100[i]).length;
  if (miss100 > 0) {
    const first = report100.results.findIndex((r, i) => r.answer !== exp100[i]);
    fail(`4-columnas: ${miss100}/100 erradas (ej q${first + 1}: leyo '${report100.results[first].answer}' esperaba '${exp100[first]}')`);
  }
  console.log(`4-column guard passed: 100 preguntas / 4 columnas leidas OK (${report100.results.length}/100) — nivel ZipGrade en 1 hoja`);

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

  // ─── Guardia de RUT de BAJO CONTRASTE (caso real del usuario): warp "lavado"
  // donde la marca a mano queda gris ~150 sobre papel gris ~185 (medido en su
  // foto real). Con umbral fijo <70 NADA baja del umbral → 0.00 → fallaba. El
  // umbral relativo al papel lo lee. Reproduce el bug exacto y lo blinda. ───
  const sheetLC = createCanvas(SHEET_W, SHEET_H);
  drawSheet(sheetLC.getContext("2d") as unknown as Ctx2D, { rut: "12345678-5", filled: true, answers: Array.from({ length: 20 }, (_, i) => i % 5) });
  const imgLC = await loadImage(sheetLC.toDataURL("image/png"));
  const capLC = createCanvas(imgLC.width, imgLC.height);
  capLC.getContext("2d").drawImage(imgLC, 0, 0);
  const frameLC = capLC.getContext("2d").getImageData(0, 0, capLC.width, capLC.height) as unknown as globalThis.ImageData;
  const cornersLC = findCorners(frameLC) ?? fail("bajo-contraste: sin esquinas");
  const warpedLC = warpImageData(frameLC, cornersLC);
  // Comprime el contraste a [150,185]: negro(0)→150, blanco(255)→185 (warp lavado).
  const dLC = warpedLC.data;
  for (let i = 0; i < dLC.length; i += 4) {
    for (let k = 0; k < 3; k++) dLC[i + k] = Math.round(150 + dLC[i + k] * (35 / 255));
  }
  const rutLC = readRut(warpedLC);
  if (rutLC.rut !== "12345678-5") fail(`bajo-contraste: RUT leyó "${rutLC.rut}" (esperaba 12345678-5) — el umbral relativo no aguantó`);
  if ((rutLC.diag?.timing ?? 0) < 7) fail(`bajo-contraste: la pista del RUT no se enganchó (timing=${rutLC.diag?.timing}) — readRutTimingY relativo no aguantó`);
  console.log(`Low-contrast RUT guard passed: RUT 12345678-5 + pista anclada (timing=${rutLC.diag?.timing}) en warp lavado`);

  // ─── Guardia de PREGUNTAS de bajo contraste (caso real del usuario): lava SOLO
  // la zona de opciones (marca gris ~130 / papel ~185), dejando anclas/timing
  // oscuros para que el warp valide. El score relativo por pregunta debe leerlas
  // (antes el absoluto <70 daba ~12/40). ───
  const ansFq = Array.from({ length: 20 }, (_, i) => i % 5);
  const sheetFq = createCanvas(SHEET_W, SHEET_H);
  drawSheet(sheetFq.getContext("2d") as unknown as Ctx2D, { answers: ansFq, rut: "12345678-5", filled: true });
  const imgFq = await loadImage(sheetFq.toDataURL("image/png"));
  const capFq = createCanvas(imgFq.width, imgFq.height);
  capFq.getContext("2d").drawImage(imgFq, 0, 0);
  const frameFq = capFq.getContext("2d").getImageData(0, 0, capFq.width, capFq.height) as unknown as globalThis.ImageData;
  const cornersFq = findCorners(frameFq) ?? fail("preg-bajo-contraste: sin esquinas");
  const warpedFq = warpImageData(frameFq, cornersFq);
  // Lava solo la banda de opciones (x 175-485), preservando anclas/timing oscuros.
  const dFq = warpedFq.data;
  for (let y = 300; y < warpedFq.height; y++) {
    for (let x = 175; x < 485 && x < warpedFq.width; x++) {
      const i = (y * warpedFq.width + x) * 4;
      for (let k = 0; k < 3; k++) dFq[i + k] = Math.round(130 + dFq[i + k] * (185 - 130) / 255);
    }
  }
  const gFq = gradeBubbles(warpedFq);
  if (!gFq.valid) fail(`preg-bajo-contraste: warp inválido (${gFq.reason})`);
  const expFq = ansFq.map((a) => "ABCDE"[a]);
  const missFq = gFq.results.filter((r, i) => r.answer !== expFq[i]).length;
  if (missFq > 1) fail(`preg-bajo-contraste: ${missFq}/20 preguntas erradas con marca leve — score relativo no aguantó`);
  console.log(`Low-contrast questions guard passed: ${20 - missFq}/20 preguntas leídas con marca leve (gris ~130/papel ~185)`);

  // ─── Guardia de PIPELINE COMPLETO LAVADO: warp entero comprimido a [90,185]
  // (todo gris, incluidas anclas/timing). Antes el check "Warp vacío" (<70 fijo)
  // lo rechazaba; ahora el umbral relativo lo acepta y lee preguntas + RUT. ───
  const sheetFull = createCanvas(SHEET_W, SHEET_H);
  drawSheet(sheetFull.getContext("2d") as unknown as Ctx2D, { answers: Array.from({ length: 20 }, (_, i) => i % 5), rut: "12345678-5", filled: true });
  const imgFull = await loadImage(sheetFull.toDataURL("image/png"));
  const capFull = createCanvas(imgFull.width, imgFull.height);
  capFull.getContext("2d").drawImage(imgFull, 0, 0);
  const frameFull = capFull.getContext("2d").getImageData(0, 0, capFull.width, capFull.height) as unknown as globalThis.ImageData;
  const cornersFull = findCorners(frameFull) ?? fail("pipeline-lavado: sin esquinas");
  const warpedFull = warpImageData(frameFull, cornersFull);
  const dFull = warpedFull.data;
  for (let i = 0; i < dFull.length; i += 4) for (let k = 0; k < 3; k++) dFull[i + k] = Math.round(90 + dFull[i + k] * (185 - 90) / 255);
  const gFull = gradeBubbles(warpedFull);
  const rFull = readRut(warpedFull);
  if (!gFull.valid) fail(`pipeline-lavado: warp inválido (${gFull.reason}) — el check relativo no aguantó`);
  const expFull = Array.from({ length: 20 }, (_, i) => "ABCDE"[i % 5]);
  const missFull = gFull.results.filter((r, i) => r.answer !== expFull[i]).length;
  if (missFull > 1 || rFull.rut !== "12345678-5") fail(`pipeline-lavado: preg ${missFull} erradas, rut="${rFull.rut}"`);
  console.log(`Washed-pipeline guard passed: warp [90,185] → ${20 - missFull}/20 preg + RUT ${rFull.rut} (Warp-vacío relativo)`);

  // ─── Guardia de CODIGO DE HOJA en warp LAVADO: readSheetCode usaba umbral
  // ABSOLUTO (<70), el ULTIMO detector sin contraste relativo → en camara (warp
  // lavado, tinta ~150/papel ~185) leia todos los bits 0 y devolvia null
  // (codigo_hoja null en produccion). Ahora relativo al papel local debe leer el
  // codigo tambien en [90,185]. Verifica id + pagina + total. ───
  const sheetCode = createCanvas(SHEET_W, SHEET_H);
  drawSheet(sheetCode.getContext("2d") as unknown as Ctx2D, { answers: Array.from({ length: 20 }, (_, i) => i % 5), rut: "12345678-5", filled: true, code: { version: 1, sheetId: 54321, page: 1, pagesTotal: 3 } });
  const imgCode = await loadImage(sheetCode.toDataURL("image/png"));
  const capCode = createCanvas(imgCode.width, imgCode.height);
  capCode.getContext("2d").drawImage(imgCode, 0, 0);
  const frameCode = capCode.getContext("2d").getImageData(0, 0, capCode.width, capCode.height) as unknown as globalThis.ImageData;
  const warpedCode = warpImageData(frameCode, findCorners(frameCode) ?? fail("codigo-lavado: sin esquinas"));
  const dCode = warpedCode.data;
  for (let i = 0; i < dCode.length; i += 4) for (let k = 0; k < 3; k++) dCode[i + k] = Math.round(90 + dCode[i + k] * (185 - 90) / 255);
  const codeLC = readSheetCode(warpedCode);
  if (!codeLC || codeLC.sheetId !== 54321 || codeLC.page !== 1 || codeLC.pagesTotal !== 3) fail(`codigo-lavado: leyo ${JSON.stringify(codeLC)} (esperado sheetId=54321 p1/3)`);
  console.log(`Low-contrast sheet-code guard passed: codigo id=${codeLC.sheetId} p${codeLC.page}/${codeLC.pagesTotal} en warp lavado [90,185]`);

  // ─── Guardia de CÓDIGO DE HOJA v2 (Fase 1, multi-país): agrega el campo
  // COUNTRY sin cambiar la geometría física (46 celdas, sale del SHEET_ID que
  // pasa de 20→16 bits). Prueba que v2 codifica/decodifica país+sheetId chicos
  // y que sigue siendo el MISMO detector (contraste relativo) sin regresión. ───
  const sheetV2 = createCanvas(SHEET_W, SHEET_H);
  drawSheet(sheetV2.getContext("2d") as unknown as Ctx2D, { answers: Array.from({ length: 20 }, (_, i) => i % 5), rut: "12345678-5", filled: true, code: { version: 2, country: 1, sheetId: 4242, page: 2, pagesTotal: 3 } });
  const imgV2 = await loadImage(sheetV2.toDataURL("image/png"));
  const capV2 = createCanvas(imgV2.width, imgV2.height);
  capV2.getContext("2d").drawImage(imgV2, 0, 0);
  const frameV2 = capV2.getContext("2d").getImageData(0, 0, capV2.width, capV2.height) as unknown as globalThis.ImageData;
  const warpedV2 = warpImageData(frameV2, findCorners(frameV2) ?? fail("codigo-v2: sin esquinas"));
  const codeV2 = readSheetCode(warpedV2);
  if (!codeV2 || codeV2.version !== 2 || codeV2.country !== 1 || codeV2.sheetId !== 4242 || codeV2.page !== 2 || codeV2.pagesTotal !== 3) {
    fail(`codigo-v2: leyo ${JSON.stringify(codeV2)} (esperado v2 country=1 sheetId=4242 p2/3)`);
  }
  console.log(`Sheet-code v2 guard passed: country=${codeV2.country} sheetId=${codeV2.sheetId} p${codeV2.page}/${codeV2.pagesTotal}`);

  // ─── Guardia de CONFIANZA (#4): las banderas deben ser coherentes y NO dar
  // falsas alarmas en marcas limpias (marca sólida → "ok", RUT válido → "ok"). ───
  const sheetCf = createCanvas(SHEET_W, SHEET_H);
  drawSheet(sheetCf.getContext("2d") as unknown as Ctx2D, { answers: Array.from({ length: 20 }, (_, i) => i % 5), rut: "12345678-5", filled: true });
  const imgCf = await loadImage(sheetCf.toDataURL("image/png"));
  const capCf = createCanvas(imgCf.width, imgCf.height);
  capCf.getContext("2d").drawImage(imgCf, 0, 0);
  const frameCf = capCf.getContext("2d").getImageData(0, 0, capCf.width, capCf.height) as unknown as globalThis.ImageData;
  const warpedCf = warpImageData(frameCf, findCorners(frameCf) ?? fail("confianza: sin esquinas"));
  const gCf = gradeBubbles(warpedCf);
  const rCf = readRut(warpedCf);
  const falseAlarms = gCf.results.filter((r) => r.answer !== "-" && r.flag === "revisar").length;
  if (gCf.results.some((r) => !r.flag)) fail("confianza: falta la bandera en alguna pregunta (wiring)");
  if (falseAlarms > 0) fail(`confianza: ${falseAlarms} falsas alarmas "revisar" sobre marcas limpias`);
  if (rCf.flag !== "ok") fail(`confianza: RUT limpio marcado "${rCf.flag}" (${rCf.flagReason})`);
  console.log(`Confidence guard passed: banderas coherentes (marcas limpias→ok, RUT→ok, 0 falsas alarmas)`);

  // ─── Guardia de RECORTE DE NOMBRE (escalabilidad / cascada de identidad):
  // el recorte de la caja de nombre debe tener dimensiones válidas. ───
  const nameCrop = cropNameBox(warpedCf);
  if (!nameCrop || nameCrop.width < 400 || nameCrop.height < 30) fail(`crop-nombre: recorte inválido (${nameCrop?.width}x${nameCrop?.height})`);
  console.log(`Name-crop guard passed: caja de nombre recortada (${nameCrop.width}x${nameCrop.height})`);

  // ─── Guardia de BARRIDO: lee TODA combinación que el generador puede crear
  // (nº preguntas × opciones × columnas). Es el "blindaje" — si una config no
  // lee 100%, aquí se ve y se sabe el sobre seguro del generador. ───
  // Sobre SEGURO (validado por este barrido): 1 col 6-40; 2 col 12-50; 3 col
  // 18-90; 4 col 21-100 (nivel ZipGrade en 1 hoja, jul 2026 — más allá de 100
  // en 4 col ya se detectaron errores/timing insuficiente en el barrido
  // exploratorio, por eso el tope). Fuera de esto el generador se restringe
  // (ver sheet_generator.safeColumns/allowedColumns/MAX_QUESTIONS).
  const sweepConfigs: { nq: number; no: number; nc: number }[] = [];
  for (const no of [3, 4, 5]) {
    for (const nq of [6, 10, 15, 20, 25, 30, 40]) sweepConfigs.push({ nq, no, nc: 1 });
    for (const nq of [12, 20, 30, 40, 50]) sweepConfigs.push({ nq, no, nc: 2 });
    for (const nq of [18, 30, 45, 60, 75, 90]) sweepConfigs.push({ nq, no, nc: 3 });
    for (const nq of [21, 40, 60, 80, 100]) sweepConfigs.push({ nq, no, nc: 4 });
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