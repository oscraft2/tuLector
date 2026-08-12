import assert from "node:assert/strict";
import test from "node:test";
import {
  scoreFromTable, paesEquivalence, simceEquivalence, achievementPct,
  PAES_TABLES, SIMCE_TABLES, type ConversionTable,
} from "./paes_scale";

test("achievementPct usa el puntaje PONDERADO cuando el ensayo lo tiene", () => {
  assert.equal(achievementPct({ score: 18, total: 20 }), 0.9);
  assert.equal(achievementPct({ score: 18, total: 20, points: 22, points_total: 44 }), 0.5);
});

test("achievementPct devuelve null sin denominador (no se afirma nada)", () => {
  assert.equal(achievementPct({ score: 5, total: 0 }), null);
  assert.equal(achievementPct({ score: null, total: null }), null);
});

test("achievementPct acota a [0,1]", () => {
  assert.equal(achievementPct({ score: 30, total: 20 }), 1);
  assert.equal(achievementPct({ score: -5, total: 20 }), 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Fallback proporcional: mientras no este cargada la tabla del DEMRE
// ─────────────────────────────────────────────────────────────────────────────

test("sin tabla cargada el puntaje es el proporcional de siempre, y se marca aproximado", () => {
  assert.equal(PAES_TABLES.length, 0, "si esto falla, ya se cargo una tabla y hay que revisar el test");
  assert.equal(SIMCE_TABLES.length, 0);

  assert.deepEqual(paesEquivalence(0), { score: 100, aproximado: true });
  assert.deepEqual(paesEquivalence(1), { score: 1000, aproximado: true });
  assert.deepEqual(paesEquivalence(0.5), { score: 550, aproximado: true });

  assert.deepEqual(simceEquivalence(0), { score: 100, aproximado: true });
  assert.deepEqual(simceEquivalence(1), { score: 400, aproximado: true });
  assert.deepEqual(simceEquivalence(0.5), { score: 250, aproximado: true });
});

test("los numeros del 2° Medio B real cuadran con la aritmetica a mano", () => {
  // SOFIA 11/36 = 30,6%
  assert.equal(paesEquivalence(11 / 36).score, 375);
  assert.equal(simceEquivalence(11 / 36).score, 192);
  // SERGIO 14/36 = 38,9%
  assert.equal(paesEquivalence(14 / 36).score, 450);
  assert.equal(simceEquivalence(14 / 36).score, 217);
  // TRINIDAD 6/36 = 16,7%
  assert.equal(paesEquivalence(6 / 36).score, 250);
  assert.equal(simceEquivalence(6 / 36).score, 150);
});

// ─────────────────────────────────────────────────────────────────────────────
// Tabla de conversion (cuando se cargue la del DEMRE)
// ─────────────────────────────────────────────────────────────────────────────

const TABLA: ConversionTable = {
  id: "demo",
  label: "Demo",
  rows: [
    { pct: 0, score: 100 },
    { pct: 25, score: 438 },
    { pct: 50, score: 612 },
    { pct: 100, score: 1000 },
  ],
};

test("scoreFromTable devuelve el valor exacto en los tramos declarados", () => {
  assert.equal(scoreFromTable(TABLA, 0), 100);
  assert.equal(scoreFromTable(TABLA, 0.25), 438);
  assert.equal(scoreFromTable(TABLA, 0.5), 612);
  assert.equal(scoreFromTable(TABLA, 1), 1000);
});

test("scoreFromTable interpola entre dos tramos", () => {
  // 37,5% esta a mitad de camino entre 25 (438) y 50 (612) => 525
  assert.equal(scoreFromTable(TABLA, 0.375), 525);
  // 75% esta a mitad entre 50 (612) y 100 (1000) => 806
  assert.equal(scoreFromTable(TABLA, 0.75), 806);
});

test("scoreFromTable satura fuera de rango en vez de extrapolar", () => {
  assert.equal(scoreFromTable(TABLA, -1), 100);
  assert.equal(scoreFromTable(TABLA, 5), 1000);
});

test("scoreFromTable con una tabla vacia devuelve null (cae al proporcional)", () => {
  assert.equal(scoreFromTable({ id: "x", label: "x", rows: [] }, 0.5), null);
});

test("una tabla NO lineal se separa del proporcional, que es el punto de cargarla", () => {
  assert.equal(scoreFromTable(TABLA, 0.25), 438);
  assert.equal(paesEquivalence(0.25).score, 325, "el proporcional daria 325");
});
