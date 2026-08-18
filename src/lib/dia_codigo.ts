/**
 * Mapeo de una respuesta de desarrollo (open_answers) al "codigo" que pide la
 * plataforma DIA para preguntas abiertas: 2 = correcta, 1 = parcialmente
 * correcta, 0 = incorrecta O en blanco/no responde -- confirmado en vivo
 * contra la pauta de correccion oficial de DIA (ago 2026, ver
 * docs/plan-dia-abiertas.md). Un alumno que no escribio nada cae en 0, igual
 * que la propia definicion de DIA de "no responde".
 *
 * Solo usa `confirmed_points` (nunca `puntaje`, la sugerencia de la IA sin
 * confirmar) -- mismo principio que quiz_score.ts: "la IA sugiere, el
 * profesor decide". Si el profesor todavia no confirmo, el codigo queda en 0
 * en vez de adivinar.
 */
export type DiaCodigoOpenAnswer = {
  transcripcion: string | null;
  legible: boolean | null;
  confirmed_points: number | null;
  max_points: number | null;
};

export function diaCodigoParaAbierta(oa: DiaCodigoOpenAnswer | null | undefined): 0 | 1 | 2 {
  if (!oa) return 0;
  if (!oa.transcripcion?.trim() || oa.legible === false) return 0;

  const max = Number(oa.max_points);
  const confirmed = oa.confirmed_points;
  if (confirmed == null || !Number.isFinite(Number(confirmed)) || !Number.isFinite(max) || max <= 0) return 0;

  const puntos = Number(confirmed);
  if (puntos >= max) return 2;
  if (puntos > 0) return 1;
  return 0;
}
