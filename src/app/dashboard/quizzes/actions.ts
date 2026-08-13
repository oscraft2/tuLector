"use server";

import { revalidatePath } from "next/cache";
import { getDashboardContext } from "@/lib/supabase_server";
import { getSiteUrl } from "@/lib/site_url";
import { sendTemplatedEmail } from "@/lib/email";
import { planHasFeature } from "@/lib/plan_gates";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { fetchUserEmails } from "@/lib/quiz_shares";
import type { DashboardActionState } from "@/app/dashboard/actions";

/**
 * Compartir un ensayo con otros docentes del colegio (plan school).
 *
 * Viven aparte de dashboard/actions.ts, igual que papers/actions.ts: aca solo
 * hay permisos, forma del formulario y avisos. El acceso real lo concede la RLS
 * (supabase/migrations/20260815000000_quiz_shares.sql) — sin fila `accepted` en
 * `quiz_shares` nadie ve nada, y con ella el invitado escanea hojas que caen en
 * el MISMO ensayo, que es el punto de toda la feature.
 */

const SHARED_PATH = "/dashboard/quizzes/compartidos";

function ok(title: string, message: string, emoji = "✓"): DashboardActionState {
  return { status: "success", title, message, emoji, key: Date.now() };
}

function fail(error: unknown, title = "No se pudo completar"): DashboardActionState {
  return { status: "error", title, message: error instanceof Error ? error.message : "Intenta nuevamente.", emoji: "!", key: Date.now() };
}

/** Rutas que cambian cuando alguien gana o pierde acceso a un ensayo. */
function revalidateShareSurfaces(quizId?: string) {
  revalidatePath(SHARED_PATH);
  revalidatePath("/dashboard/quizzes");
  revalidatePath("/dashboard/papers");
  revalidatePath("/dashboard");
  revalidatePath("/app");
  revalidatePath("/app/scan");
  revalidatePath("/app/compartidos");
  if (quizId) {
    revalidatePath(`/dashboard/quizzes/${quizId}`);
    revalidatePath(`/dashboard/results/${quizId}`);
  }
}

/**
 * Notificacion in-app para OTRO usuario. Va con service role a proposito: la
 * policy `notifications_user` deja escribir solo la propia (o al admin del
 * colegio), asi que un docente no puede insertarle una notificacion a su
 * colega. Mismo camino que src/lib/quota_alerts.ts.
 */
async function notifyUser(input: {
  userId: string;
  schoolId: string;
  type: string;
  title: string;
  body: string;
  link: string;
}) {
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("notifications").insert({
      user_id: input.userId,
      school_id: input.schoolId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
    });
    if (error) console.warn("[quiz_shares] notificacion no insertada:", error.message);
  } catch (error) {
    // Sin SUPABASE_SERVICE_ROLE_KEY no hay notificacion in-app, pero la
    // compartición y el correo siguen su curso. No se propaga.
    console.warn("[quiz_shares] notificacion omitida:", error instanceof Error ? error.message : error);
  }
}

/** El ensayo, si esta cuenta puede compartirlo (dueño o admin del colegio). */
async function loadShareableQuiz(quizId: string) {
  const ctx = await getDashboardContext();
  if (!planHasFeature(ctx.school.plan, "quiz_sharing")) {
    throw new Error("Compartir ensayos esta disponible en el plan Colegio.");
  }
  const { data: quiz, error } = await ctx.supabase
    .from("quizzes")
    .select("id,title,created_by,school_id")
    .eq("id", quizId)
    .eq("school_id", ctx.school.id)
    .maybeSingle();
  if (error || !quiz) throw new Error("Ensayo no encontrado.");
  if (quiz.created_by !== ctx.user.id && !ctx.isAdmin) {
    throw new Error("Solo el docente que creo el ensayo (o un administrador) puede compartirlo.");
  }
  return { ctx, quiz: quiz as { id: string; title: string | null; created_by: string | null; school_id: string } };
}

