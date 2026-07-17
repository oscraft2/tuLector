import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/supabase_server";
import { calculateGrade } from "@/lib/latam";
import { resolveNationalId } from "@/lib/national_id";
import { isMissingColumnError, isMissingTableError } from "@/lib/supabase_errors";
import { sendPushToSchool } from "@/lib/push_server";
import { QUIZ_MAX_QUESTIONS } from "@/lib/quiz_constraints";
import { assembleMultipageResult, type PageScanResult } from "@/lib/multipage";

type ScanAnswer = {
  q: number;
  a: string;
  s?: number[];
};

type ScanResultPayload = {
  quizId?: string;
  rut?: string;
  answers?: ScanAnswer[];
  photo?: string | null;
  warp?: string | null;
  source?: "camera" | "upload" | string;
  dvOk?: boolean;
  code?: unknown;
  nameImg?: string | null;
};

type StudentMatch = {
  id: string;
  student_id: string | null;
  rut: string | null;
  rut_normalized: string | null;
  name: string | null;
};

type DashboardCtx = Awaited<ReturnType<typeof getDashboardContext>>;
type SupabaseClient = DashboardCtx["supabase"];
type DashboardSchoolLite = { id: string; scans_used: number | null };

type QuizRow = {
  id: string;
  answer_key: string | null;
  num_questions: number | null;
  evaluation_type: string | null;
  exigencia: number | null;
  sheet_code: number | null;
};

function normalizeAnswers(value: unknown): ScanAnswer[] {
  if (!Array.isArray(value)) return [];
  const answers: ScanAnswer[] = [];
  for (const item of value) {
    const row = item as Partial<ScanAnswer>;
    const q = Number(row.q);
    const a = String(row.a ?? "-").trim().toUpperCase() || "-";
    if (!Number.isInteger(q) || q < 1) continue;
    const answer: ScanAnswer = { q, a };
    if (Array.isArray(row.s)) answer.s = row.s.map(Number).filter(Number.isFinite);
    answers.push(answer);
  }
  return answers.sort((a, b) => a.q - b.q);
}

function answerKeyAt(answerKey: string, index: number) {
  return answerKey.replace(/[^A-Za-z]/g, "").toUpperCase()[index] ?? "";
}

function equivalentScore(evaluationType: string | null | undefined, score: number, total: number) {
  if (total <= 0) return null;
  const pct = score / total;
  if (evaluationType === "paes") return Math.round(100 + pct * 900);
  if (evaluationType === "simce") return Math.round(100 + pct * 300);
  return Math.round(pct * 100);
}

function trimDataUrl(value: string | null | undefined) {
  if (!value || typeof value !== "string") return null;
  if (!value.startsWith("data:image/")) return null;
  return value.length <= 750_000 ? value : null;
}

/** Decodifica el codigo de hoja leido por el cliente: sheetId + page/pagesTotal
 * (ya presentes en v1 y v2 del codec, ver src/tulector/sheet_code.ts). */
function readSheetPage(value: unknown): { sheetId: number; page: number; pagesTotal: number } | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { sheetId?: unknown; page?: unknown; pagesTotal?: unknown };
  const sheetId = typeof v.sheetId === "number" ? v.sheetId : typeof v.sheetId === "string" ? Number(v.sheetId) : NaN;
  const page = typeof v.page === "number" ? v.page : typeof v.page === "string" ? Number(v.page) : NaN;
  const pagesTotal = typeof v.pagesTotal === "number" ? v.pagesTotal : typeof v.pagesTotal === "string" ? Number(v.pagesTotal) : NaN;
  if (!Number.isInteger(sheetId) || sheetId < 0) return null;
  if (!Number.isInteger(page) || page < 1) return null;
  if (!Number.isInteger(pagesTotal) || pagesTotal < 1) return null;
  return { sheetId, page, pagesTotal };
}

