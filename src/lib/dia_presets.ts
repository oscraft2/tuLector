/**
 * Presets de instrumentos DIA (Monitoreo Intermedio 2026) para precargar el
 * formulario de creacion de ensayo en tuLector -- el profesor elige
 * "5° Básico - Matemática" y el formulario ya trae nº de preguntas, opciones,
 * abiertas y overrides correctos, sin tipearlos a mano.
 *
 * Fuente de la estructura (nº preguntas/opciones/abiertas/overrides): hojas
 * de respuesta oficiales de la Agencia de Calidad de la Educación,
 * documentadas en docs/dia-instrumentos-monitoreo-2026.md. 5° básico a II
 * medio, Lectura y Matemática (11 de 12 posibles -- falta Matemática 8°
 * básico, sin PDF disponible) -- agregar un preset nuevo cuando se documente
 * otro nivel/asignatura, nunca adivinar la estructura de un instrumento que
 * no se haya visto.
 *
 * Fuente de `answerKey`/`openQuestionRubrics` (clave real + pauta de
 * corrección oficial): fichas técnicas de la Agencia,
 * docs/fichas-tecnicas-dia-2026.md -- cubre 9 de los 11 instrumentos de
 * arriba (todos salvo 6° básico Lectura/Matemática, sin ficha técnica
 * disponible aún). Las preguntas de "completación/ordenación" (par ordenado,
 * número exacto, orden de secuencia) de Matemática no tienen código de
 * pauta 2/1/0 en la ficha -- se tratan igual como reverso/desarrollo pero con
 * `max_points: 1` y una pauta de coincidencia exacta en vez de una escala de
 * 3 niveles.
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
  /** Clave real de alternativas (una letra por pregunta, "-" en las
   *  posiciones de desarrollo/completación), tal como espera el campo
   *  `value`/`answer_key` de AnswerKeyEditor. Fuente: docs/fichas-tecnicas-
   *  dia-2026.md. Ausente = el profesor ingresa la clave a mano. */
  answerKey?: string;
  /** Pauta de corrección oficial por pregunta abierta -- mismo shape que
   *  OpenQuestionRubric salvo `subtipo` (ese viene de openQuestionSubtypes).
   *  Fuente: docs/fichas-tecnicas-dia-2026.md. Ausente = sin pauta
   *  precargada (el profesor puede tipearla igual). */
  openQuestionRubrics?: Record<number, { rubric: string; max_points: number }>;
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
    answerKey: "BDAA-DCBCCDBCDCD-BCADDAADCB",
    openQuestionRubrics: {
      5: { rubric: `Código 2 (correcta): Opina sobre actitudes/acciones de los personajes, fundamentando con elementos del texto que dan cuenta de su comprensión. Puede complementar con conocimiento de mundo. Fundamenta su respuesta aludiendo a que fue el atleta quien intentó jugarle una broma a Pedro en primer lugar, o bien a las consecuencias asociadas al engaño (liberar/salvar a un gorrión, ser invitado a comer a un restaurante). Puede complementar aludiendo a valores como la honestidad y la astucia.
Código 1 (parcial): Opina sobre las actitudes o acciones de los personajes, pero la fundamentación evidencia una comprensión parcial del texto. Fundamenta su respuesta centrándose en elementos locales del texto que no se relacionan directamente con el engaño de Pedro para ganar la apuesta.
Código 0 (incorrecta): Puede expresar una opinión, pero no fundamenta o lo hace utilizando información que no tiene relación con el texto ni con la pregunta. También son incorrectas las respuestas tautológicas, vagas, contradictorias, incoherentes o en blanco.`, max_points: 2 },
      17: { rubric: `Código 2 (correcta): Entrega una opinión sobre el aspecto solicitado que evidencia una comprensión global del texto. Fundamenta con información del texto (valoración del pueblo Tehuelche y/o reconocimiento al trabajador que ha aportado en los descubrimientos en la zona).
Código 1 (parcial): Entrega una opinión sobre el aspecto solicitado, pero la justificación es general, evidenciando una comprensión parcial del texto. Fundamenta con elementos secundarios de la noticia, que no se relacionan directamente con la forma en que se decidió nombrar al dinosaurio. O bien, la conexión entre su opinión y la información del texto es débil o poco clara.
Código 0 (incorrecta): No opina sobre el aspecto solicitado, no evidencia comprensión del texto, o evidencia una compresión errónea. También son incorrectas las respuestas tautológicas, vagas, contradictorias, incoherentes, en blanco.`, max_points: 2 },
    },
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
    answerKey: "CD-DCA-CBDA-ACBCBCAB-BAABCCDCD-BBCD",
    openQuestionRubrics: {
      3: { rubric: `Respuesta correcta: 3-1-4-2. Código 1: coincide con ese valor. Código 0: cualquier otro valor o en blanco.`, max_points: 1 },
      7: { rubric: `Respuesta correcta: 4/8 o cualquier fracción/decimal equivalente. Código 1: la respuesta es equivalente a ese valor. Código 0: cualquier otro valor o en blanco.`, max_points: 1 },
      12: { rubric: `Respuesta correcta: (5,6) (par ordenado x,y). Código 1: coincide exactamente con ese par. Código 0: cualquier otro par o en blanco.`, max_points: 1 },
      21: { rubric: `Código 2 (correcta): Selecciona una estrategia que permite resolver el problema, elige todas (tres) las películas que podría ver completas Tomás durante el viaje, resuelve correctamente la operatoria seleccionada y calcula las horas de viaje que quedaría sin ver películas Tomás.
Código 1 (parcial): **Opción A**: Selecciona una estrategia adecuada para resolver el problema, pero elige dos películas, por lo que no cumple con la condición de escoger todas las películas que podría ver completas, resuelve correctamente la operatoria y calcula las horas sin ver películas. **Opción B**: Selecciona una estrategia adecuada, elige tres películas que podría ver completas, pero resuelve con errores de cálculo la operatoria seleccionada, por lo que al calcular las horas sin ver películas no obtiene el valor esperado.
Código 0 (incorrecta): Entrega otras respuestas distintas a las esperadas en los códigos anteriores, o bien, no responde.`, max_points: 2 },
      31: { rubric: `Respuesta correcta: 11,5. Código 1: coincide con ese valor. Código 0: cualquier otro valor o en blanco.`, max_points: 1 },
    },
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
    answerKey: "CAADCBDCBBDDCABDBBDDBACC-BABDC",
    openQuestionRubrics: {
      25: { rubric: `Código 2 (correcta): Formula una interpretación que evidencia una comprensión correcta del texto y un análisis coherente de la información. Considera elementos textuales que evidencian aspectos "aterradores", tanto del monstruo como de los humanos. Si selecciona al monstruo: cañas, lanzas y anzuelos de los pescadores; el pavor del monstruo frente a la especie humana; el hecho de que el monstruo esté solo. Si selecciona a los pescadores: el monstruo es carnívoro, alusiones al aspecto, tamaño o voracidad.
Código 1 (parcial): Formula una interpretación que evidencia una comprensión parcial de lo solicitado. Considera aspectos más locales del cuento que no se relacionan directamente con el factor del "miedo"/"terror". O evidencia comprensión global pero no realiza una interpretación sobre el aspecto solicitado.
Código 0 (incorrecta): Evidencia una comprensión errónea del texto y de lo solicitado, no realiza una interpretación adecuada de la situación y evidencia errores en la comprensión lectora. También son incorrectas las respuestas en blanco.`, max_points: 2 },
    },
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
    answerKey: "DCDCA-DBCCB-BB-AABDCDDACCDCA-AAB-CB",
    openQuestionRubrics: {
      6: { rubric: `Respuesta correcta: 24. Código 1: coincide con ese valor. Código 0: cualquier otro valor o en blanco.`, max_points: 1 },
      12: { rubric: `Respuesta correcta: 30. Código 1: coincide con ese valor. Código 0: cualquier otro valor o en blanco.`, max_points: 1 },
      15: { rubric: `Código 2 (correcta): Analiza las frecuencias relativas presentadas en la tabla para cada una de las letras, contrasta esta información con cada ruleta, escoge la ruleta A y justifica su elección mediante el uso de las frecuencias relativas.
Código 1 (parcial): Analiza las frecuencias relativas presentadas en la tabla para cada una de las letras, contrasta esta información con cada ruleta, escoge la ruleta A, pero en su justificación no se evidencia el uso de las frecuencias relativas.
Código 0 (incorrecta): Entrega otras respuestas distintas a las esperadas en los códigos anteriores, o bien, no responde.`, max_points: 2 },
      29: { rubric: `Respuesta correcta: 2. Código 1: coincide con ese valor. Código 0: cualquier otro valor o en blanco.`, max_points: 1 },
      33: { rubric: `Respuesta correcta: 21/10 o cualquier fracción/decimal equivalente. Código 1: la respuesta es equivalente a ese valor. Código 0: cualquier otro valor o en blanco.`, max_points: 1 },
    },
  },
  {
    id: "dia_8b_lectura",
    label: "8° Básico - Lectura",
    numQuestions: 31,
    numOptions: 4,
    openQuestions: "20",
    optionOverrides: "",
    multiSelectQuestions: "",
    answerKey: "DBCBCDBDADBCCBABDBA-BCBDDDCADCD",
    openQuestionRubrics: {
      20: { rubric: `Código 2 (correcta): Evidencia una interpretación coherente sobre el final de la obra, considerando los elementos de la fábula y la comprensión global del texto. Debe incluir tres elementos: (1) lo que simboliza el derramamiento de la leche, (2) la explicación de dicha interpretación, y (3) los elementos del texto y/o fábula que permiten hacerla coherente. Una interpretación adecuada: los planes de los enamorados se verán frustrados por el idealismo de la pareja, concentrándose en sus sueños sin ver la realidad.
Código 1 (parcial): Evidencia una interpretación sobre el final de la obra, pero demuestra una comprensión parcial del texto, la pregunta o la fábula. Considera aspectos más locales del texto (no evidenciando una comprensión global ni la alusión al idealismo de los enamorados). Por ejemplo, que la relación de pareja es prohibida porque tienen otros pretendientes o que los van a descubrir por el ruido de la leche derramada.
Código 0 (incorrecta): Evidencia una comprensión errónea del texto y de lo solicitado, no realiza una interpretación adecuada de la situación. También son incorrectas las respuestas en blanco.`, max_points: 2 },
    },
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
    answerKey: "CADCC-AACDCBADAABBDCDBBDCCDADCBBADA",
    openQuestionRubrics: {
      6: { rubric: `Código 2 (correcta): Formula una interpretación que evidencia una comprensión correcta del texto y un análisis coherente. Interpretación adecuada: los estudiantes se sumaron voluntariamente al castigo por sentirse tan responsables como Roberto de haber participado en las carreras. Elementos textuales que pueden utilizar: "si casi nacimos andando a caballo y a los dos años galopábamos solos", "los desafié, se prendieron" o alusiones a que nadie delata a Roberto cuando la profesora pregunta o que todos se sumaron (vencedores y vencidos).
Código 1 (parcial): Formula una interpretación que evidencia una comprensión parcial del texto y un análisis parcialmente correcto. Considera aspectos locales del cuento y no la comprensión global (por ejemplo, que temían una futura represalia de la profesora, que no querían que la profesora se molestara o se sintiera triste, porque querían disculparse con la profesora por haber ocultado la verdad).
Código 0 (incorrecta): Evidencia una comprensión errónea del texto, no realiza una interpretación adecuada de la situación. También son incorrectas las respuestas en blanco.`, max_points: 2 },
    },
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
    answerKey: "DCDBCDAD-BD-ADACDABDBCACAABBDAA-BACCCB",
    openQuestionRubrics: {
      9: { rubric: `Código 2 (correcta): Demuestra que la estrategia que propone Ana es correcta, planteando y resolviendo un sistema de ecuaciones que representa el problema que está resolviendo Ana. Puede o no definir las variables que representan el kg de tomates y el kg de manzanas.
Código 1 (parcial): **Opción A**: Plantea y resuelve un sistema de ecuaciones que representa el problema y encuentra el valor de cada variable. Por lo que, no demuestra que la estrategia que propone Ana es correcta y solo obtiene el valor de 1 kg de tomate y de 1 kg de manzanas. **Opción B**: Demuestra que la estrategia de Ana es correcta, utilizando un procedimiento diferente a un sistema de ecuaciones.
Código 0 (incorrecta): Entrega otras respuestas distintas a las esperadas en los códigos anteriores, o bien, no responde.`, max_points: 2 },
      12: { rubric: `Respuesta correcta: (1;5) (par ordenado x,y). Código 1: coincide exactamente con ese par. Código 0: cualquier otro par o en blanco.`, max_points: 1 },
      32: { rubric: `Respuesta correcta: 71. Código 1: coincide con ese valor. Código 0: cualquier otro valor o en blanco.`, max_points: 1 },
    },
  },
  {
    id: "dia_IImedio_lectura",
    label: "II Medio - Lectura",
    numQuestions: 38,
    numOptions: 4,
    openQuestions: "27",
    optionOverrides: "",
    multiSelectQuestions: "",
    answerKey: "DABCBDCCBDCAABBCBBDACDCDBC-BBADACBCBAD",
    openQuestionRubrics: {
      27: { rubric: `Código 2 (correcta): Formula una opinión crítica a partir de un aspecto controversial de la lectura, con fundamentos que integren información del texto de los medios de comunicación y/o sus conocimientos previos, evidenciando en su respuesta una comprensión y análisis adecuado del texto. En caso de responder sí: resultados inmediatos y a largo plazo de la medida (crear conciencia ecológica, apoyo a las personas de menor ingreso, etc.). En caso de responder no: resultados inmediatos, pero que no sugieren un cambio real (conciencia ecológica, cantidad de personas a las que ayuda, etc.).
Código 1 (parcial): Formula una opinión a partir de un aspecto controversial de la lectura, pero no demuestra un análisis profundo de la situación expuesta en su respuesta. Pueden aludir a un aspecto puntual mencionado (problema de alimentación, recolección de basura, etc.), pero no evalúan la proyección de los efectos de la iniciativa como resolución definitiva a problemáticas sociales. O bien, pueden aludir a la responsabilidad de la resolución de los problemas expuestos.
Código 0 (incorrecta): Formula una opinión respecto a la situación, pero evidencia una comprensión errónea del texto y/o la información solicitada en la pregunta, pues no realiza un análisis crítico de la información global y evidencia errores en la comprensión lectora (respuestas incoherentes, vagas, tautológicas, etc.). También son incorrectas las respuestas en blanco.`, max_points: 2 },
    },
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
    answerKey: "CACCDDBCCBCBDABBDBADDBCBBB-B-ACA-DDCAAD",
    openQuestionRubrics: {
      27: { rubric: `Respuesta correcta: (0;4) (par ordenado x,y). Código 1: coincide exactamente con ese par. Código 0: cualquier otro par o en blanco.`, max_points: 1 },
      29: { rubric: `Código 2 (correcta): Selecciona una estrategia que le permite encontrar la función inversa de f(x) = 6x - 1. Posteriormente, evalúa correctamente la función inversa en x = 17 y obtiene como resultado f⁻¹(17) = 3.
Código 1 (parcial): **Opción A**: Selecciona una estrategia que permite encontrar la función inversa de f(x) = 6x - 1. Sin embargo, no evalúa la función inversa. **Opción B**: Selecciona una estrategia que presenta errores, por lo que la función inversa encontrada de f(x) = 6x - 1 es incorrecta. Sin embargo, evalúa correctamente la función inversa obtenida en x = 17.
Código 0 (incorrecta): Entrega otras respuestas distintas a las esperadas en los códigos anteriores, o bien, no responde.
Importante: Para los casos en que la respuesta contenga la expresión que corresponde al numerador de la fracción sin paréntesis (por ejemplo, X+1/6), NO la califique como incorrecta inmediatamente, sino que indague primero cuál es realmente la expresión que él o la estudiante considera que representa a la función inversa.`, max_points: 2 },
      33: { rubric: `Respuesta correcta: 4. Código 1: coincide con ese valor. Código 0: cualquier otro valor o en blanco.`, max_points: 1 },
    },
  },
];

/** value especial: mantiene el comportamiento libre/manual de antes (ningún campo se precarga). */
export const DIA_CUSTOM_ID = "dia_custom";

export function findDiaPreset(id: string): DiaPreset | undefined {
  return DIA_PRESETS.find((p) => p.id === id);
}
