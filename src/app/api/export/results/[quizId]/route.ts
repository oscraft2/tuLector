import { getDashboardContext } from "@/lib/supabase_server";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

type ResultsExportRow = {
  student_name: string | null;
  student_id: string | null;
  score: number | null;
  total: number | null;
  equivalent_score: number | null;
  grade: string | number | null;
  scanned_at: string | null;
};

export async function GET(_request: Request, { params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params;
  const { supabase, user, school, isAdmin } = await getDashboardContext();
  if (!isAdmin) return new Response("Solo administradores pueden exportar resultados.", { status: 403 });

  const { data: quiz, error: quizError } = await supabase
    .from("quizzes")
    .select("id, title")
    .eq("id", quizId)
    .eq("school_id", school.id)
    .single();

  if (quizError || !quiz) return new Response("Ensayo no encontrado.", { status: 404 });

  const { data, error } = await supabase
    .from("papers")
    .select("student_name, student_id, score, total, equivalent_score, grade, scanned_at")
    .eq("school_id", school.id)
    .eq("quiz_id", quiz.id)
    .order("score", { ascending: false });

  if (error) return new Response("No se pudo generar el CSV de resultados.", { status: 500 });

  const rows = (data ?? []) as ResultsExportRow[];
  const csv = toCsv(
    ["alumno", "rut", "correctas", "total", "porcentaje", "nota", "puntaje_equivalente", "fecha"],
    rows.map((paper) => {
      const total = paper.total ?? 0;
      const score = paper.score ?? 0;
      const pct = total > 0 ? `${Math.round((score / total) * 100)}%` : "";
      return [
        paper.student_name ?? "Sin identificar",
        paper.student_id ?? "",
        paper.score ?? "",
        paper.total ?? "",
        pct,
        paper.grade ?? "",
        paper.equivalent_score ?? "",
        formatDateTime(paper.scanned_at),
      ];
    }),
  );

  const { error: logError } = await supabase.from("export_logs").insert({
    school_id: school.id,
    user_id: user.id,
    export_type: "results_csv",
    entity_type: "quiz",
    entity_id: quiz.id,
    reason: "exportacion CSV de resultados",
    row_count: rows.length,
  });

  if (logError) return new Response("No se pudo registrar la exportacion.", { status: 500 });

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="resultados_${toFilenameSlug(quiz.title)}.csv"`,
    },
  });
}

function formatDateTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("es-CL");
}

function toFilenameSlug(value: string | null) {
  const slug = (value ?? "ensayo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "ensayo";
}
