import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase_server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { resolveDisplayName, type PrivacyLevel } from "@/lib/display_name";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const adminClient = createSupabaseAdminClient();
    const anonClient = await createSupabaseServerClient();

    const { data: link, error: linkError } = await adminClient
      .from("result_links")
      .select("id, school_id, quiz_id, paper_id, privacy_level, created_at, revoked_at, view_count, last_viewed_at")
      .eq("token", token)
      .is("revoked_at", null)
      .maybeSingle();

    if (linkError || !link) {
      return NextResponse.json({ error: "Enlace no valido o revocado" }, { status: 404 });
    }

    const [{ data: paper }, { data: quiz }, { data: schoolRow }] = await Promise.all([
      anonClient.from("papers").select("id, student_name, student_id, score, total, answers, scanned_at, equivalent_score, grade, student_rut_norm").eq("id", link.paper_id).single(),
      anonClient.from("quizzes").select("id, title, num_questions, answer_key, evaluation_type, evaluation_variant, subject, grade").eq("id", link.quiz_id).single(),
      anonClient.from("schools").select("name").eq("id", link.school_id).single(),
    ]);

    if (!paper || !quiz) {
      return NextResponse.json({ error: "Resultado no disponible" }, { status: 404 });
    }

    const displayName = resolveDisplayName(
      (paper as Record<string, unknown>).student_name as string | null ?? null,
      (paper as Record<string, unknown>).student_id as string | null ?? null,
      link.privacy_level as PrivacyLevel,
    );

    const normalizedAnswers: string[] = [];
    const rawScores: number[][] = [];
    const rawAnswers = (paper as Record<string, unknown>).answers;
    if (Array.isArray(rawAnswers)) {
      for (const item of rawAnswers) {
        const qIdx = typeof item.q === "number" ? item.q - 1 : -1;
        if (qIdx >= 0) {
          normalizedAnswers[qIdx] = String(item.a ?? "-").trim().toUpperCase() || "-";
        }
        if (Array.isArray(item.s)) {
          rawScores[qIdx] = item.s.map(Number).filter(Number.isFinite);
        }
      }
    }

    const answerKey = String((quiz as Record<string, unknown>).answer_key ?? "").replace(/[^A-Za-z]/g, "").toUpperCase();
    const numQuestions = (quiz as Record<string, unknown>).num_questions as number ?? 0;

    const questions = Array.from({ length: numQuestions }, (_, i) => ({
      q: i + 1,
      answer: normalizedAnswers[i] ?? "-",
      expected: answerKey[i] ?? "",
      correct: normalizedAnswers[i] ? normalizedAnswers[i] === (answerKey[i] ?? "") : false,
      rawScores: rawScores[i] ?? null,
    }));

    await adminClient.rpc("increment_result_link_view", { link_id: link.id });

    return NextResponse.json({
      token,
      student: {
        name: displayName,
        score: (paper as Record<string, unknown>).score,
        total: (paper as Record<string, unknown>).total ?? numQuestions,
        grade: (paper as Record<string, unknown>).grade,
        equivalent_score: (paper as Record<string, unknown>).equivalent_score,
        scanned_at: (paper as Record<string, unknown>).scanned_at,
      },
      quiz: {
        title: (quiz as Record<string, unknown>).title,
        num_questions: numQuestions,
        evaluation_type: (quiz as Record<string, unknown>).evaluation_type,
        evaluation_variant: (quiz as Record<string, unknown>).evaluation_variant,
        subject: (quiz as Record<string, unknown>).subject,
        grade: (quiz as Record<string, unknown>).grade,
      },
      school: {
        name: schoolRow ? (schoolRow as Record<string, unknown>).name as string : "",
      },
      questions,
    });
  } catch (error) {
    console.error("[r/token]", error);
    return NextResponse.json({ error: "Error al obtener el resultado" }, { status: 500 });
  }
}
