/**
 * Calificacion masiva de preguntas abiertas (pantalla "Calificacion rapida").
 * Lo que se guarda aqui termina en la plataforma DIA, asi que las reglas viven
 * en funciones que se pueden probar: nunca sobre el maximo, nunca en hojas
 * ajenas o descartadas, y "solo sin revisar" nunca pisa un puntaje confirmado.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseOpenQuestions, parseOpenQuestionRubrics } from "@/lib/quiz_constraints";

export type ItemLote = { paperId: string; question: number; points: number };

export const MAX_ITEMS_LOTE = 3000;

export const claveCelda = (paperId: string, question: number) => `${paperId}:${question}`;

/** Filtro de estado, mirando solo las preguntas visibles. */
export function cumpleEstado(paperId: string, preguntas: number[], confirmadas: ReadonlySet<string>, estado: string): boolean {
  if (estado === "pendientes") return preguntas.some((q) => !confirmadas.has(claveCelda(paperId, q)));
  if (estado === "revisadas") return preguntas.every((q) => confirmadas.has(claveCelda(paperId, q)));
  return true;
}

/** Celdas a las que se aplicaria un mismo puntaje en toda la lista filtrada. */
export function celdasParaPuntaje(args: {
  paperIds: string[];
  preguntas: number[];
  puntos: number;
  maximos: ReadonlyMap<number, number>;
  confirmadas: ReadonlySet<string>;
  reemplazar: boolean;
}): { items: ItemLote[]; yaGuardadas: number; reemplazadas: number; sinMaximoSuficiente: number[] } {
  const sinMaximoSuficiente = args.preguntas.filter((q) => !((args.maximos.get(q) ?? 0) >= args.puntos));
  const aplicables = args.preguntas.filter((q) => !sinMaximoSuficiente.includes(q));
  const items: ItemLote[] = [];
  let yaGuardadas = 0;
  let reemplazadas = 0;
  for (const paperId of args.paperIds) {
    for (const question of aplicables) {
      const confirmada = args.confirmadas.has(claveCelda(paperId, question));
      if (confirmada && !args.reemplazar) { yaGuardadas++; continue; }
      if (confirmada) reemplazadas++;
      items.push({ paperId, question, points: args.puntos });
    }
  }
  return { items, yaGuardadas, reemplazadas, sinMaximoSuficiente };
}

/** Todo o nada: un solo dato invalido rechaza el lote completo. */
export function validarLote(
  entrada: unknown,
  papersValidos: ReadonlySet<string>,
  maximos: ReadonlyMap<number, number>,
): { items: ItemLote[] } | { error: string } {
  if (!Array.isArray(entrada) || entrada.length === 0) return { error: "No hay respuestas para guardar." };
  if (entrada.length > MAX_ITEMS_LOTE) return { error: `Son demasiadas respuestas juntas (máximo ${MAX_ITEMS_LOTE}). Filtra por curso.` };
  const unicas = new Map<string, ItemLote>();
  for (const crudo of entrada as Partial<ItemLote>[]) {
    const paperId = String(crudo?.paperId ?? "");
    const question = Number(crudo?.question);
    const points = crudo?.points;
    if (!papersValidos.has(paperId)) return { error: "Una de las hojas no pertenece a este ensayo o fue descartada. Recarga la página." };
    const maximo = maximos.get(question);
    if (!maximo) return { error: `La pregunta ${question} no es abierta o no tiene puntaje máximo configurado.` };
    if (typeof points !== "number" || !Number.isFinite(points) || points < 0 || points > maximo) {
      return { error: `Puntaje inválido en la pregunta ${question}: debe estar entre 0 y ${maximo}.` };
    }
    unicas.set(claveCelda(paperId, question), { paperId, question, points });
  }
  return { items: [...unicas.values()] };
}

const enTandas = <T,>(lista: T[], n: number): T[][] =>
  Array.from({ length: Math.ceil(lista.length / n) }, (_, i) => lista.slice(i * n, (i + 1) * n));

