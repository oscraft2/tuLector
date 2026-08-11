/**
 * Modo de hoja del ensayo (columna `quizzes.sheet_mode`, migracion
 * 20260811000000_quiz_sheet_mode.sql).
 *
 *   full    → hoja completa de TuLector (todo lo existente, default).
 *   compact → BLOQUE OMR COMPACTO que el profesor pega dentro de su propia
 *             prueba de Word/Canva (sub-motor src/tulector/compact_block.ts).
 *
 * Vive fuera del motor a proposito: aca estan las reglas de PRODUCTO (que
 * ensayo puede usar bloque compacto y con que mensaje se explica si no), no la
 * geometria. Los limites duros vienen de compact_layout.ts, que es la unica
 * fuente de verdad de lo que fisicamente cabe en el bloque.
 */
import { COMPACT_MAX_QUESTIONS, maxQuestionsFor, minColumnsFor } from "@/tulector/compact_layout";

export type SheetMode = "full" | "compact";

export const SHEET_MODES: readonly SheetMode[] = ["full", "compact"] as const;

/** Nº maximo de opciones por pregunta que dibuja el bloque compacto. */
export const COMPACT_MAX_OPTIONS = 5;

export { COMPACT_MAX_QUESTIONS, maxQuestionsFor, minColumnsFor };

/** Normaliza cualquier valor (form, API, BD vieja) a un modo valido. */
export function parseSheetMode(value: unknown): SheetMode {
  return String(value ?? "") === "compact" ? "compact" : "full";
}

/**
 * Motivo por el que un ensayo NO puede usar bloque compacto, o null si puede.
 * Se usa igual en el servidor (validacion de createQuiz/updateQuiz) y en la UI
 * (para deshabilitar la opcion antes de enviar, en vez de corregirla callada).
 */
export function compactModeIssue(numQuestions: number, numOptions: number, openCount = 0): string | null {
  if (numQuestions > COMPACT_MAX_QUESTIONS) {
    return `El bloque compacto llega hasta ${COMPACT_MAX_QUESTIONS} preguntas (este ensayo tiene ${numQuestions}). Usa la hoja completa.`;
  }
  if (numOptions > COMPACT_MAX_OPTIONS) {
    return `El bloque compacto llega hasta ${COMPACT_MAX_OPTIONS} opciones por pregunta.`;
  }
  if (openCount > 0) {
    // El bloque dibuja SOLO burbujas: no tiene fila "Resolver al reverso" ni
    // pagina de reverso donde escribir. Permitirlo imprimiria burbujas para una
    // pregunta que se responde escribiendo.
    return "El bloque compacto no admite preguntas de desarrollo (no tiene reverso). Usa la hoja completa.";
  }
  return null;
}
