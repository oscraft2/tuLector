/**
 * Heuristica minima para llevar el "curso" (texto libre que el profesor escribe
 * al crear un ensayo, ej. "2do medio C", "6to Basico A") al formato que usa la
 * plataforma DIA (nivel + letra separados por espacio: basico = numero arabico
 * 1-8, medio = numero romano I-IV, ej. "II C", "6 A"). No toca `quizzes.grade`
 * ni la tabla `courses` -- se usa SOLO al exportar (ExportCsvButton), asi el
 * resto de la app sigue mostrando el texto que el profesor escribio.
 *
 * Si no logra reconocer el patron devuelve el texto original sin tocar: mejor
 * mostrar el original (revisable a simple vista, el profesor lo corrige a
 * mano en el CSV) que adivinar mal o dejar la celda vacia.
 */

// El parseo del texto del curso vive en course_level.ts, que tambien lo usa
// para decidir que equivalencias mostrar. Se comparte en vez de duplicarse: dos
// heuristicas de curso divergiendo es como se termina con el CSV de DIA y la
// tabla de resultados leyendo el mismo "2do medio C" de forma distinta.
import {
  ORDINAL_A_ROMANO, ORDINAL_A_ARABIGO,
  extraerRomano, extraerDigito, extraerOrdinal, limpiarCurso,
} from "./course_level";

const YA_FORMATO_DIA = /^(?:[1-8]|I{1,3}|IV)\s+[A-Z]$/;

export function normalizarCursoDIA(raw: string | null | undefined): string {
  if (!raw) return "";
  const original = raw.trim();
  if (!original) return "";

  const limpio = limpiarCurso(original);

  if (YA_FORMATO_DIA.test(limpio)) return limpio;

  // Lookbehind (no consume) para que `match.index` sea justo la posicion de
  // la letra -- asi "6B" (sin espacio) tambien se reconoce (resto="6"), pero
  // "2MC" no (la "M" antes de la "C" no es digito/espacio/inicio -> ambiguo,
  // se deja intacto en vez de adivinar).
  const letraMatch = limpio.match(/(?<=^|[\s0-9])([A-Z])$/);
  if (!letraMatch || letraMatch.index === undefined) return original;
  const letra = letraMatch[1];
  const resto = limpio.slice(0, letraMatch.index).trim();
  if (!resto) return original;

  const esMedio = /\bMEDIO\b/.test(resto);

  if (esMedio) {
    const nivel = extraerRomano(resto) ?? (extraerDigito(resto, 1, 4) ? ["", "I", "II", "III", "IV"][Number(extraerDigito(resto, 1, 4))] : null) ?? extraerOrdinal(resto, ORDINAL_A_ROMANO);
    return nivel ? `${nivel} ${letra}` : original;
  }

  const nivel = extraerDigito(resto, 1, 8) ?? extraerOrdinal(resto, ORDINAL_A_ARABIGO);
  return nivel ? `${nivel} ${letra}` : original;
}
