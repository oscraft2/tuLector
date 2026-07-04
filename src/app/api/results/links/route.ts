import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/supabase_server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { supabase } = await getDashboardContext();
    const { searchParams } = new URL(request.url);
    const quizId = searchParams.get("quizId");

    if (!quizId) return NextResponse.json({ error: "Falta quizId" }, { status: 400 });

    const { data, error } = await supabase
      .from("result_links")
      .select("id, paper_id, token, privacy_level, created_at, revoked_at, view_count, last_viewed_at, papers(student_name, student_id)")
      .eq("quiz_id", quizId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const links = (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id,
      token: row.token,
      privacy_level: row.privacy_level,
      created_at: row.created_at,
      revoked_at: row.revoked_at,
      view_count: row.view_count,
      last_viewed_at: row.last_viewed_at,
      student_name: (row.papers as { student_name?: string; student_id?: string } | null)?.student_name ?? null,
      student_id: (row.papers as { student_name?: string; student_id?: string } | null)?.student_id ?? null,
    }));

    return NextResponse.json({ links });
  } catch (error) {
    console.error("[results/links GET]", error);
    return NextResponse.json({ error: "No se pudieron obtener los enlaces" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, school, user, isAdmin } = await getDashboardContext();

    if (!isAdmin) return NextResponse.json({ error: "Solo administradores del colegio pueden generar enlaces" }, { status: 403 });

    const body = await request.json().catch(() => null);

    if (!body?.quizId) return NextResponse.json({ error: "Falta quizId" }, { status: 400 });

    const quizId = String(body.quizId);
    const studentIds: string[] | undefined = Array.isArray(body.studentIds) ? body.studentIds.map(String) : undefined;
    const allStudents = studentIds ? false : true;
    const privacyLevel = ["full_name", "initials_only", "id_only"].includes(body.privacyLevel)
      ? body.privacyLevel
      : "full_name";

    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .select("id, title")
      .eq("id", quizId)
      .eq("school_id", school.id)
      .single();

    if (quizError || !quiz) return NextResponse.json({ error: "Ensayo no encontrado" }, { status: 404 });

    const statusFilter = "corrected";
    let papersQuery = supabase
      .from("papers")
      .select("id, student_name, student_id")
      .eq("school_id", school.id)
      .eq("quiz_id", quizId);

    try {
      papersQuery = papersQuery.eq("status", statusFilter);
    } catch {
      // status column may not exist in all environments
    }

    if (!allStudents && studentIds && studentIds.length > 0) {
      papersQuery = papersQuery.in("student_id", studentIds);
    }

    const { data: papers, error: papersError } = await papersQuery;

    if (papersError) throw papersError;
    if (!papers || papers.length === 0) {
      return NextResponse.json({ error: "No hay hojas corregidas para generar enlaces" }, { status: 404 });
    }

    const existingTokens = new Set<string>();
    const { data: existing } = await supabase
      .from("result_links")
      .select("paper_id, token")
      .in("paper_id", papers.map((p) => p.id))
      .is("revoked_at", null);

    for (const row of existing ?? []) {
      existingTokens.add(row.paper_id);
    }

    const rowsToInsert = papers
      .filter((p) => !existingTokens.has(p.id))
      .map((p) => ({
        school_id: school.id,
        quiz_id: quizId,
        paper_id: p.id,
        created_by: user.id,
        privacy_level: privacyLevel,
      }));

    if (rowsToInsert.length === 0) {
      return NextResponse.json({ links: [], message: "Todos los alumnos ya tienen enlaces activos" });
    }

    const { data: inserted, error: insertError } = await supabase
      .from("result_links")
      .insert(rowsToInsert)
      .select("id, paper_id, token, privacy_level, created_at");

    if (insertError) throw insertError;

    const links = (inserted ?? []).map((row: Record<string, unknown>) => ({
      id: row.id,
      token: row.token,
      privacy_level: row.privacy_level,
      created_at: row.created_at,
      student_name: papers.find((p) => p.id === row.paper_id)?.student_name ?? null,
      student_id: papers.find((p) => p.id === row.paper_id)?.student_id ?? null,
    }));

    return NextResponse.json({ links });
  } catch (error) {
    console.error("[results/links POST]", error);
    return NextResponse.json({ error: "No se pudieron generar los enlaces" }, { status: 500 });
  }
}
