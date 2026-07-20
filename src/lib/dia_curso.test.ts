import assert from "node:assert/strict";
import test from "node:test";
import { normalizarCursoDIA } from "./dia_curso";

test("normalizarCursoDIA reconoce formatos comunes de medio", () => {
  assert.equal(normalizarCursoDIA("2do medio C"), "II C");
  assert.equal(normalizarCursoDIA("Segundo Medio C"), "II C");
  assert.equal(normalizarCursoDIA("II Medio C"), "II C");
  assert.equal(normalizarCursoDIA("1° medio A"), "I A");
  assert.equal(normalizarCursoDIA("4to Medio B"), "IV B");
});

test("normalizarCursoDIA reconoce formatos comunes de basico", () => {
  assert.equal(normalizarCursoDIA("6to Basico A"), "6 A");
  assert.equal(normalizarCursoDIA("6° básico A"), "6 A");
  assert.equal(normalizarCursoDIA("Sexto Basico B"), "6 B");
  assert.equal(normalizarCursoDIA("3ro basico C"), "3 C");
});

test("normalizarCursoDIA deja pasar formatos ya compatibles con DIA", () => {
  assert.equal(normalizarCursoDIA("II C"), "II C");
  assert.equal(normalizarCursoDIA("6 A"), "6 A");
  assert.equal(normalizarCursoDIA("ii c"), "II C");
});

test("normalizarCursoDIA cae al original si no reconoce el patron", () => {
  assert.equal(normalizarCursoDIA("Curso Piloto"), "Curso Piloto");
  assert.equal(normalizarCursoDIA(""), "");
  assert.equal(normalizarCursoDIA(null), "");
  assert.equal(normalizarCursoDIA(undefined), "");
});

test("normalizarCursoDIA no rompe con letras pegadas al numero", () => {
  assert.equal(normalizarCursoDIA("6B"), "6 B");
  assert.equal(normalizarCursoDIA("2MC"), "2MC"); // ambiguo a proposito: no se adivina
});
