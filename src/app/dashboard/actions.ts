"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDashboardContext } from "@/lib/supabase_server";
import { validateRut, normalizeRut } from "@/lib/rut";
import {
  QUIZ_ALLOWED_OPTIONS,
  QUIZ_MAX_QUESTIONS,
  QUIZ_MIN_QUESTIONS,
  normalizeAnswerKeyForOptions,
  normalizeQuestionCount,
  normalizeQuizOptions,
  optionLabelsFor,
} from "@/lib/quiz_constraints";
import { countryDefaults, resolveCountryProfile } from "@/lib/country_profiles";

export async function updateLocale(formData: FormData) {
  const { supabase, user } = await getDashboardContext();
  const locale = String(formData.get("locale") ?? "es-CL");
  if (!["es-CL", "en", "pt-BR"].includes(locale)) return;
  await supabase.from("profiles").upsert({ user_id: user.id, locale, updated_at: new Date().toISOString() });
  revalidatePath("/dashboard");
}

export async function createQuiz(formData: FormData) {
  const { supabase, user, school } = await getDashboardContext();
  const title = String(formData.get("title") ?? "").trim();
  const requestedQuestions = Number(formData.get("num_questions") ?? 20);
  const requestedOptions = Number(formData.get("options_per_question") ?? 5);
  if (!Number.isInteger(requestedQuestions) || requestedQuestions < QUIZ_MIN_QUESTIONS || requestedQuestions > QUIZ_MAX_QUESTIONS) {
    throw new Error("El lector movil soporta entre 1 y 40 preguntas.");
  }
  if (!QUIZ_ALLOWED_OPTIONS.includes(requestedOptions as (typeof QUIZ_ALLOWED_OPTIONS)[number])) {
    throw new Error("El lector movil soporta 3, 4 o 5 opciones.");
  }
  const numQuestions = normalizeQuestionCount(formData.get("num_questions"));
  const numOptions = normalizeQuizOptions(formData.get("options_per_question"));
  const answerKey = normalizeAnswerKeyForOptions(formData.get("answer_key_clean") ?? formData.get("answer_key"), numOptions);
  if (!title) throw new Error("Ingresa un titulo para el ensayo.");
  if (answerKey.length !== numQuestions) throw new Error("La clave debe coincidir con el numero de preguntas y las opciones del formato.");
  await supabase.from("quizzes").insert({
    school_id: school.id,
    user_id: user.id,
    created_by: user.id,
    title,
    num_questions: numQuestions,
    options_per_question: numOptions,
    option_labels: optionLabelsFor(numOptions).split("").join(","),
    answer_key: answerKey,
    subject: String(formData.get("subject") ?? "") || null,
    grade: String(formData.get("grade") ?? "") || null,
  });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/quizzes");
}

export async function archiveQuiz(formData: FormData) {
  const { supabase } = await getDashboardContext();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await supabase.from("quizzes").update({ archived_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/dashboard/quizzes");
}

export async function duplicateQuiz(formData: FormData) {
  const { supabase, user, school } = await getDashboardContext();
  const id = String(formData.get("id") ?? "");
  const { data } = await supabase.from("quizzes").select("*").eq("id", id).single();
  if (!data) return;
  await supabase.from("quizzes").insert({
    school_id: school.id,
    user_id: user.id,
    created_by: user.id,
    title: `${data.title} copia`,
    num_questions: data.num_questions,
    options_per_question: data.options_per_question,
    option_labels: data.option_labels,
    answer_key: data.answer_key,
    subject: data.subject,
    grade: data.grade,
    duplicated_from: data.id,
  });
  revalidatePath("/dashboard/quizzes");
}

export async function importStudents(formData: FormData) {
  const { supabase, user, school } = await getDashboardContext();
  const csv = String(formData.get("csv") ?? "");
  const rows = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const payload = rows.slice(rows[0]?.toLowerCase().includes("rut") ? 1 : 0).map((line) => {
    const [rutRaw, nameRaw, courseRaw] = line.split(",").map((cell) => cell?.trim() ?? "");
    if (!rutRaw || !nameRaw || !validateRut(rutRaw)) return null;
    return {
      school_id: school.id,
      user_id: user.id,
      student_id: normalizeRut(rutRaw),
      rut: normalizeRut(rutRaw),
      name: nameRaw,
      grade: courseRaw || null,
      course: courseRaw || null,
      updated_at: new Date().toISOString(),
    };
  }).filter((row): row is NonNullable<typeof row> => row !== null);
  if (payload.length === 0) throw new Error("No hay alumnos validos para importar.");
  await supabase.from("students").upsert(payload, { onConflict: "school_id,student_id" });
  revalidatePath("/dashboard/students");
}

export async function inviteMember(formData: FormData) {
  const { supabase, user, school, isAdmin } = await getDashboardContext();
  if (!isAdmin) throw new Error("Solo admin puede invitar miembros.");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "teacher");
  if (!email || !["admin", "teacher", "viewer"].includes(role)) return;
  await supabase.from("invitations").insert({ school_id: school.id, email, role, invited_by: user.id });
  revalidatePath("/dashboard/team");
}

export async function revokeMember(formData: FormData) {
  const { supabase, isAdmin } = await getDashboardContext();
  if (!isAdmin) throw new Error("Solo admin puede revocar miembros.");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await supabase.from("school_members").delete().eq("id", id);
  revalidatePath("/dashboard/team");
}

export async function updateSchoolSettings(formData: FormData) {
  const { supabase, school, isAdmin } = await getDashboardContext();
  if (!isAdmin) throw new Error("Solo admin puede editar configuracion del colegio.");
  const country = resolveCountryProfile(String(formData.get("country_code") ?? "CL"));
  const defaults = countryDefaults(country.code);
  await supabase.from("schools").update({
    name: String(formData.get("name") ?? school.name),
    subdomain: String(formData.get("subdomain") ?? "") || null,
    country_code: country.code,
    region: String(formData.get("region") ?? "") || null,
    city: String(formData.get("city") ?? "") || null,
    branding_primary_color: String(formData.get("branding_primary_color") ?? "#111827"),
    timezone: String(formData.get("timezone") ?? country.timezone),
    ...defaults,
    updated_at: new Date().toISOString(),
  }).eq("id", school.id);
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
}

export async function logExport(formData: FormData) {
  const { supabase, user, school, isAdmin } = await getDashboardContext();
  if (!isAdmin) throw new Error("Solo admin puede exportar datos sensibles.");
  await supabase.from("export_logs").insert({
    school_id: school.id,
    user_id: user.id,
    export_type: String(formData.get("export_type") ?? "csv"),
    entity_type: String(formData.get("entity_type") ?? "dashboard"),
    reason: String(formData.get("reason") ?? "exportacion solicitada desde dashboard"),
  });
  revalidatePath("/dashboard");
}


export async function startScanForQuiz(formData: FormData) {
  const { supabase } = await getDashboardContext();
  const quizId = String(formData.get("quiz_id") ?? "");
  if (!quizId) throw new Error("Selecciona un ensayo.");
  const { data, error } = await supabase.from("quizzes").select("id").eq("id", quizId).is("archived_at", null).single();
  if (error || !data) throw new Error("No tienes acceso a ese ensayo.");
  const cookieStore = await cookies();
  cookieStore.set("tulector_active_quiz", quizId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  redirect("/scan");
}

