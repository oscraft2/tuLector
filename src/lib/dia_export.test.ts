import assert from "node:assert/strict";
import test from "node:test";
import { buildDiaCsv, type ExportPaper, type ExportOpenAnswer } from "./dia_export";

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
