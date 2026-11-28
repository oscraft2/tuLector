import { normalizarCursoDIA } from "@/lib/dia_curso";
// El mapeo de respuesta cruda -> celda ("-" vacio, "?"/doble marca "NULA",
// multi-select "1|3|5" tal cual) y el RUT con guion viven en el catalogo comun
// de exportacion: asi el CSV de DIA y el configurable no pueden divergir.
// Semantica DIA: celda vacia = "No Responde" (ver dia-bot/docs/FINDINGS.md
// seccion 8.1); el RUT con guion es como la plataforma lo expone
// (`usuario.rutCompleto`, seccion 6.bis).
import { celdaRespuesta, celdaMultiSelect, formatRutConGuion, answersByQuestion } from "@/lib/export_columns";
import { diaRevisionAbierta, respuestaPautaCompletacion, type DiaCodigoOpenAnswer } from "@/lib/dia_codigo";
import { canonicalRut } from "@/lib/rut";

export type ExportPaper = {
  /** Necesario para cruzar con open_answers (paper_id+question). Sin id, una
   *  pregunta abierta exporta codigo 0 (mismo resultado que "sin respuesta"). */
  id?: string;
  student_name: string | null;
  student_rut_norm: string | null;
  answers: unknown;
};

export type ExportOpenAnswer = DiaCodigoOpenAnswer & { paper_id: string; question: number };

/** Version del CSV. La extension la usa para saber que el archivo distingue
 *  "sin revisar" de "incorrecta" (columnas p{n}_estado y p{n}_valor). */
export const DIA_FORMATO = "2";

/** Una hoja por estudiante: gana la PRIMERA de la lista, que debe venir de la
 *  mas reciente a la mas antigua. Es la misma regla de la pantalla de
 *  calificacion rapida, para exportar la hoja que el profesor califico. Las
 *  hojas sin RUT no se agrupan. */
export function unaHojaPorEstudiante<T extends { student_rut_norm: string | null; student_id?: string | null }>(papers: T[]): T[] {
  const vistos = new Set<string>();
  return papers.filter((paper) => {
    const rut = paper.student_rut_norm ?? canonicalRut(paper.student_id ?? null);
    if (!rut) return true;
    if (vistos.has(rut)) return false;
    vistos.add(rut);
    return true;
  });
}

function csvEscape(value: string): string {
  return /[",\n;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Arma el CSV en formato Pruebas DIA (rut,nombre,curso,asignatura,p1..pN) a
 * partir de los `papers` de un ensayo -- ver dia-bot/docs/FINDINGS.md seccion
 * 8.1 para el formato exacto que espera el motor de ingreso. Se usa tanto
 * desde la ruta de descarga (api/quiz/[id]/export-dia) como podria reusarse
 * en otro lado sin duplicar la logica de mapeo. */
export function buildDiaCsv({
  papers,
  numQuestions,
  subject,
  grade,
  openQuestions = [],
  multiSelectQuestions = [],
  openAnswers = [],
  openQuestionRubrics = {},
}: {
  papers: ExportPaper[];
  numQuestions: number;
  subject: string | null;
  grade: string | null;
  /** Preguntas de desarrollo (1-indexadas): su celda lleva el "codigo" DIA
   *  (0/1/2, ver dia_codigo.ts) segun lo que haya en `openAnswers` para ese
   *  paper+pregunta. El 0 de una pregunta sin confirmar se distingue con la
   *  columna p{n}_estado = "sin_revisar". */
  openQuestions?: number[];
  /** Preguntas de seleccion MULTIPLE (1-indexadas, ej. "marca todas las
   *  correctas"): su celda lleva las etiquetas marcadas tal cual las entrega
   *  el motor ("1|3|5"), sin pasar por celdaRespuesta (que colapsaria un
   *  largo>1 a "NULA" -- correcto para una doble marca en seleccion unica,
   *  incorrecto aca donde varias marcas son la respuesta normal). */
  multiSelectQuestions?: number[];
  /** Filas de open_answers ya calificadas/confirmadas del ensayo, para armar
   *  el codigo de cada pregunta abierta (docs/plan-dia-abiertas.md Fase C). */
  openAnswers?: ExportOpenAnswer[];
  /** Rubricas del ensayo: dan el puntaje maximo y, en completacion, la
   *  respuesta de la pauta que va en p{n}_valor para quienes acertaron. */
  openQuestionRubrics?: Record<number, { rubric: string; max_points: number }>;
}): string {
  const abiertasOrdenadas = [...new Set(openQuestions)]
    .filter((q) => q >= 1 && q <= numQuestions)
    .sort((a, b) => a - b);
  const headers = [
    "rut",
    "nombre",
    "curso",
    "asignatura",
    ...Array.from({ length: numQuestions }, (_, i) => `p${i + 1}`),
    "dia_formato",
    ...abiertasOrdenadas.flatMap((q) => [`p${q}_estado`, `p${q}_valor`]),
  ];

  const openSet = new Set(openQuestions);
  const multiSet = new Set(multiSelectQuestions);
  const openAnswersByPaperQuestion = new Map<string, ExportOpenAnswer>();
  for (const oa of openAnswers) openAnswersByPaperQuestion.set(`${oa.paper_id}:${oa.question}`, oa);

  const rows = papers.map((paper) => {
    const porPregunta = answersByQuestion(paper.answers);
    const revision = (qNum: number) => {
      const oa = paper.id ? openAnswersByPaperQuestion.get(`${paper.id}:${qNum}`) : undefined;
      return diaRevisionAbierta(oa ?? null, openQuestionRubrics[qNum]?.max_points);
    };
    const celdas = Array.from({ length: numQuestions }, (_, i) => {
      const qNum = i + 1;
      if (openSet.has(qNum)) return String(revision(qNum).codigo);
      if (multiSet.has(qNum)) return celdaMultiSelect(porPregunta.get(qNum));
      return celdaRespuesta(porPregunta.get(qNum));
    });
    return [
      formatRutConGuion(paper.student_rut_norm),
      paper.student_name ?? "",
      normalizarCursoDIA(grade),
      subject ?? "",
      ...celdas,
      DIA_FORMATO,
      ...abiertasOrdenadas.flatMap((qNum) => {
        const { revisada, codigo } = revision(qNum);
        const pauta = codigo === 2 ? respuestaPautaCompletacion(openQuestionRubrics[qNum]?.rubric) : null;
        return [revisada ? "revisada" : "sin_revisar", pauta ?? ""];
      }),
    ];
  });

  const csvLines = [headers, ...rows].map((row) => row.map((cell) => csvEscape(String(cell ?? ""))).join(","));
  // BOM para que Excel en Windows reconozca UTF-8 (nombres con tildes/Ñ).
  return "﻿" + csvLines.join("\r\n");
}

export function slugCsvFilename(subject: string | null, grade: string | null): string {
  const slug = (s: string | null) => (s ?? "ensayo").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_");
  return `resultados_${slug(subject)}_${slug(grade)}.csv`;
}
