import test from "node:test";
import assert from "node:assert/strict";
import { DIA_PRESETS, findDiaPreset, mergePresetRubrics } from "@/lib/dia_presets";
import { parseOpenQuestions } from "@/lib/quiz_constraints";

test("todos los presets de Evaluación de Cierre 2026 existen y son válidos", () => {
  const cierrePresets = DIA_PRESETS.filter((p) => p.stage === "cierre");
  assert.equal(cierrePresets.length, 8, "Deben existir exactamente 8 instrumentos de Cierre auditados");

  const expectedIds = [
    "dia_cierre_7b_lectura",
    "dia_cierre_8b_lectura",
    "dia_cierre_1m_lectura",
    "dia_cierre_2m_lectura",
    "dia_cierre_7b_matematica",
    "dia_cierre_8b_matematica",
    "dia_cierre_1m_matematica",
    "dia_cierre_2m_matematica",
  ];

  for (const id of expectedIds) {
    const preset = findDiaPreset(id);
    assert.ok(preset, `Preset ${id} debe existir`);
    assert.equal(preset.stage, "cierre");
    assert.ok(preset.pdfUrl, `Preset ${id} debe incluir pdfUrl`);
    assert.ok(preset.fichaUrl, `Preset ${id} debe incluir fichaUrl`);
    assert.equal(preset.answerKey.length, preset.numQuestions, `El largo de la clave (${preset.answerKey.length}) debe coincidir con numQuestions (${preset.numQuestions})`);

    // Las preguntas abiertas deben tener '-' en la clave
    if (preset.openQuestions) {
      const openIdxs = preset.openQuestions.split(",").map((s) => Number(s.trim()));
      for (const idx of openIdxs) {
        assert.equal(preset.answerKey[idx - 1], "-", `Pregunta abierta ${idx} en ${id} debe tener '-' en su clave`);
        assert.ok(preset.openQuestionRubrics?.[idx], `Pregunta abierta ${idx} en ${id} debe tener rúbrica`);
      }
    }
  }
});

test("las claves oficiales de Evaluación de Cierre 2026 coinciden exactamente con Mineduc", () => {
  const keys: Record<string, string> = {
    dia_cierre_7b_lectura: "BDDCB-CDACABADCDDBBDBBDCBBCAAC",
    dia_cierre_8b_lectura: "CCBDDCBACBADAACBBD-CDADACBCDBCA",
    dia_cierre_1m_lectura: "BDDAADACADDC-AADBDDBDDABBCBACDBDDAC",
    dia_cierre_2m_lectura: "DBBCBBDBDCADAC-BCAABDDDBBCCAACCBBDCACA",
    dia_cierre_7b_matematica: "BCDAA-DBCDB-CBCAA-DACDABBACBDACC-BB",
    dia_cierre_8b_matematica: "-ADCDCADBCCDB-BCBBDACABDCBBDA-AACBBD-",
    dia_cierre_1m_matematica: "ACDBBDAD-BABACBADBBDDCBCADCBDCC-DBCADC",
    dia_cierre_2m_matematica: "DBCCDDADCCABCBADBBDACBCACC-B-ACA-CBCACC",
  };

  for (const [id, expectedKey] of Object.entries(keys)) {
    const preset = findDiaPreset(id);
    assert.ok(preset, `Preset ${id} debe existir`);
    assert.equal(preset.answerKey, expectedKey, `Clave de ${id} debe coincidir con la pauta oficial`);
  }
});

// Bug real visto en produccion (2026-11-23): "Generar prueba DIA" carga primero
// DIA_PRESETS[0] (7° Lectura, pauta en la P6); al pasar a 7° Matematica (Cierre)
// la P6 se quedaba con la pauta de Lectura y max_points 2 en vez de 1.
function aplicar(id: string, prev: ReturnType<typeof mergePresetRubrics>, anterior?: string) {
  const preset = findDiaPreset(id)!;
  const openQs = parseOpenQuestions(preset.openQuestions, preset.numQuestions);
  return mergePresetRubrics(prev, openQs, preset, anterior ? findDiaPreset(anterior) : undefined);
}

test("cambiar de preset reemplaza la pauta que solo puso el preset anterior", () => {
  const porDefecto = aplicar(DIA_PRESETS[0].id, {});
  assert.match(porDefecto[6].rubric, /apariencia física/, "el preset por defecto trae la pauta de Lectura en la P6");

  const mate = aplicar("dia_cierre_7b_matematica", porDefecto, DIA_PRESETS[0].id);
  assert.match(mate[6].rubric, /^Respuesta correcta: 36\./, "la P6 de Matemática debe llevar su propia pauta");
  assert.equal(mate[6].max_points, 1, "la P6 es completación: vale 1, no 2");
  assert.equal(mate[6].subtipo, "entero_decimal");
  assert.equal(mate[12].max_points, 1);
  assert.equal(mate[18].max_points, 2);
  assert.equal(mate[33].max_points, 1);
  assert.deepEqual(Object.keys(mate).map(Number), [6, 12, 18, 33], "solo las preguntas abiertas del preset nuevo");
});

test("la pauta que escribió el profesor no se pisa al cambiar de preset", () => {
  const porDefecto = aplicar(DIA_PRESETS[0].id, {});
  porDefecto[6] = { ...porDefecto[6], rubric: "Mi pauta propia para la P6", max_points: 3 };

  const mate = aplicar("dia_cierre_7b_matematica", porDefecto, DIA_PRESETS[0].id);
  assert.equal(mate[6].rubric, "Mi pauta propia para la P6");
  assert.equal(mate[6].max_points, 3);
  assert.match(mate[12].rubric, /^Respuesta correcta: 6\./, "las demás siguen tomando la oficial");
});

test("sin preset anterior conocido (editar un ensayo guardado) se respeta lo guardado", () => {
  const guardado = { 6: { rubric: "Pauta guardada", max_points: 2, subtipo: "simple" as const } };
  const r = aplicar("dia_cierre_7b_matematica", guardado);
  assert.equal(r[6].rubric, "Pauta guardada");
  assert.equal(r[6].max_points, 2);
  assert.match(r[12].rubric, /^Respuesta correcta: 6\./, "las preguntas sin pauta guardada reciben la oficial");
});

test("el 7° Matemática de Cierre queda bien armado de principio a fin", () => {
  const p = findDiaPreset("dia_cierre_7b_matematica")!;
  assert.equal(p.numQuestions, 35);
  assert.equal(p.optionOverrides, "16:3");
  assert.equal(p.answerKey!.length, 35);
  assert.equal(p.answerKey![15], "A", "la P16 tiene 3 opciones (A-C) y su clave debe caer entre ellas");
  assert.equal(p.openQuestions, "6,12,18,33");
});
