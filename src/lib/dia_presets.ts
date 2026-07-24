/**
 * Presets de instrumentos DIA (Monitoreo Intermedio 2026) para precargar el
 * formulario de creacion de ensayo en tuLector -- el profesor elige
 * "5° Básico - Matemática" y el formulario ya trae nº de preguntas, opciones,
 * abiertas y overrides correctos, sin tipearlos a mano.
 *
 * Fuente: hojas de respuesta oficiales de la Agencia de Calidad de la
 * Educación, documentadas en docs/dia-instrumentos-monitoreo-2026.md. 5°
 * básico a II medio, Lectura y Matemática (11 de 12 posibles -- falta
 * Matemática 8° básico, sin PDF disponible) -- agregar un preset nuevo cuando
 * se documente otro nivel/asignatura, nunca adivinar la estructura de un
 * instrumento que no se haya visto.
 */

import type { OpenQuestionSubtype } from "@/lib/quiz_constraints";

export interface DiaPreset {
  /** Usado como evaluation_variant en BD y como value del <select>. */
  id: string;
  /** Texto del <option> y de getVariantLabel() en el detalle del ensayo. */
  label: string;
  numQuestions: number;
  numOptions: 3 | 4 | 5;
  /** CSV tal como espera el campo "Preguntas de desarrollo". */
  openQuestions: string;
  /** CSV "pregunta:opciones" tal como espera "Nº de opciones por pregunta puntual". */
  optionOverrides: string;
  /** CSV tal como espera el campo "Preguntas de selección múltiple". */
  multiSelectQuestions: string;
  /** Subtipo por pregunta abierta (docs/dia-instrumentos-monitoreo-2026.md) --
   *  decide qué le pide el prompt de la IA que transcriba. Ausente = todas
   *  "simple" (el caso de Lectura/Lenguaje, siempre desarrollo genérico). */
  openQuestionSubtypes?: Record<number, OpenQuestionSubtype>;
}

export const DIA_PRESETS: DiaPreset[] = [
  {
    id: "dia_5b_lectura",
    label: "5° Básico - Lectura",
    numQuestions: 27,
    numOptions: 4,
    openQuestions: "5,17",
    optionOverrides: "",
    multiSelectQuestions: "",
  },
  {
    id: "dia_5b_matematica",
    label: "5° Básico - Matemática",
    numQuestions: 35,
    numOptions: 4,
    openQuestions: "3,7,12,21,31",
    optionOverrides: "6:3,11:3,25:3,29:3",
    multiSelectQuestions: "",
    openQuestionSubtypes: { 3: "entero_decimal", 7: "entero_decimal", 12: "par_ordenado", 21: "simple", 31: "entero_decimal" },
  },
  {
    id: "dia_6b_lectura",
    label: "6° Básico - Lectura",
    numQuestions: 28,
    numOptions: 4,
    openQuestions: "5,23",
    optionOverrides: "",
    multiSelectQuestions: "",
  },
  {
    id: "dia_6b_matematica",
    label: "6° Básico - Matemática",
    numQuestions: 35,
    numOptions: 4,
    openQuestions: "7,15,18",
    optionOverrides: "20:3",
    multiSelectQuestions: "29",
  },
  {
    id: "dia_7b_lectura",
    label: "7° Básico - Lectura",
    numQuestions: 30,
    numOptions: 4,
    openQuestions: "25",
    optionOverrides: "",
    multiSelectQuestions: "",
  },
  {
    id: "dia_7b_matematica",
    label: "7° Básico - Matemática",
    numQuestions: 35,
    numOptions: 4,
    openQuestions: "6,12,15,29,33",
    optionOverrides: "16:3",
    multiSelectQuestions: "",
    openQuestionSubtypes: { 6: "entero_decimal", 12: "entero_decimal", 15: "simple", 29: "entero_decimal", 33: "entero_decimal" },
  },
  {
    id: "dia_8b_lectura",
    label: "8° Básico - Lectura",
    numQuestions: 31,
    numOptions: 4,
    openQuestions: "20",
    optionOverrides: "",
    multiSelectQuestions: "",
  },
  // 8° básico Matemática: sin PDF en el escritorio -- NO agregar hasta tenerlo.
  {
    id: "dia_Imedio_lectura",
    label: "I Medio - Lectura",
    numQuestions: 35,
    numOptions: 4,
    openQuestions: "6",
    optionOverrides: "",
    multiSelectQuestions: "",
  },
  {
    id: "dia_Imedio_matematica",
    label: "I Medio - Matemática",
    numQuestions: 38,
    numOptions: 4,
    openQuestions: "9,12,32",
    optionOverrides: "",
    multiSelectQuestions: "",
    openQuestionSubtypes: { 9: "simple", 12: "par_ordenado", 32: "entero_decimal" },
  },
  {
    id: "dia_IImedio_lectura",
    label: "II Medio - Lectura",
    numQuestions: 38,
    numOptions: 4,
    openQuestions: "27",
    optionOverrides: "",
    multiSelectQuestions: "",
  },
  {
    id: "dia_IImedio_matematica",
    label: "II Medio - Matemática",
    numQuestions: 39,
    numOptions: 4,
    // Mismo instrumento ya visto por dia-bot en producción (FINDINGS.md §11.4):
    // 27=ABIERTA_PAR_ORDENADO, 29=ABIERTA_SIMPLE, 33=ABIERTA_ENTERO_DECIMAL.
    openQuestions: "27,29,33",
    optionOverrides: "",
    multiSelectQuestions: "",
    openQuestionSubtypes: { 27: "par_ordenado", 29: "simple", 33: "entero_decimal" },
  },
];

/** value especial: mantiene el comportamiento libre/manual de antes (ningún campo se precarga). */
export const DIA_CUSTOM_ID = "dia_custom";

export function findDiaPreset(id: string): DiaPreset | undefined {
  return DIA_PRESETS.find((p) => p.id === id);
}
