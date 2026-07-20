/** Logica de import de alumnos COMPARTIDA entre el server action
 * (actions.ts, modo "pegar CSV simple") y el componente cliente
 * (CSVImport.tsx, modo "subir archivo + mapeo inteligente"). Sin
 * dependencias de Node ni del DOM -- corre igual en los dos lados.
 *
 * Los alias de columna son intencionalmente genericos (no solo "rut"): el
 * pais del colegio define la ETIQUETA visible (`studentIdLabel` en
 * country_profiles.ts, ej. "DNI", "CPF"), pero el AUTODETECTOR de columnas
 * acepta terminos de varios paises a la vez -- asi una planilla que ya trae
 * "DNI" o "documento" como encabezado tambien se reconoce sola.
 */

export type StudentCsvRow = {
  rut: string;
  name: string;
  course: string | null;
  grade: string | null;
};

export type ColumnMapping = {
  rutCol: number;
  nameCol: number;
  courseCol: number;
  gradeCol: number; // -1 = no mapeada (opcional)
};

export const ID_ALIASES = ["rut", "run", "dni", "cpf", "student_id", "id alumno", "identificador", "documento", "id"] as const;
export const NAME_ALIASES = ["nombre", "name", "alumno", "estudiante", "nombre completo"] as const;
export const COURSE_ALIASES = ["curso", "course", "grupo", "seccion", "sección"] as const;
export const GRADE_ALIASES = ["nivel", "grade", "grado"] as const;

export function normalizeCsvHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function findHeaderIndex(headers: string[], aliases: readonly string[]): number {
  const normalizedAliases = new Set(aliases.map(normalizeCsvHeader));
  return headers.findIndex((header) => normalizedAliases.has(normalizeCsvHeader(header)));
}

/** Mejor palpito de mapeo de columnas a partir de los encabezados detectados
 * -- se usa tanto para pre-llenar el selector del modo "mapeo inteligente"
 * como (indirectamente, via los mismos alias) para el modo "CSV simple". */
export function guessColumnMapping(headers: string[]): ColumnMapping {
  return {
    rutCol: findHeaderIndex(headers, ID_ALIASES),
    nameCol: findHeaderIndex(headers, NAME_ALIASES),
    courseCol: findHeaderIndex(headers, COURSE_ALIASES),
    gradeCol: findHeaderIndex(headers, GRADE_ALIASES),
  };
}

/** Parser CSV minimo (RFC4180: comillas, comas y comillas escapadas dentro de
 * campo), sin dependencias -- corre en el navegador (a diferencia de
 * `csv-parse` que usa actions.ts, pensado solo para servidor). Tambien sirve
 * para TSV si `delimiter` es "\t" (pegado desde Excel/Sheets). */
export function parseDelimitedText(text: string, delimiter = ","): string[][] {
  const clean = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delimiter) { row.push(field); field = ""; }
    else if (c === "\r") { /* el \n que sigue cierra la fila */ }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

/** Detecta el delimitador mas probable (coma o tab) mirando la primera
 * linea -- pegar desde Excel/Sheets suele venir separado por tabs. */
export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return tabs > commas ? "\t" : ",";
}

/** Arma las filas de alumnos a partir de una tabla cruda + el mapeo de
 * columnas elegido (a mano o adivinado). `hasHeader` descarta la primera
 * fila si corresponde. Filas vacias o sin RUT/nombre quedan afuera (se
 * reportan aparte, no se inventan datos). */
export function rowsFromMapping(table: string[][], mapping: ColumnMapping, hasHeader: boolean): StudentCsvRow[] {
  const dataRows = hasHeader ? table.slice(1) : table;
  return dataRows
    .filter((row) => row.some((c) => c.trim() !== ""))
    .map((row) => ({
      rut: (row[mapping.rutCol] ?? "").trim(),
      name: (row[mapping.nameCol] ?? "").trim(),
      course: mapping.courseCol >= 0 ? (row[mapping.courseCol] ?? "").trim() || null : null,
      grade: mapping.gradeCol >= 0 ? (row[mapping.gradeCol] ?? "").trim() || null : null,
    }));
}
