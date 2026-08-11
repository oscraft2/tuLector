"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parse } from "csv-parse/sync";
import { getDashboardContext } from "@/lib/supabase_server";
import { getSiteUrl } from "@/lib/site_url";
import { normalizeRut } from "@/lib/rut";
import { resolveNationalId } from "@/lib/national_id";
import {
  QUIZ_ALLOWED_OPTIONS,
  QUIZ_MAX_QUESTIONS,
  QUIZ_MAX_QUESTIONS_MULTIPAGE,
  QUIZ_MIN_QUESTIONS,
  applyOpenSlots,
  normalizeAnswerKeyForOptions,
  normalizeAnswerKeySlots,
  normalizeQuestionCount,
  normalizeQuizOptions,
  optionLabelsFor,
  parseOpenQuestions,
  serializeOpenQuestions,
  parseOptionOverrides,
  serializeOptionOverrides,
  parseMultiSelectQuestions,
  serializeMultiSelectQuestions,
  parseOpenQuestionRubrics,
  serializeOpenQuestionRubrics,
} from "@/lib/quiz_constraints";
import { countryDefaults, resolveCountryProfile } from "@/lib/country_profiles";
import { type StudentCsvRow, guessColumnMapping, rowsFromMapping } from "@/lib/student_import";
import { suggestColumns, OPEN_BOXES_PER_PAGE } from "@/lib/sheet_generator";
import { sendTemplatedEmail } from "@/lib/email";
import { calculateGrade } from "@/lib/latam";
import { computeQuizScore } from "@/lib/grading";
import type { DashboardSchool } from "@/lib/supabase_server";
import { isMissingColumnError } from "@/lib/supabase_errors";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export async function updateLocale(formData: FormData) {
  const { supabase, user } = await getDashboardContext();
  const locale = String(formData.get("locale") ?? "es-CL");
  if (!["es-CL", "en", "pt-BR"].includes(locale)) return;
  await supabase.from("profiles").upsert({ user_id: user.id, locale, updated_at: new Date().toISOString() });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath("/app/configuracion");
}

/** Reintentos ante choque de sheet_code. Generoso a proposito: en el modo
 *  degradado (sin la funcion next_sheet_code) el correlativo se descubre
 *  avanzando de a uno desde un maximo que RLS puede dejar corto. */
const MAX_SHEET_CODE_RETRIES = 25;

/** Siguiente sheet_code correlativo del colegio (1,2,3…). Cabe en los 20 bits del
 * codigo de hoja del motor; el indice unico (school_id, sheet_code) evita choques.
 *
 * Va por RPC y no por SELECT directo porque el SELECT pasa por RLS: desde
 * 20260808000000_teacher_isolation.sql un docente no-admin solo ve SUS ensayos,
 * asi que el maximo le salia recortado y pedia un codigo que otro usuario del
 * colegio ya tenia (ver 20260810100000_next_sheet_code.sql). */
