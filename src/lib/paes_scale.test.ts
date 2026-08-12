import assert from "node:assert/strict";
import test from "node:test";
import {
  scoreFromTable, paesEquivalence, simceEquivalence, achievementPct, paesTableForQuiz,
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
// Tablas oficiales importadas del DEMRE
// ─────────────────────────────────────────────────────────────────────────────

test("estan cargadas las 20 tablas del DEMRE (5 pruebas x 2 procesos x 2 años)", () => {
  assert.equal(PAES_TABLES.length, 20);
  for (const prueba of ["m1", "m2", "competencia-lectora", "ciencias", "hycsoc"]) {
    for (const proceso of ["regular", "invierno"]) {
      for (const anio of [2025, 2026]) {
        const id = `${prueba}_${proceso}_${anio}`;
        assert.ok(PAES_TABLES.some((t) => t.id === id), `falta ${id}`);
      }
    }
  }
});

test("cada tabla del DEMRE es coherente: 0%→100, 100%→1000 y monotona", () => {
  for (const table of PAES_TABLES) {
    const first = table.rows[0];
    const last = table.rows[table.rows.length - 1];
    assert.equal(first.pct, 0, `${table.id}: la primera fila debe ser 0% de logro`);
    assert.equal(first.score, 100, `${table.id}: 0% debe dar el piso 100`);
    assert.equal(last.pct, 100, `${table.id}: la ultima fila debe ser 100%`);
    assert.equal(last.score, 1000, `${table.id}: 100% debe dar el techo 1000`);
    for (let i = 1; i < table.rows.length; i++) {
      assert.ok(table.rows[i].pct > table.rows[i - 1].pct, `${table.id}: pct no crece en la fila ${i}`);
      assert.ok(table.rows[i].score >= table.rows[i - 1].score, `${table.id}: el puntaje BAJA en la fila ${i}`);
    }
  }
});

test("el largo de cada prueba coincide con el instrumento real", () => {
  const esperado: Record<string, number> = {
    m1: 60, m2: 49, "competencia-lectora": 60, ciencias: 75, hycsoc: 60,
  };
  for (const table of PAES_TABLES) {
    const prueba = table.id.replace(/_(regular|invierno)_\d+$/, "");
    assert.equal(table.preguntas, esperado[prueba], `${table.id}`);
    // Una fila por cada nº de correctas posible, de 0 a N.
    assert.equal(table.rows.length, esperado[prueba] + 1, `${table.id}: nº de filas`);
  }
});

test("la tabla oficial NO es lineal: ahi esta el punto de haberla importado", () => {
  const m1 = PAES_TABLES.find((t) => t.id === "m1_regular_2026")!;
  const alMedio = scoreFromTable(m1, 0.5)!;
  const proporcional = Math.round(100 + 0.5 * 900); // 550
  assert.notEqual(alMedio, proporcional);
  // Una sola respuesta correcta ya salta muy por encima del piso: eso es lo que
  // la aproximacion proporcional no podia capturar.
  assert.ok(scoreFromTable(m1, 1 / 60)! > 150, "1 de 60 correctas");
});

test("paesEquivalence usa la tabla y ya no se marca aproximado", () => {
  const eq = paesEquivalence(0.5);
  assert.equal(eq.aproximado, false);
  assert.ok(eq.tabla && eq.tabla.length > 0, "debe decir que tabla se aplico");
  assert.deepEqual(paesEquivalence(0).score, 100);
  assert.deepEqual(paesEquivalence(1).score, 1000);
});

test("SIMCE sigue siendo proporcional y se marca como aproximado", () => {
  assert.equal(SIMCE_TABLES.length, 0, "la Agencia de Calidad no publica tabla equivalente");
  assert.deepEqual(simceEquivalence(0), { score: 100, aproximado: true });
  assert.deepEqual(simceEquivalence(1), { score: 400, aproximado: true });
  assert.deepEqual(simceEquivalence(0.5), { score: 250, aproximado: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// Elección de tabla por ensayo
// ─────────────────────────────────────────────────────────────────────────────

test("la variante PAES del ensayo elige su prueba", () => {
  assert.ok(paesTableForQuiz({ evaluation_variant: "paes_m1" }).id.startsWith("m1_regular_"));
  assert.ok(paesTableForQuiz({ evaluation_variant: "paes_m2" }).id.startsWith("m2_regular_"));
  assert.ok(paesTableForQuiz({ evaluation_variant: "paes_lectora" }).id.startsWith("competencia-lectora_regular_"));
  assert.ok(paesTableForQuiz({ evaluation_variant: "paes_ciencias" }).id.startsWith("ciencias_regular_"));
  assert.ok(paesTableForQuiz({ evaluation_variant: "paes_historia" }).id.startsWith("hycsoc_regular_"));
});

test("sin variante, la asignatura del ensayo decide", () => {
  assert.ok(paesTableForQuiz({ subject: "Matemática" }).id.startsWith("m1_"));
  assert.ok(paesTableForQuiz({ subject: "Lengua y Literatura" }).id.startsWith("competencia-lectora_"));
  assert.ok(paesTableForQuiz({ subject: "Historia, Geografía y Ciencias Sociales" }).id.startsWith("hycsoc_"));
  assert.ok(paesTableForQuiz({ subject: "Ciencias Naturales (Biología)" }).id.startsWith("ciencias_"));
});

test("sin variante ni asignatura reconocible, cae a la tabla por defecto", () => {
  assert.equal(paesTableForQuiz({}).id, "m1_regular_2026");
  assert.equal(paesTableForQuiz({ subject: "Orientación" }).id, "m1_regular_2026");
});

test("siempre se prefiere el proceso REGULAR mas reciente", () => {
  assert.equal(paesTableForQuiz({ evaluation_variant: "paes_m1" }).id, "m1_regular_2026");
});

// ─────────────────────────────────────────────────────────────────────────────
// Interpolación
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
  assert.equal(scoreFromTable(TABLA, 0.375), 525);
  assert.equal(scoreFromTable(TABLA, 0.75), 806);
});

test("scoreFromTable satura fuera de rango en vez de extrapolar", () => {
  assert.equal(scoreFromTable(TABLA, -1), 100);
  assert.equal(scoreFromTable(TABLA, 5), 1000);
});

test("scoreFromTable con una tabla vacia devuelve null (cae al proporcional)", () => {
  assert.equal(scoreFromTable({ id: "x", label: "x", rows: [] }, 0.5), null);
});
