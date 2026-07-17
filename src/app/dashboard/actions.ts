"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parse } from "csv-parse/sync";
import { getDashboardContext } from "@/lib/supabase_server";
import { normalizeRut } from "@/lib/rut";
import { resolveNationalId } from "@/lib/national_id";
import {
  QUIZ_ALLOWED_OPTIONS,
  QUIZ_MAX_QUESTIONS,
  QUIZ_MAX_QUESTIONS_MULTIPAGE,
  QUIZ_MIN_QUESTIONS,
  normalizeAnswerKeyForOptions,
  normalizeAnswerKeySlots,
  normalizeQuestionCount,
  normalizeQuizOptions,
  optionLabelsFor,
} from "@/lib/quiz_constraints";
import { countryDefaults, resolveCountryProfile } from "@/lib/country_profiles";
import { suggestColumns } from "@/lib/sheet_generator";
import { sendTemplatedEmail } from "@/lib/email";
import { calculateGrade } from "@/lib/latam";
import { computeQuizScore } from "@/lib/grading";
import type { DashboardSchool } from "@/lib/supabase_server";
import { isMissingColumnError } from "@/lib/supabase_errors";

export async function updateLocale(formData: FormData) {
  const { supabase, user } = await getDashboardContext();
  const locale = String(formData.get("locale") ?? "es-CL");
  if (!["es-CL", "en", "pt-BR"].includes(locale)) return;
  await supabase.from("profiles").upsert({ user_id: user.id, locale, updated_at: new Date().toISOString() });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath("/app/configuracion");
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

export async function createQuiz(_prevState: DashboardActionState, formData: FormData): Promise<DashboardActionState> {
  try {
    const { supabase, user, school } = await getDashboardContext();
    const title = String(formData.get("title") ?? "").trim();
    const requestedQuestions = Number(formData.get("num_questions") ?? 20);
    const requestedOptions = Number(formData.get("options_per_question") ?? 5);
    if (!Number.isInteger(requestedQuestions) || requestedQuestions < QUIZ_MIN_QUESTIONS || requestedQuestions > QUIZ_MAX_QUESTIONS_MULTIPAGE) {
      throw new Error(`El lector movil soporta entre ${QUIZ_MIN_QUESTIONS} y ${QUIZ_MAX_QUESTIONS_MULTIPAGE} preguntas (mas de ${QUIZ_MAX_QUESTIONS} se reparten en varias hojas).`);
    }
    if (!QUIZ_ALLOWED_OPTIONS.includes(requestedOptions as (typeof QUIZ_ALLOWED_OPTIONS)[number])) {
      throw new Error("El lector movil soporta 3, 4 o 5 opciones.");
    }
    const numQuestions = normalizeQuestionCount(formData.get("num_questions"));
    const numOptions = normalizeQuizOptions(formData.get("options_per_question"));
    const allowPartial = formData.get("allow_partial_key") === "on";
    const rawAnswerKey = formData.get("answer_key_clean") ?? formData.get("answer_key");
    const answerKey = allowPartial
      ? normalizeAnswerKeySlots(rawAnswerKey, numOptions, numQuestions)
      : normalizeAnswerKeyForOptions(rawAnswerKey, numOptions);
    const evalType = String(formData.get("evaluation_type") ?? "custom");
    const evalVariant = String(formData.get("evaluation_variant") ?? "") || null;
    const rawExigencia = formData.get("exigencia");
    const exigencia = rawExigencia ? Math.max(0, Math.min(1, Number(rawExigencia) || 0.60)) : null;
    if (!title) throw new Error("Ingresa un titulo para el ensayo.");
    if (!allowPartial && answerKey.length !== numQuestions) throw new Error("La clave debe coincidir con el numero de preguntas y las opciones del formato.");

    // N. de columnas derivado del tamano de UNA pagina (sobre seguro validado
    // por test:omr, ver sheet_generator.allowedColumns), no del total del
    // ensayo -- un ensayo multipagina de 250 preguntas se imprime/lee en
    // paginas de 100, cada una con su propio nº de columnas (bug real: antes
    // se derivaba del total, que para >100 preguntas cae fuera del sobre
    // seguro y da una config invalida). Ver docs/plan-multipagina-fase1.md.
    const numColumns = suggestColumns(Math.min(numQuestions, QUIZ_MAX_QUESTIONS));
    const SHEET_CODE_MAX = 0xfffff; // 1.048.575
    const baseCode = await nextSheetCode(supabase, school.id);
    const grade = String(formData.get("grade") ?? "") || null;
    const courseId = grade ? await findOrCreateCourse(supabase, school.id, grade) : null;
    const payload = {
      school_id: school.id,
      user_id: user.id,
      created_by: user.id,
      title,
      num_questions: numQuestions,
      options_per_question: numOptions,
      num_columns: numColumns,
      option_labels: optionLabelsFor(numOptions).split("").join(","),
      answer_key: answerKey,
      subject: String(formData.get("subject") ?? "") || null,
      grade,
      course_id: courseId,
      evaluation_type: evalType,
      evaluation_variant: evalVariant,
      ...(exigencia !== null ? { exigencia } : {}),
    };
    for (let attempt = 0; ; attempt++) {
      const insertPayload = { ...payload, sheet_code: Math.min(baseCode + attempt, SHEET_CODE_MAX) };
      let { error } = await supabase.from("quizzes").insert(insertPayload);
      if (error && isMissingColumnError(error, "course_id")) {
        error = (await supabase.from("quizzes").insert(withoutCourseId(insertPayload))).error;
      }
      if (!error) break;
      if (error.code === "23505" && attempt < 3) continue; // unique_violation -> reintenta
      throw new Error(error.message);
    }
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/quizzes");
    revalidatePath("/app/scan");
    return actionSuccess("Ensayo creado", `"${title}" quedo listo para generar su hoja.`, "✓");
  } catch (error) {
    return actionError(error, "No se pudo crear el ensayo");
  }
}

/**
 * Edita un ensayo ya creado (titulo, preguntas, opciones, clave de
 * respuestas, etc). Si la clave/preguntas/opciones cambian y el ensayo ya
 * tiene hojas escaneadas (`papers`), recalcula automaticamente el
 * score/nota de cada una contra la clave nueva (ya se guarda `papers.answers`
 * cruda por alumno) usando el mismo `computeQuizScore` que el escaneo en
 * vivo (`src/lib/grading.ts`) -- una sola formula de puntaje para ambos
 * caminos. La confirmacion explicita de que esto va a pasar la hace la UI
 * (ConfirmDialog) antes de enviar el form.
 */
export async function updateQuiz(_prevState: DashboardActionState, formData: FormData): Promise<DashboardActionState> {
  try {
    const { supabase, school } = await getDashboardContext();
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Falta el ensayo a editar.");

    const { data: existing, error: existingError } = await supabase
      .from("quizzes")
      .select("*")
      .eq("id", id)
      .eq("school_id", school.id)
      .single();
    if (existingError || !existing) throw new Error("Ensayo no encontrado.");

    const title = String(formData.get("title") ?? "").trim();
    const requestedQuestions = Number(formData.get("num_questions") ?? 20);
    const requestedOptions = Number(formData.get("options_per_question") ?? 5);
    if (!Number.isInteger(requestedQuestions) || requestedQuestions < QUIZ_MIN_QUESTIONS || requestedQuestions > QUIZ_MAX_QUESTIONS_MULTIPAGE) {
      throw new Error(`El lector movil soporta entre ${QUIZ_MIN_QUESTIONS} y ${QUIZ_MAX_QUESTIONS_MULTIPAGE} preguntas (mas de ${QUIZ_MAX_QUESTIONS} se reparten en varias hojas).`);
    }
    if (!QUIZ_ALLOWED_OPTIONS.includes(requestedOptions as (typeof QUIZ_ALLOWED_OPTIONS)[number])) {
      throw new Error("El lector movil soporta 3, 4 o 5 opciones.");
    }
    const numQuestions = normalizeQuestionCount(formData.get("num_questions"));
    const numOptions = normalizeQuizOptions(formData.get("options_per_question"));
    const allowPartial = formData.get("allow_partial_key") === "on";
    const rawAnswerKey = formData.get("answer_key_clean") ?? formData.get("answer_key");
    const answerKey = allowPartial
      ? normalizeAnswerKeySlots(rawAnswerKey, numOptions, numQuestions)
      : normalizeAnswerKeyForOptions(rawAnswerKey, numOptions);
    if (!title) throw new Error("Ingresa un titulo para el ensayo.");
    if (!allowPartial && answerKey.length !== numQuestions) throw new Error("La clave debe coincidir con el numero de preguntas y las opciones del formato.");

    const numColumns = suggestColumns(Math.min(numQuestions, QUIZ_MAX_QUESTIONS));
    const evalType = String(formData.get("evaluation_type") ?? "custom");
    const evalVariant = String(formData.get("evaluation_variant") ?? "") || null;
    const rawExigencia = formData.get("exigencia");
    const exigencia = rawExigencia ? Math.max(0, Math.min(1, Number(rawExigencia) || 0.60)) : null;
    const grade = String(formData.get("grade") ?? "") || null;
    const courseId = grade ? await findOrCreateCourse(supabase, school.id, grade) : existing.course_id ?? null;

    const updatePayload = {
      title,
      num_questions: numQuestions,
      options_per_question: numOptions,
      num_columns: numColumns,
      option_labels: optionLabelsFor(numOptions).split("").join(","),
      answer_key: answerKey,
      subject: String(formData.get("subject") ?? "") || null,
      grade,
      course_id: courseId,
      evaluation_type: evalType,
      evaluation_variant: evalVariant,
      updated_at: new Date().toISOString(),
      ...(exigencia !== null ? { exigencia } : {}),
    };

    const keyChanged = String(existing.answer_key ?? "") !== answerKey;
    const structureChanged = existing.num_questions !== numQuestions || existing.options_per_question !== numOptions;

    let { error: updateError } = await supabase.from("quizzes").update(updatePayload).eq("id", id);
    if (updateError && isMissingColumnError(updateError, "course_id")) {
      updateError = (await supabase.from("quizzes").update(withoutCourseId(updatePayload)).eq("id", id)).error;
    }
    if (updateError) throw new Error(updateError.message);

    let recorrected = 0;
    if (keyChanged || structureChanged) {
      const updatedQuiz = { ...existing, ...updatePayload };
      const { data: papers } = await supabase
        .from("papers")
        .select("id, answers, student_rut_norm")
        .eq("quiz_id", id);

      if (papers && papers.length > 0) {
        const countryCode = school.country_code ?? "CL";
        const scannedAt = new Date().toISOString();
        for (const paper of papers) {
          const answers = Array.isArray(paper.answers) ? (paper.answers as { q: number; a: string }[]) : [];
          const result = computeQuizScore(updatedQuiz, answers, school, countryCode);
          await supabase
            .from("papers")
            .update({ score: result.score, total: result.total, grade: result.grade, equivalent_score: result.equivalentScore })
            .eq("id", paper.id);
          if (paper.student_rut_norm) {
            await supabase.from("grade_records").upsert({
              school_id: school.id,
              student_code: paper.student_rut_norm,
              quiz_id: id,
              paper_id: paper.id,
              raw_score: result.score,
              total_questions: result.total,
              calculated_grade: result.grade,
              passing: result.passing,
              graded_at: scannedAt,
            }, { onConflict: "school_id,student_code,quiz_id" });
          }
          recorrected++;
        }
      }
    }

    revalidatePath("/dashboard/quizzes");
    revalidatePath(`/dashboard/quizzes/${id}`);
    revalidatePath("/app/scan");
    return actionSuccess(
      "Ensayo actualizado",
      recorrected > 0 ? `"${title}" quedo actualizado. Se recalcularon ${recorrected} hoja(s) ya escaneada(s).` : `"${title}" quedo actualizado.`,
      "✓",
    );
  } catch (error) {
    return actionError(error, "No se pudo actualizar el ensayo");
  }
}

export async function archiveQuiz(_prevState: DashboardActionState, formData: FormData): Promise<DashboardActionState> {
  try {
    const { supabase } = await getDashboardContext();
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Falta el ensayo a archivar.");
    const { error } = await supabase.from("quizzes").update({ archived_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/quizzes");
    return actionSuccess("Ensayo archivado", "Se movio a archivados.", "🗃");
  } catch (error) {
    return actionError(error, "No se pudo archivar");
  }
}

export async function duplicateQuiz(_prevState: DashboardActionState, formData: FormData): Promise<DashboardActionState> {
  try {
    const { supabase, user, school } = await getDashboardContext();
    const id = String(formData.get("id") ?? "");
    const { data } = await supabase.from("quizzes").select("*").eq("id", id).single();
    if (!data) throw new Error("Ensayo no encontrado.");
    const sheetCode = await nextSheetCode(supabase, school.id);
    const courseId = data.course_id ?? (data.grade ? await findOrCreateCourse(supabase, school.id, String(data.grade)) : null);
    const payload = {
      school_id: school.id,
      user_id: user.id,
      created_by: user.id,
      title: `${data.title} copia`,
      num_questions: data.num_questions,
      options_per_question: data.options_per_question,
      num_columns: data.num_columns ?? suggestColumns(Math.min(Number(data.num_questions), QUIZ_MAX_QUESTIONS)),
      sheet_code: sheetCode,
      option_labels: data.option_labels,
      answer_key: data.answer_key,
      subject: data.subject,
      grade: data.grade,
      course_id: courseId,
      evaluation_type: data.evaluation_type ?? "custom",
      evaluation_variant: data.evaluation_variant ?? null,
      ...(data.exigencia != null ? { exigencia: data.exigencia } : {}),
      duplicated_from: data.id,
    };
    let { error } = await supabase.from("quizzes").insert(payload);
    if (error && isMissingColumnError(error, "course_id")) {
      error = (await supabase.from("quizzes").insert(withoutCourseId(payload))).error;
    }
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/quizzes");
    return actionSuccess("Ensayo duplicado", `Se creo "${data.title} copia".`, "⧉");
  } catch (error) {
    return actionError(error, "No se pudo duplicar");
  }
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

function withoutCourseId<T extends { course_id?: unknown }>(payload: T) {
  const { course_id: _courseId, ...rest } = payload;
  void _courseId;
  return rest;
}

type StudentPayload = {
  school_id: string;
  user_id: string;
  student_id: string;
  rut: string;
  rut_normalized: string | null;
  name: string;
  course: string | null;
  course_id: string | null;
  updated_at: string;
};

async function saveStudentWithoutConstraint(
  supabase: Awaited<ReturnType<typeof getDashboardContext>>["supabase"],
  payload: StudentPayload
) {
  const { data: existingByRut, error: rutFindError } = payload.rut_normalized
    ? await supabase
        .from("students")
        .select("id")
        .eq("school_id", payload.school_id)
        .eq("rut_normalized", payload.rut_normalized)
        .maybeSingle()
    : { data: null, error: null };
  if (rutFindError) throw new Error(rutFindError.message);

  const { data: existingByStudentId, error: findError } = existingByRut?.id
    ? { data: null, error: null }
    : await supabase
        .from("students")
        .select("id")
        .eq("school_id", payload.school_id)
        .eq("student_id", payload.student_id)
        .maybeSingle();

  if (findError) throw new Error(findError.message);
  const existing = existingByRut ?? existingByStudentId;

  if (existing?.id) {
    const updatePayload = {
      user_id: payload.user_id,
      rut: payload.rut,
      rut_normalized: payload.rut_normalized,
      name: payload.name,
      course: payload.course,
      course_id: payload.course_id,
      updated_at: payload.updated_at,
    };
    let updateResult = await supabase
      .from("students")
      .update(updatePayload)
      .eq("id", existing.id);

    if (updateResult.error && isMissingColumnError(updateResult.error, "course_id")) {
      updateResult = await supabase
        .from("students")
        .update(withoutCourseId(updatePayload))
        .eq("id", existing.id);
    }

    if (updateResult.error) throw new Error(updateResult.error.message);
    return;
  }

  let insertResult = await supabase.from("students").insert(payload);
  if (insertResult.error && isMissingColumnError(insertResult.error, "course_id")) {
    insertResult = await supabase.from("students").insert(withoutCourseId(payload));
  }
  const { error } = insertResult;
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
    const countryCode = school.country_code ?? "CL";
    const courseGrades = new Map<string, string>();
    const validRows = parseStudentCsv(csv).map((row) => {
      if (!row.rut || !row.name) return null;
      const resolved = resolveNationalId(row.rut, countryCode);
      if (!resolved.valid) return null;
      const course = row.course;
      if (course && row.grade && !courseGrades.has(course)) courseGrades.set(course, row.grade);

      return {
        student_id: resolved.normalized,
        rut: resolved.normalized,
        rut_normalized: resolved.canonical,
        name: row.name,
        course,
      };
    }).filter((row): row is NonNullable<typeof row> => row !== null);

    if (validRows.length === 0) throw new Error(`No hay alumnos validos para importar. Revisa ${resolveCountryProfile(countryCode).studentIdLabel}, nombre y curso.`);

    // Sincroniza el catalogo de cursos: cada curso del CSV queda registrado en
    // `courses` para poder asociarlo a un ensayo (antes solo quedaba como texto).
    const cursos = [...new Set(validRows.map((p) => p.course).filter((c): c is string => !!c))];
    const courseIds = new Map<string, string | null>();
    for (const curso of cursos) {
      courseIds.set(curso, await findOrCreateCourse(supabase, school.id, curso, courseGrades.get(curso)));
    }

    const payload = validRows.map((student) => ({
      school_id: school.id,
      user_id: user.id,
      ...student,
      course_id: student.course ? courseIds.get(student.course) ?? null : null,
      updated_at: new Date().toISOString(),
    }));

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
  revalidatePath("/app/configuracion");
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
    revalidatePath("/app/students");
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
    revalidatePath("/app/students");
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

    const courseId = course ? await findOrCreateCourse(supabase, school.id, course) : null;

    const updatePayload = { course: course || null, course_id: courseId, updated_at: new Date().toISOString() };
    let updateResult = await supabase
      .from("students")
      .update(updatePayload)
      .eq("id", studentId)
      .eq("school_id", school.id);

    if (updateResult.error && isMissingColumnError(updateResult.error, "course_id")) {
      updateResult = await supabase
        .from("students")
        .update(withoutCourseId(updatePayload))
        .eq("id", studentId)
        .eq("school_id", school.id);
    }

    if (updateResult.error) throw new Error(updateResult.error.message);

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
    const countryProfile = resolveCountryProfile(school.country_code ?? "CL");

    if (!name || !rut || !course) throw new Error(`Nombre, ${countryProfile.studentIdLabel} y curso son obligatorios.`);
    const resolved = resolveNationalId(rut, countryProfile.code);
    if (!resolved.valid) throw new Error(`El ${countryProfile.studentIdLabel} ingresado no es valido.`);

    // Asegura que el curso exista en el catalogo (por si vino de texto libre).
    const courseId = await findOrCreateCourse(supabase, school.id, course);

    await saveStudentWithoutConstraint(supabase, {
      school_id: school.id,
      user_id: user.id,
      student_id: resolved.normalized,
      rut: resolved.normalized,
      rut_normalized: resolved.canonical,
      name,
      course,
      course_id: courseId,
      updated_at: new Date().toISOString(),
    });

    revalidatePath("/dashboard/students");
    revalidatePath("/dashboard/quizzes");
    revalidatePath("/app/students");
    return actionSuccess("Alumno agregado", `${name} quedo registrado en ${course}.`, "✓");
  } catch (error) {
    return actionError(error, "No se pudo agregar el alumno");
  }
}

/**
 * Edita un alumno existente por su `id` (a diferencia de createStudent, que
 * hace upsert por RUT — reusarlo para "editar" corromperia el registro si el
 * profe corrige un typo en el RUT, porque buscaria/mezclaria con otro alumno
 * que ya tuviera ese RUT en vez de actualizar este).
 */
export async function updateStudent(_prevState: DashboardActionState, formData: FormData): Promise<DashboardActionState> {
  const { supabase, school } = await getDashboardContext();

  try {
    const id = String(formData.get("id") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const rut = String(formData.get("rut") ?? "").trim();
    const course = String(formData.get("course") ?? "").trim();
    const countryProfile = resolveCountryProfile(school.country_code ?? "CL");

    if (!id) throw new Error("Falta el alumno a editar.");
    if (!name || !rut || !course) throw new Error(`Nombre, ${countryProfile.studentIdLabel} y curso son obligatorios.`);
    const resolved = resolveNationalId(rut, countryProfile.code);
    if (!resolved.valid) throw new Error(`El ${countryProfile.studentIdLabel} ingresado no es valido.`);

    const { data: collision, error: collisionError } = await supabase
      .from("students")
      .select("id")
      .eq("school_id", school.id)
      .eq("rut_normalized", resolved.canonical)
      .neq("id", id)
      .maybeSingle();
    if (collisionError) throw new Error(collisionError.message);
    if (collision) throw new Error(`Ese ${countryProfile.studentIdLabel} ya pertenece a otro alumno.`);

    const courseId = await findOrCreateCourse(supabase, school.id, course);
    const updatePayload = {
      student_id: resolved.normalized,
      rut: resolved.normalized,
      rut_normalized: resolved.canonical,
      name,
      course,
      course_id: courseId,
      updated_at: new Date().toISOString(),
    };

    let updateResult = await supabase.from("students").update(updatePayload).eq("id", id).eq("school_id", school.id);
    if (updateResult.error && isMissingColumnError(updateResult.error, "course_id")) {
      updateResult = await supabase.from("students").update(withoutCourseId(updatePayload)).eq("id", id).eq("school_id", school.id);
    }
    if (updateResult.error) throw new Error(updateResult.error.message);

    revalidatePath("/dashboard/students");
    revalidatePath("/dashboard/quizzes");
    revalidatePath("/app/students");
    return actionSuccess("Alumno actualizado", `${name} quedo guardado.`, "✓");
  } catch (error) {
    return actionError(error, "No se pudo editar el alumno");
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
  studentName: string,
  studentRutNorm: string | null
) {
  const { data: paper, error } = await supabase
    .from("papers")
    .update({
      student_id: studentCode,
      student_rut_norm: studentRutNorm,
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
    student_code: studentRutNorm ?? normalizeRut(studentCode),
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
  const studentRutNorm = resolveNationalId(studentCode, school.country_code ?? "CL").canonical;

  const { data: studentByRut } = studentRutNorm
    ? await supabase
        .from("students")
        .select("student_id,rut,rut_normalized,name")
        .eq("school_id", school.id)
        .eq("rut_normalized", studentRutNorm)
        .maybeSingle()
    : { data: null };

  const { data: studentById } = studentByRut
    ? { data: null }
    : await supabase
        .from("students")
        .select("student_id,rut,rut_normalized,name")
        .eq("school_id", school.id)
        .eq("student_id", studentCode)
        .maybeSingle();

  const { data: studentByRawRut } = studentByRut || studentById
    ? { data: null }
    : await supabase
        .from("students")
        .select("student_id,rut,rut_normalized,name")
        .eq("school_id", school.id)
        .eq("rut", studentCode)
        .maybeSingle();
  const student = studentByRut ?? studentById ?? studentByRawRut;
  if (!student) throw new Error("Alumno no encontrado.");

  const paperStudentCode = student.rut ?? student.student_id ?? studentCode;
  const quizId = await assignPaperToStudent(supabase, school, paperId, paperStudentCode, student.name, student.rut_normalized ?? resolveNationalId(paperStudentCode, school.country_code ?? "CL").canonical);

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

  const countryProfile = resolveCountryProfile(school.country_code ?? "CL");
  if (!paperId || !name || !rut || !course) throw new Error(`Nombre, ${countryProfile.studentIdLabel} y curso son obligatorios.`);
  const resolved = resolveNationalId(rut, countryProfile.code);
  if (!resolved.valid) throw new Error(`El ${countryProfile.studentIdLabel} ingresado no es valido.`);

  const courseId = await findOrCreateCourse(supabase, school.id, course);

  await saveStudentWithoutConstraint(supabase, {
    school_id: school.id,
    user_id: user.id,
    student_id: resolved.normalized,
    rut: resolved.normalized,
    rut_normalized: resolved.canonical,
    name,
    course,
    course_id: courseId,
    updated_at: new Date().toISOString(),
  });

  const quizId = await assignPaperToStudent(supabase, school, paperId, resolved.normalized, name, resolved.canonical);

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

/**
 * Elimina la CUENTA del usuario (no solo la membresia a un colegio): requisito
 * de Apple (5.1.1(v)) y de Google Play para poder aprobar la app. Borra su
 * perfil y sus membresias, y elimina el usuario de Supabase Auth via el
 * cliente admin (service role). Los datos del colegio (ensayos, alumnos,
 * resultados) NO se borran — son del colegio, no de este usuario; otros
 * miembros del staff los siguen necesitando.
 */
export async function deleteMyAccount() {
  const { createSupabaseServerClient } = await import("@/lib/supabase_server");
  const { createSupabaseAdminClient } = await import("@/lib/supabaseAdmin");

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const admin = createSupabaseAdminClient();

  await admin.from("school_members").delete().eq("user_id", user.id);
  await admin.from("profiles").delete().eq("user_id", user.id);

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) throw new Error(`No se pudo eliminar la cuenta: ${error.message}`);

  await supabase.auth.signOut();

  const cookieStore = await cookies();
  cookieStore.delete("tulector_active_school_id");
  cookieStore.delete("tulector_active_quiz");

  redirect("/account-deleted");
}



