"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parse } from "csv-parse/sync";
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

/** Siguiente sheet_code correlativo del colegio (1,2,3…). Cabe en los 20 bits del
 * codigo de hoja del motor; el indice unico (school_id, sheet_code) evita choques. */
async function nextSheetCode(
  supabase: Awaited<ReturnType<typeof getDashboardContext>>["supabase"],
  schoolId: string,
): Promise<number> {
  const { data } = await supabase
    .from("quizzes")
    .select("sheet_code")
    .eq("school_id", schoolId)
    .not("sheet_code", "is", null)
    .order("sheet_code", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((data?.sheet_code as number | null) ?? 0) + 1;
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
  // Nº de columnas: derivado (misma heuristica que ya usaba el lector). El sobre
  // valido es 1 col <=40 y 2 col >=12; con <=40 preguntas siempre cae bien.
  const numColumns = numQuestions > 30 ? 2 : 1;

  // sheet_code: correlativo por colegio (cabe en los 20 bits del codigo de hoja del
  // motor). Ata la hoja impresa a su ensayo para verificar "hoja correcta" al escanear.
  const SHEET_CODE_MAX = 0xfffff; // 1.048.575
  const baseCode = await nextSheetCode(supabase, school.id);

  const insertQuiz = (sheetCode: number) =>
    supabase.from("quizzes").insert({
      school_id: school.id,
      user_id: user.id,
      created_by: user.id,
      title,
      num_questions: numQuestions,
      options_per_question: numOptions,
      num_columns: numColumns,
      sheet_code: Math.min(sheetCode, SHEET_CODE_MAX),
      option_labels: optionLabelsFor(numOptions).split("").join(","),
      answer_key: answerKey,
      subject: String(formData.get("subject") ?? "") || null,
      grade: String(formData.get("grade") ?? "") || null,
      evaluation_type: evalType,
      evaluation_variant: evalVariant,
    });

  // Reintento acotado ante colision del indice unico (school_id, sheet_code).
  let attempt = 0;
  while (true) {
    const { error } = await insertQuiz(baseCode + attempt);
    if (!error) break;
    if (error.code === "23505" && attempt < 3) { attempt++; continue; } // unique_violation
    throw new Error(error.message);
  }
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

export type DashboardActionState = {
  status: "idle" | "success" | "error";
  title?: string;
  message?: string;
  emoji?: string;
  key?: number;
};

function actionSuccess(title: string, message: string, emoji = "✓"): DashboardActionState {
  return { status: "success", title, message, emoji, key: Date.now() };
}

function actionError(error: unknown, title = "No se pudo completar"): DashboardActionState {
  return { status: "error", title, message: error instanceof Error ? error.message : "Intenta nuevamente.", emoji: "!", key: Date.now() };
}

type StudentPayload = {
  school_id: string;
  user_id: string;
  student_id: string;
  rut: string;
  name: string;
  course: string | null;
  updated_at: string;
};

async function saveStudentWithoutConstraint(
  supabase: Awaited<ReturnType<typeof getDashboardContext>>["supabase"],
  payload: StudentPayload
) {
  const { data: existing, error: findError } = await supabase
    .from("students")
    .select("id")
    .eq("school_id", payload.school_id)
    .eq("student_id", payload.student_id)
    .maybeSingle();

  if (findError) throw new Error(findError.message);

  if (existing?.id) {
    const { error } = await supabase
      .from("students")
      .update({
        user_id: payload.user_id,
        rut: payload.rut,
        name: payload.name,
        course: payload.course,
        updated_at: payload.updated_at,
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from("students").insert(payload);
  if (error) throw new Error(error.message);
}

type StudentCsvRow = {
  rut: string;
  name: string;
  course: string | null;
  grade: string | null;
};

function normalizeCsvHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function findHeaderIndex(headers: string[], aliases: readonly string[]) {
  const normalizedAliases = new Set(aliases.map(normalizeCsvHeader));
  return headers.findIndex((header) => normalizedAliases.has(normalizeCsvHeader(header)));
}

function parseStudentCsv(csv: string): StudentCsvRow[] {
  const parsed = parse(csv, {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  }) as string[][];

  if (parsed.length === 0) return [];

  const firstRow = parsed[0] ?? [];
  const rutIndex = findHeaderIndex(firstRow, ["rut", "run", "student_id", "id alumno", "identificador"]);
  const nameIndex = findHeaderIndex(firstRow, ["nombre", "name", "alumno", "estudiante", "nombre completo"]);
  const courseIndex = findHeaderIndex(firstRow, ["curso", "course", "grupo", "seccion", "sección"]);
  const gradeIndex = findHeaderIndex(firstRow, ["nivel", "grade", "grado"]);
  const hasHeader = rutIndex >= 0 && nameIndex >= 0 && courseIndex >= 0;
  const dataRows = hasHeader ? parsed.slice(1) : parsed;

  return dataRows.map((row) => {
    if (hasHeader) {
      return {
        rut: row[rutIndex]?.trim() ?? "",
        name: row[nameIndex]?.trim() ?? "",
        course: row[courseIndex]?.trim() || null,
        grade: gradeIndex >= 0 ? row[gradeIndex]?.trim() || null : null,
      };
    }

    const legacyCourseIndex = row.length <= 4 ? 2 : row.length - 1;
    const legacyGrade = row.length === 4 ? row[3]?.trim() || null : null;

    return {
      rut: row[0]?.trim() ?? "",
      name: row[1]?.trim() ?? "",
      course: row.length >= 3 ? row[legacyCourseIndex]?.trim() || null : null,
      grade: legacyGrade,
    };
  });
}

/** Asegura que el curso exista en la tabla `courses` (find-or-insert, robusto
 * ante constraint ausente). Esto mantiene SINCRONIZADO el catalogo de cursos con
 * los alumnos: un curso escrito al crear/importar alumnos queda disponible para
 * asociarlo a un ensayo. Devuelve el id del curso. */
async function findOrCreateCourse(
  supabase: Awaited<ReturnType<typeof getDashboardContext>>["supabase"],
  schoolId: string,
  name: string,
  grade?: string | null
): Promise<string | null> {
  const clean = name.trim();
  if (!clean) return null;

  const { data: existing, error: findError } = await supabase
    .from("courses")
    .select("id")
    .eq("school_id", schoolId)
    .eq("name", clean)
    .maybeSingle();
  if (findError) throw new Error(findError.message);
  if (existing?.id) return existing.id;

  const { data: inserted, error } = await supabase
    .from("courses")
    .insert({ school_id: schoolId, name: clean, grade: (grade || "").trim() || "Sin nivel" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return inserted.id;
}

export async function importStudents(_prevState: DashboardActionState, formData: FormData): Promise<DashboardActionState> {
  const { supabase, user, school } = await getDashboardContext();

  try {
    const csv = String(formData.get("csv") ?? "");
    const courseGrades = new Map<string, string>();
    const payload = parseStudentCsv(csv).map((row) => {
      if (!row.rut || !row.name || !validateRut(row.rut)) return null;
      const course = row.course;
      if (course && row.grade && !courseGrades.has(course)) courseGrades.set(course, row.grade);

      return {
        school_id: school.id,
        user_id: user.id,
        student_id: normalizeRut(row.rut),
        rut: normalizeRut(row.rut),
        name: row.name,
        course,
        updated_at: new Date().toISOString(),
      };
    }).filter((row): row is NonNullable<typeof row> => row !== null);

    if (payload.length === 0) throw new Error("No hay alumnos validos para importar. Revisa RUT, nombre y curso.");

    // Sincroniza el catalogo de cursos: cada curso del CSV queda registrado en
    // `courses` para poder asociarlo a un ensayo (antes solo quedaba como texto).
    const cursos = [...new Set(payload.map((p) => p.course).filter((c): c is string => !!c))];
    for (const curso of cursos) {
      await findOrCreateCourse(supabase, school.id, curso, courseGrades.get(curso));
    }

    for (const student of payload) {
      await saveStudentWithoutConstraint(supabase, student);
    }

    revalidatePath("/dashboard/students");
    revalidatePath("/dashboard/quizzes");
    const cursoMsg = cursos.length ? ` en ${cursos.length} curso${cursos.length === 1 ? "" : "s"}` : "";
    return actionSuccess("Importacion lista", `${payload.length} alumno${payload.length === 1 ? "" : "s"} importado${payload.length === 1 ? "" : "s"} o actualizado${payload.length === 1 ? "" : "s"}${cursoMsg}.`);
  } catch (error) {
    return actionError(error, "No se pudo importar");
  }
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

export async function createCourse(_prevState: DashboardActionState, formData: FormData): Promise<DashboardActionState> {
  const { supabase, school } = await getDashboardContext();

  try {
    const name = String(formData.get("name") ?? "").trim();
    const grade = String(formData.get("grade") ?? "").trim();

    if (!name || !grade) throw new Error("Nombre y nivel son obligatorios.");

    const { error } = await supabase.from("courses").insert({
      school_id: school.id,
      name,
      grade,
    });
    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/students");
    revalidatePath("/dashboard/quizzes");
    return actionSuccess("Curso creado", `${name} quedo disponible para asociar alumnos.`, "✓");
  } catch (error) {
    return actionError(error, "No se pudo crear el curso");
  }
}

export async function deleteCourse(_prevState: DashboardActionState, formData: FormData): Promise<DashboardActionState> {
  const { supabase, school } = await getDashboardContext();
  try {
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Falta el curso a eliminar.");

    const { data: course, error: findError } = await supabase
      .from("courses")
      .select("name")
      .eq("id", id)
      .eq("school_id", school.id)
      .maybeSingle();
    if (findError) throw new Error(findError.message);

    const { error } = await supabase.from("courses").delete().eq("id", id).eq("school_id", school.id);
    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/students");
    revalidatePath("/dashboard/quizzes");
    return actionSuccess("Curso eliminado", `${course?.name ?? "El curso"} fue eliminado del catalogo.`, "🗑");
  } catch (error) {
    return actionError(error, "No se pudo eliminar el curso");
  }
}

export async function deleteStudent(_prevState: DashboardActionState, formData: FormData): Promise<DashboardActionState> {
  const { supabase, school } = await getDashboardContext();
  try {
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Falta el alumno a eliminar.");

    const { data: student, error: findError } = await supabase
      .from("students")
      .select("name")
      .eq("id", id)
      .eq("school_id", school.id)
      .maybeSingle();
    if (findError) throw new Error(findError.message);

    const { error } = await supabase.from("students").delete().eq("id", id).eq("school_id", school.id);
    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/students");
    return actionSuccess("Alumno eliminado", `${student?.name ?? "El alumno"} fue eliminado del establecimiento.`, "🗑");
  } catch (error) {
    return actionError(error, "No se pudo eliminar el alumno");
  }
}

export async function updateStudentCourse(_prevState: DashboardActionState, formData: FormData): Promise<DashboardActionState> {
  const { supabase, school, isAdmin } = await getDashboardContext();

  try {
    if (!isAdmin) throw new Error("Solo admin puede editar cursos.");

    const studentId = String(formData.get("student_id") ?? "").trim();
    const course = String(formData.get("course") ?? "").trim();
    if (!studentId) throw new Error("Selecciona un alumno.");

    const { data: student, error: findError } = await supabase
      .from("students")
      .select("name")
      .eq("id", studentId)
      .eq("school_id", school.id)
      .maybeSingle();
    if (findError) throw new Error(findError.message);
    if (!student) throw new Error("Alumno no encontrado.");

    if (course) await findOrCreateCourse(supabase, school.id, course);

    const { error } = await supabase
      .from("students")
      .update({ course: course || null, updated_at: new Date().toISOString() })
      .eq("id", studentId)
      .eq("school_id", school.id);
    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/students");
    revalidatePath("/dashboard/quizzes");
    return course
      ? actionSuccess("Alumno agregado al curso", `${student.name} quedo en ${course}.`, "✓")
      : actionSuccess("Alumno quitado del curso", `${student.name} quedo sin curso asignado.`, "✓");
  } catch (error) {
    return actionError(error, "No se pudo actualizar el curso");
  }
}
export async function createStudent(_prevState: DashboardActionState, formData: FormData): Promise<DashboardActionState> {
  const { supabase, user, school } = await getDashboardContext();

  try {
    const name = String(formData.get("name") ?? "").trim();
    const rut = String(formData.get("rut") ?? "").trim();
    const course = String(formData.get("course") ?? "").trim();

    if (!name || !rut || !course) throw new Error("Nombre, RUT y curso son obligatorios.");
    if (!validateRut(rut)) throw new Error("El RUT chileno ingresado no es valido.");

    const normalized = normalizeRut(rut);

    // Asegura que el curso exista en el catalogo (por si vino de texto libre).
    await findOrCreateCourse(supabase, school.id, course);

    await saveStudentWithoutConstraint(supabase, {
      school_id: school.id,
      user_id: user.id,
      student_id: normalized,
      rut: normalized,
      name,
      course,
      updated_at: new Date().toISOString(),
    });

    revalidatePath("/dashboard/students");
    revalidatePath("/dashboard/quizzes");
    return actionSuccess("Alumno agregado", `${name} quedo registrado en ${course}.`, "✓");
  } catch (error) {
    return actionError(error, "No se pudo agregar el alumno");
  }
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

  await saveStudentWithoutConstraint(supabase, {
    school_id: school.id,
    user_id: user.id,
    student_id: normalized,
    rut: normalized,
    name,
    course,
    updated_at: new Date().toISOString(),
  });

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



