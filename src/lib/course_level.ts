/**
 * Nivel de un curso a partir del texto libre que el profesor escribe
 * ("2° Medio B", "7mo Basico A", "III C").
 *
 * Los helpers de parseo salieron de dia_curso.ts, que resolvia exactamente esto
 * pero devolvia "II B" (nivel + letra) porque su destino es el formato de la
 * plataforma DIA. Aca hace falta el NIVEL suelto, para decidir que equivalencias
 * mostrar. Viven en este modulo y dia_curso.ts los importa, para no dejar dos
 * parseos de curso divergiendo.
 *
 * Modulo puro: sin "server-only" y sin alias, testeable con node:test.
 */

export const ORDINAL_A_ROMANO: Record<string, string> = {
  PRIMERO: "I", PRIMER: "I",
  SEGUNDO: "II",
  TERCERO: "III", TERCER: "III",
  CUARTO: "IV",
};

export const ORDINAL_A_ARABIGO: Record<string, string> = {
  PRIMERO: "1", PRIMER: "1",
  SEGUNDO: "2",
  TERCERO: "3", TERCER: "3",
  CUARTO: "4",
  QUINTO: "5",
  SEXTO: "6",
  SEPTIMO: "7",
  OCTAVO: "8",
};

export function quitarTildes(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function extraerRomano(s: string): string | null {
  const m = s.match(/\b(IV|III|II|I)\b/);
  return m ? m[1] : null;
}

export function extraerDigito(s: string, min: number, max: number): string | null {
  const m = s.match(/[0-9]/);
  if (!m) return null;
  const n = Number(m[0]);
  if (n < min || n > max) return null;
  return String(n);
}

export function extraerOrdinal(s: string, tabla: Record<string, string>): string | null {
  const m = s.match(/\b(PRIMERO|PRIMER|SEGUNDO|TERCERO|TERCER|CUARTO|QUINTO|SEXTO|SEPTIMO|OCTAVO)\b/);
  return m ? (tabla[m[1]] ?? null) : null;
}

/** Normaliza el texto del curso al mismo criterio que usa dia_curso.ts. */
export function limpiarCurso(raw: string): string {
  return quitarTildes(raw).toUpperCase().replace(/[°º.]/g, " ").replace(/\s+/g, " ").trim();
}

export type CourseLevel = {
  ciclo: "basica" | "media";
  /** 1..8 en basica, 1..4 en media (I a IV). */
  nivel: number;
};

const ROMANO_A_NUMERO: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4 };

/**
 * Nivel del curso, o null si el texto no se reconoce.
 *
 * Reconoce "medio" tanto en romano ("II Medio", "III A") como en arabigo
 * ("2 Medio") y como ordinal escrito ("Segundo Medio"). Sin la palabra MEDIO,
 * un romano suelto igual cuenta como media: "III A" es un curso de tercero
 * medio, no de tercero basico (ese se escribe "3° Basico").
 */
export function parseCourseLevel(raw: string | null | undefined): CourseLevel | null {
  if (!raw) return null;
  const limpio = limpiarCurso(raw);
  if (!limpio) return null;

  const esMedio = /\bMEDIO\b/.test(limpio);

  // El nivel esta SIEMPRE antes de la palabra del ciclo ("2 Medio B", "5
  // Basico I"). Buscarlo en la cadena completa hacia confundible la LETRA del
  // curso con un nivel: "2 MEDIO I" se leia como I medio, y "5 BASICO I" como
  // I medio en vez de 5 basico.
  const cabeza = esMedio ? antesDe(limpio, /\bMEDIO\b/) : antesDe(limpio, /\bBASICA?O?\b/);

  if (esMedio) {
    // Puede venir romano ("II Medio"), arabigo ("2 Medio") u ordinal escrito
    // ("Segundo Medio").
    const romano = extraerRomano(cabeza);
    if (romano) return { ciclo: "media", nivel: ROMANO_A_NUMERO[romano] };
    const digito = extraerDigito(cabeza, 1, 4);
    if (digito) return { ciclo: "media", nivel: Number(digito) };
    const ordinal = extraerOrdinal(cabeza, ORDINAL_A_ROMANO);
    return ordinal ? { ciclo: "media", nivel: ROMANO_A_NUMERO[ordinal] } : null;
  }

  const digito = extraerDigito(cabeza, 1, 8);
  if (digito) return { ciclo: "basica", nivel: Number(digito) };

  const ordinal = extraerOrdinal(cabeza, ORDINAL_A_ARABIGO);
  if (ordinal) return { ciclo: "basica", nivel: Number(ordinal) };

  // Romano sin digito ni palabra de ciclo: "III A" es tercero medio (un tercero
  // basico se escribe "3 Basico").
  const romano = extraerRomano(cabeza);
  if (romano) return { ciclo: "media", nivel: ROMANO_A_NUMERO[romano] };

  return null;
}

/** Lo que va antes de la palabra del ciclo; la cadena entera si no aparece
 *  (un curso puede escribirse "8 B" o "III A", sin decir basico ni medio). */
function antesDe(limpio: string, palabra: RegExp): string {
  const m = limpio.match(palabra);
  if (!m || m.index === undefined) return limpio;
  return limpio.slice(0, m.index).trim();
}

/**
 * Que equivalencias tiene sentido mostrar para un curso.
 *
 * - 1° basico a II medio: PAES y SIMCE.
 * - III y IV medio: solo PAES (es el nivel donde el puntaje PAES es el que
 *   importa; el SIMCE ya no se rinde ahi).
 * - Curso irreconocible: ambas. No se esconde informacion por no haber
 *   entendido el texto que el profesor escribio.
 */
export function equivalencesForCourse(raw: string | null | undefined): { paes: boolean; simce: boolean } {
  const level = parseCourseLevel(raw);
  if (!level) return { paes: true, simce: true };
  if (level.ciclo === "media" && level.nivel >= 3) return { paes: true, simce: false };
  return { paes: true, simce: true };
}