async function findStudentByCode(
  supabase: SupabaseClient,
  schoolId: string,
  studentRutNorm: string | null,
  candidateCodes: string[],
) {
  if (studentRutNorm) {
    const { data, error } = await supabase
      .from("students")
      .select("id,student_id,rut,rut_normalized,name")
      .eq("school_id", schoolId)
      .eq("rut_normalized", studentRutNorm)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as StudentMatch;
  }

  for (const code of candidateCodes) {
    const { data: byStudentId, error: studentIdError } = await supabase
      .from("students")
      .select("id,student_id,rut,rut_normalized,name")
      .eq("school_id", schoolId)
      .eq("student_id", code)
      .maybeSingle();
    if (studentIdError) throw studentIdError;
    if (byStudentId) return byStudentId as StudentMatch;

    const { data: byRut, error: rutError } = await supabase
      .from("students")
      .select("id,student_id,rut,rut_normalized,name")
      .eq("school_id", schoolId)
      .eq("rut", code)
      .maybeSingle();
    if (rutError) throw rutError;
    if (byRut) return byRut as StudentMatch;
  }

  return null;
}

async function findExistingPaper(
  supabase: SupabaseClient,
  schoolId: string,
  quizId: string,
  studentRutNorm: string | null,
  candidateCodes: string[],
) {
  if (studentRutNorm) {
    const { data, error } = await supabase
      .from("papers")
      .select("id")
      .eq("school_id", schoolId)
      .eq("quiz_id", quizId)
      .eq("student_rut_norm", studentRutNorm)
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return data;
  }

  for (const code of candidateCodes) {
    const { data, error } = await supabase
      .from("papers")
      .select("id")
      .eq("school_id", schoolId)
      .eq("quiz_id", quizId)
      .eq("student_id", code)
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return data;
  }

  return null;
}

/** Suma 1 a scans_used de forma best-effort (no atomico -- mismo criterio
 * pragmatico que el resto del archivo; el uso real es un profesor escaneando
 * paginas de a una desde un solo telefono, la carrera es improbable). Solo se
 * llama para una pagina NUEVA que NO complete el ensayo (si completa, el
 * INSERT en `papers` ya dispara on_paper_insert_increment_scan_usage). */
async function incrementScansUsed(supabase: SupabaseClient, school: DashboardSchoolLite): Promise<void> {
  try {
    const { data } = await supabase.from("schools").select("scans_used").eq("id", school.id).single();
    const current = data?.scans_used ?? school.scans_used ?? 0;
    await supabase.from("schools").update({ scans_used: current + 1 }).eq("id", school.id);
  } catch (e) {
    console.warn("[scan/result] no se pudo incrementar scans_used (pagina parcial):", e);
  }
}

/**
 * Calcula nota/puntaje, empareja alumno, y persiste el resultado FINAL en
 * `papers`+`grade_records`. Compartida entre el camino de 1 pagina (answers =
 * lo escaneado, numeracion local=global) y el cierre de un ensayo multipagina
 * (answers = assembleMultipageResult(...).answers, ya en numeracion global) --
 * ver docs/plan-multipagina-fase1.md, evita duplicar esta logica dos veces.
 */
