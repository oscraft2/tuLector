/**
 * Presets de instrumentos DIA (Monitoreo Intermedio 2026) para precargar el
 * formulario de creacion de ensayo en tuLector -- el profesor elige
 * "5° Básico - Matemática" y el formulario ya trae nº de preguntas, opciones,
 * abiertas y overrides correctos, sin tipearlos a mano.
 *
 * Fuente: hojas de respuesta oficiales de la Agencia de Calidad de la
 * Educación, documentadas en docs/dia-instrumentos-monitoreo-2026.md. SOLO
 * 5° y 6° básico (los únicos niveles auditados hasta ahora) -- agregar un
 * preset nuevo cuando se documente otro nivel/asignatura, nunca adivinar la
 * estructura de un instrumento que no se haya visto.
 */

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
];

/** value especial: mantiene el comportamiento libre/manual de antes (ningún campo se precarga). */
export const DIA_CUSTOM_ID = "dia_custom";

export function findDiaPreset(id: string): DiaPreset | undefined {
  return DIA_PRESETS.find((p) => p.id === id);
}
