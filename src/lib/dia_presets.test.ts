import test from "node:test";
import assert from "node:assert/strict";
import { DIA_PRESETS, findDiaPreset } from "@/lib/dia_presets";

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