async function finalizeGrading(
  ctx: { supabase: SupabaseClient; user: DashboardCtx["user"]; school: DashboardCtx["school"] },
  quiz: QuizRow,
  identity: { studentCode: string; studentRutNorm: string | null; legacyStudentCode: string; candidateCodes: string[] },
  answers: ScanAnswer[],
  extras: { sheetIdRead: number | null; photo: string | null | undefined; nameImg: string | null | undefined; countryCode: string },
) {
  const { supabase, user, school } = ctx;
  const total = Number(quiz.num_questions ?? answers.length);
  const score = answers.reduce((sum, answer) => {
    const expected = answerKeyAt(String(quiz.answer_key ?? ""), answer.q - 1);
    return sum + (answer.a !== "-" && answer.a === expected ? 1 : 0);
  }, 0);
  const gradeResult = calculateGrade(score, total, extras.countryCode, {
    gradeScale: {
      min: school.grading_scale_min ?? 1.0,
      max: school.grading_scale_max ?? 7.0,
    },
    passingGrade: school.passing_grade ?? 4.0,
    exigencia: (quiz.exigencia as number | undefined) ?? school.exigencia ?? 0.60,
  });
  const eqScore = equivalentScore(quiz.evaluation_type, score, total);
  const expectedSheetCode = typeof quiz.sheet_code === "number" ? quiz.sheet_code : null;
  const sheetMismatch = extras.sheetIdRead !== null && expectedSheetCode !== null && extras.sheetIdRead !== expectedSheetCode;

  const { studentCode, studentRutNorm, legacyStudentCode, candidateCodes } = identity;
  let studentName: string | null = null;
  let matchedStudent = false;

  if (studentCode) {
    const student = await findStudentByCode(supabase, school.id, studentRutNorm, candidateCodes);
    if (student) {
      matchedStudent = true;
      studentName = student.name ?? null;
    }
  }

  const status = sheetMismatch || !studentCode || !matchedStudent ? "manual_review" : "corrected";
  const scannedAt = new Date().toISOString();
  const paperPayloadWithoutSheetCode = {
    school_id: school.id,
    quiz_id: quiz.id,
    user_id: user.id,
    student_id: studentCode || null,
    student_rut_norm: studentRutNorm,
    student_name: studentName ?? (studentCode ? "Sin identificar" : "Sin RUT"),
    score,
    total,
    answers: answers.map((answer) => ({ q: answer.q, a: answer.a })),
    raw_scores: answers.map((answer) => ({ q: answer.q, a: answer.a, s: answer.s ?? [] })),
    image_url: trimDataUrl(extras.photo),
    name_img_url: trimDataUrl(extras.nameImg),
    status,
    grade: gradeResult.grade,
    equivalent_score: eqScore,
    scanned_at: scannedAt,
    corrected_answers: [],
  };
  const paperPayload = {
    ...paperPayloadWithoutSheetCode,
    sheet_code_read: extras.sheetIdRead,
  };

  let paperId: string | null = null;
  let action: "inserted" | "updated" = "inserted";

  if (studentCode) {
    const existing = await findExistingPaper(supabase, school.id, quiz.id, studentRutNorm, candidateCodes);

    if (existing?.id) {
      let updateResult = await supabase
        .from("papers")
        .update(paperPayload)
        .eq("id", existing.id)
        .select("id")
        .single();

      if (updateResult.error && isMissingColumnError(updateResult.error, "sheet_code_read")) {
        updateResult = await supabase
          .from("papers")
          .update(paperPayloadWithoutSheetCode)
          .eq("id", existing.id)
          .select("id")
          .single();
      }

      const { data: updated, error: updateError } = updateResult;
      if (updateError) throw updateError;
      paperId = updated.id;
      action = "updated";
    }
  }

  if (!paperId) {
    let insertResult = await supabase
      .from("papers")
      .insert(paperPayload)
      .select("id")
      .single();

    if (insertResult.error && isMissingColumnError(insertResult.error, "sheet_code_read")) {
      insertResult = await supabase
        .from("papers")
        .insert(paperPayloadWithoutSheetCode)
        .select("id")
        .single();
    }

    const { data: inserted, error: insertError } = insertResult;
    if (insertError) throw insertError;
    paperId = inserted.id;
  }

  const studentRecordCode = studentRutNorm ?? legacyStudentCode;
  // Una hoja de otro ensayo queda en revision y no debe convertirse en nota valida.
  if (studentRecordCode && !sheetMismatch) {
    await supabase.from("grade_records").upsert({
      school_id: school.id,
      student_code: studentRecordCode,
      quiz_id: quiz.id,
      paper_id: paperId,
      raw_score: score,
      total_questions: total,
      calculated_grade: gradeResult.grade,
      passing: gradeResult.passing,
      graded_at: scannedAt,
    }, { onConflict: "school_id,student_code,quiz_id" });
  }

  return {
    action, paperId, status, matchedStudent, studentName,
    studentCode: studentCode || null, studentRutNorm,
    score, total, grade: gradeResult.grade, equivalentScore: eqScore,
    sheetMismatch: sheetMismatch ? { read: extras.sheetIdRead, expected: expectedSheetCode } : undefined,
  };
}

/** Lee el valor actual de scans_used para armar la alerta de cuota (el
 * trigger on_paper_insert, o incrementScansUsed en la rama multipagina, ya
 * hicieron el incremento -- esto solo lee para avisar). */
