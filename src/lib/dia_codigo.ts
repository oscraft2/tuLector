/**
 * Mapeo de una respuesta de desarrollo (open_answers) al "codigo" que pide la
 * plataforma DIA para preguntas abiertas: 2 = correcta, 1 = parcialmente
 * correcta, 0 = incorrecta O en blanco/no responde -- confirmado en vivo
 * contra la pauta de correccion oficial de DIA (ago 2026, ver
 * docs/plan-dia-abiertas.md).
 *
 * Solo usa `confirmed_points` (nunca `puntaje`, la sugerencia de la IA sin
 * confirmar) -- mismo principio que quiz_score.ts: "la IA sugiere, el
 * profesor decide". Y lo que el profesor confirma MANDA, haya o no lectura de
 * la IA: antes se exigia ademas `transcripcion` y `legible`, asi que un 2 de 2
 * puesto a mano en la calificacion rapida salia como 0 hacia DIA.
 */
export type DiaCodigoOpenAnswer = {
  transcripcion: string | null;
  legible: boolean | null;
  confirmed_points: number | null;
  max_points: number | null;
};

export type DiaRevision = {
  /** false = nadie la ha confirmado (o no hay maximo para convertir el
   *  puntaje): su codigo 0 NO significa "incorrecta". */
  revisada: boolean;
  codigo: 0 | 1 | 2;
};

/** `maxRubrica` tiene prioridad sobre el maximo guardado en la fila, igual que
 *  en la pantalla de calificacion rapida (quizzes/[id]/abiertas). */
export function diaRevisionAbierta(oa: DiaCodigoOpenAnswer | null | undefined, maxRubrica?: number | null): DiaRevision {
  const confirmed = oa?.confirmed_points;
  const max = Number(maxRubrica) > 0 ? Number(maxRubrica) : Number(oa?.max_points);
  if (confirmed == null || !Number.isFinite(Number(confirmed)) || !Number.isFinite(max) || max <= 0) {
    return { revisada: false, codigo: 0 };
  }

  const puntos = Number(confirmed);
  if (puntos >= max) return { revisada: true, codigo: 2 };
  if (puntos > 0) return { revisada: true, codigo: 1 };
  return { revisada: true, codigo: 0 };
}

export function diaCodigoParaAbierta(oa: DiaCodigoOpenAnswer | null | undefined, maxRubrica?: number | null): 0 | 1 | 2 {
  return diaRevisionAbierta(oa, maxRubrica).codigo;
}

/**
 * Respuesta de la pauta de una pregunta de completacion, tomada del texto
 * "Respuesta correcta: ..." de su rubrica. DIA corrige estas preguntas contra
 * el valor escrito, asi que a quien el profesor marco como correcto se le
 * sube este valor. Formatos que devuelve: "36", "-70", "3/20" y "0;-2" (par
 * ordenado). null = la rubrica no trae una respuesta reconocible.
 */
export function respuestaPautaCompletacion(rubric: string | null | undefined): string | null {
  const m = /^\s*Respuesta correcta:\s*([\s\S]*)/i.exec((rubric ?? "").replace(/−/g, "-"));
  if (!m) return null;
  const texto = m[1];
  const numero = "-?\\d+(?:[.,]\\d+)?";

  const par = new RegExp(`^\\(\\s*(${numero})\\s*[;,]\\s*(${numero})\\s*\\)`).exec(texto);
  if (par) return `${par[1]};${par[2]}`;

  const fraccion = /^(-?\d+)\s*\/\s*(\d+)/.exec(texto);
  if (fraccion) return `${fraccion[1]}/${fraccion[2]}`;

  const simple = new RegExp(`^(${numero})`).exec(texto);
  return simple ? simple[1] : null;
}
