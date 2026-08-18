import assert from "node:assert/strict";
import test from "node:test";
import { computeAxisMastery, buildPaperQuestionBreakdown } from "./item_analysis";

test("computeAxisMastery consolida ejes de varios ensayos para un alumno", () => {
  const result = computeAxisMastery([
    {
      answerKey: "ABCD",
      numQuestions: 4,
      answers: [
        { q: 1, a: "A" },
        { q: 2, a: "C" },
        { q: 3, a: "C" },
        { q: 4, a: "-" },
      ],
      metadata: [
        { question_number: 1, axis_name: "Lectura", skill_name: null },
        { question_number: 2, axis_name: "Lectura", skill_name: null },
        { question_number: 3, axis_name: "Matematica", skill_name: null },
        { question_number: 4, axis_name: "Matematica", skill_name: null },
      ],
    },
    {
      answerKey: "AB",
      numQuestions: 2,
      answers: [
        { q: 1, a: "A" },
        { q: 2, a: "B" },
      ],
      metadata: [
        { question_number: 1, axis_name: "Lectura", skill_name: null },
        { question_number: 2, axis_name: "Matematica", skill_name: null },
      ],
    },
  ]);

  assert.deepEqual(result.map((axis) => ({ axis: axis.axis, pct: axis.pct, count: axis.count, level: axis.level })), [
    { axis: "Lectura", pct: 67, count: 3, level: "warn" },
    { axis: "Matematica", pct: 67, count: 3, level: "warn" },
  ]);
});

test("buildPaperQuestionBreakdown marca correcto/incorrecto pregunta por pregunta", () => {
  const rows = buildPaperQuestionBreakdown(
    { answers: [{ q: 1, a: "A" }, { q: 2, a: "C" }, { q: 3, a: "-" }, { q: 4, a: "B" }] },
    { answer_key: "ABC-", num_questions: 4 },
  );
  assert.deepEqual(rows, [
    { q: 1, axis: null, skill: null, isOpen: false, isMultiSelect: false, studentAnswer: "A", correctAnswer: "A", hasKey: true, correct: true },
    { q: 2, axis: null, skill: null, isOpen: false, isMultiSelect: false, studentAnswer: "C", correctAnswer: "B", hasKey: true, correct: false },
    { q: 3, axis: null, skill: null, isOpen: false, isMultiSelect: false, studentAnswer: "-", correctAnswer: "C", hasKey: true, correct: false },
    // pregunta 4: clave "-" (sin clave definida) -- nunca correcta, sin importar lo marcado.
    { q: 4, axis: null, skill: null, isOpen: false, isMultiSelect: false, studentAnswer: "B", correctAnswer: "", hasKey: false, correct: false },
  ]);
});

test("buildPaperQuestionBreakdown marca preguntas abiertas/multi-select como solo lectura y trae metadata", () => {
  const rows = buildPaperQuestionBreakdown(
    { answers: [{ q: 1, a: "A" }, { q: 2, a: "B" }, { q: 3, a: "C" }] },
    { answer_key: "ABC", num_questions: 3, open_questions: "2", multi_select_questions: "3" },
    [{ question_number: 1, axis_name: "Lectura", skill_name: "Inferencia" }],
  );
  assert.equal(rows[0].axis, "Lectura");
  assert.equal(rows[0].skill, "Inferencia");
  assert.equal(rows[1].isOpen, true);
  assert.equal(rows[2].isMultiSelect, true);
});
