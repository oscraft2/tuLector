/**
 * Genera el fixture de prueba (src/app/test/test_image.ts) renderizando la hoja
 * TuLector v2 con el MISMO codigo compartido (sheet_render.ts) que usa el
 * generador real. Asi la imagen de test no puede divergir de la hoja impresa.
 *
 *   npm run gen:fixture
 */
import { createCanvas } from "canvas";
import { writeFileSync } from "fs";
import { drawSheet, type Ctx2D } from "../src/lib/sheet_render";
import * as L from "../src/lib/sheet_layout";

// Respuestas conocidas (indices 0..4 = A..E) y marcas de ID por fila.
const answers = [2, 1, 1, 1, 2, 4, 4, 3, 2, 1, 0, 1, 2, 3, 4, 4, 3, 2, 1, 0];
const idMarks = [[3], [7], [1, 5]];

const canvas = createCanvas(L.SHEET_W, L.SHEET_H);
const ctx = canvas.getContext("2d");
drawSheet(ctx as unknown as Ctx2D, { answers, idMarks, filled: true });
const base64 = canvas.toDataURL("image/png");

const expAnswers = answers.map((a) => L.OPTION_LABELS[a]);
const expId = idMarks.map((cols) => {
  const s = new Array(L.ID_COLS).fill("0");
  for (const c of cols) s[c] = "1";
  return s.join("");
});

const out = `// AUTO-GENERADO por scripts/gen_fixture.ts — no editar a mano.
// Hoja TuLector v2 (anclas solidas + pista de temporizacion).
export const TEST_IMAGE_BASE64 = ${JSON.stringify(base64)};
export const EXPECTED_ANSWERS = ${JSON.stringify(expAnswers)};
export const EXPECTED_ID = ${JSON.stringify(expId)};
`;

writeFileSync("src/app/test/test_image.ts", out);
console.log(`Fixture regenerado: ${base64.length} chars b64, ${expAnswers.length} respuestas, ${expId.length} filas ID`);
