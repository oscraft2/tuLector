export type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

export function isMissingColumnError(error: SupabaseErrorLike | null | undefined, column: string) {
  if (!error) return false;
  const text = [error.message, error.details, error.hint].filter(Boolean).join(" ").toLowerCase();
  const expected = column.toLowerCase();

  return text.includes(expected) && (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    text.includes("could not find") ||
    text.includes("column")
  );
}

/** Igual que isMissingColumnError pero para una TABLA entera ausente (ej. una
 * migracion nueva todavia no aplicada en produccion, ver
 * docs/plan-multipagina-fase1.md). Codigos: 42P01 (Postgres) / PGRST205 (PostgREST). */
export function isMissingTableError(error: SupabaseErrorLike | null | undefined, table: string) {
  if (!error) return false;
  const text = [error.message, error.details, error.hint].filter(Boolean).join(" ").toLowerCase();
  const expected = table.toLowerCase();

  return text.includes(expected) && (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    text.includes("could not find the table") ||
    text.includes("does not exist")
  );
}
