export type PrivacyLevel = "full_name" | "initials_only" | "id_only";

export function resolveDisplayName(
  studentName: string | null,
  studentId: string | null,
  privacyLevel: PrivacyLevel,
): string {
  if (privacyLevel === "id_only") {
    return studentId ? `Estudiante #${studentId}` : "Sin identificar";
  }
  if (privacyLevel === "initials_only") {
    const source = studentName ?? studentId;
    if (!source) return "Sin identificar";
    return source
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + ".")
      .join("");
  }
  return studentName ?? studentId ?? "Sin identificar";
}

export function privacyLabel(level: PrivacyLevel): string {
  if (level === "initials_only") return "Iniciales";
  if (level === "id_only") return "Solo ID";
  return "Completo";
}
