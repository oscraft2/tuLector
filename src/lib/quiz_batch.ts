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

export type BatchQuiz = {
  id: string;
  batch_id?: string | null;
  course_id?: string | null;
  answer_key?: string | null;
  num_questions?: number | null;
};

/** Clave suficientemente larga como para que coincidir por casualidad sea irreal. */
const MIN_KEY_LEN = 10;

/**
 * ¿Son la MISMA prueba impresa para dos cursos distintos?
 *
 * El `batch_id` es la señal directa, pero no siempre está (ensayos creados antes
 * de esa columna, o cuyo insert cayó a un fallback). Por eso vale también la
 * señal de contenido: misma clave de respuestas y mismo número de preguntas es,
 * en la práctica, el mismo instrumento — que es lo que el profesor quiere decir
 * con "los creé todos juntos". Dos ensayos genuinamente distintos no comparten
 * una clave de 39 letras, así que un ensayo independiente nunca entra aquí.
 */
export function isSameInstrument(a: BatchQuiz, b: BatchQuiz): boolean {
  if (a.id === b.id) return false;
  if (a.batch_id && b.batch_id && a.batch_id === b.batch_id) return true;
  const key = String(a.answer_key ?? "");
  return (
    key.length >= MIN_KEY_LEN &&
    key === String(b.answer_key ?? "") &&
    Number(a.num_questions ?? 0) === Number(b.num_questions ?? 0)
  );
}

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
  // Alumno sin curso (o sin identificar): no hay criterio para mover la hoja.
  if (!studentCourseId) return { kind: "same", quiz: current };
  // Ya esta en el ensayo de su curso.
  if (current.course_id === studentCourseId) return { kind: "same", quiz: current };

  const family = siblings.filter((q) => isSameInstrument(current, q));
  // Sin hermanos no hay lote: el ensayo es independiente y la hoja se queda.
  if (family.length === 0) return { kind: "same", quiz: current };

  const target = family.find((q) => q.course_id === studentCourseId);
  if (!target) return { kind: "no_sibling", quiz: current };
  return { kind: "rerouted", quiz: target, from: current };
}

/**
 * Ensayos hermanos de este, en el mismo colegio: por lote si lo hay, y si no,
 * por contenido identico. Devuelve `[]` cuando el ensayo es independiente.
 */
/** Builder minimo de PostgREST: lo justo que usa esta consulta. El cast queda
 *  encapsulado aqui para no arrastrar los genericos del cliente de Supabase. */
type Filter = {
  eq: (column: string, value: unknown) => Filter;
  is: (column: string, value: unknown) => PromiseLike<{ data: unknown }>;
};
type QuizTable = { select: (columns: string) => Filter };

export async function fetchSiblingQuizzes<Q extends BatchQuiz>(
  supabase: { from: (table: string) => unknown },
  schoolId: string,
  quiz: Q,
  columns: string,
): Promise<Q[]> {
  const table = () => supabase.from("quizzes") as QuizTable;
  const others = (data: unknown) => ((data ?? []) as Q[]).filter((q) => q.id !== quiz.id);

  if (quiz.batch_id) {
    const { data } = await table()
      .select(columns)
      .eq("school_id", schoolId)
      .eq("batch_id", quiz.batch_id)
      .is("archived_at", null);
    const rows = others(data);
    if (rows.length > 0) return rows;
  }

  const key = String(quiz.answer_key ?? "");
  if (key.length < MIN_KEY_LEN) return [];
  const { data } = await table()
    .select(columns)
    .eq("school_id", schoolId)
    .eq("answer_key", key)
    .eq("num_questions", Number(quiz.num_questions ?? 0))
    .is("archived_at", null);
  return others(data);
}
