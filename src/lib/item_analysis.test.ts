import assert from "node:assert/strict";
import test from "node:test";
import { computeAxisMastery } from "./item_analysis";

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