export async function shareQuiz(_prevState: DashboardActionState, formData: FormData): Promise<DashboardActionState> {
  try {
    const quizId = String(formData.get("quiz_id") ?? "").trim();
    if (!quizId) throw new Error("Falta el ensayo a compartir.");
    const targets = formData.getAll("user_ids").map((v) => String(v).trim()).filter(Boolean);
    if (targets.length === 0) throw new Error("Elige al menos un docente.");

    const { ctx, quiz } = await loadShareableQuiz(quizId);
    const { supabase, user, school, locale } = ctx;

    // Solo miembros de ESTE colegio, y nunca uno mismo.
    const { data: members } = await supabase
      .from("school_members")
      .select("user_id")
      .eq("school_id", school.id);
    const memberIds = new Set((members ?? []).map((m: { user_id: string }) => m.user_id));
    const recipients = targets.filter((id) => memberIds.has(id) && id !== user.id && id !== quiz.created_by);
    if (recipients.length === 0) throw new Error("Ninguno de los docentes elegidos pertenece a este colegio.");

    // Comparticiones vivas: se saltan en vez de chocar contra el indice unico
    // quiz_shares_live_uk (y asi "compartir de nuevo" a un grupo donde uno ya
    // tenia acceso no falla entero).
    const { data: liveRows } = await supabase
      .from("quiz_shares")
      .select("shared_with,status")
      .eq("quiz_id", quizId)
      .in("status", ["pending", "accepted"]);
    const already = new Set((liveRows ?? []).map((r: { shared_with: string }) => r.shared_with));
    const fresh = recipients.filter((id) => !already.has(id));
    if (fresh.length === 0) throw new Error("Esos docentes ya tienen este ensayo compartido o pendiente de aceptar.");

    const { error: insertError } = await supabase.from("quiz_shares").insert(
      fresh.map((id) => ({
        quiz_id: quizId,
        school_id: school.id,
        shared_by: user.id,
        shared_with: id,
      })),
    );
    if (insertError) throw new Error(insertError.message);

    const emails = await fetchUserEmails(fresh);
    const quizTitle = quiz.title ?? "Ensayo";
    const acceptLink = `${getSiteUrl()}${SHARED_PATH}`;
    let emailsSent = 0;

    for (const id of fresh) {
      await notifyUser({
        userId: id,
        schoolId: school.id,
        type: "share",
        title: "Te compartieron un ensayo",
        body: `${user.email ?? "Un docente"} te compartio "${quizTitle}". Acepta para verlo y escanear sus hojas.`,
        link: SHARED_PATH,
      });
      const to = emails.get(id);
      if (!to) continue;
      const result = await sendTemplatedEmail({
        to,
        templateKey: "quiz_shared",
        locale,
        variables: {
          shared_by_email: user.email ?? "Un docente",
          quiz_title: quizTitle,
          school_name: school.name,
          accept_link: acceptLink,
        },
      });
      if (result.success) emailsSent += 1;
    }

    revalidateShareSurfaces(quizId);

    const plural = fresh.length === 1 ? "" : "s";
    if (emailsSent < fresh.length) {
      // Igual que inviteMember: la compartición ya existe y se puede aceptar
      // desde la campana o desde "Compartidos", aunque el correo no salga.
      return ok(
        "Ensayo compartido",
        `Se compartio con ${fresh.length} docente${plural}. Algun correo no se pudo enviar; igual les llega el aviso dentro de TuLector.`,
        "⚠",
      );
    }
    return ok("Ensayo compartido", `Se aviso por correo y dentro de la app a ${fresh.length} docente${plural}. Cada uno debe aceptar para ver el ensayo.`, "🤝");
  } catch (error) {
    return fail(error, "No se pudo compartir");
  }
}

