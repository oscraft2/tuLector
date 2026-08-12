/**
 * Catalogo UNICO de columnas exportables de un ensayo.
 *
 * Una sola definicion la usan el panel de exportacion, el CSV, el Excel y los
 * presets institucionales. Antes cada exportador tenia sus columnas escritas a
 * mano (api/export/results tenia 8 fijas, dia_export las suyas, y
 * latam.generateExportCSV una tercera lista muerta que nadie llamaba), asi que
 * agregar una columna significaba tocar tres sitios y que se desincronizaran.
 *
 * Modulo puro: sin "server-only" y sin alias, para poder probarlo con node:test.
 */

/** Una hoja corregida, con lo que necesita cualquier columna. */
export type ExportPaperRow = {
  student_name: string | null;
  student_id: string | null;
  student_rut_norm: string | null;
  course_name?: string | null;
  score: number | null;
  total: number | null;
  points?: number | null;
  points_total?: number | null;
  equivalent_score: number | null;
  grade: string | number | null;
  status?: string | null;
  scanned_at: string | null;
  /** [{q, a}] tal como lo guarda el motor. */
  answers?: unknown;
};

export type ExportContext = {
  /** Nota minima de aprobacion resuelta, para la columna "Aprobado". */
  passingGrade: number;
  /** Preguntas de desarrollo (1-indexadas): su celda de respuesta va vacia. */
  openQuestions?: number[];
  /** Preguntas de seleccion multiple (1-indexadas). */
  multiSelectQuestions?: number[];
};

export type ExportColumn = {
  id: string;
  label: string;
  value: (row: ExportPaperRow, ctx: ExportContext) => string;
};

/**
 * Mapea la letra cruda del motor a la celda de un export.
 * "-" (sin marca) -> vacio. "?" (reflejo/no legible) o largo>1 (doble marca) ->
 * "NULA". Cualquier otra cosa -> la letra tal cual.
 *
 * Vive aca y no en dia_export.ts (de donde salio) para que la exportacion DIA y
 * la generica no puedan divergir: ambas importan ESTA.
 */
export function celdaRespuesta(a: string | undefined): string {
  if (!a || a === "-") return "";
  if (a === "?" || a.length > 1) return "NULA";
  return a;
}

/**
 * Celda de una pregunta de SELECCION MULTIPLE: el motor ya entrega las
 * etiquetas marcadas unidas por "|" (ej "1|3|5"), o "-" si no se marco ninguna.
 * A diferencia de celdaRespuesta, un largo>1 NO es ambiguedad aca: es el
 * formato normal de una respuesta con varias marcas.
 */
export function celdaMultiSelect(a: string | undefined): string {
  if (!a || a === "-") return "";
  return a;
}

/** Respuestas de una hoja indexadas por nº de pregunta. */
export function answersByQuestion(answers: unknown): Map<number, string> {
  const map = new Map<number, string>();
  if (!Array.isArray(answers)) return map;
  for (const item of answers as { q?: unknown; a?: unknown }[]) {
    const q = Number(item?.q);
    if (Number.isInteger(q)) map.set(q, String(item?.a ?? ""));
  }
  return map;
}

/** RUT con guion, como lo esperan la mayoria de los sistemas externos. El RUT
 *  canonico de tuLector va sin guion (`canonicalRut`, src/lib/rut.ts). */
export function formatRutConGuion(rutNorm: string | null | undefined): string {
  if (!rutNorm) return "";
  const m = rutNorm.match(/^(\d{7,8})([0-9K])$/);
  if (!m) return rutNorm;
  return `${m[1]}-${m[2]}`;
}

function pct(row: ExportPaperRow): string {
  const total = Number(row.points_total ?? row.total ?? 0);
  const score = Number(row.points ?? row.score ?? 0);
  if (total <= 0) return "";
  return `${Math.round((score / total) * 100)}%`;
}

export const EXPORT_COLUMNS: ExportColumn[] = [
  { id: "student_name", label: "Alumno", value: (r) => r.student_name ?? "Sin identificar" },
  { id: "rut", label: "RUT", value: (r) => formatRutConGuion(r.student_rut_norm) || (r.student_id ?? "") },
  { id: "course", label: "Curso", value: (r) => r.course_name ?? "" },
  { id: "correct", label: "Correctas", value: (r) => (r.score != null ? String(r.score) : "") },
  { id: "questions", label: "Total preguntas", value: (r) => (r.total != null ? String(r.total) : "") },
  // Con ponderacion ausente, `points` vale lo mismo que `score` -- la columna
  // sigue siendo correcta en un ensayo sin puntaje por pregunta.
  { id: "points", label: "Puntos", value: (r) => String(r.points ?? r.score ?? "") },
  { id: "points_total", label: "Puntos totales", value: (r) => String(r.points_total ?? r.total ?? "") },
  { id: "percent", label: "Porcentaje", value: pct },
  { id: "grade", label: "Nota", value: (r) => (r.grade != null ? String(r.grade) : "") },
  { id: "equivalent", label: "Puntaje equivalente", value: (r) => (r.equivalent_score != null ? String(r.equivalent_score) : "") },
  {
    id: "passing",
    label: "Aprobado",
    value: (r, ctx) => {
      // `Number(null)` es 0, no NaN: sin este corte previo una hoja sin nota
      // (ej. una que quedo en revision manual) se exportaba como "No", que se
      // lee como "reprobo" cuando en realidad no tiene nota todavia.
      if (r.grade === null || r.grade === undefined || r.grade === "") return "";
      const grade = Number(r.grade);
      if (!Number.isFinite(grade)) return "";
      return grade >= ctx.passingGrade ? "Sí" : "No";
    },
  },
  { id: "status", label: "Estado", value: (r) => r.status ?? "" },
  { id: "scanned_at", label: "Fecha", value: (r) => (r.scanned_at ? new Date(r.scanned_at).toLocaleString("es-CL") : "") },
];

