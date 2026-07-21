// Mapa central de features premium por plan. Toda decisión "¿este plan puede
// usar X?" vive acá — el gating previo era ad-hoc (ej. team/page.tsx compara
// school.plan a mano). Para agregar una feature de pago nueva basta sumar una
// entrada; los endpoints/páginas la consultan con planHasFeature().
export type PaidFeature = "dia_sync";

const PLAN_FEATURES: Record<PaidFeature, ReadonlyArray<string>> = {
  // Sync automático de ensayos con la extensión de Chrome para la plataforma
  // DIA (dia-bot-extension). El export manual del CSV (export-dia, botón del
  // dashboard) sigue libre en starter a propósito: el CSV manual es el gancho,
  // la automatización es lo premium.
  dia_sync: ["pro", "school"],
};

export function planHasFeature(plan: string | null | undefined, feature: PaidFeature): boolean {
  return PLAN_FEATURES[feature].includes(plan ?? "");
}