async function nextSheetCode(
  supabase: Awaited<ReturnType<typeof getDashboardContext>>["supabase"],
  schoolId: string,
): Promise<number> {
  const rpc = await supabase.rpc("next_sheet_code", { p_school: schoolId });
  if (!rpc.error && typeof rpc.data === "number") return rpc.data;

  // BD sin la migracion aplicada: se cae al calculo anterior. Para un docente
  // no-admin puede quedar corto, y por eso los bucles de reintento avanzan de
  // forma monotona en vez de volver a este valor.
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
    const openQuestions = parseOpenQuestions(formData.get("open_questions"), numQuestions);
    if (openQuestions.length >= numQuestions) throw new Error("Debe quedar al menos 1 pregunta de alternativas (no puede ser todo desarrollo).");
    const optionOverrides = parseOptionOverrides(formData.get("option_overrides"), numQuestions);
    const multiSelectQuestions = parseMultiSelectQuestions(formData.get("multi_select_questions"), numQuestions);
    if (multiSelectQuestions.some((q) => openQuestions.includes(q))) {
      throw new Error("Una pregunta no puede ser de desarrollo y de seleccion multiple a la vez.");
    }
    const openQuestionRubrics = parseOpenQuestionRubrics(String(formData.get("open_question_rubrics") ?? ""));
    // La clave de una fila de seleccion multiple no representa "que subconjunto
    // es correcto" (es una letra), asi que se trata igual que las abiertas para
    // el proposito de la clave/puntaje: fuera del calculo automatico (ver
    // computeQuizScore en src/lib/grading.ts).
    const unscoredQuestions = [...new Set([...openQuestions, ...multiSelectQuestions])].sort((a, b) => a - b);
    const rawAnswerKey = formData.get("answer_key_clean") ?? formData.get("answer_key");
    // Con preguntas de desarrollo la clave SIEMPRE es posicional (slots): las
    // abiertas quedan "-" fijo y no pueden colapsar el resto de la clave.
    const answerKey = allowPartial || unscoredQuestions.length > 0
      ? applyOpenSlots(normalizeAnswerKeySlots(rawAnswerKey, numOptions, numQuestions), unscoredQuestions)
      : normalizeAnswerKeyForOptions(rawAnswerKey, numOptions);
    const evalType = String(formData.get("evaluation_type") ?? "custom");
    const evalVariant = String(formData.get("evaluation_variant") ?? "") || null;
    const rawExigencia = formData.get("exigencia");
    const exigencia = rawExigencia ? Math.max(0, Math.min(1, Number(rawExigencia) || 0.60)) : null;
    if (!title) throw new Error("Ingresa un titulo para el ensayo.");
    const filledSlots = answerKey.split("").filter((ch) => ch !== "-").length;
    if (!allowPartial && filledSlots !== numQuestions - unscoredQuestions.length) throw new Error("La clave debe coincidir con el numero de preguntas y las opciones del formato.");

    // N. de columnas derivado del tamano de UNA pagina (sobre seguro validado
    // por test:omr, ver sheet_generator.allowedColumns), no del total del
    // ensayo -- un ensayo multipagina de 250 preguntas se imprime/lee en
    // paginas de 100, cada una con su propio nº de columnas (bug real: antes
    // se derivaba del total, que para >100 preguntas cae fuera del sobre
    // seguro y da una config invalida). Ver docs/plan-multipagina-fase1.md.
    const numColumns = suggestColumns(Math.min(numQuestions, QUIZ_MAX_QUESTIONS));
    const SHEET_CODE_MAX = 0xfffff; // 1.048.575
    let baseCode = await nextSheetCode(supabase, school.id);
    // Un mismo ensayo puede aplicarse a varios cursos a la vez: se crea 1 fila
    // de `quizzes` POR curso elegido (mismo patron que duplicateQuiz -- clona
    // titulo/preguntas/clave/config con su propio sheet_code y course_id). El
    // resto del sistema (escaneo, resultados, exportaciones, DIA) ya opera por
    // quiz_id individual y no asume nada sobre cuantos cursos comparten un
    // mismo ensayo, asi que no hace falta tocar nada mas.
    const grades = [...new Set(formData.getAll("grade").map((g) => String(g).trim()).filter(Boolean))];
    if (grades.length === 0) throw new Error("Selecciona al menos un curso.");
    // Vincula las N filas del lote para que el lector pueda reconocer una hoja
    // "hermana" (mismo contenido, otro curso) automaticamente al escanear en
    // vez de mandarla siempre a revision manual -- ver batch_id en
    // api/scan/result/route.ts. Con 1 solo curso queda null (sin cambios).
    const batchId = grades.length > 1 ? crypto.randomUUID() : null;

    let sheetOffset = 0; // compartido entre TODOS los cursos del lote: sheet_code=baseCode+sheetOffset nunca colisiona dentro del mismo envio
    for (const gradeName of grades) {
      const courseId = await findOrCreateCourse(supabase, school.id, gradeName);
      // Con 1 solo curso el titulo queda identico a como lo tipeo el profesor
      // (sin cambio de comportamiento); con varios, el sufijo distingue cada
      // fila en /dashboard/quizzes, /app/scan y el sync DIA.
      const rowTitle = grades.length > 1 ? `${title} — ${gradeName}` : title;
      const payload = {
        school_id: school.id,
        user_id: user.id,
        created_by: user.id,
        title: rowTitle,
        num_questions: numQuestions,
        options_per_question: numOptions,
        num_columns: numColumns,
        option_labels: optionLabelsFor(numOptions).split("").join(","),
        answer_key: answerKey,
        open_questions: serializeOpenQuestions(openQuestions),
        option_overrides: serializeOptionOverrides(optionOverrides),
        multi_select_questions: serializeMultiSelectQuestions(multiSelectQuestions),
        open_question_rubrics: serializeOpenQuestionRubrics(openQuestionRubrics),
        // Congela para SIEMPRE la regla de reparto de reverso vigente al crear
        // este ensayo (ver src/lib/sheet_generator.ts LEGACY_OPEN_BOXES_PER_PAGE):
        // asi imprimir y leer una misma hoja fisica nunca dependen de que la
        // constante global no haya cambiado entre medio (bug real, 2026-08-05).
        open_boxes_per_page: OPEN_BOXES_PER_PAGE,
        subject: String(formData.get("subject") ?? "") || null,
        grade: gradeName,
        course_id: courseId,
        batch_id: batchId,
        evaluation_type: evalType,
        evaluation_variant: evalVariant,
        ...(exigencia !== null ? { exigencia } : {}),
      };
      for (let retries = 0; ; retries++) {
        let insertPayload: Record<string, unknown> = { ...payload, sheet_code: Math.min(baseCode + sheetOffset, SHEET_CODE_MAX) };
        let { error } = await supabase.from("quizzes").insert(insertPayload);
        if (error && isMissingColumnError(error, "batch_id")) {
          // Degradacion SIEMPRE silenciosa: sin la columna, cada fila del lote
          // simplemente no se auto-reconoce como hermana al escanear (cae al
          // manual_review de siempre), pero se crea igual.
          insertPayload = withoutBatchId(insertPayload);
          error = (await supabase.from("quizzes").insert(insertPayload)).error;
        }
        if (error && isMissingColumnError(error, "course_id")) {
          insertPayload = withoutCourseId(insertPayload);
          error = (await supabase.from("quizzes").insert(insertPayload)).error;
        }
        if (error && isMissingColumnError(error, "option_overrides")) {
          if (Object.keys(optionOverrides).length > 0) throw new Error("Nº de opciones por pregunta requiere actualizar la base de datos (migracion option_overrides).");
          insertPayload = withoutOptionOverrides(insertPayload);
          error = (await supabase.from("quizzes").insert(insertPayload)).error;
        }
        if (error && isMissingColumnError(error, "multi_select_questions")) {
          if (multiSelectQuestions.length > 0) throw new Error("Preguntas de seleccion multiple requieren actualizar la base de datos (migracion option_overrides).");
          insertPayload = withoutMultiSelectQuestions(insertPayload);
          error = (await supabase.from("quizzes").insert(insertPayload)).error;
        }
        if (error && isMissingColumnError(error, "open_question_rubrics")) {
          // Degradacion SIEMPRE silenciosa (a diferencia de open_questions/
          // option_overrides): perder la rubrica no rompe la hoja ni el
          // puntaje, solo el profesor tiene que volver a tipearla despues.
          insertPayload = withoutOpenQuestionRubrics(insertPayload);
          error = (await supabase.from("quizzes").insert(insertPayload)).error;
        }
        if (error && isMissingColumnError(error, "open_boxes_per_page")) {
          // Degradacion SIEMPRE silenciosa: si la migracion no corrio aun, el
          // ensayo simplemente cae al fallback LEGACY_OPEN_BOXES_PER_PAGE al
          // imprimir/leer (mismo comportamiento que hoy, sin regresion).
          insertPayload = withoutOpenBoxesPerPage(insertPayload);
          error = (await supabase.from("quizzes").insert(insertPayload)).error;
        }
        if (error && isMissingColumnError(error, "open_questions")) {
          // BD sin migrar: solo se degrada si el ensayo no usa abiertas (perderlas
          // en silencio dejaria la hoja y el puntaje inconsistentes).
          if (openQuestions.length > 0) throw new Error("Preguntas de desarrollo requieren actualizar la base de datos (migracion open_questions).");
          error = (await supabase.from("quizzes").insert(withoutOpenQuestions(insertPayload))).error;
        }
        if (!error) { sheetOffset++; break; }
        if (error.code === "23505" && retries < MAX_SHEET_CODE_RETRIES) {
          // unique_violation en sheet_code. El candidato SIEMPRE avanza: nunca
          // se reintenta un numero ya probado.
          //
          // Antes, al segundo choque se releia el maximo y se reseteaba el
          // offset a 0. Con RLS recortando ese maximo a los ensayos del propio
          // docente (teacher_isolation), releer devolvia el MISMO valor
          // insuficiente una y otra vez: el bucle reintentaba eternamente el
          // mismo codigo y terminaba culpando a "otros usuarios". Ahora la
          // relectura solo se acepta si APUNTA MAS ARRIBA.
          sheetOffset++;
          if (retries >= 1) {
            const reread = await nextSheetCode(supabase, school.id);
            if (reread > baseCode + sheetOffset) {
              baseCode = reread;
              sheetOffset = 0;
            }
          }
          continue;
        }
        if (error.code === "23505") throw new Error("No se pudo asignar un codigo de hoja libre para este ensayo. Si el problema persiste, aplica la migracion 20260810100000_next_sheet_code.sql.");
        throw new Error(error.message);
      }
    }
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/quizzes");
    revalidatePath("/app/scan");
    return grades.length > 1
      ? actionSuccess("Ensayos creados", `${grades.length} ensayos quedaron listos para generar sus hojas (uno por curso).`, "✓")
      : actionSuccess("Ensayo creado", `"${title}" quedo listo para generar su hoja.`, "✓");
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
    const openQuestions = parseOpenQuestions(formData.get("open_questions"), numQuestions);
    if (openQuestions.length >= numQuestions) throw new Error("Debe quedar al menos 1 pregunta de alternativas (no puede ser todo desarrollo).");
    const optionOverrides = parseOptionOverrides(formData.get("option_overrides"), numQuestions);
    const multiSelectQuestions = parseMultiSelectQuestions(formData.get("multi_select_questions"), numQuestions);
    if (multiSelectQuestions.some((q) => openQuestions.includes(q))) {
      throw new Error("Una pregunta no puede ser de desarrollo y de seleccion multiple a la vez.");
    }
    const openQuestionRubrics = parseOpenQuestionRubrics(String(formData.get("open_question_rubrics") ?? ""));
    const unscoredQuestions = [...new Set([...openQuestions, ...multiSelectQuestions])].sort((a, b) => a - b);
    const rawAnswerKey = formData.get("answer_key_clean") ?? formData.get("answer_key");
    const answerKey = allowPartial || unscoredQuestions.length > 0
      ? applyOpenSlots(normalizeAnswerKeySlots(rawAnswerKey, numOptions, numQuestions), unscoredQuestions)
      : normalizeAnswerKeyForOptions(rawAnswerKey, numOptions);
    if (!title) throw new Error("Ingresa un titulo para el ensayo.");
    const filledSlots = answerKey.split("").filter((ch) => ch !== "-").length;
    if (!allowPartial && filledSlots !== numQuestions - unscoredQuestions.length) throw new Error("La clave debe coincidir con el numero de preguntas y las opciones del formato.");

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
      open_questions: serializeOpenQuestions(openQuestions),
      option_overrides: serializeOptionOverrides(optionOverrides),
      multi_select_questions: serializeMultiSelectQuestions(multiSelectQuestions),
      open_question_rubrics: serializeOpenQuestionRubrics(openQuestionRubrics),
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
    const openChanged = String(existing.open_questions ?? "") !== String(updatePayload.open_questions ?? "")
      || String(existing.multi_select_questions ?? "") !== String(updatePayload.multi_select_questions ?? "");

    let effectivePayload: Record<string, unknown> = updatePayload;
    let { error: updateError } = await supabase.from("quizzes").update(effectivePayload).eq("id", id);
    if (updateError && isMissingColumnError(updateError, "course_id")) {
      effectivePayload = withoutCourseId(effectivePayload);
      updateError = (await supabase.from("quizzes").update(effectivePayload).eq("id", id)).error;
    }
    if (updateError && isMissingColumnError(updateError, "option_overrides")) {
      if (Object.keys(optionOverrides).length > 0) throw new Error("Nº de opciones por pregunta requiere actualizar la base de datos (migracion option_overrides).");
      effectivePayload = withoutOptionOverrides(effectivePayload);
      updateError = (await supabase.from("quizzes").update(effectivePayload).eq("id", id)).error;
    }
    if (updateError && isMissingColumnError(updateError, "multi_select_questions")) {
      if (multiSelectQuestions.length > 0) throw new Error("Preguntas de seleccion multiple requieren actualizar la base de datos (migracion option_overrides).");
      effectivePayload = withoutMultiSelectQuestions(effectivePayload);
      updateError = (await supabase.from("quizzes").update(effectivePayload).eq("id", id)).error;
    }
    if (updateError && isMissingColumnError(updateError, "open_question_rubrics")) {
      effectivePayload = withoutOpenQuestionRubrics(effectivePayload);
      updateError = (await supabase.from("quizzes").update(effectivePayload).eq("id", id)).error;
    }
    if (updateError && isMissingColumnError(updateError, "open_questions")) {
      if (openQuestions.length > 0) throw new Error("Preguntas de desarrollo requieren actualizar la base de datos (migracion open_questions).");
      updateError = (await supabase.from("quizzes").update(withoutOpenQuestions(effectivePayload)).eq("id", id)).error;
    }
    if (updateError) throw new Error(updateError.message);

    let recorrected = 0;
    if (keyChanged || structureChanged || openChanged) {
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
    const { supabase, school } = await getDashboardContext();
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Falta el ensayo a archivar.");
    const { error } = await supabase.from("quizzes").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("school_id", school.id);
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
    const { data } = await supabase.from("quizzes").select("*").eq("id", id).eq("school_id", school.id).single();
    if (!data) throw new Error("Ensayo no encontrado.");
    const courseId = data.course_id ?? (data.grade ? await findOrCreateCourse(supabase, school.id, String(data.grade)) : null);
    const basePayload = {
      school_id: school.id,
      user_id: user.id,
      created_by: user.id,
      title: `${data.title} copia`,
      num_questions: data.num_questions,
      options_per_question: data.options_per_question,
      num_columns: data.num_columns ?? suggestColumns(Math.min(Number(data.num_questions), QUIZ_MAX_QUESTIONS)),
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
    let error: { message: string; code?: string } | null = null;
    // Mismo criterio que createQuiz: el candidato avanza de forma monotona.
    // Releer el maximo en cada vuelta (lo que hacia antes) reintentaba el mismo
    // numero para siempre cuando RLS se lo recortaba al docente no-admin.
    let sheetCode = await nextSheetCode(supabase, school.id);
    for (let retries = 0; ; retries++) {
      const payload = { ...basePayload, sheet_code: sheetCode };
      const result = await supabase.from("quizzes").insert(payload);
      error = result.error;
      if (error && isMissingColumnError(error, "course_id")) {
        const retryResult = await supabase.from("quizzes").insert(withoutCourseId(payload));
        error = retryResult.error;
      }
      if (!error) break;
      if (error.code === "23505" && retries < MAX_SHEET_CODE_RETRIES) {
        const reread = await nextSheetCode(supabase, school.id);
        sheetCode = Math.max(sheetCode + 1, reread);
        continue;
      }
      break;
    }
    if (error) throw new Error(error.code === "23505" ? "No se pudo asignar un codigo de hoja libre para la copia. Si el problema persiste, aplica la migracion 20260810100000_next_sheet_code.sql." : error.message);
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

function withoutOpenQuestions<T extends { open_questions?: unknown }>(payload: T) {
  const { open_questions: _openQuestions, ...rest } = payload;
  void _openQuestions;
  return rest;
}

function withoutOptionOverrides<T extends { option_overrides?: unknown }>(payload: T) {
  const { option_overrides: _optionOverrides, ...rest } = payload;
  void _optionOverrides;
  return rest;
}

function withoutMultiSelectQuestions<T extends { multi_select_questions?: unknown }>(payload: T) {
  const { multi_select_questions: _multiSelectQuestions, ...rest } = payload;
  void _multiSelectQuestions;
  return rest;
}

function withoutOpenQuestionRubrics<T extends { open_question_rubrics?: unknown }>(payload: T) {
  const { open_question_rubrics: _openQuestionRubrics, ...rest } = payload;
  void _openQuestionRubrics;
  return rest;
}

function withoutOpenBoxesPerPage<T extends { open_boxes_per_page?: unknown }>(payload: T) {
  const { open_boxes_per_page: _openBoxesPerPage, ...rest } = payload;
  void _openBoxesPerPage;
  return rest;
}

function withoutBatchId<T extends { batch_id?: unknown }>(payload: T) {
  const { batch_id: _batchId, ...rest } = payload;
  void _batchId;
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

function parseStudentCsv(csv: string): StudentCsvRow[] {
  const parsed = parse(csv, {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  }) as string[][];

  if (parsed.length === 0) return [];

  const firstRow = parsed[0] ?? [];
  const mapping = guessColumnMapping(firstRow);
  const hasHeader = mapping.rutCol >= 0 && mapping.nameCol >= 0 && mapping.courseCol >= 0;
  if (hasHeader) return rowsFromMapping(parsed, mapping, true);

  // Sin encabezados reconocidos: formato legacy posicional (rut, nombre,
  // [...], curso, [nivel]) -- se mantiene tal cual para no romper CSVs viejos
  // ya en uso. El modo "mapeo inteligente" (importStudentsMapped) es la via
  // recomendada para cualquier planilla que no calce con este formato.
  return parsed.map((row) => {
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
    .select("id,archived_at")
    .eq("school_id", schoolId)
    .eq("name", clean)
    .maybeSingle();
  // BD sin migrar (archived_at): degradacion silenciosa -- se comporta como
  // antes, sin concepto de archivado todavia (curso encontrado por nombre
  // simplemente no existe hasta que se aplique la migracion).
  if (findError && !isMissingColumnError(findError, "archived_at")) throw new Error(findError.message);
  if (existing?.id) {
    // El curso volvio a aparecer en un import (o al crear un alumno/ensayo) ->
    // vuelve a estar en uso, se restaura solo (sin esto quedaria linkeado
    // pero invisible en los selectores activos, un curso "fantasma").
    if (existing.archived_at) await supabase.from("courses").update({ archived_at: null }).eq("id", existing.id);
    return existing.id;
  }

  const { data: inserted, error } = await supabase
    .from("courses")
    .insert({ school_id: schoolId, name: clean, grade: (grade || "").trim() || "Sin nivel" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return inserted.id;
}

/** Valida, sincroniza cursos y guarda una lista de filas de alumnos ya
 * parseadas -- logica COMPARTIDA entre `importStudents` (modo "pegar CSV
 * simple", formato fijo que nosotros definimos) e `importStudentsMapped`
 * (modo "mapeo inteligente", cualquier planilla + columnas elegidas por el
 * usuario). Ambos caminos terminan validando/guardando exactamente igual;
 * solo cambia como se llega a `StudentCsvRow[]`. */
async function persistStudentRows(
  rows: StudentCsvRow[],
  ctx: { supabase: Awaited<ReturnType<typeof getDashboardContext>>["supabase"]; user: { id: string }; school: { id: string; country_code?: string | null } },
): Promise<DashboardActionState> {
  const { supabase, user, school } = ctx;
  const countryCode = school.country_code ?? "CL";
  const courseGrades = new Map<string, string>();
  const validRows = rows.map((row) => {
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
  revalidatePath("/dashboard/courses");
  revalidatePath("/dashboard/quizzes");
  const cursoMsg = cursos.length ? ` en ${cursos.length} curso${cursos.length === 1 ? "" : "s"}` : "";
  return actionSuccess("Importacion lista", `${payload.length} alumno${payload.length === 1 ? "" : "s"} importado${payload.length === 1 ? "" : "s"} o actualizado${payload.length === 1 ? "" : "s"}${cursoMsg}.`);
}

export async function importStudents(_prevState: DashboardActionState, formData: FormData): Promise<DashboardActionState> {
  const ctx = await getDashboardContext();
  try {
    if (!ctx.isAdmin) throw new Error("Solo administradores pueden importar alumnos.");
    const csv = String(formData.get("csv") ?? "");
    return await persistStudentRows(parseStudentCsv(csv), ctx);
  } catch (error) {
    return actionError(error, "No se pudo importar");
  }
}

/** Modo "mapeo inteligente" (CSVImport.tsx): el cliente ya parseo el archivo
 * (CSV/TSV/XLSX, con o sin encabezados) y el usuario eligio a mano cual
 * columna es cual -- aca solo se reconstruyen las filas con ese mapeo y se
 * reusa la misma validacion/guardado que el modo simple. Acepta cualquier
 * formato de planilla, no solo el que definimos nosotros. */
export async function importStudentsMapped(_prevState: DashboardActionState, formData: FormData): Promise<DashboardActionState> {
  const ctx = await getDashboardContext();
  try {
    if (!ctx.isAdmin) throw new Error("Solo administradores pueden importar alumnos.");
    const table = JSON.parse(String(formData.get("rows") ?? "[]")) as string[][];
    if (!Array.isArray(table) || table.length === 0) throw new Error("No se recibieron filas para importar.");
    const mapping = {
      rutCol: Number(formData.get("rutCol") ?? -1),
      nameCol: Number(formData.get("nameCol") ?? -1),
      courseCol: Number(formData.get("courseCol") ?? -1),
      gradeCol: Number(formData.get("gradeCol") ?? -1),
    };
    if (mapping.rutCol < 0 || mapping.nameCol < 0) {
      throw new Error(`Falta indicar cual columna es el ${resolveCountryProfile(ctx.school.country_code ?? "CL").studentIdLabel} y cual es el nombre.`);
    }
    const hasHeader = formData.get("hasHeader") === "1";
    return await persistStudentRows(rowsFromMapping(table, mapping, hasHeader), ctx);
  } catch (error) {
    return actionError(error, "No se pudo importar");
  }
}

function inviteRoleLabel(role: string) {
  return role === "admin" ? "Administrador" : role === "teacher" ? "Profesor" : "Observador";
}

async function dispatchInviteEmail(email: string, inviteId: string, role: string, opts: { locale: string; school: { id: string; name: string }; invitedByEmail: string | null }) {
  const inviteLink = `${getSiteUrl()}/auth?mode=register&invite_id=${inviteId}`;
  return sendTemplatedEmail({
    to: email,
    templateKey: "invitation",
    locale: opts.locale,
    variables: {
      invited_by_email: opts.invitedByEmail ?? "Un administrador",
      school_name: opts.school.name,
      role: inviteRoleLabel(role),
      invite_link: inviteLink,
    },
  });
}

export async function inviteMember(_prevState: DashboardActionState, formData: FormData): Promise<DashboardActionState> {
  try {
    const { supabase, user, school, isAdmin, locale } = await getDashboardContext();
    if (!isAdmin) throw new Error("Solo admin puede invitar miembros.");
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const role = String(formData.get("role") ?? "teacher");
    if (!email) throw new Error("Falta el correo a invitar.");
    if (!["admin", "teacher", "viewer"].includes(role)) throw new Error("Rol invalido.");

    const { data: existing } = await supabase
      .from("invitations")
      .select("id")
      .eq("school_id", school.id)
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) {
      throw new Error(`Ya existe una invitacion pendiente para ${email}. Usa "Reenviar" en su menu de opciones.`);
    }

    const { data, error } = await supabase
      .from("invitations")
      .insert({ school_id: school.id, email, role, invited_by: user.id })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const result = await dispatchInviteEmail(email, data.id, role, { locale, school, invitedByEmail: user.email ?? null });
    revalidatePath("/dashboard/settings");

    if (!result.success) {
      // La invitacion igual quedo creada y es utilizable via "Copiar enlace".
      return actionSuccess("Invitacion creada", `El correo a ${email} no se pudo enviar. Usa "Copiar enlace" en su menu de opciones para compartirla manualmente.`, "⚠");
    }
    return actionSuccess("Invitacion enviada", `Se envio un correo a ${email}.`, "✉");
  } catch (error) {
    return actionError(error, "No se pudo invitar");
  }
}

export async function resendInvitation(_prevState: DashboardActionState, formData: FormData): Promise<DashboardActionState> {
  try {
    const { supabase, user, school, isAdmin, locale } = await getDashboardContext();
    if (!isAdmin) throw new Error("Solo admin puede reenviar invitaciones.");
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Falta la invitacion.");

    const { data: invite } = await supabase
      .from("invitations")
      .select("id, email, role, status")
      .eq("id", id)
      .eq("school_id", school.id)
      .maybeSingle();
    if (!invite || invite.status !== "pending") throw new Error("Esta invitacion ya no esta pendiente.");

    await supabase
      .from("invitations")
      .update({ expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })
      .eq("id", id);

    const result = await dispatchInviteEmail(invite.email, invite.id, invite.role, { locale, school, invitedByEmail: user.email ?? null });
    revalidatePath("/dashboard/settings");

    if (!result.success) {
      return actionSuccess("Invitacion actualizada", `El correo a ${invite.email} no se pudo reenviar. Usa "Copiar enlace" para compartirla manualmente.`, "⚠");
    }
    return actionSuccess("Invitacion reenviada", `Se reenvio el correo a ${invite.email}.`, "✉");
  } catch (error) {
    return actionError(error, "No se pudo reenviar");
  }
}

export async function deleteInvitation(_prevState: DashboardActionState, formData: FormData): Promise<DashboardActionState> {
  try {
    const { supabase, isAdmin, school } = await getDashboardContext();
    if (!isAdmin) throw new Error("Solo admin puede eliminar invitaciones.");
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Falta la invitacion.");
    const { error } = await supabase
      .from("invitations")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", id)
      .eq("school_id", school.id);
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/settings");
    return actionSuccess("Invitacion eliminada", "Ya puedes invitar de nuevo a ese correo.", "🗑");
  } catch (error) {
    return actionError(error, "No se pudo eliminar");
  }
}

export async function revokeMember(_prevState: DashboardActionState, formData: FormData): Promise<DashboardActionState> {
  try {
    const { supabase, isAdmin } = await getDashboardContext();
    if (!isAdmin) throw new Error("Solo admin puede revocar miembros.");
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Falta el miembro.");
    const { error } = await supabase.from("school_members").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/settings");
    return actionSuccess("Miembro eliminado", "Se quito el acceso a este colegio.", "🗑");
  } catch (error) {
    return actionError(error, "No se pudo quitar");
  }
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


/**
 * Confirma (o ajusta) el puntaje sugerido por la IA para una pregunta de
 * desarrollo (Fase 3, docs/plan-correccion-ia-abiertas.md). Principio del
 * plan: la IA sugiere, el profesor decide -- este es el ÚNICO lugar donde
 * `confirmed_points` se escribe; hasta que esto corre, el puntaje de la IA
 * no cuenta para nada (computeQuizScore sigue excluyendo las abiertas).
 */
export async function confirmOpenAnswer(formData: FormData) {
  const { supabase, school } = await getDashboardContext();
  const paperId = String(formData.get("paper_id") ?? "");
  const question = Number(formData.get("question"));
  const quizId = String(formData.get("quiz_id") ?? "");
  const points = Number(formData.get("points"));
  if (!paperId || !Number.isInteger(question) || !Number.isFinite(points)) throw new Error("Datos invalidos.");
  const { error } = await supabase
    .from("open_answers")
    .update({ confirmed_points: Math.max(0, points), confirmed_at: new Date().toISOString() })
    .eq("paper_id", paperId)
    .eq("question", question)
    .eq("school_id", school.id);
  if (error) throw new Error(error.message);
  if (quizId) revalidatePath(`/dashboard/quizzes/${quizId}`);
}

/**
 * Enlace de un solo uso que abre la sesion del PROPIO usuario en otro navegador,
 * aterrizando en Mi plan.
 *
 * Por que existe: el pago no puede ocurrir dentro del APK (reglas de compra
 * in-app; ver dashboard/billing/page.tsx), asi que "Mi plan" abre Chrome. Pero
 * el WebView del APK y Chrome tienen almacenamientos separados: en Chrome no
 * habia sesion, el profesor tenia que iniciarla de nuevo, y ahi reventaba con
 * "PKCE code verifier not found in storage" -- porque el App Link verificado
 * sobre /auth/callback (AndroidManifest) hace que Android le quite ese callback
 * a Chrome y lo entregue al APK, donde el code_verifier no existe.
 *
 * Con este traspaso NO se inicia ningun login en Chrome: el enlace es del tipo
 * verify-por-token (el mismo mecanismo de un magic link de correo), que por
 * diseno funciona entre navegadores distintos y no usa PKCE.
 *
 * Devuelve null (y el cliente cae a su respaldo) ante cualquier problema, en vez
 * de dejar al profesor sin camino para pagar.
 */
export async function createBillingHandoffLink(): Promise<{ url: string | null }> {
  try {
    const { user, isImpersonating } = await getDashboardContext();

    // Nunca durante una suplantacion: convertiria una sesion de soporte en una
    // sesion REAL de esa persona dentro de otro navegador.
    if (isImpersonating) return { url: null };

    const email = user.email;
    if (!email) return { url: null };

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${getSiteUrl()}/dashboard/billing` },
    });

    const link = data?.properties?.action_link;
    if (error || !link) return { url: null };
    return { url: link };
  } catch {
    // Sin SUPABASE_SERVICE_ROLE_KEY, o Supabase caido: respaldo del cliente.
    return { url: null };
  }
}

export async function startScanForQuiz(formData: FormData) {
  const { supabase, school } = await getDashboardContext();
  const quizId = String(formData.get("quiz_id") ?? "");
  if (!quizId) throw new Error("Selecciona un ensayo.");
  const { data, error } = await supabase.from("quizzes").select("id").eq("id", quizId).eq("school_id", school.id).is("archived_at", null).single();
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
  const { supabase, school, isAdmin } = await getDashboardContext();

  try {
    if (!isAdmin) throw new Error("Solo administradores pueden crear cursos.");
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
    revalidatePath("/dashboard/courses");
    revalidatePath("/dashboard/quizzes");
    revalidatePath("/app/students");
    // /app/scan monta el formulario de ensayo (CreateQuizFab): sin esto, el
    // curso recien creado desde ahi mismo no aparecia en su propia lista.
    revalidatePath("/app/scan");
    return actionSuccess("Curso creado", `${name} quedo disponible para asociar alumnos.`, "✓");
  } catch (error) {
    return actionError(error, "No se pudo crear el curso");
  }
}

/** Antes no existia forma de corregir un curso mal escrito (ej. "IIMC" en vez
 * de "II C") una vez creado -- solo crear/eliminar. Ademas de renombrar la
 * fila en `courses`, propaga el nombre nuevo al texto denormalizado
 * `students.course` de sus alumnos (asi el listado de alumnos no queda
 * mostrando el nombre viejo) -- NO toca `quizzes.grade`: un ensayo ya creado
 * conserva el nombre de curso que tenia al crearse, igual que al duplicar o
 * editar un ensayo, para no reescribir historial. */
export async function updateCourse(_prevState: DashboardActionState, formData: FormData): Promise<DashboardActionState> {
  const { supabase, school, isAdmin } = await getDashboardContext();
  try {
    if (!isAdmin) throw new Error("Solo administradores pueden editar cursos.");
    const id = String(formData.get("id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const grade = String(formData.get("grade") ?? "").trim();
    if (!id) throw new Error("Falta el curso a editar.");
    if (!name || !grade) throw new Error("Nombre y nivel son obligatorios.");

    const { data: existing, error: findError } = await supabase
      .from("courses")
      .select("id,name")
      .eq("id", id)
      .eq("school_id", school.id)
      .maybeSingle();
    if (findError) throw new Error(findError.message);
    if (!existing) throw new Error("Curso no encontrado.");

    const { error } = await supabase.from("courses").update({ name, grade }).eq("id", id).eq("school_id", school.id);
    if (error) throw new Error(error.message);

    if (existing.name !== name) {
      await supabase.from("students").update({ course: name }).eq("course_id", id).eq("school_id", school.id);
    }

    revalidatePath("/dashboard/students");
    revalidatePath("/dashboard/courses");
    revalidatePath("/dashboard/quizzes");
    return actionSuccess("Curso actualizado", `Ahora se llama "${name}".`, "✓");
  } catch (error) {
    return actionError(error, "No se pudo editar el curso");
  }
}

/** Antes "Eliminar curso" borraba la fila para siempre: sin recuperacion,
 * y los alumnos/ensayos ya vinculados por course_id quedaban con el link
 * roto (ON DELETE SET NULL). Ahora archiva (soft delete, mismo patron que
 * archiveQuiz): oculta el curso de los selectores activos pero conserva la
 * fila y todos los vinculos -- se puede restaurar con restoreCourse. */
export async function archiveCourse(_prevState: DashboardActionState, formData: FormData): Promise<DashboardActionState> {
  const { supabase, school, isAdmin } = await getDashboardContext();
  try {
    if (!isAdmin) throw new Error("Solo administradores pueden archivar cursos.");
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Falta el curso a archivar.");

    const { data: course, error: findError } = await supabase
      .from("courses")
      .select("name")
      .eq("id", id)
      .eq("school_id", school.id)
      .maybeSingle();
    if (findError) throw new Error(findError.message);

    const { error } = await supabase.from("courses").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("school_id", school.id);
    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/students");
    revalidatePath("/dashboard/courses");
    revalidatePath("/dashboard/quizzes");
    return actionSuccess("Curso archivado", `${course?.name ?? "El curso"} se movio a archivados. Puedes restaurarlo cuando quieras.`, "🗃");
  } catch (error) {
    return actionError(error, "No se pudo archivar el curso");
  }
}

export async function restoreCourse(_prevState: DashboardActionState, formData: FormData): Promise<DashboardActionState> {
  const { supabase, school, isAdmin } = await getDashboardContext();
  try {
    if (!isAdmin) throw new Error("Solo administradores pueden restaurar cursos.");
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Falta el curso a restaurar.");

    const { data: course, error: findError } = await supabase
      .from("courses")
      .select("name")
      .eq("id", id)
      .eq("school_id", school.id)
      .maybeSingle();
    if (findError) throw new Error(findError.message);

    const { error } = await supabase.from("courses").update({ archived_at: null }).eq("id", id).eq("school_id", school.id);
    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/students");
    revalidatePath("/dashboard/courses");
    revalidatePath("/dashboard/quizzes");
    return actionSuccess("Curso restaurado", `${course?.name ?? "El curso"} volvio a estar disponible.`, "✓");
  } catch (error) {
    return actionError(error, "No se pudo restaurar el curso");
  }
}

export async function deleteStudent(_prevState: DashboardActionState, formData: FormData): Promise<DashboardActionState> {
  const { supabase, school, isAdmin } = await getDashboardContext();
  try {
    if (!isAdmin) throw new Error("Solo administradores pueden eliminar alumnos.");
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
    revalidatePath("/dashboard/courses");
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
    revalidatePath("/dashboard/courses");
    revalidatePath("/dashboard/quizzes");
    return course
      ? actionSuccess("Alumno agregado al curso", `${student.name} quedo en ${course}.`, "✓")
      : actionSuccess("Alumno quitado del curso", `${student.name} quedo sin curso asignado.`, "✓");
  } catch (error) {
    return actionError(error, "No se pudo actualizar el curso");
  }
}
export async function createStudent(_prevState: DashboardActionState, formData: FormData): Promise<DashboardActionState> {
  const { supabase, user, school, isAdmin } = await getDashboardContext();

  try {
    if (!isAdmin) throw new Error("Solo administradores pueden agregar alumnos.");
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
    revalidatePath("/dashboard/courses");
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
  const { supabase, school, isAdmin } = await getDashboardContext();

  try {
    if (!isAdmin) throw new Error("Solo administradores pueden editar alumnos.");
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
    revalidatePath("/dashboard/courses");
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
  revalidatePath("/dashboard/courses");
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



