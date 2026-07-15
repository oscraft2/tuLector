import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase_server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { resolveNationalId } from "@/lib/national_id";
import { resolveCountryProfile } from "@/lib/country_profiles";
import { resolveDisplayName, type PrivacyLevel } from "@/lib/display_name";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rut = searchParams.get("rut")?.trim();
    // Default "CL" por compatibilidad: links viejos guardados/compartidos antes
    // de la Fase multi-pais no traen &country= y deben seguir funcionando igual.
    const countryCode = searchParams.get("country")?.trim() || "CL";
    const countryProfile = resolveCountryProfile(countryCode);

    if (!rut) return NextResponse.json({ error: `Ingresa un ${countryProfile.studentIdLabel}` }, { status: 400 });

    const resolvedId = resolveNationalId(rut, countryProfile.code);
    if (!resolvedId.canonical) return NextResponse.json({ error: `${countryProfile.studentIdLabel} no valido` }, { status: 400 });
    const normalizedRut = resolvedId.canonical;

    const adminClient = createSupabaseAdminClient();
    const anonClient = await createSupabaseServerClient();

    const { data: links, error } = await adminClient
      .from("result_links")
      .select("id, token, privacy_level, created_at, paper_id")
      .is("revoked_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!links || links.length === 0) {
      return NextResponse.json({ results: [], message: `No hay resultados publicados para este ${countryProfile.studentIdLabel}` });
    }

    const paperIds = links.map((r: Record<string, unknown>) => r.paper_id);
    const paperIdByLink: Record<string, Record<string, unknown>> = {};
    for (const l of links) {
      paperIdByLink[l.paper_id as string] = l;
    }

    const { data: papersRaw, error: paperError } = await anonClient
      .from("papers")
      .select("id, student_name, student_id, score, total, grade, equivalent_score, scanned_at, quiz_id, student_rut_norm, school_id")
      .in("id", paperIds)
      .eq("student_rut_norm", normalizedRut);

    if (paperError) throw paperError;
    if (!papersRaw || papersRaw.length === 0) {
      return NextResponse.json({ results: [], message: `No hay resultados publicados para este ${countryProfile.studentIdLabel}` });
    }

    // El ID normalizado NO es unico global entre paises (un DNI argentino y
    // una CI uruguaya pueden coincidir como string) — este endpoint es publico
    // y muestra notas, asi que se cruza contra el pais del colegio del paper
    // para no filtrar el resultado de un alumno de OTRO pais por coincidencia
    // numerica. Solo aplica si el colegio tiene country_code (default "CL" en
    // schools, asi que en la practica siempre lo tiene).
    const schoolIds = [...new Set(papersRaw.map((p: Record<string, unknown>) => p.school_id).filter(Boolean))];
    const { data: schoolRows } = schoolIds.length
      ? await anonClient.from("schools").select("id, country_code").in("id", schoolIds)
      : { data: [] as { id: string; country_code: string | null }[] };
    const schoolCountry = new Map((schoolRows ?? []).map((s) => [s.id, s.country_code ?? "CL"]));
    const papers = papersRaw.filter((p: Record<string, unknown>) => schoolCountry.get(p.school_id as string) === countryProfile.code);

    if (papers.length === 0) {
      return NextResponse.json({ results: [], message: `No hay resultados publicados para este ${countryProfile.studentIdLabel}` });
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
