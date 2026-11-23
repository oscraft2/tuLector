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
  /** Etapa de la evaluación DIA: Cierre (final) o Monitoreo Intermedio. */
  stage?: "cierre" | "intermedio";
  /** URL pública del cuadernillo de preguntas PDF si está disponible. */
  pdfUrl?: string;
  /** URL pública de la ficha técnica oficial PDF si está disponible. */
  fichaUrl?: string;
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
  // ==========================================
  // EVALUACIÓN DE CIERRE 2026 (FINAL)
  // ==========================================
  {
    id: "dia_cierre_7b_lectura",
    label: "7° Básico - Lectura (Cierre)",
    stage: "cierre",
    pdfUrl: "/instrumentos-dia/prueba_lectura_cierre_2026_7_basico.pdf",
    fichaUrl: "/instrumentos-dia/ficha_tecnica_lectura_cierre_2026_7_basico.pdf",
    numQuestions: 30,
    numOptions: 4,
    openQuestions: "6",
    optionOverrides: "",
    multiSelectQuestions: "",
    answerKey: "BDDCB-CDACABADCDDBBDBBDCBBCAAC",
    openQuestionRubrics: {
      6: {
        rubric: `Código 2 (correcta): La/el estudiante formula una interpretación sobre lo que se pregunta (una enseñanza respecto a la apariencia física) y fundamenta coherentemente su interpretación, aludiendo a información del texto (explícita o implícita) que la sustenta (relacionada a la motivación del rey para ocultar su aspecto físico y/o a las consecuencias de las acciones del rey). Puede complementar con experiencia personal.
Código 1 (parcial): La/el estudiante formula una interpretación sobre lo que se pregunta (una enseñanza respecto de la apariencia física) y fundamenta su interpretación, aludiendo a información del texto, pero esta solo remite a aspectos locales del relato, demostrando una comprensión parcial del mismo.
Código 0 (incorrecta): La/el estudiante formula una interpretación que no se relaciona con lo solicitado, o fundamenta solo basándose en sus percepciones sin dar cuenta de la comprensión del texto, respuestas confusas, contradictorias, tautológicas o en blanco.`,
        max_points: 2,
      },
    },
  },
  {
    id: "dia_cierre_8b_lectura",
    label: "8° Básico - Lectura (Cierre)",
    stage: "cierre",
    pdfUrl: "/instrumentos-dia/prueba_lectura_cierre_2026_8_basico.pdf",
    fichaUrl: "/instrumentos-dia/ficha_tecnica_lectura_cierre_2026_8_basico.pdf",
    numQuestions: 31,
    numOptions: 4,
    openQuestions: "19",
    optionOverrides: "",
    multiSelectQuestions: "",
    answerKey: "CCBDDCBACBADAACBBD-CDADACBCDBCA",
    openQuestionRubrics: {
      19: {
        rubric: `Código 2 (correcta): La/el estudiante formula una interpretación sobre lo que se pregunta (por qué Juan cree que a Luis “le hará bien” la crisis económica del padre) y fundamenta coherentemente su respuesta, aludiendo a información del texto (explícita o implícita). Se considerará coherente incorporar información referida a las consecuencias que tendrá la escasez de dinero en la vida de Luis.
Código 1 (parcial): Formula una interpretación sobre lo que se pregunta, pero fundamenta con información referida a aspectos locales del texto, sin considerar el sentido global y evidenciando comprensión parcial, o bien con información ambigua.
Código 0 (incorrecta): Formula una interpretación sin fundamentar, o no se relaciona con lo solicitado, respuestas vagas, contradictorias o en blanco.`,
        max_points: 2,
      },
    },
  },
  {
    id: "dia_cierre_1m_lectura",
    label: "I Medio - Lectura (Cierre)",
    stage: "cierre",
    pdfUrl: "/instrumentos-dia/prueba_lectura_cierre_2026_I_medio.pdf",
    fichaUrl: "/instrumentos-dia/ficha_tecnica_lectura_cierre_2026_I_medio.pdf",
    numQuestions: 35,
    numOptions: 4,
    openQuestions: "13",
    optionOverrides: "",
    multiSelectQuestions: "",
    answerKey: "BDDAADACADDC-AADBDDBDDABBCBACDBDDAC",
    openQuestionRubrics: {
      13: {
        rubric: `Código 2 (correcta): La/el estudiante formula una postura sobre lo que se le solicita (escoge con qué punto de vista de ambos textos está de acuerdo) y fundamenta coherentemente su postura, aludiendo a información (explícita o implícita) que da cuenta de la comprensión de ambos textos.
Código 1 (parcial): Formula una postura sobre lo que se le solicita y fundamenta coherentemente, pero alude a información que da cuenta de una comprensión parcial o local de los textos, o comprensión de solo uno de los dos textos.
Código 0 (incorrecta): No formula postura o no se relaciona con lo solicitado, fundamenta de manera incoherente, vaga o sin fundamentar, o solo basándose en percepciones sin comprensión del texto, respuestas confusas, contradictorias o en blanco.`,
        max_points: 2,
      },
    },
  },
  {
    id: "dia_cierre_2m_lectura",
    label: "II Medio - Lectura (Cierre)",
    stage: "cierre",
    pdfUrl: "/instrumentos-dia/prueba_lectura_cierre_2026_II_medio.pdf",
    fichaUrl: "/instrumentos-dia/ficha_tecnica_lectura_cierre_2026_II_medio.pdf",
    numQuestions: 38,
    numOptions: 4,
    openQuestions: "15",
    optionOverrides: "",
    multiSelectQuestions: "",
    answerKey: "DBBCBBDBDCADAC-BCAABDDDBBCCAACCBBDCACA",
    openQuestionRubrics: {
      15: {
        rubric: `Código 2 (correcta): Formula una postura sobre cuál enfoque le parece más adecuado y fundamenta coherentemente aludiendo a aspectos característicos de ambos enfoques que sustentan dicha postura y evidencian la comprensión del texto. También se consideran correctas aquellas respuestas que justifiquen con información coherente de solo alguno de los textos.
Código 1 (parcial): Formula una postura sobre cuál enfoque le parece más adecuado, pero alude a información que da cuenta de una comprensión parcial o local de los textos (sin demostrar comprensión global al considerar beneficios y consecuencias de cada enfoque).
Código 0 (incorrecta): No formula postura, o es incoherente, vaga, tautológica, o en blanco.`,
        max_points: 2,
      },
    },
  },
  {
    // Ficha técnica oficial "Prueba de Matemática 7° básico - Evaluación de
    // Cierre 2026" (Agencia de Calidad, octubre 2026). 35 preguntas: 31 de
    // alternativas (solo la 16 tiene 3 opciones, verificado en el cuadernillo),
    // 3 de completación (6, 12, 33) y 1 de desarrollo (18).
    id: "dia_cierre_7b_matematica",
    label: "7° Básico - Matemática (Cierre)",
    stage: "cierre",
    pdfUrl: "/instrumentos-dia/prueba_matematica_cierre_2026_7_basico.pdf",
    fichaUrl: "/instrumentos-dia/ficha_tecnica_matematica_cierre_2026_7_basico.pdf",
    numQuestions: 35,
    numOptions: 4,
    openQuestions: "6,12,18,33",
    optionOverrides: "16:3",
    multiSelectQuestions: "",
    openQuestionSubtypes: { 6: "entero_decimal", 12: "entero_decimal", 18: "simple", 33: "entero_decimal" },
    answerKey: "BCDAA-DBCDB-CBCAA-DACDABBACBDACC-BB",
    openQuestionRubrics: {
      6: { rubric: `Respuesta correcta: 36. Código 1: coincide exactamente con ese valor numérico. Código 0: cualquier otro valor o en blanco.`, max_points: 1 },
      12: { rubric: `Respuesta correcta: 6. Código 1: coincide exactamente con ese valor numérico. Código 0: cualquier otro valor o en blanco.`, max_points: 1 },
      18: {
        rubric: `Código 2 (correcta): Marca la opción No o la explícita en su respuesta. Luego selecciona una estrategia para determinar la cantidad de bolsas necesaria o los kilogramos de capacidad de las 6 bolsas que desea ocupar el vendedor. Posteriormente evalúa el valor de verdad de la afirmación del vendedor justificando su argumento mediante sus cálculos. Ejemplos: "No, porque necesita más de 6 bolsas para envasar el total de kilogramos de nueces (4/5 : 1/8 = 6,4)"; "No, porque la capacidad total de las bolsas es menor a la cantidad total de kilogramos a envasar (6 · 1/8 = 0,75, que es menor a 4/5 = 0,8)".
Código 1 (parcial): Selecciona una estrategia para determinar la cantidad de bolsas necesarias para envasar las nueces o los kilogramos de capacidad de las 6 bolsas que desea ocupar el vendedor, pero no evalúa el valor de verdad de la afirmación del vendedor ni la justifica. Ejemplos: "Necesita 6,4 bolsas"; "Necesita embolsar 0,75 kilogramos".
Código 0 (incorrecta): Entrega otras respuestas distintas a las esperadas en los códigos anteriores, o bien, no responde. Ejemplos: "No, porque necesita más bolsas puesto que debe embolsar aproximadamente 0,9 kilogramos de nueces" (suma en vez de dividir); "Sí, porque 6 es mayor que 1/8 = 0,125".`,
        max_points: 2,
      },
      33: { rubric: `Respuesta correcta: 3/20 o cualquier fracción/decimal equivalente (0,15). Código 1: la respuesta es equivalente a ese valor. Código 0: cualquier otro valor o en blanco.`, max_points: 1 },
    },
  },
  {
    id: "dia_cierre_8b_matematica",
    label: "8° Básico - Matemática (Cierre)",
    stage: "cierre",
    pdfUrl: "/instrumentos-dia/prueba_matematica_cierre_2026_8_basico.pdf",
    fichaUrl: "/instrumentos-dia/ficha_tecnica_matematica_cierre_2026_8_basico.pdf",
    numQuestions: 37,
    numOptions: 4,
    openQuestions: "1,14,37",
    optionOverrides: "",
    multiSelectQuestions: "30",
    openQuestionSubtypes: { 1: "entero_decimal", 14: "simple", 37: "entero_decimal" },
    answerKey: "-ADCDCADBCCDB-BCBBDACABDCBBDA-AACBBD-",
    openQuestionRubrics: {
      1: { rubric: `Respuesta correcta: -70. Código 1: coincide exactamente con ese valor numérico. Código 0: cualquier otro valor o en blanco.`, max_points: 1 },
      14: {
        rubric: `Código 2 (correcta): Marca No o evidencia la adopción de esta postura. Argumenta que los resultados descritos tienen la misma cantidad de combinaciones (3 combinaciones cada uno: 2 caras y 1 sello = 3; 2 sellos y 1 cara = 3), o bien argumenta usando las 3 ramas del diagrama de árbol.
Código 1 (parcial): Marca No o evidencia la adopción de esta postura, pero sólo señala que el número de combinaciones es el mismo sin usar elementos del diagrama del árbol ni justificar adecuadamente.
Código 0 (incorrecta): Marca Sí, entrega respuestas distintas a las esperadas, o en blanco.`,
        max_points: 2,
      },
      37: { rubric: `Respuesta correcta: -13. Código 1: coincide exactamente con ese valor numérico. Código 0: cualquier otro valor o en blanco.`, max_points: 1 },
    },
  },
  {
    id: "dia_cierre_1m_matematica",
    label: "I Medio - Matemática (Cierre)",
    stage: "cierre",
    pdfUrl: "/instrumentos-dia/prueba_matematica_cierre_2026_I_medio.pdf",
    fichaUrl: "/instrumentos-dia/ficha_tecnica_matematica_cierre_2026_I_medio.pdf",
    numQuestions: 38,
    numOptions: 4,
    openQuestions: "9,32",
    optionOverrides: "",
    multiSelectQuestions: "",
    openQuestionSubtypes: { 9: "simple", 32: "entero_decimal" },
    answerKey: "ACDBBDAD-BABACBADBBDDCBCADCBDCC-DBCADC",
    openQuestionRubrics: {
      9: {
        rubric: `Código 2 (correcta): Presenta un sistema de ecuaciones que representa correctamente la información entregada (a + c = 12 y 2a + 3c = 33, o equivalente) y lo resuelve sin errores utilizando cualquier método. Finalmente responde que el camión traslada 3 autos y 9 camionetas.
Código 1 (parcial): Presenta un sistema de ecuaciones correcto pero comete algún error al resolverlo llegando a solución concordante con el contexto (enteros positivos); o plantea una ecuación correcta y la otra con error pero resuelve coherentemente; o resuelve coherentemente un sistema con números positivos concordantes.
Código 0 (incorrecta): Respuestas que no corresponden a lo solicitado, o en blanco.`,
        max_points: 2,
      },
      32: { rubric: `Respuesta correcta: 4. Código 1: coincide exactamente con ese valor numérico. Código 0: cualquier otro valor o en blanco.`, max_points: 1 },
    },
  },
  {
    id: "dia_cierre_2m_matematica",
    label: "II Medio - Matemática (Cierre)",
    stage: "cierre",
    pdfUrl: "/instrumentos-dia/prueba_matematica_cierre_2026_II_medio.pdf",
    fichaUrl: "/instrumentos-dia/ficha_tecnica_matematica_cierre_2026_II_medio.pdf",
    numQuestions: 39,
    numOptions: 4,
    openQuestions: "27,29,33",
    optionOverrides: "",
    multiSelectQuestions: "",
    openQuestionSubtypes: { 27: "par_ordenado", 29: "simple", 33: "entero_decimal" },
    answerKey: "DBCCDDADCCABCBADBBDA CBCACC-B-ACA-CBCACC".replace(/\s+/g, ""),
    openQuestionRubrics: {
      27: { rubric: `Respuesta correcta: (0,-2) o (0;-2) (par ordenado x,y). Código 1: coincide exactamente con ese par ordenado. Código 0: cualquier otro par o en blanco.`, max_points: 1 },
      29: {
        rubric: `Código 2 (correcta): Selecciona una estrategia que le permite encontrar la función inversa de g(x) = x/4 + 3 (obteniendo g⁻¹(x) = 4x - 12 o equivalente). Posteriormente, evalúa correctamente la función inversa en x = 10 y obtiene como resultado g⁻¹(10) = 28. (Nota: Si escribe x+1/6 sin paréntesis, verificar si comprende la expresión antes de invalidar).
Código 1 (parcial): Opción A: Encuentra la función inversa pero no evalúa en 10. Opción B: Comete error al encontrar la inversa pero evalúa correctamente en x = 10 su función obtenida.
Código 0 (incorrecta): Respuestas distintas a las esperadas, o en blanco.`,
        max_points: 2,
      },
      33: { rubric: `Respuesta correcta: 5. Código 1: coincide exactamente con ese valor numérico. Código 0: cualquier otro valor o en blanco.`, max_points: 1 },
    },
  },

  // ==========================================
  // MONITOREO INTERMEDIO 2026
  // ==========================================
  {
    id: "dia_5b_lectura",
    label: "5° Básico - Lectura (Intermedio)",
    stage: "intermedio",
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
    stage: "intermedio",
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
    stage: "intermedio",
    numQuestions: 28,
    numOptions: 4,
    openQuestions: "5,23",
    optionOverrides: "",
    multiSelectQuestions: "",
  },
  {
    id: "dia_6b_matematica",
    label: "6° Básico - Matemática",
    stage: "intermedio",
    numQuestions: 35,
    numOptions: 4,
    openQuestions: "7,15,18",
    optionOverrides: "20:3",
    multiSelectQuestions: "29",
  },
  {
    id: "dia_7b_lectura",
    label: "7° Básico - Lectura",
    stage: "intermedio",
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
    stage: "intermedio",
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
    stage: "intermedio",
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
  {
    id: "dia_8b_matematica",
    label: "8° Básico - Matemática",
    stage: "intermedio",
    numQuestions: 37,
    numOptions: 4,
    openQuestions: "16,37",
    optionOverrides: "",
    multiSelectQuestions: "",
    openQuestionSubtypes: { 16: "simple", 37: "entero_decimal" },
    answerKey: "ABCDCCBDDCDDACC-CBCAACBCDDBABBDABBAB-",
    openQuestionRubrics: {
      16: { rubric: `Código 2 (correcta): Comprende que en una hora el montañista desciende 3 veces 110 metros, ya que en 20 minutos desciende 110 metros, y que ese tramo que descendió en una hora lo hace 4 veces, ya que se pregunta por la altura en la que se encontrará el montañista después de 4 horas. Luego, selecciona una estrategia que permite resolver el problema, resuelve correctamente la operatoria y calcula la altura en la que se encontrará el montañista.
Código 1 (parcial): Opción A: Comprende que en una hora el montañista desciende 3 veces 110 metros, ya que en 20 minutos desciende 110 metros, y que ese tramo que descendió en una hora lo hace 4 veces, ya que se pregunta por la altura en la que se encontrará el montañista después de 4 horas. Luego, selecciona una estrategia para resolver el problema, resuelve correctamente la operatoria seleccionada, sin embargo, no calcula la altura en la que se encontrará el montañista. Opción B: Comprende que en una hora el montañista desciende 3 veces 110 metros, ya que en 20 minutos desciende 110 metros, pero no considera que ese tramo que descendió en una hora lo hace 4 veces, ya que por alguna razón omite que se pregunta por la altura en la que se encontrará el montañista después de 4 horas, por lo que no responde a la pregunta del problema. Luego, selecciona una estrategia para resolver el problema, resuelve correctamente la operatoria seleccionada, sin embargo, no calcula el descenso después de 4 horas y tampoco la altura en la que se encontrará el montañista.
Código 0 (incorrecta): Entrega otras respuestas distintas a las esperadas en los códigos anteriores, o bien, no responde.`, max_points: 2 },
      37: { rubric: `Respuesta correcta: 133. Código 1: coincide con ese valor. Código 0: cualquier otro valor o en blanco.`, max_points: 1 },
    },
  },
  {
    id: "dia_Imedio_lectura",
    label: "I Medio - Lectura",
    stage: "intermedio",
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
    stage: "intermedio",
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
    stage: "intermedio",
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
    stage: "intermedio",
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
