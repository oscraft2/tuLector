import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase_server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { canonicalRut } from "@/lib/rut";
import { resolveDisplayName, type PrivacyLevel } from "@/lib/display_name";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rut = searchParams.get("rut")?.trim();

    if (!rut) return NextResponse.json({ error: "Ingresa un RUT" }, { status: 400 });

    const normalizedRut = canonicalRut(rut);
    if (!normalizedRut) return NextResponse.json({ error: "RUT no valido" }, { status: 400 });

    const adminClient = createSupabaseAdminClient();
    const anonClient = await createSupabaseServerClient();

    const { data: links, error } = await adminClient
      .from("result_links")
      .select("id, token, privacy_level, created_at, paper_id")
      .is("revoked_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!links || links.length === 0) {
      return NextResponse.json({ results: [], message: "No hay resultados publicados para este RUT" });
    }

    const paperIds = links.map((r: Record<string, unknown>) => r.paper_id);
    const paperIdByLink: Record<string, Record<string, unknown>> = {};
    for (const l of links) {
      paperIdByLink[l.paper_id as string] = l;
    }

    const { data: papers, error: paperError } = await anonClient
      .from("papers")
      .select("id, student_name, student_id, score, total, grade, equivalent_score, scanned_at, quiz_id, student_rut_norm")
      .in("id", paperIds)
      .eq("student_rut_norm", normalizedRut);

    if (paperError) throw paperError;
    if (!papers || papers.length === 0) {
      return NextResponse.json({ results: [], message: "No hay resultados publicados para este RUT" });
    }

    const quizIds = [...new Set(papers.map((p: Record<string, unknown>) => p.quiz_id))];
    const { data: quizzes, error: quizError } = await anonClient
      .from("quizzes")
      .select("id, title, num_questions, evaluation_type, evaluation_variant, subject")
      .in("id", quizIds);

    if (quizError) throw quizError;
    const quizMap = new Map<string, Record<string, unknown>>();
    for (const q of (quizzes ?? [])) {
      quizMap.set(q.id as string, q);
    }

    const results = papers.map((paper: Record<string, unknown>) => {
      const link = paperIdByLink[paper.id as string] ?? {};
      const quiz = quizMap.get(paper.quiz_id as string) ?? {};
      const privacyLevel = (link.privacy_level ?? "full_name") as PrivacyLevel;

      return {
        token: link.token ?? "",
        display_name: resolveDisplayName(
          paper.student_name as string | null ?? null,
          paper.student_id as string | null ?? null,
          privacyLevel,
        ),
        score: paper.score ?? 0,
        total: paper.total ?? (quiz.num_questions ?? 0),
        grade: paper.grade ?? null,
        equivalent_score: paper.equivalent_score ?? null,
        quiz_title: quiz.title ?? "Sin titulo",
        quiz_subject: quiz.subject ?? null,
        evaluation_type: quiz.evaluation_type ?? "custom",
        scanned_at: paper.scanned_at ?? null,
        num_questions: quiz.num_questions ?? 0,
      };
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[consulta]", error);
    return NextResponse.json({ error: "Error al buscar resultados" }, { status: 500 });
  }
}
