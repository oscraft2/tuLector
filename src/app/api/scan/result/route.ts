import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/supabase_server";
import { calculateGrade } from "@/lib/latam";
import { canonicalRut, normalizeRut } from "@/lib/rut";
import { isMissingColumnError } from "@/lib/supabase_errors";

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

function readSheetId(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const raw = (value as { sheetId?: unknown }).sheetId;
  const sheetId = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isInteger(sheetId) && sheetId >= 0 ? sheetId : null;
}

async function findStudentByCode(
  supabase: Awaited<ReturnType<typeof getDashboardContext>>["supabase"],
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
  supabase: Awaited<ReturnType<typeof getDashboardContext>>["supabase"],
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
      .select("id,school_id,title,answer_key,num_questions,evaluation_type,evaluation_variant,sheet_code")
      .eq("id", quizId)
      .eq("school_id", school.id)
      .is("archived_at", null)
      .single();

    if (quizResult.error && isMissingColumnError(quizResult.error, "sheet_code")) {
      quizResult = await supabase
        .from("quizzes")
        .select("id,school_id,title,answer_key,num_questions,evaluation_type,evaluation_variant")
        .eq("id", quizId)
        .eq("school_id", school.id)
        .is("archived_at", null)
        .single();
    }

    const { data: quiz, error: quizError } = quizResult;

    if (quizError || !quiz) return NextResponse.json({ error: "Ensayo no disponible" }, { status: 404 });

    const total = Number(quiz.num_questions ?? answers.length);
    const score = answers.reduce((sum, answer) => {
      const expected = answerKeyAt(String(quiz.answer_key ?? ""), answer.q - 1);
      return sum + (answer.a !== "-" && answer.a === expected ? 1 : 0);
    }, 0);

    const rawRut = String(payload.rut ?? "").trim();
    const studentCode = rawRut;
    const legacyStudentCode = rawRut ? normalizeRut(rawRut) : "";
    const studentRutNorm = canonicalRut(rawRut);
    const candidateCodes = Array.from(new Set([studentCode, legacyStudentCode].filter(Boolean)));
    const countryCode = school.country_code ?? "CL";
    const gradeResult = calculateGrade(score, total, countryCode, {
      gradeScale: {
        min: school.grading_scale_min ?? 1.0,
        max: school.grading_scale_max ?? 7.0,
      },
      passingGrade: school.passing_grade ?? 4.0,
      exigencia: school.exigencia ?? 0.60,
    });
    const eqScore = equivalentScore(quiz.evaluation_type, score, total);
    const sheetIdRead = readSheetId(payload.code);
    const expectedSheetCode = typeof quiz.sheet_code === "number" ? quiz.sheet_code : null;
    const sheetMismatch = sheetIdRead !== null && expectedSheetCode !== null && sheetIdRead !== expectedSheetCode;

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
      image_url: trimDataUrl(payload.photo),
      name_img_url: trimDataUrl(payload.nameImg),
      status,
      grade: gradeResult.grade,
      equivalent_score: eqScore,
      scanned_at: scannedAt,
      corrected_answers: [],
    };
    const paperPayload = {
      ...paperPayloadWithoutSheetCode,
      sheet_code_read: sheetIdRead,
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

    // Cuota REAL: cada escaneo procesado consume 1 (alimenta QuotaBar, alertas 90/100%
    // y billing). RPC atomica SECURITY DEFINER (los profes no pueden editar schools por
    // RLS). Tope SUAVE: se informa, no se bloquea el escaneo. Si la funcion aun no
    // existe en la BD, el escaneo NO falla (degrada sin cuota).
    let quota: { used: number; limit: number; warning: string | null } | null = null;
    try {
      const { data: used, error: quotaError } = await supabase.rpc("increment_scans_used", { p_school_id: school.id });
      if (!quotaError && typeof used === "number") {
        const limit = school.scans_limit ?? 0;
        let warning: string | null = null;
        if (limit > 0 && used >= limit) warning = `Cuota de escaneos agotada (${used}/${limit}). Amplia tu plan en Facturacion.`;
        else if (limit > 0 && used >= limit * 0.9) warning = `Cuota casi agotada (${used}/${limit}).`;
        quota = { used, limit, warning };
      }
    } catch { /* sin cuota disponible: no bloquea el flujo */ }

    return NextResponse.json({
      ok: true,
      action,
      paperId,
      status,
      matchedStudent,
      studentName,
      studentCode: studentCode || null,
      studentRutNorm,
      score,
      total,
      grade: gradeResult.grade,
      equivalentScore: eqScore,
      sheetMismatch: sheetMismatch ? { read: sheetIdRead, expected: expectedSheetCode } : undefined,
      quota,
    });
  } catch (error) {
    console.error("[scan/result]", error);
    return NextResponse.json({ error: "No se pudo guardar el resultado" }, { status: 500 });
  }
}
