import assert from "node:assert/strict";
import test from "node:test";
import { parseCourseLevel, equivalencesForCourse } from "./course_level";

test("parseCourseLevel reconoce ensenanza media en romano, arabigo y ordinal", () => {
  assert.deepEqual(parseCourseLevel("2° Medio B"), { ciclo: "media", nivel: 2 });
  assert.deepEqual(parseCourseLevel("II Medio C"), { ciclo: "media", nivel: 2 });
  assert.deepEqual(parseCourseLevel("Segundo Medio C"), { ciclo: "media", nivel: 2 });
  assert.deepEqual(parseCourseLevel("1° medio A"), { ciclo: "media", nivel: 1 });
  assert.deepEqual(parseCourseLevel("4to Medio B"), { ciclo: "media", nivel: 4 });
  assert.deepEqual(parseCourseLevel("IV Medio"), { ciclo: "media", nivel: 4 });
});

test("parseCourseLevel reconoce ensenanza basica", () => {
  assert.deepEqual(parseCourseLevel("7mo Basico A"), { ciclo: "basica", nivel: 7 });
  assert.deepEqual(parseCourseLevel("6° básico A"), { ciclo: "basica", nivel: 6 });
  assert.deepEqual(parseCourseLevel("Sexto Basico B"), { ciclo: "basica", nivel: 6 });
  assert.deepEqual(parseCourseLevel("8 B"), { ciclo: "basica", nivel: 8 });
});

test("un romano suelto sin 'medio' es ensenanza media", () => {
  // "III A" es tercero MEDIO; un tercero basico se escribe "3 Basico".
  assert.deepEqual(parseCourseLevel("III A"), { ciclo: "media", nivel: 3 });
  assert.deepEqual(parseCourseLevel("I B"), { ciclo: "media", nivel: 1 });
});

test("la LETRA del curso no se confunde con un nivel romano", () => {
  // Bug real que este orden evita: "5 BASICO I" tiene una "I" que es la seccion,
  // no un nivel. Leerla como romano convertia un 5° basico en I medio.
  assert.deepEqual(parseCourseLevel("5° Basico I"), { ciclo: "basica", nivel: 5 });
  assert.deepEqual(parseCourseLevel("2° Medio I"), { ciclo: "media", nivel: 2 });
});

test("parseCourseLevel devuelve null si no reconoce el texto", () => {
  assert.equal(parseCourseLevel(""), null);
  assert.equal(parseCourseLevel(null), null);
  assert.equal(parseCourseLevel(undefined), null);
  assert.equal(parseCourseLevel("Taller de electivos"), null);
});

test("equivalencias: hasta II medio ambas, en III y IV solo PAES", () => {
  for (const curso of ["1° Basico A", "6° Basico B", "7mo Basico A", "8° Basico C", "I Medio A", "2° Medio B"]) {
    assert.deepEqual(equivalencesForCourse(curso), { paes: true, simce: true }, curso);
  }
  for (const curso of ["III Medio A", "3° Medio B", "IV Medio A", "4to Medio C"]) {
    assert.deepEqual(equivalencesForCourse(curso), { paes: true, simce: false }, curso);
  }
});

test("equivalencias: un curso irreconocible muestra ambas (no se esconde info)", () => {
  assert.deepEqual(equivalencesForCourse("Taller de electivos"), { paes: true, simce: true });
  assert.deepEqual(equivalencesForCourse(null), { paes: true, simce: true });
});
