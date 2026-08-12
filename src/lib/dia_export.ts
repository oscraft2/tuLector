import { normalizarCursoDIA } from "@/lib/dia_curso";
// El mapeo de respuesta cruda -> celda ("-" vacio, "?"/doble marca "NULA",
// multi-select "1|3|5" tal cual) y el RUT con guion viven en el catalogo comun
// de exportacion: asi el CSV de DIA y el configurable no pueden divergir.
// Semantica DIA: celda vacia = "No Responde" (ver dia-bot/docs/FINDINGS.md
// seccion 8.1); el RUT con guion es como la plataforma lo expone
// (`usuario.rutCompleto`, seccion 6.bis).
import { celdaRespuesta, celdaMultiSelect, formatRutConGuion, answersByQuestion } from "@/lib/export_columns";

export type ExportPaper = {
  student_name: string | null;
  student_rut_norm: string | null;
  answers: unknown;
};

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
}: {
  papers: ExportPaper[];
  numQuestions: number;
  subject: string | null;
  grade: string | null;
  /** Preguntas de desarrollo (1-indexadas): su celda va SIEMPRE vacia ("No
   *  Responde"), aunque el motor haya leido ruido — la extension dia-bot ya
   *  salta las preguntas no-SELECCION_UNICA_SIMPLE al ingresar. */
  openQuestions?: number[];
  /** Preguntas de seleccion MULTIPLE (1-indexadas, ej. "marca todas las
   *  correctas"): su celda lleva las etiquetas marcadas tal cual las entrega
   *  el motor ("1|3|5"), sin pasar por celdaRespuesta (que colapsaria un
   *  largo>1 a "NULA" -- correcto para una doble marca en seleccion unica,
   *  incorrecto aca donde varias marcas son la respuesta normal). */
  multiSelectQuestions?: number[];
}): string {
  const headers = [
    "rut",
    "nombre",
    "curso",
    "asignatura",
    ...Array.from({ length: numQuestions }, (_, i) => `p${i + 1}`),
  ];

  const openSet = new Set(openQuestions);
  const multiSet = new Set(multiSelectQuestions);
  const rows = papers.map((paper) => {
    const porPregunta = answersByQuestion(paper.answers);
    const celdas = Array.from({ length: numQuestions }, (_, i) => {
      const qNum = i + 1;
      if (openSet.has(qNum)) return "";
      if (multiSet.has(qNum)) return celdaMultiSelect(porPregunta.get(qNum));
      return celdaRespuesta(porPregunta.get(qNum));
    });
    return [
      formatRutConGuion(paper.student_rut_norm),
      paper.student_name ?? "",
      normalizarCursoDIA(grade),
      subject ?? "",
      ...celdas,
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
