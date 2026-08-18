import assert from "node:assert/strict";
import test from "node:test";
import { diaCodigoParaAbierta, type DiaCodigoOpenAnswer } from "./dia_codigo";

const BASE: DiaCodigoOpenAnswer = { transcripcion: null, legible: null, confirmed_points: null, max_points: 4 };

test("sin fila en open_answers -> codigo 0", () => {
  assert.equal(diaCodigoParaAbierta(null), 0);
  assert.equal(diaCodigoParaAbierta(undefined), 0);
});

test("sin transcripcion (no escribio nada) -> codigo 0", () => {
  assert.equal(diaCodigoParaAbierta({ ...BASE, transcripcion: "" }), 0);
  assert.equal(diaCodigoParaAbierta({ ...BASE, transcripcion: "   " }), 0);
  assert.equal(diaCodigoParaAbierta({ ...BASE, transcripcion: null }), 0);
});

test("no legible -> codigo 0 aunque haya transcripcion", () => {
  assert.equal(diaCodigoParaAbierta({ ...BASE, transcripcion: "algo", legible: false, confirmed_points: 4 }), 0);
});

test("escribio algo pero el profesor todavia no confirma -> codigo 0 (nunca adivinar)", () => {
  assert.equal(diaCodigoParaAbierta({ ...BASE, transcripcion: "algo", legible: true, confirmed_points: null }), 0);
});

test("confirmado en el maximo -> codigo 2 (correcta)", () => {
  assert.equal(diaCodigoParaAbierta({ transcripcion: "3", legible: true, confirmed_points: 4, max_points: 4 }), 2);
});

test("confirmado parcial (0 < puntos < max) -> codigo 1", () => {
  assert.equal(diaCodigoParaAbierta({ transcripcion: "3", legible: true, confirmed_points: 2, max_points: 4 }), 1);
});

test("confirmado en 0 (escribio algo pero esta mal) -> codigo 0", () => {
  assert.equal(diaCodigoParaAbierta({ transcripcion: "3", legible: true, confirmed_points: 0, max_points: 4 }), 0);
});

test("confirmado por encima del maximo (dato viejo/rubrica editada) -> se recorta a codigo 2", () => {
  assert.equal(diaCodigoParaAbierta({ transcripcion: "3", legible: true, confirmed_points: 9, max_points: 4 }), 2);
});

test("max_points invalido (rubrica no configurada) -> codigo 0, nunca dividir por cero", () => {
  assert.equal(diaCodigoParaAbierta({ transcripcion: "3", legible: true, confirmed_points: 2, max_points: 0 }), 0);
  assert.equal(diaCodigoParaAbierta({ transcripcion: "3", legible: true, confirmed_points: 2, max_points: null }), 0);
});