export const EXPORT_COLUMNS_BY_ID = new Map(EXPORT_COLUMNS.map((c) => [c.id, c]));

/** Columnas del CSV historico de resultados, en su orden exacto. Es lo que
 *  devuelve la ruta de exportacion cuando NO se le pide nada en particular, para
 *  que cualquier enlace o costumbre previa siga funcionando igual. */
export const LEGACY_RESULTS_COLUMNS = [
  "student_name", "rut", "correct", "questions", "percent", "grade", "equivalent", "scanned_at",
] as const;

/** Bloques que se expanden a una columna POR PREGUNTA. */
export type PerQuestionBlock = "answers" | "points";

export type ExportSpec = {
  /** Ids del catalogo, en el orden pedido. */
  columns: string[];
  /** Encabezados a medida: {"rut": "RUN"}. Lo que no este aca usa el label. */
  headerLabels?: Record<string, string>;
  /** Columnas p1..pN al final: respuesta marcada y/o puntos obtenidos. */
  perQuestion?: PerQuestionBlock[];
  /** Nº de preguntas del ensayo; obligatorio si hay perQuestion. */
  numQuestions?: number;
  /** Puntaje de cada pregunta, para el bloque de puntos por pregunta. */
  pointsForQuestion?: (q: number) => number;
  /** Clave del ensayo, para saber si una respuesta fue correcta. */
  answerKey?: string;
};

/** Encabezados finales de un export. */
export function buildHeaders(spec: ExportSpec): string[] {
  const headers = spec.columns.map((id) => spec.headerLabels?.[id] ?? EXPORT_COLUMNS_BY_ID.get(id)?.label ?? id);
  const numQuestions = spec.numQuestions ?? 0;
  for (const block of spec.perQuestion ?? []) {
    for (let q = 1; q <= numQuestions; q++) {
      headers.push(block === "answers" ? `p${q}` : `p${q}_pts`);
    }
  }
  return headers;
}

/** Una fila de un export, ya como texto. */
export function buildRow(row: ExportPaperRow, spec: ExportSpec, ctx: ExportContext): string[] {
  const cells = spec.columns.map((id) => EXPORT_COLUMNS_BY_ID.get(id)?.value(row, ctx) ?? "");

  const blocks = spec.perQuestion ?? [];
  if (blocks.length === 0) return cells;

  const numQuestions = spec.numQuestions ?? 0;
  const answers = answersByQuestion(row.answers);
  const openSet = new Set(ctx.openQuestions ?? []);
  const multiSet = new Set(ctx.multiSelectQuestions ?? []);

  for (const block of blocks) {
    for (let q = 1; q <= numQuestions; q++) {
      if (block === "answers") {
        // Una abierta va SIEMPRE vacia aunque el motor haya leido ruido en su
        // zona: no tiene alternativa marcada que reportar.
        if (openSet.has(q)) cells.push("");
        else if (multiSet.has(q)) cells.push(celdaMultiSelect(answers.get(q)));
        else cells.push(celdaRespuesta(answers.get(q)));
      } else {
        cells.push(pointsCell(q, answers, spec, openSet, multiSet));
      }
    }
  }
  return cells;
}

/** Puntos obtenidos en una pregunta: su puntaje si acerto, 0 si no. Las
 *  abiertas y las de seleccion multiple no se corrigen automaticamente, asi que
 *  su celda va vacia en vez de un 0 que se leeria como "lo hizo mal". */
function pointsCell(
  q: number,
  answers: Map<number, string>,
  spec: ExportSpec,
  openSet: Set<number>,
  multiSet: Set<number>,
): string {
  if (openSet.has(q) || multiSet.has(q)) return "";
  const key = String(spec.answerKey ?? "").replace(/[^A-Za-z-]/g, "").toUpperCase();
  const expected = key[q - 1] ?? "";
  const given = answers.get(q);
  if (!expected || expected === "-") return "";
  const correct = given !== undefined && given !== "-" && given === expected;
  return correct ? String(spec.pointsForQuestion?.(q) ?? 1) : "0";
}
