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
