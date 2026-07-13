import assert from "node:assert/strict";
import test from "node:test";
import { assembleMultipageResult, type PageScanResult } from "./multipage";

const pagesInOrder: PageScanResult[] = [
  { page: 1, pagesTotal: 3, sheetId: 777, studentCode: "175178082", answers: [{ q: 1, a: "A" }, { q: 2, a: "B" }], scannedAt: "2026-07-12T10:00:00Z" },
  { page: 2, pagesTotal: 3, sheetId: 777, studentCode: "175178082", answers: [{ q: 3, a: "C" }, { q: 4, a: "D" }], scannedAt: "2026-07-12T10:01:00Z" },
  { page: 3, pagesTotal: 3, sheetId: 777, studentCode: "175178082", answers: [{ q: 5, a: "E" }], scannedAt: "2026-07-12T10:02:00Z" },
];

test("assembleMultipageResult junta las paginas sin importar el orden de escaneo", () => {
  const inOrder = assembleMultipageResult(pagesInOrder);
  const reversed = assembleMultipageResult([...pagesInOrder].reverse());
  assert.equal(inOrder.complete, true);
  assert.equal(reversed.complete, true);
  assert.deepEqual(inOrder.answers, reversed.answers);
  assert.deepEqual(inOrder.answers, [
    { q: 1, a: "A" }, { q: 2, a: "B" }, { q: 3, a: "C" }, { q: 4, a: "D" }, { q: 5, a: "E" },
  ]);
});

test("assembleMultipageResult detecta paginas faltantes", () => {
  const partial = assembleMultipageResult(pagesInOrder.slice(0, 2));
  assert.equal(partial.complete, false);
  assert.deepEqual(partial.missingPages, [3]);
});

test("assembleMultipageResult se queda con el reescaneo mas reciente de una pagina repetida", () => {
  const rescan: PageScanResult = { ...pagesInOrder[0], answers: [{ q: 1, a: "Z" }, { q: 2, a: "B" }], scannedAt: "2026-07-12T10:05:00Z" };
  const result = assembleMultipageResult([...pagesInOrder, rescan]);
  assert.equal(result.answers.find((a) => a.q === 1)?.a, "Z");
  assert.deepEqual(result.conflicts, []);
});

test("assembleMultipageResult marca conflicto si la misma pregunta aparece en paginas distintas", () => {
  const overlap: PageScanResult = { page: 2, pagesTotal: 3, sheetId: 777, studentCode: "175178082", answers: [{ q: 1, a: "X" }], scannedAt: "2026-07-12T10:03:00Z" };
  const result = assembleMultipageResult([pagesInOrder[0], overlap, pagesInOrder[2]]);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].q, 1);
});

test("assembleMultipageResult con lista vacia no revienta", () => {
  const result = assembleMultipageResult([]);
  assert.equal(result.complete, false);
  assert.deepEqual(result.answers, []);
});
