/**
 * Comparticiones de ensayos entre docentes del mismo colegio.
 *
 * La RLS es la que hace el trabajo pesado (ver
 * supabase/migrations/20260815000000_quiz_shares.sql): con una fila `accepted`
 * en `quiz_shares`, el invitado ve el ensayo y puede escanear hojas que quedan
 * en el MISMO quiz_id. Aca solo viven las consultas que necesitan las pantallas
 * y los server actions, para no repetirlas en cinco archivos.
 *
 * Todo degrada en silencio si la migracion no esta aplicada todavia
 * (isMissingTableError): sin la tabla no hay comparticiones y las pantallas se
 * comportan exactamente como antes, en vez de reventar.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTableError } from "@/lib/supabase_errors";

export type QuizShareStatus = "pending" | "accepted" | "declined" | "revoked";

export type QuizShareRow = {
  id: string;
  quiz_id: string;
  school_id: string;
  shared_by: string | null;
  shared_with: string;
  status: QuizShareStatus;
  created_at: string;
  responded_at: string | null;
};

const SHARE_SELECT = "id,quiz_id,school_id,shared_by,shared_with,status,created_at,responded_at";

type Db = Pick<SupabaseClient, "from">;

/** Comparticiones dirigidas a este usuario, en los estados pedidos. */
export async function fetchSharesForUser(
  supabase: Db,
  schoolId: string,
  userId: string,
  statuses: QuizShareStatus[] = ["pending", "accepted"],
): Promise<QuizShareRow[]> {
  const { data, error } = await supabase
    .from("quiz_shares")
    .select(SHARE_SELECT)
    .eq("school_id", schoolId)
    .eq("shared_with", userId)
    .in("status", statuses)
    .order("created_at", { ascending: false });
  if (error) {
    if (!isMissingTableError(error, "quiz_shares")) console.warn("[quiz_shares] fetchSharesForUser:", error.message);
    return [];
  }
  return (data ?? []) as QuizShareRow[];
}

/** Comparticiones que ESTE usuario repartio (para la pestaña "compartidos por mi"). */
export async function fetchSharesByUser(
  supabase: Db,
  schoolId: string,
  userId: string,
  statuses: QuizShareStatus[] = ["pending", "accepted"],
): Promise<QuizShareRow[]> {
  const { data, error } = await supabase
    .from("quiz_shares")
    .select(SHARE_SELECT)
    .eq("school_id", schoolId)
    .eq("shared_by", userId)
    .in("status", statuses)
    .order("created_at", { ascending: false });
  if (error) {
    if (!isMissingTableError(error, "quiz_shares")) console.warn("[quiz_shares] fetchSharesByUser:", error.message);
    return [];
  }
  return (data ?? []) as QuizShareRow[];
}

/** Comparticiones vivas de UN ensayo (panel de compartir del detalle). */
export async function fetchSharesForQuiz(
  supabase: Db,
  quizId: string,
  statuses: QuizShareStatus[] = ["pending", "accepted"],
): Promise<QuizShareRow[]> {
  const { data, error } = await supabase
    .from("quiz_shares")
    .select(SHARE_SELECT)
    .eq("quiz_id", quizId)
    .in("status", statuses)
    .order("created_at", { ascending: false });
  if (error) {
    if (!isMissingTableError(error, "quiz_shares")) console.warn("[quiz_shares] fetchSharesForQuiz:", error.message);
    return [];
  }
  return (data ?? []) as QuizShareRow[];
}

/**
 * Ids de los ensayos ACEPTADOS por este usuario. Es lo que necesitan las
 * pantallas para distinguir "esto es mio" de "esto me lo compartieron" (y el
 * scope del admin, que filtra por created_by y si no los perderia de vista).
 */
export async function sharedQuizIdsFor(
  supabase: Db,
  schoolId: string,
  userId: string,
): Promise<string[]> {
  const rows = await fetchSharesForUser(supabase, schoolId, userId, ["accepted"]);
  return rows.map((row) => row.quiz_id);
}

/** Cuantas comparticiones esperan respuesta (badge del APK y del dashboard). */
export async function countPendingShares(supabase: Db, schoolId: string, userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("quiz_shares")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("shared_with", userId)
    .eq("status", "pending");
  if (error) return 0;
  return count ?? 0;
}

export type QuizSummary = {
  id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  num_questions: number | null;
};

/**
 * Titulo y formato de los ensayos de una lista.
 *
 * Va con service role a proposito: una compartición PENDIENTE todavia no abre
 * la RLS (`shared_quizzes_read` exige `accepted`), asi que con la sesion del
 * invitado la pantalla mostraria "Ensayo" a secas y tendria que aceptar a
 * ciegas. Solo se piden los ensayos cuyos ids ya vienen de SUS comparticiones,
 * asi que no expone nada que no le hayan ofrecido.
 */
export async function fetchQuizSummaries(quizIds: string[]): Promise<Map<string, QuizSummary>> {
  const summaries = new Map<string, QuizSummary>();
  const unique = [...new Set(quizIds.filter(Boolean))];
  if (unique.length === 0) return summaries;
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabaseAdmin");
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("quizzes")
      .select("id,title,subject,grade,num_questions")
      .in("id", unique);
    for (const row of data ?? []) {
      summaries.set(String(row.id), {
        id: String(row.id),
        title: (row.title as string | null) ?? "Ensayo",
        subject: (row.subject as string | null) ?? null,
        grade: (row.grade as string | null) ?? null,
        num_questions: (row.num_questions as number | null) ?? null,
      });
    }
  } catch { /* sin service role: la pantalla cae al titulo generico */ }
  return summaries;
}

/**
 * Correos de un puñado de usuarios. `auth.users` solo se lee con service role,
 * igual que en fetchTeacherOptions (src/lib/teacher_scope.ts) y en la ficha de
 * miembro del equipo. Si falta el service role, se cae al id recortado en vez
 * de romper la pagina: el correo es una etiqueta, no el contenido.
 */
export async function fetchUserEmails(userIds: string[]): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return emails;
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabaseAdmin");
    const admin = createSupabaseAdminClient();
    await Promise.all(
      unique.map(async (id) => {
        try {
          const { data } = await admin.auth.admin.getUserById(id);
          if (data?.user?.email) emails.set(id, data.user.email);
        } catch { /* usuario borrado en auth */ }
      }),
    );
  } catch { /* sin service role configurado */ }
  return emails;
}

/** Etiqueta legible de un usuario: su correo o el id recortado. */
export function userLabel(userId: string | null, emails: Map<string, string>): string {
  if (!userId) return "Alguien del colegio";
  return emails.get(userId) ?? `${userId.slice(0, 8)}…`;
}
