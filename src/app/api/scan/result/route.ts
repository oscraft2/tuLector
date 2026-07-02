import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/supabase_server";
import { calculateGrade } from "@/lib/latam";
import { normalizeRut } from "@/lib/rut";

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

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => null)) as ScanResultPayload | null;
    if (!payload) return NextResponse.json({ error: "Payload invalido" }, { status: 400 });

    const quizId = String(payload.quizId ?? "").trim();
    const answers = normalizeAnswers(payload.answers);
    if (!quizId) return NextResponse.json({ error: "Falta quizId" }, { status: 400 });
    if (answers.length === 0) return NextResponse.json({ error: "No hay respuestas para guardar" }, { status: 400 });

    const { supabase, user, school } = await getDashboardContext();

    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .select("id,school_id,title,answer_key,num_questions,evaluation_type,evaluation_variant")
      .eq("id", quizId)
      .eq("school_id", school.id)
      .is("archived_at", null)
      .single();

    if (quizError || !quiz) return NextResponse.json({ error: "Ensayo no disponible" }, { status: 404 });

    const total = Number(quiz.num_questions ?? answers.length);
    const score = answers.reduce((sum, answer) => {
      const expected = answerKeyAt(String(quiz.answer_key ?? ""), answer.q - 1);
      return sum + (answer.a !== "-" && answer.a === expected ? 1 : 0);
    }, 0);

    const rawRut = String(payload.rut ?? "").trim();
    const studentCode = rawRut ? normalizeRut(rawRut) : "";
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

    let studentName: string | null = null;
    let matchedStudent = false;

    if (studentCode) {
      const { data: student } = await supabase
        .from("students")
        .select("student_id,name")
        .eq("school_id", school.id)
        .or(`student_id.eq.${studentCode},rut.eq.${studentCode}`)
        .maybeSingle();

      if (student) {
        matchedStudent = true;
        studentName = student.name ?? null;
      }
    }

    const status = studentCode && matchedStudent ? "corrected" : "manual_review";
    const scannedAt = new Date().toISOString();
    const paperPayload = {
      school_id: school.id,
      quiz_id: quiz.id,
      user_id: user.id,
      student_id: studentCode || null,
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

    let paperId: string | null = null;
    let action: "inserted" | "updated" = "inserted";

    if (studentCode) {
      const { data: existing } = await supabase
        .from("papers")
        .select("id")
        .eq("school_id", school.id)
        .eq("quiz_id", quiz.id)
        .eq("student_id", studentCode)
        .maybeSingle();

      if (existing?.id) {
        const { data: updated, error: updateError } = await supabase
          .from("papers")
          .update(paperPayload)
          .eq("id", existing.id)
          .select("id")
          .single();
        if (updateError) throw updateError;
        paperId = updated.id;
        action = "updated";
      }
    }

    if (!paperId) {
      const { data: inserted, error: insertError } = await supabase
        .from("papers")
        .insert(paperPayload)
        .select("id")
        .single();
      if (insertError) throw insertError;
      paperId = inserted.id;
    }

    if (studentCode) {
      await supabase.from("grade_records").upsert({
        school_id: school.id,
        student_code: studentCode,
        quiz_id: quiz.id,
        paper_id: paperId,
        raw_score: score,
        total_questions: total,
        calculated_grade: gradeResult.grade,
        passing: gradeResult.passing,
        graded_at: scannedAt,
      }, { onConflict: "school_id,student_code,quiz_id" });
    }

    return NextResponse.json({
      ok: true,
      action,
      paperId,
      status,
      matchedStudent,
      studentName,
      studentCode: studentCode || null,
      score,
      total,
      grade: gradeResult.grade,
      equivalentScore: eqScore,
    });
  } catch (error) {
    console.error("[scan/result]", error);
    return NextResponse.json({ error: "No se pudo guardar el resultado" }, { status: 500 });
  }
}
