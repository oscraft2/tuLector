// Config centralizada de tipos de evaluacion (quizzes.evaluation_type).
// Hoy solo CL usa "paes"/"simce" (ver supabase/migrations/20260627000000_paes_simce.sql,
// trigger calculate_paper_results que calcula equivalent_score con estas mismas escalas).
// Agregar un pais/sistema nuevo despues es sumar una entrada aca, no tocar JSX
// en cada pagina que hoy repite `evType === "paes" ? "PAES" : ...`.

export type EvaluationTypeKey = "custom" | "paes" | "simce";

export const EVALUATION_TYPES: Record<EvaluationTypeKey, { label: string; unit: string; scoreRange?: [number, number] }> = {
  custom: { label: "Personalizado", unit: "%" },
  paes: { label: "PAES", unit: "pts", scoreRange: [100, 1000] },
  simce: { label: "SIMCE", unit: "pts", scoreRange: [100, 400] },
};

export function isNotaType(evType: string | null | undefined): boolean {
  return evType !== "paes" && evType !== "simce";
}

export function evaluationLabel(evType: string | null | undefined): string {
  return EVALUATION_TYPES[(evType as EvaluationTypeKey) ?? "custom"]?.label ?? "Personalizado";
}

export function scoreDisplay(evType: string | null | undefined, pct: number, equivalentScore: number | null | undefined): string {
  if (isNotaType(evType)) return `${Math.round(pct)}%`;
  const unit = EVALUATION_TYPES[evType as EvaluationTypeKey]?.unit ?? "pts";
  const value = equivalentScore ?? Math.round(pct);
  return `${value} ${unit}`;
}

export const EVALUATION_VARIANT_LABELS: Record<string, string> = {
  paes_m1: "PAES Competencia Matematica 1 (M1)",
  paes_m2: "PAES Competencia Matematica 2 (M2)",
  paes_lectora: "PAES Competencia Lectora",
  paes_ciencias: "PAES Ciencias",
  paes_historia: "PAES Historia",
  simce_4b_mate: "SIMCE 4° Basico - Matematica",
  simce_4b_lectura: "SIMCE 4° Basico - Lectura",
  simce_8b_mate: "SIMCE 8° Basico - Matematica",
  simce_8b_lectura: "SIMCE 8° Basico - Lectura",
  simce_2m_mate: "SIMCE II Medio - Matematica",
  simce_2m_lectura: "SIMCE II Medio - Lectura",
};

export function evaluationVariantLabel(variant: string | null | undefined): string {
  if (!variant) return "Personalizado";
  return EVALUATION_VARIANT_LABELS[variant] ?? variant;
}
