import Link from "next/link";
import { getDashboardContext } from "@/lib/supabase_server";
import { getDashboardMessages } from "@/locales";
import { DataTable } from "@/components/dashboard/DataTable";
import { StatusPill } from "@/components/AppShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { isMissingColumnError } from "@/lib/supabase_errors";

export const dynamic = "force-dynamic";

type PaperRow = {
  id: string;
  quiz_id: string;
  student_name: string | null;
  student_id: string | null;
  score: number | null;
  total: number | null;
  status: string | null;
  image_url: string | null;
  storage_path: string | null;
  scanned_at: string;
  sheet_code_read?: number | null;
  quizzes?: { sheet_code: number | null } | Array<{ sheet_code: number | null }> | null;
};

export default async function PapersPage() {
  const { supabase, locale } = await getDashboardContext();
  const t = getDashboardMessages(locale);
  const papersResult = await supabase.from("papers").select("id,quiz_id,student_name,student_id,score,total,status,image_url,storage_path,scanned_at,sheet_code_read,quizzes(sheet_code)").order("scanned_at", { ascending: false }).limit(100);
  let papersData: unknown = papersResult.data;
  if (papersResult.error && isMissingColumnError(papersResult.error, "sheet_code_read")) {
    const fallbackResult = await supabase.from("papers").select("id,quiz_id,student_name,student_id,score,total,status,image_url,storage_path,scanned_at,quizzes(sheet_code)").order("scanned_at", { ascending: false }).limit(100);
    papersData = fallbackResult.data;
  }
  const papers = (papersData ?? []) as unknown as PaperRow[];
  return (
    <>
      <PageHeader title={t.papers} description="Lecturas sincronizadas desde la app movil. Desde aqui se auditan, anulan, corrigen manualmente y alimentan ground truth para entrenamiento." />
      <DataTable
        columns={["Alumno", "Puntaje", "Estado", "Foto", "Fecha", "Accion"]}
        rows={papers}
        empty="La app todavia no ha sincronizado lecturas."
        renderRow={(paper) => (
          <tr key={paper.id} className="border-b border-[#eef0f3] last:border-0">
            <td className="px-5 py-4 font-semibold">{paper.student_name ?? paper.student_id ?? "Sin identificar"}</td>
            <td className="px-5 py-4">{paper.score ?? "-"}/{paper.total ?? "-"}</td>
            <td className="px-5 py-4">
              <div className="flex flex-wrap gap-2">
                <StatusPill>{paper.status ?? "active"}</StatusPill>
                {hasSheetMismatch(paper) ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Hoja de otro ensayo</span> : null}
              </div>
            </td>
            <td className="px-5 py-4 text-[#5b6472]">{paper.storage_path || paper.image_url ? "Privada" : "-"}</td>
            <td className="px-5 py-4 text-[#5b6472]">{new Date(paper.scanned_at).toLocaleString("es-CL")}</td>
            <td className="px-5 py-4 space-x-3">
              <Link href={`/dashboard/results/${paper.quiz_id}`} className="font-semibold underline">Resultado</Link>
              {paper.status === "manual_review" && (
                <Link href={`/dashboard/papers/${paper.id}`} className="font-semibold text-amber-700 underline">Identificar alumno</Link>
              )}
            </td>
          </tr>
        )}
        renderMobileRow={(paper) => (
          <article key={paper.id} className="rounded-md border border-[#e6e8eb] bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-[#111827]">{paper.student_name ?? paper.student_id ?? "Sin identificar"}</p>
                <p className="mt-1 text-sm text-[#5b6472]">Puntaje: <span className="font-semibold text-[#111827]">{paper.score ?? "-"}/{paper.total ?? "-"}</span></p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <StatusPill>{paper.status ?? "active"}</StatusPill>
                {hasSheetMismatch(paper) ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Hoja de otro ensayo</span> : null}
              </div>
            </div>
            <div className="mt-3 grid gap-1 text-xs text-[#5b6472]">
              <p>Foto: {paper.storage_path || paper.image_url ? "Privada" : "-"}</p>
              <p>Fecha: {new Date(paper.scanned_at).toLocaleString("es-CL")}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <Link href={`/dashboard/results/${paper.quiz_id}`} className="font-semibold text-[#07305f] underline">Resultado</Link>
              {paper.status === "manual_review" && (
                <Link href={`/dashboard/papers/${paper.id}`} className="font-semibold text-amber-700 underline">Identificar alumno</Link>
              )}
            </div>
          </article>
        )}
      />
    </>
  );
}

function hasSheetMismatch(paper: PaperRow) {
  if (paper.status !== "manual_review") return false;
  if (typeof paper.sheet_code_read !== "number") return false;
  const quiz = Array.isArray(paper.quizzes) ? paper.quizzes[0] : paper.quizzes;
  const expected = quiz?.sheet_code;
  return typeof expected === "number" && paper.sheet_code_read !== expected;
}
