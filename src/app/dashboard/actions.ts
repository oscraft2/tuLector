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
import { sendTemplatedEmail } from "@/lib/email";
import { calculateGrade } from "@/lib/latam";
import type { DashboardSchool } from "@/lib/supabase_server";

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
  const evalType = String(formData.get("evaluation_type") ?? "custom");
  const evalVariant = String(formData.get("evaluation_variant") ?? "") || null;
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
    evaluation_type: evalType,
    evaluation_variant: evalVariant,
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
  const { supabase, user, school, isAdmin, locale } = await getDashboardContext();
  if (!isAdmin) throw new Error("Solo admin puede invitar miembros.");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "teacher");
  if (!email || !["admin", "teacher", "viewer"].includes(role)) return;

  const { data, error } = await supabase
    .from("invitations")
    .insert({ school_id: school.id, email, role, invited_by: user.id })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Error al crear la invitación: ${error.message}`);
  }

  if (data) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const inviteLink = `${siteUrl}/auth?mode=register&invite_id=${data.id}`;

    await sendTemplatedEmail({
      to: email,
      templateKey: "invitation",
      locale,
      variables: {
        invited_by_email: user.email ?? "Un administrador",
        school_name: school.name,
        role: role === "admin" ? "Administrador" : role === "teacher" ? "Profesor" : "Observador",
        invite_link: inviteLink,
      },
    });
  }

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
    rbd: String(formData.get("rbd") ?? "") || null,
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

export async function switchActiveSchool(formData: FormData) {
  const { supabase, user } = await getDashboardContext();
  const schoolId = String(formData.get("school_id") ?? "");
  if (!schoolId) return;

  const { data: membership } = await supabase
    .from("school_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (membership) {
    const cookieStore = await cookies();
    cookieStore.set("tulector_active_school_id", schoolId, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function createCourse(formData: FormData) {
  const { supabase, school } = await getDashboardContext();
  const name = String(formData.get("name") ?? "").trim();
  const grade = String(formData.get("grade") ?? "").trim();

  if (!name || !grade) throw new Error("Nombre y curso son obligatorios.");

  await supabase.from("courses").insert({
    school_id: school.id,
    name,
    grade,
  });

  revalidatePath("/dashboard/students");
  revalidatePath("/dashboard/quizzes");
}

export async function deleteCourse(formData: FormData) {
  const { supabase } = await getDashboardContext();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("courses").delete().eq("id", id);

  revalidatePath("/dashboard/students");
  revalidatePath("/dashboard/quizzes");
}

export async function createStudent(formData: FormData) {
  const { supabase, user, school } = await getDashboardContext();
  const name = String(formData.get("name") ?? "").trim();
  const rut = String(formData.get("rut") ?? "").trim();
  const course = String(formData.get("course") ?? "").trim();

  if (!name || !rut || !course) throw new Error("Nombre, RUT y curso son obligatorios.");
  if (!validateRut(rut)) throw new Error("El RUT chileno ingresado no es válido.");

  const normalized = normalizeRut(rut);

  await supabase.from("students").upsert({
    school_id: school.id,
    user_id: user.id,
    student_id: normalized,
    rut: normalized,
    name,
    grade: course,
    course,
    updated_at: new Date().toISOString(),
  }, { onConflict: "school_id,student_id" });

  revalidatePath("/dashboard/students");
}

// Comparte la logica entre "asignar alumno existente" y "crear alumno y asignar":
// actualiza el paper en revision manual y su grade_record. status "corrected" al
// identificar por RUT/nombre sigue el mismo patron que usa /api/scan/result
// (colisiona en el nombre con corrected_answers/corrected_by, pensadas para
// correccion manual de respuestas; deuda tecnica conocida, no se resuelve aqui).
async function assignPaperToStudent(
  supabase: Awaited<ReturnType<typeof getDashboardContext>>["supabase"],
  school: DashboardSchool,
  paperId: string,
  studentCode: string,
  studentName: string
) {
  const { data: paper, error } = await supabase
    .from("papers")
    .update({
      student_id: studentCode,
      student_name: studentName,
      status: "corrected",
    })
    .eq("id", paperId)
    .eq("school_id", school.id)
    .select("id,quiz_id,score,total")
    .single();
  if (error || !paper) throw new Error("No se pudo actualizar el paper.");

  const gradeResult = calculateGrade(paper.score ?? 0, paper.total ?? 0, school.country_code ?? "CL", {
    gradeScale: {
      min: school.grading_scale_min ?? 1.0,
      max: school.grading_scale_max ?? 7.0,
    },
    passingGrade: school.passing_grade ?? 4.0,
    exigencia: school.exigencia ?? 0.60,
  });

  await supabase.from("grade_records").upsert({
    school_id: school.id,
    student_code: studentCode,
    quiz_id: paper.quiz_id,
    paper_id: paper.id,
    raw_score: paper.score,
    total_questions: paper.total,
    calculated_grade: gradeResult.grade,
    passing: gradeResult.passing,
    graded_at: new Date().toISOString(),
  }, { onConflict: "school_id,student_code,quiz_id" });

  return paper.quiz_id as string;
}

export async function assignPaperStudent(formData: FormData) {
  const { supabase, school } = await getDashboardContext();
  const paperId = String(formData.get("paper_id") ?? "").trim();
  const studentCode = String(formData.get("student_id") ?? "").trim();
  if (!paperId || !studentCode) throw new Error("Faltan datos para asignar el alumno.");

  const { data: student } = await supabase
    .from("students")
    .select("student_id,name")
    .eq("school_id", school.id)
    .or(`student_id.eq.${studentCode},rut.eq.${studentCode}`)
    .maybeSingle();
  if (!student) throw new Error("Alumno no encontrado.");

  const quizId = await assignPaperToStudent(supabase, school, paperId, studentCode, student.name);

  revalidatePath("/dashboard/papers");
  revalidatePath(`/dashboard/papers/${paperId}`);
  revalidatePath(`/dashboard/results/${quizId}`);
}

export async function createStudentAndAssignPaper(formData: FormData) {
  const { supabase, user, school } = await getDashboardContext();
  const paperId = String(formData.get("paper_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const rut = String(formData.get("rut") ?? "").trim();
  const course = String(formData.get("course") ?? "").trim();

  if (!paperId || !name || !rut || !course) throw new Error("Nombre, RUT y curso son obligatorios.");
  if (!validateRut(rut)) throw new Error("El RUT chileno ingresado no es válido.");

  const normalized = normalizeRut(rut);

  await supabase.from("students").upsert({
    school_id: school.id,
    user_id: user.id,
    student_id: normalized,
    rut: normalized,
    name,
    grade: course,
    course,
    updated_at: new Date().toISOString(),
  }, { onConflict: "school_id,student_id" });

  const quizId = await assignPaperToStudent(supabase, school, paperId, normalized, name);

  revalidatePath("/dashboard/students");
  revalidatePath("/dashboard/papers");
  revalidatePath(`/dashboard/papers/${paperId}`);
  revalidatePath(`/dashboard/results/${quizId}`);
}

export async function disconnectSchool() {
  const { supabase, user, school } = await getDashboardContext();

  await supabase
    .from("school_members")
    .delete()
    .eq("user_id", user.id)
    .eq("school_id", school.id);

  const cookieStore = await cookies();
  cookieStore.delete("tulector_active_school_id");

  revalidatePath("/dashboard");
  redirect("/dashboard");
}



