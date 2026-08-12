import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHeaders, buildRow, celdaRespuesta, celdaMultiSelect, formatRutConGuion,
  LEGACY_RESULTS_COLUMNS, type ExportPaperRow, type ExportSpec,
} from "./export_columns";

const CTX = { passingGrade: 4.0 };

const PAPER: ExportPaperRow = {
  student_name: "Ana Pérez",
  student_id: "123456785",
  student_rut_norm: "123456785",
  course_name: "2° Medio C",
  score: 18,
  total: 20,
  points: 22,
  points_total: 24,
  equivalent_score: 750,
  grade: 6.2,
  status: "corrected",
  scanned_at: "2026-08-13T12:00:00.000Z",
  answers: [
    { q: 1, a: "A" }, { q: 2, a: "-" }, { q: 3, a: "?" },
    { q: 4, a: "AB" }, { q: 5, a: "1|3|5" },
  ],
};

test("sin configurar nada, las columnas son las del CSV historico", () => {
  const spec: ExportSpec = { columns: [...LEGACY_RESULTS_COLUMNS] };
  assert.deepEqual(buildHeaders(spec), [
    "Alumno", "RUT", "Correctas", "Total preguntas", "Porcentaje", "Nota", "Puntaje equivalente", "Fecha",
  ]);
});

test("las columnas salen en el orden pedido", () => {
  const spec: ExportSpec = { columns: ["grade", "student_name", "rut"] };
  assert.deepEqual(buildHeaders(spec), ["Nota", "Alumno", "RUT"]);
  assert.deepEqual(buildRow(PAPER, spec, CTX), ["6.2", "Ana Pérez", "12345678-5"]);
});

test("header_labels sobrescribe el encabezado (el cliente que exige RUN)", () => {
  const spec: ExportSpec = { columns: ["student_name", "rut"], headerLabels: { rut: "RUN" } };
  assert.deepEqual(buildHeaders(spec), ["Alumno", "RUN"]);
});

test("los puntos usan la ponderacion, y el porcentaje sale de ellos", () => {
  const spec: ExportSpec = { columns: ["correct", "points", "points_total", "percent"] };
  assert.deepEqual(buildRow(PAPER, spec, CTX), ["18", "22", "24", "92%"]);
});

test("sin ponderacion, la columna de puntos cae al conteo de correctas", () => {
  const sinPuntos: ExportPaperRow = { ...PAPER, points: null, points_total: null };
  const spec: ExportSpec = { columns: ["points", "points_total", "percent"] };
  assert.deepEqual(buildRow(sinPuntos, spec, CTX), ["18", "20", "90%"]);
});

test("la columna Aprobado se mide contra la nota de aprobacion del contexto", () => {
  const spec: ExportSpec = { columns: ["passing"] };
  assert.deepEqual(buildRow(PAPER, spec, CTX), ["Sí"]);
  assert.deepEqual(buildRow(PAPER, spec, { passingGrade: 6.5 }), ["No"]);
  assert.deepEqual(buildRow({ ...PAPER, grade: null }, spec, CTX), [""], "sin nota no se afirma nada");
});

test("una hoja sin identificar no rompe ninguna columna", () => {
  const anonima: ExportPaperRow = {
    student_name: null, student_id: null, student_rut_norm: null,
    score: null, total: null, equivalent_score: null, grade: null, scanned_at: null,
  };
  const spec: ExportSpec = { columns: [...LEGACY_RESULTS_COLUMNS] };
  const row = buildRow(anonima, spec, CTX);
  assert.equal(row[0], "Sin identificar");
  assert.equal(row.length, LEGACY_RESULTS_COLUMNS.length);
});

// ─────────────────────────────────────────────────────────────────────────────
// DETALLE POR PREGUNTA
// ─────────────────────────────────────────────────────────────────────────────

test("el bloque de respuestas se expande a p1..pN con el mapeo del motor", () => {
  const spec: ExportSpec = {
    columns: ["student_name"], perQuestion: ["answers"], numQuestions: 5,
  };
  assert.deepEqual(buildHeaders(spec), ["Alumno", "p1", "p2", "p3", "p4", "p5"]);
  const ctx = { passingGrade: 4.0, multiSelectQuestions: [5] };
  assert.deepEqual(buildRow(PAPER, spec, ctx), [
    "Ana Pérez",
    "A",     // marcada
    "",      // "-" en blanco
    "NULA",  // "?" ilegible
    "NULA",  // doble marca
    "1|3|5", // seleccion multiple: varias marcas son la respuesta normal
  ]);
});

test("una pregunta de desarrollo va SIEMPRE vacia aunque el motor leyera algo", () => {
  const spec: ExportSpec = { columns: [], perQuestion: ["answers"], numQuestions: 3 };
  const ctx = { passingGrade: 4.0, openQuestions: [1] };
  assert.deepEqual(buildRow(PAPER, spec, ctx), ["", "", "NULA"]);
});

test("el bloque de puntos por pregunta da el puntaje si acerto y 0 si no", () => {
  const spec: ExportSpec = {
    columns: [], perQuestion: ["points"], numQuestions: 4,
    answerKey: "AB-C",
    pointsForQuestion: (q) => (q === 1 ? 3 : 1),
  };
  // La 1 acierta (A=A) => 3 pts. La 2 esta en blanco => 0. La 3 no tiene clave
  // ("-") => vacio. La 4 respondio "AB" y la clave es "C" => 0.
  assert.deepEqual(buildRow(PAPER, spec, CTX), ["3", "0", "", "0"]);
});

test("los dos bloques por pregunta se pueden pedir juntos", () => {
  const spec: ExportSpec = {
    columns: ["student_name"], perQuestion: ["answers", "points"], numQuestions: 2, answerKey: "AB",
  };
  assert.deepEqual(buildHeaders(spec), ["Alumno", "p1", "p2", "p1_pts", "p2_pts"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// GUARDIA: extraer el mapeo de celdas de dia_export.ts no cambio nada
// ─────────────────────────────────────────────────────────────────────────────

test("celdaRespuesta conserva la semantica que espera el bot de DIA", () => {
  assert.equal(celdaRespuesta(undefined), "", "sin dato = No Responde");
  assert.equal(celdaRespuesta("-"), "", "en blanco = No Responde");
  assert.equal(celdaRespuesta("?"), "NULA", "reflejo/ilegible");
  assert.equal(celdaRespuesta("AB"), "NULA", "doble marca");
  assert.equal(celdaRespuesta("C"), "C");
});

test("celdaMultiSelect NO colapsa varias marcas a NULA", () => {
  assert.equal(celdaMultiSelect("1|3|5"), "1|3|5");
  assert.equal(celdaMultiSelect("-"), "");
  assert.equal(celdaMultiSelect(undefined), "");
});

test("formatRutConGuion reformatea el RUT canonico y deja pasar lo demas", () => {
  assert.equal(formatRutConGuion("123456785"), "12345678-5");
  assert.equal(formatRutConGuion("1234567K"), "1234567-K");
  assert.equal(formatRutConGuion(null), "");
  assert.equal(formatRutConGuion("no-es-un-rut"), "no-es-un-rut");
});
