import assert from "node:assert/strict";
import test from "node:test";
import { buildDiaCsv, unaHojaPorEstudiante, type ExportPaper, type ExportOpenAnswer } from "./dia_export";

const PAPER: ExportPaper = {
  id: "paper-1",
  student_name: "Ana Test",
  student_rut_norm: "123456785",
  answers: [{ q: 1, a: "A" }],
};

function csvRows(csv: string): string[][] {
  // Saca el BOM y separa filas/celdas -- alcanza para estos casos simples
  // (sin comas/comillas dentro de una celda).
  return csv.replace(/^﻿/, "").split("\r\n").map((line) => line.split(","));
}

test("pregunta abierta sin fila en open_answers -> codigo 0 en el CSV", () => {
  const csv = buildDiaCsv({
    papers: [PAPER],
    numQuestions: 2,
    subject: "Matemática",
    grade: "II medio",
    openQuestions: [2],
  });
  const [, row] = csvRows(csv);
  // rut,nombre,curso,asignatura,p1,p2
  assert.equal(row[5], "0");
});

test("pregunta abierta confirmada en el maximo -> codigo 2 en el CSV", () => {
  const openAnswers: ExportOpenAnswer[] = [
    { paper_id: "paper-1", question: 2, transcripcion: "3", legible: true, confirmed_points: 4, max_points: 4 },
  ];
  const csv = buildDiaCsv({
    papers: [PAPER],
    numQuestions: 2,
    subject: "Matemática",
    grade: "II medio",
    openQuestions: [2],
    openAnswers,
  });
  const [, row] = csvRows(csv);
  assert.equal(row[5], "2");
});

test("pregunta abierta de OTRO paper no se cruza por error", () => {
  const openAnswers: ExportOpenAnswer[] = [
    { paper_id: "paper-otro", question: 2, transcripcion: "3", legible: true, confirmed_points: 4, max_points: 4 },
  ];
  const csv = buildDiaCsv({
    papers: [PAPER],
    numQuestions: 2,
    subject: "Matemática",
    grade: "II medio",
    openQuestions: [2],
    openAnswers,
  });
  const [, row] = csvRows(csv);
  assert.equal(row[5], "0");
});

test("preguntas de alternativas no se tocan (guardia de no-regresion)", () => {
  const csv = buildDiaCsv({
    papers: [PAPER],
    numQuestions: 2,
    subject: "Matemática",
    grade: "II medio",
    openQuestions: [2],
  });
  const [, row] = csvRows(csv);
  assert.equal(row[4], "A");
});

test("columnas de revision: distingue sin revisar, incorrecta y correcta con su pauta", () => {
  const rubricas = {
    2: { rubric: "Respuesta correcta: 36. Código 1: coincide.", max_points: 1 },
    3: { rubric: "Respuesta correcta: 6. Código 1: coincide.", max_points: 1 },
    4: { rubric: "Código 2 (correcta): justifica.", max_points: 2 },
  };
  const csv = buildDiaCsv({
    papers: [PAPER],
    numQuestions: 4,
    subject: "Matemática",
    grade: "II medio",
    openQuestions: [4, 2, 3],
    openQuestionRubrics: rubricas,
    openAnswers: [
      // confirmada a mano, sin lectura de IA y sin max_points en la fila
      { paper_id: "paper-1", question: 2, transcripcion: null, legible: null, confirmed_points: 1, max_points: null },
      { paper_id: "paper-1", question: 3, transcripcion: null, legible: null, confirmed_points: 0, max_points: 1 },
    ],
  });
  const [headers, row] = csvRows(csv);
  const celda = (nombre: string) => row[headers.indexOf(nombre)];
  assert.equal(celda("dia_formato"), "2");
  assert.deepEqual([celda("p2"), celda("p2_estado"), celda("p2_valor")], ["2", "revisada", "36"]);
  assert.deepEqual([celda("p3"), celda("p3_estado"), celda("p3_valor")], ["0", "revisada", ""]);
  assert.deepEqual([celda("p4"), celda("p4_estado"), celda("p4_valor")], ["0", "sin_revisar", ""]);
});

test("una hoja por estudiante: gana la primera (la mas reciente) y las sin RUT no se agrupan", () => {
  const hojas = [
    { id: "nueva", student_rut_norm: "123456785" },
    { id: "antigua", student_rut_norm: "123456785" },
    { id: "sin-rut-1", student_rut_norm: null },
    { id: "sin-rut-2", student_rut_norm: null },
  ];
  assert.deepEqual(unaHojaPorEstudiante(hojas).map((h) => h.id), ["nueva", "sin-rut-1", "sin-rut-2"]);
});
