/**
 * Tabla de equivalencia puntaje -> nota del colegio (quizzes.grade_table).
 *
 * Es la alternativa a la formula de exigencia de calculateGrade (src/lib/latam.ts):
 * muchos colegios ya tienen su tabla oficial impresa y necesitan que la nota
 * salga EXACTAMENTE de ahi, no de una interpolacion con otro criterio.
 *
 * Modulo puro (sin "server-only", sin alias) para poder probarse con node:test.
 */

export type GradeTableMode = "points" | "percent";

/** Un tramo: desde `from` (inclusive) la nota es `grade`. Entre dos tramos se
 *  interpola linealmente, que es como se leen las tablas escolares reales
 *  ("12 puntos = 4.0, 20 puntos = 7.0" implica los intermedios). */
export interface GradeTableRow {
  from: number;
  grade: number;
}

export interface GradeTable {
  mode: GradeTableMode;
  rows: GradeTableRow[];
}

/**
 * Parsea quizzes.grade_table (JSON-string) de forma TOLERANTE: cualquier cosa
 * invalida devuelve null y el llamador se cae a la formula de exigencia de
 * siempre. Una tabla rota nunca puede dejar una hoja sin nota.
 *
 * Descarta filas no numericas, ordena por `from` y deduplica: dos tramos con el
 * mismo `from` son ambiguos, gana el ultimo declarado.
 */
export function parseGradeTable(value: string | null | undefined): GradeTable | null {
  if (!value) return null;
  try {
    const raw = JSON.parse(value) as Partial<GradeTable>;
    const mode: GradeTableMode = raw.mode === "percent" ? "percent" : "points";
    if (!Array.isArray(raw.rows)) return null;

    const byFrom = new Map<number, number>();
    for (const row of raw.rows) {
      const from = Number((row as GradeTableRow)?.from);
      const grade = Number((row as GradeTableRow)?.grade);
      if (!Number.isFinite(from) || !Number.isFinite(grade)) continue;
      if (from < 0) continue;
      byFrom.set(from, grade);
    }
    if (byFrom.size === 0) return null;

    const rows = [...byFrom.entries()]
      .map(([from, grade]) => ({ from, grade }))
      .sort((a, b) => a.from - b.from);
    return { mode, rows };
  } catch {
    return null;
  }
}

/** Serializa a la forma canonica de BD, o null si la tabla esta vacia. */
export function serializeGradeTable(table: GradeTable | null): string | null {
  if (!table || table.rows.length === 0) return null;
  return JSON.stringify({
    mode: table.mode,
    rows: [...table.rows].sort((a, b) => a.from - b.from),
  });
}

/**
 * Nota que la tabla asigna a un puntaje.
 *
 * - Por debajo del primer tramo: la nota del primer tramo (satura).
 * - Por encima del ultimo: la nota del ultimo tramo (satura).
 * - Entre dos tramos: interpolacion lineal, redondeada a 1 decimal igual que
 *   calculateGrade.
 *
 * `pointsTotal` solo se usa cuando la tabla esta en modo "percent" (hay que
 * convertir el puntaje a porcentaje antes de buscar el tramo).
 */
export function gradeFromTable(table: GradeTable, points: number, pointsTotal: number): number | null {
  if (table.rows.length === 0) return null;

  let x = points;
  if (table.mode === "percent") {
    if (pointsTotal <= 0) return null;
    x = (points / pointsTotal) * 100;
  }

  const rows = table.rows;
  if (x <= rows[0].from) return round1(rows[0].grade);
  const last = rows[rows.length - 1];
  if (x >= last.from) return round1(last.grade);

  for (let i = 0; i < rows.length - 1; i++) {
    const lo = rows[i];
    const hi = rows[i + 1];
    if (x >= lo.from && x <= hi.from) {
      const span = hi.from - lo.from;
      // Dos tramos consecutivos con el mismo `from` no pueden existir (el
      // parser deduplica), pero un `span` 0 aqui devolveria NaN.
      if (span <= 0) return round1(hi.grade);
      const t = (x - lo.from) / span;
      return round1(lo.grade + t * (hi.grade - lo.grade));
    }
  }
  return round1(last.grade);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Escala de puntaje equivalente propia del ensayo (quizzes.equivalent_scale).
 *  Tolerante igual que la tabla: invalida = null = se usa el % simple. */
export function parseEquivalentScale(value: string | null | undefined): { min: number; max: number } | null {
  if (!value) return null;
  try {
    const raw = JSON.parse(value) as { min?: unknown; max?: unknown };
    const min = Number(raw?.min);
    const max = Number(raw?.max);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    if (max <= min) return null;
    return { min, max };
  } catch {
    return null;
  }
}
