/**
 * Equivalencia de un ensayo a puntaje PAES y SIMCE.
 *
 * SIEMPRE se calcula sobre el PORCENTAJE DE LOGRO (correctas / total, o puntos
 * ponderados / puntaje total), nunca sobre un numero fijo de preguntas: un
 * ensayo de 36 preguntas y uno de 65 tienen que poder compararse.
 *
 * ---------------------------------------------------------------------------
 * ESTADO: la conversion oficial del DEMRE TODAVIA NO ESTA CARGADA.
 * ---------------------------------------------------------------------------
 * El DEMRE publica una tabla distinta por prueba (M1, M2, Competencia Lectora,
 * Ciencias, Historia) y por año, y NO es lineal. Mientras no este cargada aca,
 * se usa la aproximacion proporcional (la misma que ya usaba `equivalentScore`
 * en quiz_score.ts) y el resultado viaja con `aproximado: true` para que la
 * interfaz lo rotule como tal. Un puntaje presentado como oficial cuando no lo
 * es seria un numero creible y falso -- justo lo que hay que evitar.
 *
 * COMO CARGAR LA TABLA OFICIAL: agregar una entrada a PAES_TABLES con los
 * tramos en PORCENTAJE. Si la tabla del DEMRE viene como "correctas -> puntaje"
 * para una prueba de N preguntas, cada fila se convierte con pct = correctas/N.
 * Eso la hace aplicable a un ensayo de cualquier largo; es una ADAPTACION de la
 * tabla oficial, no la tabla literal, y asi hay que describirla al profesor.
 *
 * Modulo puro: sin "server-only" y sin alias, testeable con node:test.
 */

/** Un tramo de conversion: desde `pct` de logro, el puntaje es `score`. */
export type ConversionRow = { pct: number; score: number };

export type ConversionTable = {
  id: string;
  label: string;
  /** Ordenados por `pct` ascendente. Entre dos tramos se interpola. */
  rows: ConversionRow[];
};

/** Tablas oficiales del DEMRE, en porcentaje de logro. VACIO por ahora. */
export const PAES_TABLES: ConversionTable[] = [];

/** Tablas oficiales de la Agencia de Calidad para SIMCE. VACIO por ahora. */
export const SIMCE_TABLES: ConversionTable[] = [];

/** Rango de la escala PAES (DEMRE) y SIMCE (Agencia de Calidad). */
const PAES_MIN = 100, PAES_MAX = 1000;
const SIMCE_MIN = 100, SIMCE_MAX = 400;

export type Equivalence = {
  score: number;
  /** true = proporcional, no la conversion oficial. La interfaz lo rotula. */
  aproximado: boolean;
};

/**
 * Puntaje que la tabla asigna a un porcentaje de logro. Interpola linealmente
 * entre tramos y satura en los extremos -- mismo criterio que `gradeFromTable`
 * (src/lib/grade_table.ts) para la tabla puntaje->nota del colegio.
 */
export function scoreFromTable(table: ConversionTable, pct: number): number | null {
  const rows = table.rows;
  if (rows.length === 0) return null;

  const x = clamp01(pct) * 100;
  if (x <= rows[0].pct) return Math.round(rows[0].score);
  const last = rows[rows.length - 1];
  if (x >= last.pct) return Math.round(last.score);

  for (let i = 0; i < rows.length - 1; i++) {
    const lo = rows[i];
    const hi = rows[i + 1];
    if (x >= lo.pct && x <= hi.pct) {
      const span = hi.pct - lo.pct;
      if (span <= 0) return Math.round(hi.score);
      const t = (x - lo.pct) / span;
      return Math.round(lo.score + t * (hi.score - lo.score));
    }
  }
  return Math.round(last.score);
}

/** Puntaje PAES equivalente a un porcentaje de logro. */
export function paesEquivalence(pct: number, tableId?: string): Equivalence {
  const table = findTable(PAES_TABLES, tableId);
  const fromTable = table ? scoreFromTable(table, pct) : null;
  if (fromTable !== null) return { score: fromTable, aproximado: false };
  return { score: linear(pct, PAES_MIN, PAES_MAX), aproximado: true };
}

/** Puntaje SIMCE equivalente a un porcentaje de logro. */
export function simceEquivalence(pct: number, tableId?: string): Equivalence {
  const table = findTable(SIMCE_TABLES, tableId);
  const fromTable = table ? scoreFromTable(table, pct) : null;
  if (fromTable !== null) return { score: fromTable, aproximado: false };
  return { score: linear(pct, SIMCE_MIN, SIMCE_MAX), aproximado: true };
}

/** Porcentaje de logro de una hoja. Usa el puntaje PONDERADO cuando el ensayo
 *  lo tiene (points/points_total) y el conteo de correctas cuando no. Devuelve
 *  null si no hay denominador: ahi no se puede afirmar nada. */
export function achievementPct(paper: {
  score?: number | null; total?: number | null;
  points?: number | null; points_total?: number | null;
}): number | null {
  const total = paper.points_total ?? paper.total ?? 0;
  const score = paper.points ?? paper.score ?? 0;
  if (!Number.isFinite(total) || total <= 0) return null;
  return clamp01(score / total);
}

function findTable(tables: ConversionTable[], id?: string): ConversionTable | null {
  if (tables.length === 0) return null;
  if (id) return tables.find((t) => t.id === id) ?? tables[0];
  return tables[0];
}

function linear(pct: number, min: number, max: number): number {
  return Math.round(min + clamp01(pct) * (max - min));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