async function readQuotaStatus(supabase: SupabaseClient, school: DashboardCtx["school"]) {
  try {
    const { data: schoolRow, error: quotaError } = await supabase
      .from("schools")
      .select("scans_used")
      .eq("id", school.id)
      .single();
    if (quotaError) return null;
    const used = schoolRow?.scans_used ?? (school.scans_used ?? 0) + 1;
    const limit = school.scans_limit ?? 0;
    let warning: string | null = null;
    if (limit > 0 && used >= limit) warning = `Cuota de escaneos agotada (${used}/${limit}). Amplia tu plan en Facturacion.`;
    else if (limit > 0 && used >= limit * 0.9) warning = `Cuota casi agotada (${used}/${limit}).`;

    if (limit > 0 && used >= limit * 0.9) {
      void sendPushToSchool(school.id, {
        title: used >= limit ? "Cuota de escaneos agotada" : "Cuota de escaneos casi agotada",
        body: used >= limit
          ? `Alcanzaste el limite de ${limit} escaneos. Sube de plan para seguir escaneando.`
          : `Has usado ${used} de ${limit} escaneos. Queda poco para llegar al limite.`,
        data: { type: "quota", used: String(used), limit: String(limit) },
      });
    }
    return { used, limit, warning };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => null)) as ScanResultPayload | null;
    if (!payload) return NextResponse.json({ error: "Payload invalido" }, { status: 400 });

    const quizId = String(payload.quizId ?? "").trim();
    const answers = normalizeAnswers(payload.answers);
    if (!quizId) return NextResponse.json({ error: "Falta quizId" }, { status: 400 });
    if (answers.length === 0) return NextResponse.json({ error: "No hay respuestas para guardar" }, { status: 400 });

    const { supabase, user, school } = await getDashboardContext();

    let quizResult = await supabase
      .from("quizzes")
      .select("id,school_id,title,answer_key,num_questions,evaluation_type,evaluation_variant,sheet_code,exigencia")
      .eq("id", quizId)
      .eq("school_id", school.id)
      .is("archived_at", null)
      .single();

    if (quizResult.error && isMissingColumnError(quizResult.error, "sheet_code")) {
      quizResult = await supabase
        .from("quizzes")
        .select("id,school_id,title,answer_key,num_questions,evaluation_type,evaluation_variant,exigencia")
        .eq("id", quizId)
        .eq("school_id", school.id)
        .is("archived_at", null)
        .single();
    }

    const { data: quiz, error: quizError } = quizResult;

    if (quizError || !quiz) return NextResponse.json({ error: "Ensayo no disponible" }, { status: 404 });

    const rawRut = String(payload.rut ?? "").trim();
    const countryCode = school.country_code ?? "CL";
    const resolvedId = resolveNationalId(rawRut, countryCode);
    const studentCode = rawRut;
    const legacyStudentCode = rawRut ? resolvedId.normalized : "";
    const studentRutNorm = resolvedId.canonical;
    const candidateCodes = Array.from(new Set([studentCode, legacyStudentCode].filter(Boolean)));

    const codeR = readSheetPage(payload.code);
    const total = Number(quiz.num_questions ?? answers.length);
    // Multipagina (Fase 1): pagesTotal se DERIVA de num_questions, nunca de lo
    // impreso en la hoja -- una sola fuente de verdad, ver
    // docs/plan-multipagina-fase1.md. pagesTotal<=1 (el 100% del trafico real
    // de hoy) corre exactamente el camino de siempre, sin ninguna rama nueva.
    const pagesTotal = Math.max(1, Math.ceil(total / QUIZ_MAX_QUESTIONS));

    if (pagesTotal > 1) {
      if (!studentCode || !codeR) {
        // Sin ID legible o sin codigo de hoja no hay forma segura de saber a
        // que pagina del ensayo corresponde este escaneo -- a revision manual,
        // sin tocar paper_pages/papers/grade_records.
        return NextResponse.json({
          ok: true,
          status: "manual_review",
          matchedStudent: false,
          studentName: null,
          studentCode: studentCode || null,
          multipage: { complete: false, reason: !studentCode ? "sin_id" : "sin_codigo_hoja" },
        });
      }

      const globalAnswers = answers
        .map((a) => ({ ...a, q: (codeR.page - 1) * QUIZ_MAX_QUESTIONS + a.q }))
        .filter((a) => a.q <= total);

      const { data: existingPage, error: existingPageError } = await supabase
        .from("paper_pages")
        .select("id")
        .eq("quiz_id", quiz.id)
        .eq("student_code_norm", legacyStudentCode)
        .eq("page", codeR.page)
        .maybeSingle();

      // Degradacion elegante: si la migracion de paper_pages todavia no se
      // aplico en produccion (ver docs/plan-multipagina-fase1.md), no tirar
      // 500 -- a revision manual sin tocar nada, igual que "sin_id".
      if (existingPageError && isMissingTableError(existingPageError, "paper_pages")) {
        console.warn("[scan/result] paper_pages no existe todavia (migracion pendiente)");
        return NextResponse.json({
          ok: true,
          status: "manual_review",
          matchedStudent: false,
          studentName: null,
          studentCode,
          multipage: { complete: false, reason: "tabla_pendiente" },
        });
      }
      const isNewPage = !existingPage;

      const { error: pageUpsertError } = await supabase.from("paper_pages").upsert({
        school_id: school.id,
        quiz_id: quiz.id,
        student_code_norm: legacyStudentCode,
        student_code_raw: studentCode,
        sheet_id: codeR.sheetId,
        page: codeR.page,
        pages_total: pagesTotal,
        answers: globalAnswers.map((a) => ({ q: a.q, a: a.a })),
        scanned_at: new Date().toISOString(),
      }, { onConflict: "quiz_id,student_code_norm,page" });
      if (pageUpsertError) throw pageUpsertError;

      const { data: pageRows } = await supabase
        .from("paper_pages")
        .select("page,pages_total,sheet_id,answers,scanned_at")
        .eq("quiz_id", quiz.id)
        .eq("student_code_norm", legacyStudentCode);

      const assembled = assembleMultipageResult((pageRows ?? []).map((row): PageScanResult => ({
        page: row.page,
        pagesTotal: row.pages_total,
        sheetId: row.sheet_id,
        studentCode: legacyStudentCode,
        answers: (row.answers ?? []) as { q: number; a: string }[],
        scannedAt: row.scanned_at,
      })));

      if (!assembled.complete) {
        if (isNewPage) await incrementScansUsed(supabase, school);
        return NextResponse.json({
          ok: true,
          matchedStudent: false,
          studentName: null,
          studentCode,
          multipage: {
            complete: false,
            page: codeR.page,
            pagesTotal,
            pagesPresent: assembled.pagesPresent,
            missingPages: assembled.missingPages,
          },
        });
      }

      const result = await finalizeGrading(
        { supabase, user, school },
        quiz as QuizRow,
        { studentCode, studentRutNorm, legacyStudentCode, candidateCodes },
        assembled.answers,
        { sheetIdRead: codeR.sheetId, photo: payload.photo, nameImg: payload.nameImg, countryCode },
      );
      // El INSERT en `papers` (si action==="inserted") ya dispara
      // on_paper_insert_increment_scan_usage -- no sumar cupo de nuevo aca
      // aunque esta pagina fuera nueva (evitar cobrar 2 veces la ultima pagina).
      const quota = await readQuotaStatus(supabase, school);

      return NextResponse.json({
        ok: true,
        ...result,
        multipage: { complete: true, page: codeR.page, pagesTotal, pagesPresent: assembled.pagesPresent, missingPages: [] },
        quota,
      });
    }

    // ── Camino de 1 pagina (hoy, sin cambios de comportamiento) ──
    const result = await finalizeGrading(
      { supabase, user, school },
      quiz as QuizRow,
      { studentCode, studentRutNorm, legacyStudentCode, candidateCodes },
      answers,
      { sheetIdRead: codeR?.sheetId ?? null, photo: payload.photo, nameImg: payload.nameImg, countryCode },
    );
    const quota = await readQuotaStatus(supabase, school);

    return NextResponse.json({ ok: true, ...result, quota });
  } catch (error) {
    console.error("[scan/result]", error);
    return NextResponse.json({ error: "No se pudo guardar el resultado" }, { status: 500 });
  }
}
