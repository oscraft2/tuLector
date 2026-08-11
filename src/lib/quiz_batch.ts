/**
 * A que ensayo pertenece una hoja escaneada, cuando los ensayos se crearon
 * TODOS JUNTOS (lote multi-curso, ver `batch_id` en createQuiz).
 *
 * El caso real: se imprimio la hoja del 2° Medio E y con ella se corrigio todo
 * el nivel. Hasta ahora el resultado seguia a la HOJA -- habia un re-enrutado
 * por `sheet_code` que mandaba todo al ensayo del 2E -- asi que el 2E aparecia
 * con 23 alumnos y al 2C le faltaban los suyos. Con un lote, el resultado tiene
 * que seguir al ALUMNO: su RUT dice su curso, y su curso dice en que ensayo del
 * lote va la hoja, sin importar con cual se corrigio.
 *
 * Un ensayo creado por separado (sin `batch_id`) NUNCA se re-enruta: ahi no hay
 * lote del cual elegir y la hoja se queda donde se escaneo.
 */

export type BatchQuiz = { id: string; batch_id?: string | null; course_id?: string | null };

export type RerouteDecision<Q extends BatchQuiz> =
  | { kind: "same"; quiz: Q }
  /** La hoja se mueve al ensayo del lote que corresponde al curso del alumno. */
  | { kind: "rerouted"; quiz: Q; from: Q }
  /** Hay lote y el alumno tiene curso, pero ese curso no tiene ensayo en el lote. */
  | { kind: "no_sibling"; quiz: Q };

/**
 * Elige el ensayo final para una hoja ya leida.
 *
 * `siblings` son las filas del mismo `batch_id` (incluida la actual). Es una
 * funcion pura para poder probar la regla sin base de datos.
 */
export function resolveQuizForStudent<Q extends BatchQuiz>(
  current: Q,
  studentCourseId: string | null | undefined,
  siblings: readonly Q[],
): RerouteDecision<Q> {
  // Sin lote no hay nada que decidir: el ensayo es el que se escaneo.
  if (!current.batch_id) return { kind: "same", quiz: current };
  // Alumno sin curso (o sin identificar): no hay criterio para mover la hoja.
  if (!studentCourseId) return { kind: "same", quiz: current };
  // Ya esta en el ensayo de su curso.
  if (current.course_id === studentCourseId) return { kind: "same", quiz: current };

  const target = siblings.find(
    (q) => q.batch_id === current.batch_id && q.course_id === studentCourseId && q.id !== current.id,
  );
  if (!target) return { kind: "no_sibling", quiz: current };
  return { kind: "rerouted", quiz: target, from: current };
}
