import { normalizarCursoDIA } from "@/lib/dia_curso";

export type ExportPaper = {
  student_name: string | null;
  student_rut_norm: string | null;
  answers: unknown;
};

/** RUT canonico de tuLector viene sin guion (`canonicalRut`, src/lib/rut.ts:
 * `${body}${dv}`). Se reformatea con guion aca solo para exportar, porque asi
 * es como la plataforma DIA expone el RUT (`usuario.rutCompleto`) -- ver
 * dia-bot/docs/FINDINGS.md seccion 6.bis. */
function formatRutConGuion(rutNorm: string | null): string {
  if (!rutNorm) return "";
  const m = rutNorm.match(/^(\d{7,8})([0-9K])$/);
  if (!m) return rutNorm;
  return `${m[1]}-${m[2]}`;
}

/** Mapea la letra cruda del motor OMR al valor que espera el bot de ingreso:
 * "-" (sin marca) -> celda vacia = "No Responde" en DIA.
 * "?" (reflejo/no legible) o largo>1 (doble marca) -> "NULA".
 * cualquier otra cosa -> la letra tal cual (A, B, C, D...). */
function celdaRespuesta(a: string | undefined): string {
  if (!a || a === "-") return "";
  if (a === "?" || a.length > 1) return "NULA";
  return a;
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
}: {
  papers: ExportPaper[];
  numQuestions: number;
  subject: string | null;
  grade: string | null;
}): string {
  const headers = [
    "rut",
    "nombre",
    "curso",
    "asignatura",
    ...Array.from({ length: numQuestions }, (_, i) => `p${i + 1}`),
  ];

  const rows = papers.map((paper) => {
    const porPregunta = new Map<number, string>();
    if (Array.isArray(paper.answers)) {
      for (const item of paper.answers as { q?: unknown; a?: unknown }[]) {
        const q = Number(item?.q);
        if (Number.isInteger(q)) porPregunta.set(q, String(item?.a ?? ""));
      }
    }
    const celdas = Array.from({ length: numQuestions }, (_, i) => celdaRespuesta(porPregunta.get(i + 1)));
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