export type ResultadoLote =
  | { ok: true; guardadas: number; omitidas: number; paperIds: string[]; puntuaAbiertas: boolean }
  | { ok: false; error: string };

/** Valida contra la base de datos y guarda. No confia en nada del navegador
 *  salvo "que puntaje quiere poner en que celda". */
export async function guardarLoteAbiertas(
  db: SupabaseClient,
  args: { schoolId: string; quizId: string; items: unknown; soloSinRevisar: boolean; ahora: string },
): Promise<ResultadoLote> {
  const { data: quiz, error: quizError } = await db
    .from("quizzes").select("*").eq("id", args.quizId).eq("school_id", args.schoolId).single();
  if (quizError || !quiz) return { ok: false, error: "Ensayo no disponible." };

  const rubricas = parseOpenQuestionRubrics(quiz.open_question_rubrics ?? "");
  const maximos = new Map<number, number>();
  for (const q of parseOpenQuestions(quiz.open_questions ?? "", Number(quiz.num_questions) || 0)) {
    if ((rubricas[q]?.max_points ?? 0) > 0) maximos.set(q, rubricas[q].max_points);
  }

  const pedidas = Array.isArray(args.items)
    ? [...new Set((args.items as Partial<ItemLote>[]).map((i) => String(i?.paperId ?? "")))]
    : [];
  if (pedidas.length > MAX_ITEMS_LOTE) return { ok: false, error: "Son demasiadas hojas juntas. Filtra por curso." };
  const papersValidos = new Set<string>();
  for (const ids of enTandas(pedidas, 100)) {
    const { data, error } = await db
      .from("papers").select("id")
      .eq("quiz_id", args.quizId).eq("school_id", args.schoolId).neq("status", "void").in("id", ids);
    if (error) return { ok: false, error: "No se pudieron comprobar las hojas. No se guardó nada." };
    for (const row of data ?? []) papersValidos.add(String(row.id));
  }

  const validado = validarLote(args.items, papersValidos, maximos);
  if ("error" in validado) return { ok: false, error: validado.error };

  let items = validado.items;
  if (args.soloSinRevisar) {
    // Se vuelve a mirar aqui: alguien pudo calificar mientras la pantalla estaba abierta.
    const confirmadas = new Set<string>();
    for (const ids of enTandas([...new Set(items.map((i) => i.paperId))], 100)) {
      const { data, error } = await db.from("open_answers").select("paper_id,question,confirmed_points").in("paper_id", ids);
      if (error) return { ok: false, error: "No se pudieron leer los puntajes actuales. No se guardó nada." };
      for (const row of data ?? []) {
        if (row.confirmed_points != null) confirmadas.add(claveCelda(String(row.paper_id), Number(row.question)));
      }
    }
    items = items.filter((i) => !confirmadas.has(claveCelda(i.paperId, i.question)));
  }

  const filas = items.map((i) => ({
    school_id: args.schoolId,
    paper_id: i.paperId,
    question: i.question,
    confirmed_points: i.points,
    confirmed_at: args.ahora,
    max_points: maximos.get(i.question),
  }));
  let guardadas = 0;
  for (const tanda of enTandas(filas, 500)) {
    // Mismo upsert que confirmOpenAnswer: no toca transcripcion ni sugerencia de la IA.
    const { error } = await db.from("open_answers").upsert(tanda, { onConflict: "paper_id,question" });
    if (error) {
      return { ok: false, error: guardadas ? `Se guardaron ${guardadas} y falló el resto. Recarga para ver el estado.` : "No se pudo guardar. No se cambió nada." };
    }
    guardadas += tanda.length;
  }

  return {
    ok: true,
    guardadas,
    omitidas: validado.items.length - items.length,
    paperIds: [...new Set(items.map((i) => i.paperId))],
    puntuaAbiertas: quiz.score_open_questions === true,
  };
}