/** El invitado acepta: desde aca la RLS le abre el ensayo y puede escanear. */
export async function acceptQuizShare(_prevState: DashboardActionState, formData: FormData): Promise<DashboardActionState> {
  try {
    const { supabase, user, school, locale } = await getDashboardContext();
    const id = String(formData.get("share_id") ?? "").trim();
    if (!id) throw new Error("Falta la compartición.");

    const { data: share } = await supabase
      .from("quiz_shares")
      .select("id,quiz_id,shared_by,shared_with,status")
      .eq("id", id)
      .maybeSingle();
    if (!share) throw new Error("Esta compartición ya no existe.");
    if (share.shared_with !== user.id) throw new Error("Esta compartición no es para tu cuenta.");
    if (share.status !== "pending") throw new Error("Esta compartición ya fue respondida.");

    const { error } = await supabase
      .from("quiz_shares")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);

    // Recien ahora se puede leer el ensayo (la policy shared_quizzes_read
    // depende de este `accepted`), asi que el titulo se pide despues.
    const { data: quiz } = await supabase.from("quizzes").select("title").eq("id", share.quiz_id).maybeSingle();
    const quizTitle = quiz?.title ?? "Ensayo";

    if (share.shared_by) {
      await notifyUser({
        userId: share.shared_by,
        schoolId: school.id,
        type: "share",
        title: "Aceptaron tu ensayo compartido",
        body: `${user.email ?? "Un docente"} acepto "${quizTitle}" y ya puede escanear sus hojas.`,
        link: `/dashboard/quizzes/${share.quiz_id}`,
      });
      const emails = await fetchUserEmails([share.shared_by]);
      const to = emails.get(share.shared_by);
      if (to) {
        await sendTemplatedEmail({
          to,
          templateKey: "quiz_share_accepted",
          locale,
          variables: {
            accepted_by_email: user.email ?? "Un docente",
            quiz_title: quizTitle,
            quiz_link: `${getSiteUrl()}/dashboard/quizzes/${share.quiz_id}`,
          },
        });
      }
    }

    revalidateShareSurfaces(share.quiz_id);
    return ok("Ensayo aceptado", `Ya puedes ver "${quizTitle}" y escanear sus hojas: quedan en el mismo ensayo.`, "🤝");
  } catch (error) {
    return fail(error, "No se pudo aceptar");
  }
}

export async function declineQuizShare(_prevState: DashboardActionState, formData: FormData): Promise<DashboardActionState> {
  try {
    const { supabase, user } = await getDashboardContext();
    const id = String(formData.get("share_id") ?? "").trim();
    if (!id) throw new Error("Falta la compartición.");

    const { data: share } = await supabase
      .from("quiz_shares")
      .select("id,quiz_id,shared_with,status")
      .eq("id", id)
      .maybeSingle();
    if (!share) throw new Error("Esta compartición ya no existe.");
    if (share.shared_with !== user.id) throw new Error("Esta compartición no es para tu cuenta.");
    if (share.status !== "pending") throw new Error("Esta compartición ya fue respondida.");

    const { error } = await supabase
      .from("quiz_shares")
      .update({ status: "declined", responded_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);

    revalidateShareSurfaces(share.quiz_id);
    return ok("Compartición rechazada", "No veras este ensayo. Quien te lo compartio puede volver a intentarlo.", "🚫");
  } catch (error) {
    return fail(error, "No se pudo rechazar");
  }
}

/**
 * El dueño (o el admin) corta el acceso. Las hojas que el invitado ya escaneo
 * SE QUEDAN en el ensayo: son datos del colegio y borrarlas destruiria
 * resultados reales de alumnos. Solo se corta el acceso hacia adelante.
 */
export async function revokeQuizShare(_prevState: DashboardActionState, formData: FormData): Promise<DashboardActionState> {
  try {
    const { supabase, user, isAdmin } = await getDashboardContext();
    const id = String(formData.get("share_id") ?? "").trim();
    if (!id) throw new Error("Falta la compartición.");

    const { data: share } = await supabase
      .from("quiz_shares")
      .select("id,quiz_id,shared_by,status")
      .eq("id", id)
      .maybeSingle();
    if (!share) throw new Error("Esta compartición ya no existe.");
    if (share.shared_by !== user.id && !isAdmin) throw new Error("Solo quien compartio el ensayo (o un administrador) puede revocarlo.");
    if (share.status === "revoked") throw new Error("Esta compartición ya estaba revocada.");

    const { error } = await supabase
      .from("quiz_shares")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);

    revalidateShareSurfaces(share.quiz_id);
    return ok("Acceso revocado", "Ese docente ya no vera el ensayo. Las hojas que alcanzo a escanear siguen en el ensayo.", "🗑");
  } catch (error) {
    return fail(error, "No se pudo revocar");
  }
}
