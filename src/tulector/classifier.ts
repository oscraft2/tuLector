/**
 * Clasificador de burbuja entrenado (FASE 5). Reemplaza los pesos hechos a mano
 * del `score` de classifyBubble por pesos APRENDIDOS de datos reales.
 *
 * Flujo: confirmar lecturas (scan) → exportar (scripts/export_dataset.ts) →
 * entrenar (scripts/train_classifier.ts) → pegar los pesos acá → recalibrar
 * umbrales y validar con `npm run test:omr`.
 *
 * CLASSIFIER = null → el motor usa la HEURÍSTICA actual (default, cero cambio).
 * Solo se activa cuando haya datos reales suficientes y pase el test.
 */
export const CLASSIFIER: { w: number[]; b: number } | null = null;

/** Probabilidad de que la burbuja esté rellena (0..1), o null si no hay modelo. */
export function bubbleProbability(features: number[]): number | null {
  if (!CLASSIFIER) return null;
  let z = CLASSIFIER.b;
  for (let j = 0; j < features.length; j++) z += (CLASSIFIER.w[j] ?? 0) * features[j];
  return 1 / (1 + Math.exp(-z));
}
