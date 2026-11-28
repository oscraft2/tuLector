import assert from "node:assert/strict";
import test from "node:test";
import { diaCodigoParaAbierta, diaRevisionAbierta, respuestaPautaCompletacion, type DiaCodigoOpenAnswer } from "./dia_codigo";
import { DIA_PRESETS } from "./dia_presets";

const BASE: DiaCodigoOpenAnswer = { transcripcion: null, legible: null, confirmed_points: null, max_points: 4 };

test("sin fila en open_answers -> codigo 0", () => {
  assert.equal(diaCodigoParaAbierta(null), 0);
  assert.equal(diaCodigoParaAbierta(undefined), 0);
});

test("sin transcripcion y sin confirmar -> codigo 0", () => {
  assert.equal(diaCodigoParaAbierta({ ...BASE, transcripcion: "" }), 0);
  assert.equal(diaCodigoParaAbierta({ ...BASE, transcripcion: "   " }), 0);
  assert.equal(diaCodigoParaAbierta({ ...BASE, transcripcion: null }), 0);
});

test("el puntaje confirmado manda aunque la IA no haya leido nada (calificacion rapida)", () => {
  assert.equal(diaCodigoParaAbierta({ ...BASE, transcripcion: null, confirmed_points: 4 }), 2);
});

test("el puntaje confirmado manda aunque la IA la haya marcado ilegible", () => {
  assert.equal(diaCodigoParaAbierta({ ...BASE, transcripcion: "algo", legible: false, confirmed_points: 4 }), 2);
});

test("distingue 'sin revisar' de 'incorrecta': las dos son codigo 0", () => {
  assert.deepEqual(diaRevisionAbierta(null), { revisada: false, codigo: 0 });
  assert.deepEqual(diaRevisionAbierta({ ...BASE, confirmed_points: null }), { revisada: false, codigo: 0 });
  assert.deepEqual(diaRevisionAbierta({ ...BASE, confirmed_points: 0 }), { revisada: true, codigo: 0 });
});

test("el maximo de la rubrica sirve si la fila no lo tiene (o quedo en 0)", () => {
  assert.equal(diaCodigoParaAbierta({ ...BASE, max_points: null, confirmed_points: 1 }, 1), 2);
  assert.equal(diaCodigoParaAbierta({ ...BASE, max_points: 0, confirmed_points: 1 }, 2), 1);
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

test("pauta de completacion: numero, negativo, decimal, fraccion y par ordenado", () => {
  assert.equal(respuestaPautaCompletacion("Respuesta correcta: 36. Código 1: ..."), "36");
  assert.equal(respuestaPautaCompletacion("Respuesta correcta: -70. Código 1: ..."), "-70");
  assert.equal(respuestaPautaCompletacion("Respuesta correcta: 11,5. Código 1: ..."), "11,5");
  assert.equal(respuestaPautaCompletacion("Respuesta correcta: 3/20 o equivalente (0,15)."), "3/20");
  assert.equal(respuestaPautaCompletacion("Respuesta correcta: (0,-2) o (0;-2) (par ordenado x,y)."), "0;-2");
  assert.equal(respuestaPautaCompletacion("Código 2 (correcta): marca No y justifica."), null);
  assert.equal(respuestaPautaCompletacion(null), null);
});

test("todos los presets DIA: la completacion trae pauta legible y el desarrollo no", () => {
  for (const preset of DIA_PRESETS) {
    for (const [pregunta, subtipo] of Object.entries(preset.openQuestionSubtypes ?? {})) {
      const rubrica = preset.openQuestionRubrics?.[Number(pregunta)]?.rubric;
      const pauta = respuestaPautaCompletacion(rubrica);
      if (subtipo === "simple") assert.equal(pauta, null, `${preset.id} P${pregunta} es desarrollo`);
      else assert.notEqual(pauta, null, `${preset.id} P${pregunta} sin pauta legible`);
    }
  }
});
